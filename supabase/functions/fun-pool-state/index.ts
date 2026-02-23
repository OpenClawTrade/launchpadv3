import { corsHeaders, GRADUATION_THRESHOLD_SOL, TOTAL_SUPPLY } from './constants.ts';
import { fetchHolderCount } from './helius.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const INITIAL_VIRTUAL_SOL = 30;
const REQUEST_TIMEOUT_MS = 8000;
const POOL_CACHE_TTL_SECONDS = 60; // 60 seconds cache

// Create Supabase client for database-backed caching
function getSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  return createClient(url, key);
}

// Decode Meteora DBC virtualPool account data from on-chain
// Supports both 6-decimal (legacy) and 9-decimal (new) tokens
function decodePoolReserves(base64Data: string): {
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  tokenDecimals: number;
} | null {
  try {
    const binaryString = atob(base64Data);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }

    if (buffer.length < 248) {
      console.warn('[fun-pool-state] Buffer too small:', buffer.length);
      return null;
    }

    const dataView = new DataView(buffer.buffer);
    
    // Meteora DBC VirtualPool: base_reserve at 232, quote_reserve at 240
    const baseReserve = dataView.getBigUint64(232, true);
    const quoteReserve = dataView.getBigUint64(240, true);
    
    // Try to detect token decimals from reserve magnitude
    // 9-decimal tokens: baseReserve is ~1e18 for 1B supply
    // 6-decimal tokens: baseReserve is ~1e15 for 1B supply
    // We use a heuristic: if baseReserve > 1e17, assume 9 decimals
    const baseReserveNum = Number(baseReserve);
    const tokenDecimals = baseReserveNum > 1e17 ? 9 : 6;
    
    // Token reserves (dynamic decimals)
    const virtualTokenReserves = baseReserveNum / Math.pow(10, tokenDecimals);
    
    // Quote reserve tracks SOL from trades (lamports)
    // Virtual SOL = initial 30 SOL + accumulated from trades
    const accumulatedSol = Number(quoteReserve) / 1e9;
    const virtualSolReserves = INITIAL_VIRTUAL_SOL + accumulatedSol;
    const realSolReserves = accumulatedSol;

    console.log('[fun-pool-state] Decoded:', {
      tokens: virtualTokenReserves.toFixed(0),
      virtualSol: virtualSolReserves.toFixed(4),
      realSol: realSolReserves.toFixed(4),
      tokenDecimals,
    });

    return { realSolReserves, virtualSolReserves, virtualTokenReserves, tokenDecimals };
  } catch (e) {
    console.error('[fun-pool-state] Decode error:', e);
    return null;
  }
}

// Check database cache for pool state
async function getCachedPoolState(poolAddress: string): Promise<any | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('pool_state_cache')
      .select('*')
      .eq('pool_address', poolAddress)
      .maybeSingle();

    if (error || !data) return null;

    // Check if cache is still valid (60 seconds TTL)
    const updatedAt = new Date(data.updated_at);
    const ageSeconds = (Date.now() - updatedAt.getTime()) / 1000;
    
    if (ageSeconds > POOL_CACHE_TTL_SECONDS) {
      console.log('[fun-pool-state] Cache expired for pool:', poolAddress, `(${ageSeconds.toFixed(0)}s old)`);
      return null;
    }

    console.log('[fun-pool-state] Cache HIT for pool:', poolAddress, `(${ageSeconds.toFixed(0)}s old)`);
    return {
      priceSol: Number(data.price_sol),
      marketCapSol: Number(data.market_cap_sol),
      holderCount: data.holder_count || 0,
      bondingProgress: Number(data.bonding_progress),
      realSolReserves: Number(data.real_sol_reserves),
      virtualSolReserves: Number(data.virtual_sol_reserves),
      virtualTokenReserves: Number(data.virtual_token_reserves),
      isGraduated: data.is_graduated || false,
    };
  } catch (e) {
    console.error('[fun-pool-state] Cache read error:', e);
    return null;
  }
}

// Save pool state to database cache
async function setCachedPoolState(poolAddress: string, mintAddress: string | null, poolState: any): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from('pool_state_cache')
      .upsert({
        pool_address: poolAddress,
        mint_address: mintAddress,
        price_sol: poolState.priceSol,
        market_cap_sol: poolState.marketCapSol,
        holder_count: poolState.holderCount || 0,
        bonding_progress: poolState.bondingProgress,
        real_sol_reserves: poolState.realSolReserves,
        virtual_sol_reserves: poolState.virtualSolReserves,
        virtual_token_reserves: poolState.virtualTokenReserves,
        is_graduated: poolState.isGraduated || false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'pool_address' });
    
    console.log('[fun-pool-state] Cache WRITE for pool:', poolAddress);
  } catch (e) {
    console.error('[fun-pool-state] Cache write error:', e);
    // Don't throw - cache write failure shouldn't break the response
  }
}

// Fetch pool state directly from Helius RPC
async function fetchFromHeliusRpc(
  poolAddress: string,
  heliusRpcUrl: string
): Promise<{
  priceSol: number;
  marketCapSol: number;
  bondingProgress: number;
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  isGraduated: boolean;
} | null> {
  try {
    console.log('[fun-pool-state] Fetching from Helius RPC for pool:', poolAddress);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(heliusRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'fun-pool-state',
        method: 'getAccountInfo',
        params: [poolAddress, { encoding: 'base64' }],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.warn('[fun-pool-state] Helius RPC response not ok:', response.status);
      return null;
    }

    const json = await response.json();

    if (json.error) {
      console.warn('[fun-pool-state] Helius RPC error:', json.error);
      return null;
    }

    const accountData = json.result?.value?.data;
    if (!accountData || !Array.isArray(accountData) || accountData.length < 1) {
      console.warn('[fun-pool-state] No account data returned for pool:', poolAddress);
      return null;
    }

    const reserves = decodePoolReserves(accountData[0]);
    if (!reserves) {
      return null;
    }

    const { realSolReserves, virtualSolReserves, virtualTokenReserves } = reserves;

    const priceSol = virtualTokenReserves > 0 ? virtualSolReserves / virtualTokenReserves : 0;
    const marketCapSol = priceSol * TOTAL_SUPPLY;
    const bondingProgress = Math.min((realSolReserves / GRADUATION_THRESHOLD_SOL) * 100, 100);

    console.log('[fun-pool-state] Calculated:', {
      priceSol: priceSol.toExponential(4),
      marketCapSol: marketCapSol.toFixed(2),
      bondingProgress: bondingProgress.toFixed(2),
    });

    return {
      priceSol,
      marketCapSol,
      bondingProgress,
      realSolReserves,
      virtualSolReserves,
      virtualTokenReserves,
      isGraduated: bondingProgress >= 100,
    };
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      console.error('[fun-pool-state] Helius RPC fetch error:', e);
    }
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Accept both GET query params and POST body
    let poolAddress = url.searchParams.get('pool');
    let mintAddress = url.searchParams.get('mint');

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      poolAddress = poolAddress || body.pool || body.poolAddress || null;
      mintAddress = mintAddress || body.mint || body.mintAddress || null;
    }

    if (!poolAddress) {
      return new Response(JSON.stringify({ error: 'pool address required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate pool address format
    if (poolAddress.length < 32 || poolAddress.length > 44) {
      return new Response(JSON.stringify({ error: 'Invalid pool address format' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Check DATABASE cache first (persists across cold starts)
    const cached = await getCachedPoolState(poolAddress);
    if (cached) {
      return new Response(JSON.stringify({ ...cached, volume24h: 0, source: 'db-cache' }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=60',
        },
      });
    }

    const heliusRpcUrl = Deno.env.get('HELIUS_RPC_URL') || '';

    if (!heliusRpcUrl) {
      console.error('[fun-pool-state] HELIUS_RPC_URL not configured');
      return new Response(JSON.stringify({ error: 'RPC not configured' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Fetch live data from Helius RPC
    const rpcData = await fetchFromHeliusRpc(poolAddress, heliusRpcUrl);

    if (!rpcData) {
      // Return defaults if RPC fails
      console.warn('[fun-pool-state] RPC failed, returning defaults');
      return new Response(
        JSON.stringify({
          priceSol: 0.00000003,
          marketCapSol: 30,
          holderCount: 0,
          bondingProgress: 0,
          realSolReserves: 0,
          virtualSolReserves: INITIAL_VIRTUAL_SOL,
          virtualTokenReserves: TOTAL_SUPPLY,
          isGraduated: false,
          volume24h: 0,
          source: 'default',
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=5',
          },
        }
      );
    }

    // Fetch holder count if mint address provided
    let holderCount = 0;
    if (mintAddress) {
      holderCount = await fetchHolderCount(mintAddress, heliusRpcUrl);
    }

    const poolState = {
      priceSol: rpcData.priceSol,
      marketCapSol: rpcData.marketCapSol,
      holderCount,
      bondingProgress: rpcData.bondingProgress,
      realSolReserves: rpcData.realSolReserves,
      virtualSolReserves: rpcData.virtualSolReserves,
      virtualTokenReserves: rpcData.virtualTokenReserves,
      isGraduated: rpcData.isGraduated,
      volume24h: 0,
      source: 'helius-rpc',
    };

    // Save to DATABASE cache (persists across cold starts)
    await setCachedPoolState(poolAddress, mintAddress, poolState);

    // Always sync price/mcap/holders to fun_tokens DB (for both active and graduated tokens)
    try {
      const supabase = getSupabaseClient();
      const { data: tokenRecord } = await supabase
        .from('fun_tokens')
        .select('id, status, ticker')
        .eq('dbc_pool_address', poolAddress)
        .maybeSingle();

      if (tokenRecord) {
        const updatePayload: Record<string, any> = {
          price_sol: rpcData.priceSol,
          market_cap_sol: rpcData.marketCapSol,
          bonding_progress: rpcData.bondingProgress,
          holder_count: holderCount,
          updated_at: new Date().toISOString(),
        };

        // Auto-graduate if needed
        if (rpcData.isGraduated && tokenRecord.status === 'active') {
          updatePayload.status = 'graduated';
          updatePayload.bonding_progress = 100;
          console.log(`[fun-pool-state] 🎓 Auto-graduating token: $${tokenRecord.ticker} (${tokenRecord.id})`);
        }

        await supabase
          .from('fun_tokens')
          .update(updatePayload)
          .eq('id', tokenRecord.id);
      }
    } catch (e) {
      console.error('[fun-pool-state] DB sync error:', e);
    }

    console.log('[fun-pool-state] Returning fresh data:', {
      price: poolState.priceSol,
      progress: poolState.bondingProgress,
      marketCap: poolState.marketCapSol,
      holderCount: poolState.holderCount,
    });

    return new Response(JSON.stringify(poolState), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    console.error('[fun-pool-state] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
