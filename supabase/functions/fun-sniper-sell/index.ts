import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Jito endpoints
const JITO_BLOCK_ENGINES = [
  'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
];

const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4bVmkzf6HbKBJv9fYfZxTdU',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[fun-sniper-sell] Starting auto-sell process');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sniperPrivateKey = Deno.env.get('SNIPER_PRIVATE_KEY');
    const heliusRpcUrl = Deno.env.get('HELIUS_RPC_URL');

    if (!sniperPrivateKey || !heliusRpcUrl) {
      throw new Error('Missing required environment variables');
    }

    // Get trades that are ready to sell (bought and past scheduled sell time)
    const { data: tradesToSell, error: fetchError } = await supabase
      .from('sniper_trades')
      .select('*')
      .eq('status', 'bought')
      .lte('scheduled_sell_at', new Date().toISOString())
      .limit(10);

    if (fetchError) {
      throw new Error(`Failed to fetch trades: ${fetchError.message}`);
    }

    if (!tradesToSell || tradesToSell.length === 0) {
      console.log('[fun-sniper-sell] No trades ready to sell');
      return new Response(JSON.stringify({ success: true, message: 'No trades to sell', sold: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[fun-sniper-sell] Found ${tradesToSell.length} trades to sell`);

    const results: any[] = [];

    for (const trade of tradesToSell) {
      try {
        console.log(`[fun-sniper-sell] Processing trade ${trade.id} for pool ${trade.pool_address}`);

        // Call Meteora API to execute sell
        const meteoraApiUrl = Deno.env.get('METEORA_API_URL') || 'https://trenchespost.vercel.app';
        
        // Build sell transaction via API
        const sellResponse = await fetch(`${meteoraApiUrl}/api/swap/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poolAddress: trade.pool_address,
            userWallet: trade.sniper_wallet || getWalletFromPrivateKey(sniperPrivateKey),
            amount: trade.tokens_received || 0,
            isBuy: false, // Sell
            slippageBps: 5000, // 50% slippage for fast execution
            serverSideSign: true,
            sniperPrivateKey: sniperPrivateKey,
            priorityFee: 0.01, // High priority
          }),
        });

        const sellResult = await sellResponse.json();

        if (sellResult.success) {
          // Update trade as sold
          await supabase.rpc('backend_update_sniper_sell', {
            p_id: trade.id,
            p_sell_signature: sellResult.signature || 'executed',
            p_sell_slot: sellResult.slot || null,
            p_sol_received: sellResult.solReceived || 0,
          });

          results.push({ tradeId: trade.id, success: true, signature: sellResult.signature });
          console.log(`[fun-sniper-sell] Sold trade ${trade.id}, signature: ${sellResult.signature}`);
        } else {
          throw new Error(sellResult.error || 'Sell failed');
        }
      } catch (tradeError) {
        console.error(`[fun-sniper-sell] Error selling trade ${trade.id}:`, tradeError);
        
        // Mark as failed
        await supabase.rpc('backend_fail_sniper_trade', {
          p_id: trade.id,
          p_error_message: tradeError instanceof Error ? tradeError.message : 'Unknown error',
        });

        results.push({ tradeId: trade.id, success: false, error: (tradeError as Error).message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[fun-sniper-sell] Completed: ${successCount}/${tradesToSell.length} sells succeeded`);

    return new Response(JSON.stringify({
      success: true,
      sold: successCount,
      total: tradesToSell.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[fun-sniper-sell] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper to get wallet address from private key
function getWalletFromPrivateKey(privateKey: string): string {
  try {
    // This is a simplified version - in production use proper key parsing
    // The actual wallet address should be stored with the trade
    return 'sniper-wallet';
  } catch {
    return 'unknown';
  }
}
