import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

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
  tokenBAmount?: number;
  tvl?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    console.log('[pool-state] Fetching state for:', mintAddress || poolAddress);

    // Get Supabase client to fetch token info
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get token from database first
    let token: any = null;
    if (mintAddress) {
      const { data, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('mint_address', mintAddress)
        .single();
      
      if (error || !data) {
        console.error('[pool-state] Token not found:', error);
        return new Response(
          JSON.stringify({ error: 'Token not found' }),
          { status: 404, headers: corsHeaders }
        );
      }
      token = data;
    }

    const dbcPool = poolAddress || token?.dbc_pool_address;
    const dammPool = token?.damm_pool_address;
    const graduationThreshold = token?.graduation_threshold_sol || 85;

    // Check if graduated - use DAMM pool if available
    const isGraduated = token?.status === 'graduated' || !!dammPool;

    let poolState: PoolState;

    if (isGraduated && dammPool) {
      // Fetch from DAMM V2 API for graduated tokens
      console.log('[pool-state] Fetching DAMM pool:', dammPool);
      
      try {
        const dammResponse = await fetch(`https://dammv2-api.meteora.ag/pools/${dammPool}`);
        
        if (dammResponse.ok) {
          const dammData = await dammResponse.json();
          const pool = dammData.data;
          
          // DAMM pool returns token amounts directly
          const tokenBAmount = parseFloat(pool.token_b_amount || 0) / 1e9; // SOL decimals
          const tvl = parseFloat(pool.tvl || 0);
          
          poolState = {
            realSolReserves: graduationThreshold, // Already graduated
            realTokenReserves: 0,
            virtualSolReserves: 0,
            virtualTokenReserves: 0,
            bondingProgress: 100,
            graduationThreshold,
            priceSol: parseFloat(pool.pool_price || token?.price_sol || 0),
            marketCapSol: tvl,
            isGraduated: true,
            poolAddress: dammPool,
            tokenBAmount,
            tvl,
          };
        } else {
          // Fallback to database values
          poolState = {
            realSolReserves: token?.real_sol_reserves || 0,
            realTokenReserves: token?.real_token_reserves || 0,
            virtualSolReserves: token?.virtual_sol_reserves || 0,
            virtualTokenReserves: token?.virtual_token_reserves || 0,
            bondingProgress: 100,
            graduationThreshold,
            priceSol: token?.price_sol || 0,
            marketCapSol: token?.market_cap_sol || 0,
            isGraduated: true,
            poolAddress: dammPool,
          };
        }
      } catch (e) {
        console.error('[pool-state] DAMM API error:', e);
        // Fallback to database
        poolState = {
          realSolReserves: graduationThreshold,
          realTokenReserves: 0,
          virtualSolReserves: 0,
          virtualTokenReserves: 0,
          bondingProgress: 100,
          graduationThreshold,
          priceSol: token?.price_sol || 0,
          marketCapSol: token?.market_cap_sol || 0,
          isGraduated: true,
          poolAddress: dammPool,
        };
      }
    } else if (dbcPool) {
      // Fetch DBC pool state from Meteora DBC API
      console.log('[pool-state] Fetching DBC pool:', dbcPool);
      
      try {
        // Try to get pool data from Meteora's DBC API
        // The DBC SDK uses on-chain data, but we can approximate via Meteora's indexer
        const dbcResponse = await fetch(`https://dbc-api.meteora.ag/pools/${dbcPool}`);
        
        if (dbcResponse.ok) {
          const dbcData = await dbcResponse.json();
          
          const realSol = parseFloat(dbcData.real_sol_reserves || 0) / 1e9;
          const realTokens = parseFloat(dbcData.real_token_reserves || 0) / 1e6;
          const virtualSol = parseFloat(dbcData.virtual_sol_reserves || 0) / 1e9;
          const virtualTokens = parseFloat(dbcData.virtual_token_reserves || 0) / 1e6;
          
          const progress = graduationThreshold > 0 
            ? (realSol / graduationThreshold) * 100 
            : 0;
          
          const priceSol = virtualTokens > 0 ? virtualSol / virtualTokens : 0;
          const totalSupply = token?.total_supply || 1_000_000_000;
          const marketCapSol = priceSol * totalSupply;
          
          poolState = {
            realSolReserves: realSol,
            realTokenReserves: realTokens,
            virtualSolReserves: virtualSol,
            virtualTokenReserves: virtualTokens,
            bondingProgress: Math.min(progress, 100),
            graduationThreshold,
            priceSol,
            marketCapSol,
            isGraduated: progress >= 100,
            poolAddress: dbcPool,
          };
        } else {
          // DBC API didn't respond - fall back to database with Helius RPC check
          console.log('[pool-state] DBC API unavailable, using database values');
          
          // Try direct RPC call if Helius is configured
          const heliusRpcUrl = Deno.env.get('HELIUS_RPC_URL');
          if (heliusRpcUrl && dbcPool) {
            try {
              // Fetch account info directly from Solana
              const rpcResponse = await fetch(heliusRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'getAccountInfo',
                  params: [
                    dbcPool,
                    { encoding: 'base64' }
                  ]
                })
              });
              
              if (rpcResponse.ok) {
                const rpcData = await rpcResponse.json();
                if (rpcData.result?.value?.data) {
                  // The pool account data contains reserves in a specific layout
                  // For now, log it - decoding would require the exact layout
                  console.log('[pool-state] Got RPC account data for pool');
                }
              }
            } catch (rpcError) {
              console.warn('[pool-state] RPC fetch failed:', rpcError);
            }
          }
          
          // Use database values as fallback
          const realSol = token?.real_sol_reserves || 0;
          const progress = graduationThreshold > 0 
            ? (realSol / graduationThreshold) * 100 
            : 0;
          
          poolState = {
            realSolReserves: realSol,
            realTokenReserves: token?.real_token_reserves || 0,
            virtualSolReserves: token?.virtual_sol_reserves || 0,
            virtualTokenReserves: token?.virtual_token_reserves || 0,
            bondingProgress: Math.min(progress, 100),
            graduationThreshold,
            priceSol: token?.price_sol || 0,
            marketCapSol: token?.market_cap_sol || 0,
            isGraduated: progress >= 100,
            poolAddress: dbcPool,
          };
        }
      } catch (e) {
        console.error('[pool-state] DBC fetch error:', e);
        // Fallback to database
        const realSol = token?.real_sol_reserves || 0;
        const progress = graduationThreshold > 0 
          ? (realSol / graduationThreshold) * 100 
          : 0;
        
        poolState = {
          realSolReserves: realSol,
          realTokenReserves: token?.real_token_reserves || 0,
          virtualSolReserves: token?.virtual_sol_reserves || 0,
          virtualTokenReserves: token?.virtual_token_reserves || 0,
          bondingProgress: Math.min(progress, 100),
          graduationThreshold,
          priceSol: token?.price_sol || 0,
          marketCapSol: token?.market_cap_sol || 0,
          isGraduated: progress >= 100,
          poolAddress: dbcPool || '',
        };
      }
    } else {
      // No pool address - use database values
      const realSol = token?.real_sol_reserves || 0;
      const progress = graduationThreshold > 0 
        ? (realSol / graduationThreshold) * 100 
        : 0;
      
      poolState = {
        realSolReserves: realSol,
        realTokenReserves: token?.real_token_reserves || 0,
        virtualSolReserves: token?.virtual_sol_reserves || 0,
        virtualTokenReserves: token?.virtual_token_reserves || 0,
        bondingProgress: Math.min(progress, 100),
        graduationThreshold,
        priceSol: token?.price_sol || 0,
        marketCapSol: token?.market_cap_sol || 0,
        isGraduated: false,
        poolAddress: '',
      };
    }

    // Update database if values differ significantly (optional sync)
    const dbProgress = token?.bonding_curve_progress || 0;
    const liveProgress = poolState.bondingProgress;
    
    if (Math.abs(dbProgress * 100 - liveProgress) > 1) {
      console.log('[pool-state] Updating database with live values');
      // Use service key for updates
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (serviceKey && token?.id) {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey);
        await supabaseAdmin
          .from('tokens')
          .update({
            real_sol_reserves: poolState.realSolReserves,
            real_token_reserves: poolState.realTokenReserves,
            virtual_sol_reserves: poolState.virtualSolReserves,
            virtual_token_reserves: poolState.virtualTokenReserves,
            bonding_curve_progress: poolState.bondingProgress / 100,
            price_sol: poolState.priceSol,
            market_cap_sol: poolState.marketCapSol,
          })
          .eq('id', token.id);
      }
    }

    console.log('[pool-state] Returning state:', {
      bondingProgress: poolState.bondingProgress.toFixed(2),
      realSol: poolState.realSolReserves.toFixed(4),
      isGraduated: poolState.isGraduated,
    });

    return new Response(
      JSON.stringify(poolState),
      { 
        status: 200, 
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=10', // Cache for 10 seconds
        }
      }
    );

  } catch (error) {
    console.error('[pool-state] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
