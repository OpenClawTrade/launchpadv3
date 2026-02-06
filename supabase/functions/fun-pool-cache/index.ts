import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INITIAL_VIRTUAL_SOL = 30;
const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD_SOL = 85;

// Decode Meteora DBC virtualPool account data
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

    if (buffer.length < 248) return null;

    const dataView = new DataView(buffer.buffer);
    const baseReserve = dataView.getBigUint64(232, true);
    const quoteReserve = dataView.getBigUint64(240, true);
    
    // Detect token decimals from reserve magnitude
    // 9-decimal tokens: baseReserve is ~1e18 for 1B supply
    // 6-decimal tokens: baseReserve is ~1e15 for 1B supply
    const baseReserveNum = Number(baseReserve);
    const tokenDecimals = baseReserveNum > 1e17 ? 9 : 6;
    
    const virtualTokenReserves = baseReserveNum / Math.pow(10, tokenDecimals);
    const accumulatedSol = Number(quoteReserve) / 1e9;
    const virtualSolReserves = INITIAL_VIRTUAL_SOL + accumulatedSol;
    const realSolReserves = accumulatedSol;

    return { realSolReserves, virtualSolReserves, virtualTokenReserves, tokenDecimals };
  } catch {
    return null;
  }
}

// Fetch holder count using getTokenLargestAccounts (no rate limits)
async function fetchHolderCount(mintAddress: string, heliusRpcUrl: string): Promise<number> {
  if (!mintAddress || !heliusRpcUrl) return 0;

  try {
    const resp = await fetch(heliusRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'holder-count',
        method: 'getTokenLargestAccounts',
        params: [mintAddress],
      }),
    });

    if (!resp.ok) return 0;

    const json = await resp.json();
    const accounts = json?.result?.value || [];
    return accounts.filter((a: { amount: string }) => 
      a.amount && parseInt(a.amount) > 0
    ).length;
  } catch {
    return 0;
  }
}

// Fetch pool state from Helius RPC
async function fetchPoolState(
  poolAddress: string,
  mintAddress: string | null,
  heliusRpcUrl: string
): Promise<{
  priceSol: number;
  marketCapSol: number;
  holderCount: number;
  bondingProgress: number;
  isGraduated: boolean;
} | null> {
  try {
    const response = await fetch(heliusRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'pool-state',
        method: 'getAccountInfo',
        params: [poolAddress, { encoding: 'base64' }],
      }),
    });

    if (!response.ok) return null;

    const json = await response.json();
    const accountData = json.result?.value?.data;
    if (!accountData || !Array.isArray(accountData) || accountData.length < 1) return null;

    const reserves = decodePoolReserves(accountData[0]);
    if (!reserves) return null;

    const { realSolReserves, virtualSolReserves, virtualTokenReserves } = reserves;
    const priceSol = virtualTokenReserves > 0 ? virtualSolReserves / virtualTokenReserves : 0;
    const marketCapSol = priceSol * TOTAL_SUPPLY;
    const bondingProgress = Math.min((realSolReserves / GRADUATION_THRESHOLD_SOL) * 100, 100);

    let holderCount = 0;
    if (mintAddress) {
      holderCount = await fetchHolderCount(mintAddress, heliusRpcUrl);
    }

    return {
      priceSol,
      marketCapSol,
      holderCount,
      bondingProgress,
      isGraduated: bondingProgress >= 100,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const heliusRpcUrl = Deno.env.get('HELIUS_RPC_URL') || '';

    if (!supabaseUrl || !supabaseKey || !heliusRpcUrl) {
      return new Response(JSON.stringify({ error: 'Missing configuration' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'get';

    // GET: Return cached pool states from database
    if (action === 'get') {
      const { data: tokens, error } = await supabase
        .from('fun_tokens')
        .select('id, mint_address, dbc_pool_address, price_sol, market_cap_sol, holder_count, bonding_progress, status')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[fun-pool-cache] Error fetching tokens:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch cache' }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      // Return cached data as a map for easy lookup
      const cacheMap: Record<string, any> = {};
      for (const token of tokens || []) {
        if (token.dbc_pool_address) {
          cacheMap[token.dbc_pool_address] = {
            priceSol: token.price_sol || 0.00000003,
            marketCapSol: token.market_cap_sol || 30,
            holderCount: token.holder_count || 0,
            bondingProgress: token.bonding_progress || 0,
            isGraduated: token.status === 'graduated',
          };
        }
      }

      return new Response(JSON.stringify({ cache: cacheMap, updated: new Date().toISOString() }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=30',
        },
      });
    }

    // UPDATE: Refresh all pool states and update database (called by cron)
    if (action === 'update') {
      console.log('[fun-pool-cache] Starting cache update...');

      // Fetch top 30 by bonding progress (ensures King of the Hill accuracy)
      const { data: topProgressTokens, error: topError } = await supabase
        .from('fun_tokens')
        .select('id, mint_address, dbc_pool_address, status, price_sol, price_24h_ago')
        .eq('status', 'active')
        .order('bonding_progress', { ascending: false })
        .limit(30);

      // Fetch newest 30 tokens (ensures new launches get updates)
      const { data: newestTokens, error: newestError } = await supabase
        .from('fun_tokens')
        .select('id, mint_address, dbc_pool_address, status, price_sol, price_24h_ago')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(30);

      if (topError || newestError) {
        console.error('[fun-pool-cache] Error fetching tokens:', topError || newestError);
        return new Response(JSON.stringify({ error: 'Failed to fetch tokens' }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      // Deduplicate and merge (max ~60 unique tokens, often overlapping)
      const tokensMap = new Map<string, typeof topProgressTokens[0]>();
      for (const t of [...(topProgressTokens || []), ...(newestTokens || [])]) {
        tokensMap.set(t.id, t);
      }
      const tokens = Array.from(tokensMap.values());
      console.log(`[fun-pool-cache] Processing ${tokens.length} tokens (top progress + newest merged)`);

      let updated = 0;
      const batchSize = 5;

      for (let i = 0; i < (tokens || []).length; i += batchSize) {
        const batch = tokens!.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (token) => {
            if (!token.dbc_pool_address) return;

            const poolState = await fetchPoolState(
              token.dbc_pool_address,
              token.mint_address,
              heliusRpcUrl
            );

            if (poolState) {
              // Calculate price change based on stored price_24h_ago
              // If no price_24h_ago exists, initialize it with current price
              const priceNow = poolState.priceSol;
              const price24hAgo = token.price_24h_ago || priceNow;
              
              let priceChange24h = 0;
              if (price24hAgo > 0 && priceNow !== price24hAgo) {
                priceChange24h = ((priceNow - price24hAgo) / price24hAgo) * 100;
              }
              
              const updateData: Record<string, any> = {
                price_sol: priceNow,
                market_cap_sol: poolState.marketCapSol,
                holder_count: poolState.holderCount,
                bonding_progress: poolState.bondingProgress,
                status: poolState.isGraduated ? 'graduated' : 'active',
                price_change_24h: priceChange24h,
                updated_at: new Date().toISOString(),
              };
              
              // If price_24h_ago is null, initialize it
              if (!token.price_24h_ago) {
                updateData.price_24h_ago = priceNow;
              }
              
              const { error: updateError } = await supabase
                .from('fun_tokens')
                .update(updateData)
                .eq('id', token.id);

              if (!updateError) updated++;
            }
          })
        );

        // Small delay between batches to avoid rate limits
        if (i + batchSize < (tokens || []).length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      console.log(`[fun-pool-cache] Updated ${updated} tokens`);

      return new Response(JSON.stringify({ success: true, updated }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('[fun-pool-cache] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
