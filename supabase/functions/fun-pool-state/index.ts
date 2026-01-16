import { corsHeaders, GRADUATION_THRESHOLD_SOL, TOTAL_SUPPLY } from './constants.ts';
import { fetchHolderCount } from './helius.ts';
import { safeNumber } from './utils.ts';

const INITIAL_VIRTUAL_SOL = 30;

// Decode Meteora DBC virtualPool account data from on-chain
// Using the exact layout from the SDK IDL
function decodePoolReserves(base64Data: string): {
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
} | null {
  try {
    // Decode base64 to bytes
    const binaryString = atob(base64Data);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }

    // VirtualPool struct layout (from Meteora SDK IDL):
    // 8 bytes: Anchor discriminator
    // VolatilityTracker: 64 bytes (u64 + u8[8] + u128*3)
    // config: 32 bytes (pubkey)
    // creator: 32 bytes (pubkey)
    // baseMint: 32 bytes (pubkey)
    // baseVault: 32 bytes (pubkey)
    // quoteVault: 32 bytes (pubkey)
    // baseReserve: 8 bytes (u64) - virtual token reserves
    // quoteReserve: 8 bytes (u64) - virtual SOL reserves

    // Offset = 8 + 64 + 32*5 = 232
    const BASE_RESERVE_OFFSET = 232; // baseReserve (virtual tokens)
    const QUOTE_RESERVE_OFFSET = 240; // quoteReserve (virtual SOL)

    if (buffer.length < QUOTE_RESERVE_OFFSET + 8) {
      console.warn('[fun-pool-state] Buffer too small:', buffer.length);
      return null;
    }

    // Read u64 values (little-endian)
    const dataView = new DataView(buffer.buffer);
    const baseReserve = dataView.getBigUint64(BASE_RESERVE_OFFSET, true);
    const quoteReserve = dataView.getBigUint64(QUOTE_RESERVE_OFFSET, true);

    // Convert to human-readable values
    // SOL has 9 decimals, tokens have 6 decimals
    const virtualSolReserves = Number(quoteReserve) / 1e9;
    const virtualTokenReserves = Number(baseReserve) / 1e6;

    // Calculate real SOL reserves (SOL deposited by traders)
    const realSolReserves = Math.max(0, virtualSolReserves - INITIAL_VIRTUAL_SOL);

    // Sanity check
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

// Fetch pool state directly from Helius RPC (on-chain data)
async function fetchFromHeliusRpc(poolAddress: string, heliusRpcUrl: string): Promise<{
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
    const timeout = setTimeout(() => controller.abort(), 10000);

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

    const base64Data = accountData[0];
    const reserves = decodePoolReserves(base64Data);

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
    let tokenId = url.searchParams.get('tokenId');

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      poolAddress = poolAddress || body.pool || body.poolAddress || null;
      tokenId = tokenId || body.tokenId || null;
    }

    if (!poolAddress && !tokenId) {
      return new Response(JSON.stringify({ error: 'pool or tokenId required' }), {
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

    // If we only have tokenId, we need to look up the pool address from DB
    // For now, require poolAddress directly
    if (!poolAddress) {
      return new Response(JSON.stringify({ error: 'pool address required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Fetch live data from Helius RPC
    const rpcData = await fetchFromHeliusRpc(poolAddress, heliusRpcUrl);

    if (!rpcData) {
      // Return defaults if RPC fails
      return new Response(
        JSON.stringify({
          priceSol: 0.00000003,
          marketCapSol: 30,
          holderCount: 0,
          bondingProgress: 0,
          realSolReserves: 0,
          virtualSolReserves: 30,
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

    // Holder count would require the mint address - skip for now
    const holderCount = 0;

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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
