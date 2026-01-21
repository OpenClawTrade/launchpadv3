import { corsHeaders, GRADUATION_THRESHOLD_SOL, TOTAL_SUPPLY } from './constants.ts';
import { fetchHolderCount } from './helius.ts';

const INITIAL_VIRTUAL_SOL = 30;
const REQUEST_TIMEOUT_MS = 8000;

// Server-side cache to reduce RPC calls - 60 second TTL
const poolStateCache = new Map<string, { data: any; timestamp: number }>();
const POOL_CACHE_TTL = 60000; // 60 seconds cache

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

    // Check server-side cache first (60s TTL)
    const cacheKey = `${poolAddress}:${mintAddress || ''}`;
    const cached = poolStateCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < POOL_CACHE_TTL) {
      console.log('[fun-pool-state] Returning cached data for pool:', poolAddress);
      return new Response(JSON.stringify({ ...cached.data, source: 'cache' }), {
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

    // Cache the result for 60 seconds
    poolStateCache.set(cacheKey, { data: poolState, timestamp: Date.now() });

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
