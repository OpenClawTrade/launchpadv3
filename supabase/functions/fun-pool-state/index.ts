import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface PoolState {
  priceSol: number;
  marketCapSol: number;
  holderCount: number;
  bondingProgress: number;
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  isGraduated: boolean;
  volume24h: number;
}

const DBC_API_URL = 'https://dbc-api.meteora.ag';
const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD_SOL = 85;

function safeNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function computeState(params: {
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  volume24h: number;
}): PoolState {
  const { realSolReserves, virtualSolReserves, virtualTokenReserves, volume24h } = params;

  const priceSol = virtualTokenReserves > 0 ? virtualSolReserves / virtualTokenReserves : 0;
  const marketCapSol = priceSol * TOTAL_SUPPLY;
  const bondingProgress = Math.min((realSolReserves / GRADUATION_THRESHOLD_SOL) * 100, 100);

  return {
    priceSol: priceSol || 0.00000003,
    marketCapSol: marketCapSol || 30,
    holderCount: 0,
    bondingProgress: bondingProgress || 0,
    realSolReserves: realSolReserves || 0,
    virtualSolReserves: virtualSolReserves || 30,
    virtualTokenReserves: virtualTokenReserves || TOTAL_SUPPLY,
    isGraduated: bondingProgress >= 100,
    volume24h: volume24h || 0,
  };
}

async function fetchPoolFromMeteora(dbcPool: string): Promise<{
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
} | null> {
  try {
    const resp = await fetch(`${DBC_API_URL}/pools/${dbcPool}`, {
      headers: { Accept: 'application/json' },
    });

    if (!resp.ok) {
      console.warn('[fun-pool-state] DBC API not ok:', resp.status);
      return null;
    }

    const data = await resp.json();

    // Meteora responses are not perfectly consistent across versions; support common shapes.
    // Preferred keys (used in pool-state): *_sol_reserves / *_token_reserves.
    const realSolLamports =
      safeNumber(data.real_sol_reserves ?? data.real_quote_amount ?? data.real_quote_reserves ?? 0);
    const virtualSolLamports =
      safeNumber(data.virtual_sol_reserves ?? data.virtual_quote_amount ?? data.virtual_quote_reserves ?? 0);
    const virtualTokenRaw =
      safeNumber(data.virtual_token_reserves ?? data.virtual_base_amount ?? data.virtual_base_reserves ?? 0);

    // Fun tokens use SOL (9 decimals) and token decimals (6)
    const realSolReserves = realSolLamports / 1e9;
    const virtualSolReserves = virtualSolLamports / 1e9;
    const virtualTokenReserves = virtualTokenRaw / 1e6;

    // Basic sanity: virtual reserves should be positive
    if (virtualSolReserves <= 0 || virtualTokenReserves <= 0) {
      console.warn('[fun-pool-state] DBC API returned non-positive reserves', {
        virtualSolReserves,
        virtualTokenReserves,
      });
      return null;
    }

    return { realSolReserves, virtualSolReserves, virtualTokenReserves };
  } catch (e) {
    console.warn('[fun-pool-state] DBC API fetch error:', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Accept both GET query params and POST body so web + server SDK invocations are reliable.
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to resolve token (for volume_24h and fallback values)
    let token: any = null;
    if (tokenId) {
      const { data, error } = await supabase.from('fun_tokens').select('*').eq('id', tokenId).single();
      if (!error && data) token = data;
    } else if (poolAddress) {
      const { data, error } = await supabase
        .from('fun_tokens')
        .select('*')
        .eq('dbc_pool_address', poolAddress)
        .single();
      if (!error && data) token = data;
    }

    const dbcPool = poolAddress || token?.dbc_pool_address;

    // 1) Preferred: Meteora DBC API (most reliable, avoids brittle account decoding)
    let stateFromApi: { realSolReserves: number; virtualSolReserves: number; virtualTokenReserves: number } | null =
      null;
    if (dbcPool) {
      console.log('[fun-pool-state] Fetching DBC state for:', dbcPool);
      stateFromApi = await fetchPoolFromMeteora(dbcPool);
    }

    // 2) Compute final response (fallback to last-known DB values)
    const fallbackPrice = safeNumber(token?.price_sol) || 0.00000003;
    const fallbackMarketCap = fallbackPrice * TOTAL_SUPPLY || 30;

    const poolState = stateFromApi
      ? computeState({
          ...stateFromApi,
          volume24h: safeNumber(token?.volume_24h_sol) || 0,
        })
      : {
          priceSol: fallbackPrice,
          marketCapSol: fallbackMarketCap,
          holderCount: 0,
          bondingProgress: 0,
          realSolReserves: 0,
          virtualSolReserves: 30,
          virtualTokenReserves: TOTAL_SUPPLY,
          isGraduated: false,
          volume24h: safeNumber(token?.volume_24h_sol) || 0,
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
