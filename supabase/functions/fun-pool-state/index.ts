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
  virtualTokenReserves: number;
  isGraduated: boolean;
  volume24h: number;
}

// Meteora DBC Program ID
const DBC_PROGRAM_ID = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN';

// Pool account layout offsets (Anchor/Borsh format)
// The pool state has these important fields:
// - real_base_amount (u64) - actual SOL in pool
// - virtual_base_amount (u64) - virtual SOL reserves
// - virtual_quote_amount (u64) - virtual token reserves
// Layout is after the 8-byte discriminator

function decodeU64(buffer: Uint8Array, offset: number): bigint {
  let value = BigInt(0);
  for (let i = 0; i < 8; i++) {
    value += BigInt(buffer[offset + i]) << BigInt(i * 8);
  }
  return value;
}

function decodePoolState(base64Data: string): { 
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
} | null {
  try {
    const binaryStr = atob(base64Data);
    const buffer = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      buffer[i] = binaryStr.charCodeAt(i);
    }

    // Meteora DBC pool layout (424 bytes total):
    // - Discriminator: 0-7 (8 bytes)
    // - config: 8-39 (32 bytes pubkey)
    // - base_mint: 40-71 (32 bytes pubkey)
    // - quote_mint: 72-103 (32 bytes pubkey)
    // - base_vault: 104-135 (32 bytes pubkey)
    // - quote_vault: 136-167 (32 bytes pubkey)
    // - creator: 168-199 (32 bytes pubkey)
    // - real_base_amount (tokens): 200-207 (u64)
    // - real_quote_amount (SOL): 208-215 (u64)
    // - virtual_base_amount (tokens): 216-223 (u64)
    // - virtual_quote_amount (SOL): 224-231 (u64)
    
    // "Base" = Token, "Quote" = SOL in Meteora DBC
    
    if (buffer.length < 232) {
      console.log('[fun-pool-state] Buffer too short:', buffer.length);
      return null;
    }
    
    const realBaseAmount = decodeU64(buffer, 200);  // Real token reserves
    const realQuoteAmount = decodeU64(buffer, 208); // Real SOL reserves
    const virtualBaseAmount = decodeU64(buffer, 216); // Virtual token reserves
    const virtualQuoteAmount = decodeU64(buffer, 224); // Virtual SOL reserves
    
    // Convert from lamports (9 decimals for SOL, 6 for tokens)
    const realSolReserves = Number(realQuoteAmount) / 1e9;
    const virtualSolReserves = Number(virtualQuoteAmount) / 1e9;
    const virtualTokenReserves = Number(virtualBaseAmount) / 1e6; // Token has 6 decimals
    
    console.log('[fun-pool-state] Decoded pool state:', {
      realSol: realSolReserves.toFixed(4),
      virtualSol: virtualSolReserves.toFixed(4),
      virtualTokens: virtualTokenReserves.toFixed(0),
      rawRealQuote: realQuoteAmount.toString(),
      rawVirtualQuote: virtualQuoteAmount.toString(),
    });
    
    // Sanity check - virtual SOL should be around 30 SOL for new pools
    if (virtualSolReserves >= 1 && virtualSolReserves <= 1000) {
      return {
        realSolReserves,
        virtualSolReserves,
        virtualTokenReserves,
      };
    }
    
    console.log('[fun-pool-state] Decoded values failed sanity check');
    return null;
  } catch (e) {
    console.error('[fun-pool-state] Decode error:', e);
    return null;
  }
}

async function fetchPoolFromRPC(poolAddress: string, heliusRpcUrl: string): Promise<{
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
} | null> {
  try {
    console.log('[fun-pool-state] Fetching from Helius RPC:', poolAddress);
    
    const response = await fetch(heliusRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [
          poolAddress,
          { encoding: 'base64' }
        ]
      })
    });

    if (!response.ok) {
      console.error('[fun-pool-state] RPC request failed:', response.status);
      return null;
    }

    const rpcData = await response.json();
    
    if (rpcData.error) {
      console.error('[fun-pool-state] RPC error:', rpcData.error);
      return null;
    }

    if (!rpcData.result?.value?.data) {
      console.log('[fun-pool-state] No account data found for pool');
      return null;
    }

    const accountData = rpcData.result.value.data;
    const base64Data = Array.isArray(accountData) ? accountData[0] : accountData;
    
    // Check program owner matches Meteora DBC
    const owner = rpcData.result.value.owner;
    if (owner !== DBC_PROGRAM_ID) {
      console.log('[fun-pool-state] Pool not owned by DBC program:', owner);
      return null;
    }

    console.log('[fun-pool-state] Got account data, length:', base64Data.length);
    
    return decodePoolState(base64Data);
  } catch (e) {
    console.error('[fun-pool-state] RPC fetch error:', e);
    return null;
  }
}

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
    const heliusRpcUrl = Deno.env.get('HELIUS_RPC_URL');
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
    
    // Default values - use realistic bonding curve initial state
    let poolState: PoolState = {
      priceSol: 0.00000003, // 30 SOL / 1B tokens
      marketCapSol: 30,
      holderCount: 0,
      bondingProgress: 0,
      realSolReserves: 0,
      virtualSolReserves: 30,
      virtualTokenReserves: 1_000_000_000,
      isGraduated: false,
      volume24h: token?.volume_24h_sol || 0,
    };

    if (dbcPool && heliusRpcUrl) {
      // Try direct RPC call first (more reliable)
      const rpcState = await fetchPoolFromRPC(dbcPool, heliusRpcUrl);
      
      if (rpcState) {
        const { realSolReserves, virtualSolReserves, virtualTokenReserves } = rpcState;
        
        // Calculate derived values
        const priceSol = virtualTokenReserves > 0 ? virtualSolReserves / virtualTokenReserves : 0.00000003;
        const totalSupply = 1_000_000_000;
        const marketCapSol = priceSol * totalSupply;
        const graduationThreshold = 85;
        const bondingProgress = Math.min((realSolReserves / graduationThreshold) * 100, 100);
        
        poolState = {
          priceSol,
          marketCapSol,
          holderCount: 0, // Would need separate query
          bondingProgress,
          realSolReserves,
          virtualSolReserves,
          virtualTokenReserves,
          isGraduated: bondingProgress >= 100,
          volume24h: token?.volume_24h_sol || 0,
        };

        console.log('[fun-pool-state] RPC success:', {
          price: priceSol.toFixed(10),
          progress: bondingProgress.toFixed(2),
          realSol: realSolReserves.toFixed(4),
        });

        // Update database with live values
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
        console.log('[fun-pool-state] RPC decode failed, using defaults');
      }
    } else if (!heliusRpcUrl) {
      console.warn('[fun-pool-state] HELIUS_RPC_URL not configured');
    }

    console.log('[fun-pool-state] Returning:', {
      price: poolState.priceSol.toFixed(10),
      progress: poolState.bondingProgress.toFixed(2),
      marketCap: poolState.marketCapSol.toFixed(2),
    });

    return new Response(
      JSON.stringify(poolState),
      { 
        status: 200, 
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=5',
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
