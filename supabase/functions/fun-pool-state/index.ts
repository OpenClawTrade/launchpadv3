import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

interface PoolState {
  priceSol: number;
  marketCapSol: number;
  holderCount: number;
  bondingProgress: number;
  realSolReserves: number;
  virtualSolReserves: number;
  isGraduated: boolean;
  volume24h: number;
}

// DBC API base URL
const DBC_API_URL = 'https://dbc-api.meteora.ag';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const poolAddress = url.searchParams.get('pool');
    const tokenId = url.searchParams.get('tokenId');

    if (!poolAddress && !tokenId) {
      return new Response(
        JSON.stringify({ error: 'pool or tokenId required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[fun-pool-state] Fetching state for:', poolAddress || tokenId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get token from fun_tokens
    let token: any = null;
    if (tokenId) {
      const { data, error } = await supabase
        .from('fun_tokens')
        .select('*')
        .eq('id', tokenId)
        .single();
      
      if (error || !data) {
        console.error('[fun-pool-state] Token not found:', error);
        return new Response(
          JSON.stringify({ error: 'Token not found' }),
          { status: 404, headers: corsHeaders }
        );
      }
      token = data;
    } else if (poolAddress) {
      const { data, error } = await supabase
        .from('fun_tokens')
        .select('*')
        .eq('dbc_pool_address', poolAddress)
        .single();
      
      if (!error && data) {
        token = data;
      }
    }

    const dbcPool = poolAddress || token?.dbc_pool_address;
    
    // Default values from database
    let poolState: PoolState = {
      priceSol: token?.price_sol || 0.00000003,
      marketCapSol: 30,
      holderCount: 0,
      bondingProgress: 0,
      realSolReserves: 0,
      virtualSolReserves: 30,
      isGraduated: false,
      volume24h: token?.volume_24h_sol || 0,
    };

    if (dbcPool) {
      try {
        console.log('[fun-pool-state] Fetching from DBC API:', dbcPool);
        
        // Fetch pool data from Meteora DBC API
        const response = await fetch(`${DBC_API_URL}/pools/${dbcPool}`, {
          headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[fun-pool-state] DBC API response:', JSON.stringify(data).slice(0, 500));
          
          // Parse the pool data
          const realSol = parseFloat(data.real_base_amount || data.real_sol_reserves || 0) / 1e9;
          const virtualSol = parseFloat(data.virtual_base_amount || data.virtual_sol_reserves || 30e9) / 1e9;
          const virtualTokens = parseFloat(data.virtual_quote_amount || data.virtual_token_reserves || 1e15) / 1e6;
          
          // Calculate price: virtualSol / virtualTokens
          const priceSol = virtualTokens > 0 ? virtualSol / virtualTokens : 0.00000003;
          
          // Market cap: price * total supply (1B tokens)
          const totalSupply = 1_000_000_000;
          const marketCapSol = priceSol * totalSupply;
          
          // Bonding progress: realSol / graduation threshold (85 SOL for DBC)
          const graduationThreshold = 85;
          const bondingProgress = Math.min((realSol / graduationThreshold) * 100, 100);
          
          poolState = {
            priceSol,
            marketCapSol,
            holderCount: data.holder_count || 0,
            bondingProgress,
            realSolReserves: realSol,
            virtualSolReserves: virtualSol,
            isGraduated: bondingProgress >= 100,
            volume24h: token?.volume_24h_sol || 0,
          };

          // Update database if significant changes
          if (token?.id) {
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
            if (serviceKey) {
              const supabaseAdmin = createClient(supabaseUrl, serviceKey);
              await supabaseAdmin
                .from('fun_tokens')
                .update({
                  price_sol: priceSol,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', token.id);
            }
          }
        } else {
          console.warn('[fun-pool-state] DBC API error:', response.status, await response.text());
        }
      } catch (e) {
        console.error('[fun-pool-state] DBC fetch error:', e);
      }
    }

    console.log('[fun-pool-state] Returning:', {
      price: poolState.priceSol,
      progress: poolState.bondingProgress.toFixed(2),
      marketCap: poolState.marketCapSol.toFixed(2),
    });

    return new Response(
      JSON.stringify(poolState),
      { 
        status: 200, 
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=5', // Cache 5 seconds
        }
      }
    );
  } catch (error) {
    console.error('[fun-pool-state] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
