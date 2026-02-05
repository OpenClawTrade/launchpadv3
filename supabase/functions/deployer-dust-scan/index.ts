import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const rpcUrl = Deno.env.get("HELIUS_RPC_URL");
    if (!rpcUrl) {
      throw new Error("HELIUS_RPC_URL not configured");
    }

    // Fetch all deployer wallets that haven't been reclaimed
    const { data: wallets, error: fetchError } = await supabase
      .from("deployer_wallets")
      .select("*")
      .is("reclaimed_at", null);

    if (fetchError) {
      throw new Error(`Failed to fetch wallets: ${fetchError.message}`);
    }

    if (!wallets || wallets.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No deployer wallets to scan",
        wallets: [],
        totalRecoverable: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[deployer-dust-scan] Scanning ${wallets.length} wallets...`);

    const connection = new Connection(rpcUrl, "confirmed");
    
    // Fetch balances in batches of 100
    const batchSize = 100;
    const results: Array<{
      id: string;
      wallet_address: string;
      token_mint: string | null;
      funded_sol: number;
      remaining_sol: number;
      created_at: string;
    }> = [];

    for (let i = 0; i < wallets.length; i += batchSize) {
      const batch = wallets.slice(i, i + batchSize);
      const pubkeys = batch.map(w => new PublicKey(w.wallet_address));
      
      // Get multiple account balances
      const balances = await connection.getMultipleAccountsInfo(pubkeys);
      
      for (let j = 0; j < batch.length; j++) {
        const wallet = batch[j];
        const accountInfo = balances[j];
        const balanceSol = accountInfo ? accountInfo.lamports / LAMPORTS_PER_SOL : 0;
        
        // Update remaining_sol in database
        await supabase
          .from("deployer_wallets")
          .update({ remaining_sol: balanceSol })
          .eq("id", wallet.id);
        
        results.push({
          id: wallet.id,
          wallet_address: wallet.wallet_address,
          token_mint: wallet.token_mint,
          funded_sol: wallet.funded_sol,
          remaining_sol: balanceSol,
          created_at: wallet.created_at,
        });
      }
    }

    // Calculate total recoverable
    const minDust = 0.001; // Minimum to consider for recovery (to cover tx fees)
    const recoverable = results.filter(w => w.remaining_sol > minDust);
    const totalRecoverable = recoverable.reduce((sum, w) => sum + w.remaining_sol, 0);

    console.log(`[deployer-dust-scan] Found ${recoverable.length} wallets with ${totalRecoverable.toFixed(4)} SOL recoverable`);

    return new Response(JSON.stringify({
      success: true,
      wallets: results,
      recoverableWallets: recoverable.length,
      totalRecoverable: parseFloat(totalRecoverable.toFixed(6)),
      scannedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[deployer-dust-scan] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
