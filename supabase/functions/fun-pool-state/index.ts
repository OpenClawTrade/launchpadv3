import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { corsHeaders, TOTAL_SUPPLY } from './constants.ts';
import { fetchHolderCount } from './helius.ts';
import { computeState, fetchPoolFromMeteora } from './meteora.ts';
import { safeNumber } from './utils.ts';

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

    // Try to resolve token (for mint, volume_24h, and fallback values)
    let token: any = null;
    if (tokenId) {
      const { data, error } = await supabase.from('fun_tokens').select('*').eq('id', tokenId).single();
      if (!error && data) token = data;
    } else if (poolAddress) {
      const { data, error } = await supabase.from('fun_tokens').select('*').eq('dbc_pool_address', poolAddress).single();
      if (!error && data) token = data;
    }

    const dbcPool = poolAddress || token?.dbc_pool_address;
    const mintAddress = token?.mint_address as string | null;

    // Fetch holder count from Helius (token accounts count).
    const heliusRpcUrl = Deno.env.get('HELIUS_RPC_URL') || '';

    // 1) Preferred: Meteora DBC API (most reliable, avoids brittle account decoding)
    // 2) Holder count from indexed RPC
    const [stateFromApi, holderCount] = await Promise.all([
      dbcPool ? fetchPoolFromMeteora(dbcPool) : Promise.resolve(null),
      mintAddress ? fetchHolderCount(mintAddress, heliusRpcUrl) : Promise.resolve(0),
    ]);

    // Fallbacks to last-known DB values
    const fallbackPrice = safeNumber(token?.price_sol) || 0.00000003;
    const fallbackMarketCap = fallbackPrice * TOTAL_SUPPLY || 30;
    const volume24h = safeNumber(token?.volume_24h_sol) || 0;

    const poolState = stateFromApi
      ? computeState({
          ...stateFromApi,
          volume24h,
          holderCount,
        })
      : {
          priceSol: fallbackPrice,
          marketCapSol: fallbackMarketCap,
          holderCount,
          bondingProgress: 0,
          realSolReserves: 0,
          virtualSolReserves: 30,
          virtualTokenReserves: TOTAL_SUPPLY,
          isGraduated: false,
          volume24h,
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
