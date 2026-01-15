import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Treasury wallet
const TREASURY_WALLET = "CHrrxJbF7N3A622z6ajftMgAjkcNpGqTo1vtFhkf4hmQ";

// Fee distribution splits
const CREATOR_FEE_SHARE = 0.5;    // 50% to creator
const BUYBACK_FEE_SHARE = 0.3;   // 30% for buybacks
const SYSTEM_FEE_SHARE = 0.2;    // 20% kept for system expenses

// Minimum SOL to distribute to creators (avoid micro-transactions that eat gas)
const MIN_DISTRIBUTION_SOL = 0.05;

// Maximum retries for transaction
const MAX_TX_RETRIES = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[fun-distribute] ⏰ Starting fee distribution cron job...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get treasury keypair for sending payments
    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    if (!treasuryPrivateKey) {
      throw new Error("TREASURY_PRIVATE_KEY not configured");
    }

    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");
    if (!heliusRpcUrl) {
      throw new Error("HELIUS_RPC_URL not configured");
    }

    // Parse treasury keypair
    let treasuryKeypair: Keypair;
    try {
      if (treasuryPrivateKey.startsWith("[")) {
        const keyArray = JSON.parse(treasuryPrivateKey);
        treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
      } else {
        const decoded = bs58.decode(treasuryPrivateKey);
        treasuryKeypair = Keypair.fromSecretKey(decoded);
      }
    } catch (e) {
      throw new Error("Invalid TREASURY_PRIVATE_KEY format");
    }

    const connection = new Connection(heliusRpcUrl, "confirmed");

    // Check treasury balance first
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const treasuryBalanceSol = treasuryBalance / 1e9;
    console.log(`[fun-distribute] Treasury balance: ${treasuryBalanceSol.toFixed(4)} SOL`);

    if (treasuryBalanceSol < 0.01) {
      console.warn("[fun-distribute] ⚠️ Treasury balance low, skipping distributions");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Treasury balance too low for distributions",
          treasuryBalance: treasuryBalanceSol 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STEP 1: Find all fee claims that haven't been distributed to creators yet
    const { data: undistributedClaims, error: claimsError } = await supabase
      .from("fun_fee_claims")
      .select(`
        *,
        fun_token:fun_tokens(id, name, ticker, creator_wallet, status)
      `)
      .eq("creator_distributed", false)
      .order("claimed_at", { ascending: true });

    if (claimsError) {
      throw new Error(`Failed to fetch claims: ${claimsError.message}`);
    }

    console.log(`[fun-distribute] Found ${undistributedClaims?.length || 0} undistributed claims`);

    if (!undistributedClaims || undistributedClaims.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No pending distributions",
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{
      claimId: string;
      tokenName: string;
      creatorWallet: string;
      claimedSol: number;
      creatorAmount: number;
      success: boolean;
      signature?: string;
      error?: string;
    }> = [];

    let totalDistributed = 0;
    let successCount = 0;
    let failureCount = 0;

    // STEP 2: Process each undistributed claim
    for (const claim of undistributedClaims) {
      const token = claim.fun_token;
      
      if (!token || !token.creator_wallet) {
        console.warn(`[fun-distribute] Skipping claim ${claim.id}: no token or creator wallet`);
        continue;
      }

      if (token.status !== 'active') {
        console.warn(`[fun-distribute] Skipping claim ${claim.id}: token ${token.ticker} is not active`);
        continue;
      }

      const claimedSol = Number(claim.claimed_sol) || 0;
      const creatorAmount = claimedSol * CREATOR_FEE_SHARE;
      const buybackAmount = claimedSol * BUYBACK_FEE_SHARE;
      const systemAmount = claimedSol * SYSTEM_FEE_SHARE;

      console.log(`[fun-distribute] Processing ${token.ticker}: ${claimedSol} SOL → Creator ${creatorAmount}, Buyback ${buybackAmount}, System ${systemAmount}`);

      // Skip if creator amount is too small
      if (creatorAmount < MIN_DISTRIBUTION_SOL) {
        console.log(`[fun-distribute] Skipping ${token.ticker}: creator amount ${creatorAmount} too small`);
        
        // Still mark as distributed to avoid reprocessing
        await supabase
          .from("fun_fee_claims")
          .update({ creator_distributed: true })
          .eq("id", claim.id);
        
        continue;
      }

      // STEP 3: Create distribution record FIRST (pending state) - this is our safety net
      const { data: distribution, error: distError } = await supabase
        .from("fun_distributions")
        .insert({
          fun_token_id: token.id,
          creator_wallet: token.creator_wallet,
          amount_sol: creatorAmount,
          distribution_type: "creator",
          status: "pending",
        })
        .select()
        .single();

      if (distError) {
        console.error(`[fun-distribute] Failed to create distribution record:`, distError);
        results.push({
          claimId: claim.id,
          tokenName: token.name,
          creatorWallet: token.creator_wallet,
          claimedSol,
          creatorAmount,
          success: false,
          error: `DB error: ${distError.message}`,
        });
        failureCount++;
        continue;
      }

      // STEP 4: Send SOL to creator with retries
      let txSuccess = false;
      let txSignature: string | undefined;
      let txError: string | undefined;

      for (let attempt = 1; attempt <= MAX_TX_RETRIES; attempt++) {
        try {
          console.log(`[fun-distribute] Sending ${creatorAmount.toFixed(6)} SOL to ${token.creator_wallet} (attempt ${attempt})`);

          const recipientPubkey = new PublicKey(token.creator_wallet);
          const lamports = Math.floor(creatorAmount * 1e9);

          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: treasuryKeypair.publicKey,
              toPubkey: recipientPubkey,
              lamports,
            })
          );

          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = treasuryKeypair.publicKey;

          txSignature = await sendAndConfirmTransaction(
            connection, 
            transaction, 
            [treasuryKeypair],
            { commitment: "confirmed", maxRetries: 3 }
          );

          console.log(`[fun-distribute] ✅ Sent ${creatorAmount} SOL to ${token.creator_wallet}, sig: ${txSignature}`);
          txSuccess = true;
          break;

        } catch (e) {
          txError = e instanceof Error ? e.message : "Unknown error";
          console.error(`[fun-distribute] ❌ TX attempt ${attempt} failed:`, txError);
          
          if (attempt < MAX_TX_RETRIES) {
            await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
          }
        }
      }

      // STEP 5: Update distribution record with result
      if (txSuccess && txSignature) {
        await supabase
          .from("fun_distributions")
          .update({
            status: "completed",
            signature: txSignature,
          })
          .eq("id", distribution.id);

        // Mark the claim as distributed
        await supabase
          .from("fun_fee_claims")
          .update({
            creator_distributed: true,
            creator_distribution_id: distribution.id,
          })
          .eq("id", claim.id);

        // Record buyback entry (30%)
        if (buybackAmount >= MIN_DISTRIBUTION_SOL) {
          await supabase.from("fun_buybacks").insert({
            fun_token_id: token.id,
            amount_sol: buybackAmount,
            status: "pending",
          });

          await supabase.from("fun_distributions").insert({
            fun_token_id: token.id,
            creator_wallet: TREASURY_WALLET,
            amount_sol: buybackAmount,
            distribution_type: "buyback",
            status: "completed",
          });
        }

        // Record system fee (20%)
        if (systemAmount >= MIN_DISTRIBUTION_SOL) {
          await supabase.from("fun_distributions").insert({
            fun_token_id: token.id,
            creator_wallet: TREASURY_WALLET,
            amount_sol: systemAmount,
            distribution_type: "system",
            status: "completed",
          });
        }

        results.push({
          claimId: claim.id,
          tokenName: token.name,
          creatorWallet: token.creator_wallet,
          claimedSol,
          creatorAmount,
          success: true,
          signature: txSignature,
        });

        totalDistributed += creatorAmount;
        successCount++;

      } else {
        // Transaction failed - mark distribution as failed but DON'T mark claim as distributed
        // This allows retry on next cron run
        await supabase
          .from("fun_distributions")
          .update({ status: "failed" })
          .eq("id", distribution.id);

        results.push({
          claimId: claim.id,
          tokenName: token.name,
          creatorWallet: token.creator_wallet,
          claimedSol,
          creatorAmount,
          success: false,
          error: txError || "Transaction failed after retries",
        });

        failureCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[fun-distribute] ✅ Complete: ${successCount} successful, ${failureCount} failed, ${totalDistributed.toFixed(4)} SOL distributed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        totalDistributedSol: totalDistributed,
        durationMs: duration,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[fun-distribute] ❌ Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
