import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD_SOL = 85;
const INITIAL_VIRTUAL_SOL = 30;
const TOKEN_DECIMALS = 6;
const REQUEST_TIMEOUT_MS = 8000;

// Server-side cache to reduce RPC calls - 60 second TTL
const poolStateCache = new Map<string, { data: any; timestamp: number }>();
const POOL_CACHE_TTL = 60000; // 60 seconds cache
const HOLDER_CACHE_TTL = 60000; // 60 seconds for holder counts

// Holder count cache
const holderCache = new Map<string, { count: number; timestamp: number }>();

interface PoolState {
  realSolReserves: number;
  realTokenReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  bondingProgress: number;
  graduationThreshold: number;
  priceSol: number;
  marketCapSol: number;
  isGraduated: boolean;
  poolAddress: string;
  holderCount: number;
  source: string;
  mintAddress?: string;
}

function safeNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

// Decode Meteora DBC virtualPool account data from on-chain
function decodePoolReserves(base64Data: string): {
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  mintAddress?: string;
} | null {
  try {
    const binaryString = atob(base64Data);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }

    // Offset = 8 + 64 + 32*5 = 232 for baseReserve, 240 for quoteReserve
    const BASE_RESERVE_OFFSET = 232;
    const QUOTE_RESERVE_OFFSET = 240;
    const BASE_MINT_OFFSET = 136;

    if (buffer.length < QUOTE_RESERVE_OFFSET + 8) {
      console.warn('[pool-state] Buffer too small:', buffer.length);
      return null;
    }

    const dataView = new DataView(buffer.buffer);
    const baseReserve = dataView.getBigUint64(BASE_RESERVE_OFFSET, true);
    const quoteReserve = dataView.getBigUint64(QUOTE_RESERVE_OFFSET, true);

    // Read mint address
    let mintAddress: string | undefined;
    if (buffer.length >= BASE_MINT_OFFSET + 32) {
      const mintBytes = buffer.slice(BASE_MINT_OFFSET, BASE_MINT_OFFSET + 32);
      // Convert to base58 (simplified - just check if not all zeros)
      const isValid = mintBytes.some((b) => b !== 0);
      if (isValid) {
        // We'll get the mint from DB instead for accuracy
      }
    }

    // quoteReserve = accumulated SOL from trades (NOT total virtual SOL)
    // baseReserve = remaining token reserves
    const baseReserveNum = Number(baseReserve);
    // Detect token decimals: 9-decimal tokens have baseReserve > 1e17
    const tokenDecimals = baseReserveNum > 1e17 ? 9 : TOKEN_DECIMALS;
    const virtualTokenReserves = baseReserveNum / Math.pow(10, tokenDecimals);
    
    const accumulatedSol = Number(quoteReserve) / 1e9;
    const virtualSolReserves = INITIAL_VIRTUAL_SOL + accumulatedSol;
    const realSolReserves = accumulatedSol;

    if (virtualSolReserves <= 0 || virtualTokenReserves <= 0) {
      console.warn('[pool-state] Invalid reserves:', { virtualSolReserves, virtualTokenReserves });
      return null;
    }

    console.log('[pool-state] Decoded on-chain:', {
      virtualSolReserves: virtualSolReserves.toFixed(4),
      virtualTokenReserves: virtualTokenReserves.toFixed(0),
      realSolReserves: realSolReserves.toFixed(4),
      tokenDecimals,
    });

    return { realSolReserves, virtualSolReserves, virtualTokenReserves, mintAddress };
  } catch (e) {
    console.error('[pool-state] Decode error:', e);
    return null;
  }
}

// Fetch holder count from Helius DAS API with caching
async function fetchHolderCount(mintAddress: string, heliusRpcUrl: string): Promise<number> {
  if (!mintAddress || !heliusRpcUrl) return 0;

  // Check holder cache first
  const cached = holderCache.get(mintAddress);
  if (cached && Date.now() - cached.timestamp < HOLDER_CACHE_TTL) {
    return cached.count;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(heliusRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'holder-count',
        method: 'getTokenAccounts',
        params: {
          mint: mintAddress,
          limit: 1,
          page: 1,
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!resp.ok) {
      return cached?.count ?? 0;
    }

    const json = await resp.json();
    const total = safeNumber(json?.result?.total ?? 0);
    const count = total > 0 ? Math.floor(total) : 0;
    
    // Cache the result
    holderCache.set(mintAddress, { count, timestamp: Date.now() });
    return count;
  } catch {
    return cached?.count ?? 0;
  }
}

// Fetch pool state from Helius RPC
async function fetchFromHeliusRpc(
  poolAddress: string,
  heliusRpcUrl: string,
  mintAddress?: string
): Promise<PoolState | null> {
  try {
    console.log('[pool-state] Fetching from Helius RPC for pool:', poolAddress);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(heliusRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'pool-state',
        method: 'getAccountInfo',
        params: [poolAddress, { encoding: 'base64' }],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.warn('[pool-state] Helius RPC response not ok:', response.status);
      return null;
    }

    const json = await response.json();

    if (json.error) {
      console.warn('[pool-state] Helius RPC error:', json.error);
      return null;
    }

    const accountData = json.result?.value?.data;
    if (!accountData || !Array.isArray(accountData) || accountData.length < 1) {
      console.warn('[pool-state] No account data for pool:', poolAddress);
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

    // Fetch holder count if mint provided
    const holderCount = mintAddress ? await fetchHolderCount(mintAddress, heliusRpcUrl) : 0;

    console.log('[pool-state] Calculated:', {
      priceSol: priceSol.toExponential(4),
      marketCapSol: marketCapSol.toFixed(2),
      bondingProgress: bondingProgress.toFixed(2),
      holderCount,
    });

    return {
      realSolReserves,
      realTokenReserves: TOTAL_SUPPLY - virtualTokenReserves,
      virtualSolReserves,
      virtualTokenReserves,
      bondingProgress,
      graduationThreshold: GRADUATION_THRESHOLD_SOL,
      priceSol,
      marketCapSol,
      isGraduated: bondingProgress >= 100,
      poolAddress,
      holderCount,
      source: 'helius-rpc',
      mintAddress,
    };
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      console.error('[pool-state] Helius RPC error:', e);
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
    const mintAddress = url.searchParams.get('mint');
    const poolAddress = url.searchParams.get('pool');

    if (!mintAddress && !poolAddress) {
      return new Response(
        JSON.stringify({ error: 'mint or pool address required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check server-side cache first (60s TTL)
    const cacheKey = `${poolAddress || ''}:${mintAddress || ''}`;
    const cached = poolStateCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < POOL_CACHE_TTL) {
      console.log('[pool-state] Returning cached data');
      return new Response(JSON.stringify({ ...cached.data, source: 'cache' }), {
        status: 200,
        headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=60' },
      });
    }

    console.log('[pool-state] Fetching state for:', mintAddress || poolAddress);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const heliusRpcUrl = Deno.env.get('HELIUS_RPC_URL') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check fun_tokens first (primary table), fallback to tokens
    let token: any = null;
    if (mintAddress) {
      const { data } = await supabase
        .from('fun_tokens')
        .select('*')
        .eq('mint_address', mintAddress)
        .maybeSingle();
      token = data;
      
      // Fallback to tokens table if not found
      if (!token) {
        const { data: legacyData } = await supabase
          .from('tokens')
          .select('*')
          .eq('mint_address', mintAddress)
          .maybeSingle();
        token = legacyData;
      }
    }

    if (!token && poolAddress) {
      const { data } = await supabase
        .from('fun_tokens')
        .select('*')
        .eq('dbc_pool_address', poolAddress)
        .maybeSingle();
      token = data;
      
      if (!token) {
        const { data: legacyData } = await supabase
          .from('tokens')
          .select('*')
          .eq('dbc_pool_address', poolAddress)
          .maybeSingle();
        token = legacyData;
      }
    }

    const dbcPool = poolAddress || token?.dbc_pool_address;
    const dammPool = token?.damm_pool_address;
    const graduationThreshold = token?.graduation_threshold_sol || GRADUATION_THRESHOLD_SOL;
    const tokenMint = token?.mint_address || mintAddress;
    const isGraduated = token?.status === 'graduated' || !!dammPool;

    // For graduated tokens with DAMM pool
    if (isGraduated && dammPool) {
      console.log('[pool-state] Fetching DAMM pool:', dammPool);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const dammResponse = await fetch(`https://dammv2-api.meteora.ag/pools/${dammPool}`, {
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        if (dammResponse.ok) {
          const dammData = await dammResponse.json();
          const pool = dammData.data;

          const tokenBAmount = parseFloat(pool.token_b_amount || 0) / 1e9;
          const tvl = parseFloat(pool.tvl || 0);
          const holderCount = tokenMint && heliusRpcUrl
            ? await fetchHolderCount(tokenMint, heliusRpcUrl)
            : token?.holder_count || 0;

          const poolState: PoolState = {
            realSolReserves: graduationThreshold,
            realTokenReserves: 0,
            virtualSolReserves: 0,
            virtualTokenReserves: 0,
            bondingProgress: 100,
            graduationThreshold,
            priceSol: parseFloat(pool.pool_price || token?.price_sol || 0),
            marketCapSol: tvl,
            isGraduated: true,
            poolAddress: dammPool,
            holderCount,
            source: 'damm-api',
            mintAddress: tokenMint,
          };

          // Cache DAMM result for 60 seconds
          poolStateCache.set(cacheKey, { data: poolState, timestamp: Date.now() });

          return new Response(JSON.stringify(poolState), {
            status: 200,
            headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=60' },
          });
        }
      } catch (e) {
        console.warn('[pool-state] DAMM API error:', e);
      }
    }

    // For bonding curve tokens - fetch from Helius RPC
    if (dbcPool && heliusRpcUrl) {
      const rpcState = await fetchFromHeliusRpc(dbcPool, heliusRpcUrl, tokenMint);

      if (rpcState) {
        // Cache the result for 60 seconds
        poolStateCache.set(cacheKey, { data: rpcState, timestamp: Date.now() });

        // Update database in background
        if (token?.id) {
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          if (serviceKey) {
            const supabaseAdmin = createClient(supabaseUrl, serviceKey);
            supabaseAdmin
              .from('tokens')
              .update({
                real_sol_reserves: rpcState.realSolReserves,
                virtual_sol_reserves: rpcState.virtualSolReserves,
                virtual_token_reserves: rpcState.virtualTokenReserves,
                bonding_curve_progress: rpcState.bondingProgress / 100,
                price_sol: rpcState.priceSol,
                market_cap_sol: rpcState.marketCapSol,
                holder_count: rpcState.holderCount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', token.id)
              .then(() => console.log('[pool-state] Updated DB'));

            // Always sync fun_tokens with latest data (active or graduated)
            supabaseAdmin
              .from('fun_tokens')
              .update({
                price_sol: rpcState.priceSol,
                market_cap_sol: rpcState.marketCapSol,
                bonding_progress: rpcState.isGraduated ? 100 : rpcState.bondingProgress,
                holder_count: rpcState.holderCount,
                ...(rpcState.isGraduated ? { status: 'graduated' } : {}),
                updated_at: new Date().toISOString(),
              })
              .eq('dbc_pool_address', dbcPool)
              .then(({ error }) => {
                if (!error) console.log('[pool-state] Synced fun_token data for pool:', dbcPool);
              });
          }
        }

        return new Response(JSON.stringify(rpcState), {
          status: 200,
          headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=60' },
        });
      }
    }

    // Fallback to database values
    console.log('[pool-state] Using database fallback');

    const realSol = token?.real_sol_reserves || 0;
    const virtualSol = token?.virtual_sol_reserves || INITIAL_VIRTUAL_SOL;
    const virtualTokens = token?.virtual_token_reserves || TOTAL_SUPPLY;
    const priceSol = virtualTokens > 0 ? virtualSol / virtualTokens : 0;
    const progress = graduationThreshold > 0 ? (realSol / graduationThreshold) * 100 : 0;

    const poolState: PoolState = {
      realSolReserves: realSol,
      realTokenReserves: token?.real_token_reserves || 0,
      virtualSolReserves: virtualSol,
      virtualTokenReserves: virtualTokens,
      bondingProgress: Math.min(progress, 100),
      graduationThreshold,
      priceSol: token?.price_sol || priceSol,
      marketCapSol: token?.market_cap_sol || priceSol * TOTAL_SUPPLY,
      isGraduated: token?.status === 'graduated' || progress >= 100,
      poolAddress: dbcPool || '',
      holderCount: token?.holder_count || 0,
      source: 'database',
      mintAddress: tokenMint,
    };

    // Cache the fallback result too
    poolStateCache.set(cacheKey, { data: poolState, timestamp: Date.now() });

    return new Response(JSON.stringify(poolState), {
      status: 200,
      headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=60' },
    });
  } catch (error) {
    console.error('[pool-state] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
