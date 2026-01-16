import { corsHeaders, GRADUATION_THRESHOLD_SOL, TOTAL_SUPPLY } from './constants.ts';
import { fetchHolderCount } from './helius.ts';

const INITIAL_VIRTUAL_SOL = 30;
const TOKEN_DECIMALS = 6;
const REQUEST_TIMEOUT_MS = 8000;

// Decode Meteora DBC virtualPool account data from on-chain
function decodePoolReserves(base64Data: string): {
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
} | null {
  try {
    const binaryString = atob(base64Data);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }

    // VirtualPool struct layout:
    // 8 bytes: Anchor discriminator
    // 64 bytes: VolatilityTracker
    // 32*5 bytes: config, creator, baseMint, baseVault, quoteVault
    // baseReserve: 8 bytes (u64) at offset 232
    // quoteReserve: 8 bytes (u64) at offset 240
    const BASE_RESERVE_OFFSET = 232;
    const QUOTE_RESERVE_OFFSET = 240;

    if (buffer.length < QUOTE_RESERVE_OFFSET + 8) {
      console.warn('[fun-pool-state] Buffer too small:', buffer.length);
      return null;
    }

    const dataView = new DataView(buffer.buffer);
    const baseReserve = dataView.getBigUint64(BASE_RESERVE_OFFSET, true);
    const quoteReserve = dataView.getBigUint64(QUOTE_RESERVE_OFFSET, true);

    const virtualSolReserves = Number(quoteReserve) / 1e9;
    const virtualTokenReserves = Number(baseReserve) / Math.pow(10, TOKEN_DECIMALS);
    const realSolReserves = Math.max(0, virtualSolReserves - INITIAL_VIRTUAL_SOL);

    if (virtualSolReserves <= 0 || virtualTokenReserves <= 0) {
      console.warn('[fun-pool-state] Invalid reserves:', { virtualSolReserves, virtualTokenReserves });
      return null;
    }

    console.log('[fun-pool-state] Decoded on-chain:', {
      virtualSolReserves: virtualSolReserves.toFixed(4),
      virtualTokenReserves: virtualTokenReserves.toFixed(0),
      realSolReserves: realSolReserves.toFixed(4),
    });

    return { realSolReserves, virtualSolReserves, virtualTokenReserves };
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

    console.log('[fun-pool-state] Returning:', {
      price: poolState.priceSol,
      progress: poolState.bondingProgress,
      marketCap: poolState.marketCapSol,
      holderCount: poolState.holderCount,
    });

    return new Response(JSON.stringify(poolState), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=2',
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
