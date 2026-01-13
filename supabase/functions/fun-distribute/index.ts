import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Treasury wallet
const TREASURY_WALLET = "7UiXCtz3wxjiKS2W3LQsJcs6GqwfuDbeEcRhaAVwcHB2";
// Creator gets 50% of fees
const CREATOR_FEE_SHARE = 0.5;
// Minimum SOL to distribute (to avoid dust)
const MIN_DISTRIBUTION_SOL = 0.001;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[fun-distribute] Starting fee distribution for fun token creators...");

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

    // Get all active fun tokens that have earned fees
    const { data: funTokens, error: fetchError } = await supabase
      .from("fun_tokens")
      .select("*")
      .eq("status", "active")
      .gt("total_fees_earned", 0);

    if (fetchError) {
      throw new Error(`Failed to fetch fun tokens: ${fetchError.message}`);
    }

    console.log(`[fun-distribute] Found ${funTokens?.length || 0} tokens with fees to distribute`);

    if (!funTokens || funTokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No fees to distribute" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{
      tokenId: string;
      creatorWallet: string;
      amountSol: number;
      success: boolean;
      signature?: string;
      error?: string;
    }> = [];

    // Get previous distributions to calculate undistributed fees
    const { data: previousDistributions } = await supabase
      .from("fun_distributions")
      .select("fun_token_id, amount_sol")
      .eq("status", "completed");

    // Calculate total distributed per token
    const distributedPerToken: Record<string, number> = {};
    previousDistributions?.forEach(d => {
      distributedPerToken[d.fun_token_id] = (distributedPerToken[d.fun_token_id] || 0) + Number(d.amount_sol);
    });

    // Process each token
    for (const token of funTokens) {
      try {
        const totalEarned = Number(token.total_fees_earned) || 0;
        const alreadyDistributed = distributedPerToken[token.id] || 0;
        const undistributed = totalEarned - alreadyDistributed;
        
        // Creator's share of undistributed fees
        const creatorAmount = undistributed * CREATOR_FEE_SHARE;

        if (creatorAmount < MIN_DISTRIBUTION_SOL) {
          console.log(`[fun-distribute] Skipping ${token.ticker}: amount too small (${creatorAmount} SOL)`);
          continue;
        }

        console.log(`[fun-distribute] Distributing ${creatorAmount} SOL to ${token.creator_wallet} for ${token.ticker}`);

        // Create distribution record first (pending)
        const { data: distribution, error: insertError } = await supabase
          .from("fun_distributions")
          .insert({
            fun_token_id: token.id,
            creator_wallet: token.creator_wallet,
            amount_sol: creatorAmount,
            status: "pending",
          })
          .select()
          .single();

        if (insertError) {
          console.error(`[fun-distribute] Failed to create distribution record:`, insertError);
          continue;
        }

        // Send SOL to creator wallet
        try {
          const recipientPubkey = new PublicKey(token.creator_wallet);
          const lamports = Math.floor(creatorAmount * 1e9);

          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: treasuryKeypair.publicKey,
              toPubkey: recipientPubkey,
              lamports,
            })
          );

          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = treasuryKeypair.publicKey;

          const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], {
            commitment: "confirmed",
          });

          console.log(`[fun-distribute] Sent ${creatorAmount} SOL to ${token.creator_wallet}, sig: ${signature}`);

          // Update distribution record as completed
          await supabase
            .from("fun_distributions")
            .update({
              status: "completed",
              signature,
            })
            .eq("id", distribution.id);

          // Update token last distribution time
          await supabase
            .from("fun_tokens")
            .update({
              last_distribution_at: new Date().toISOString(),
            })
            .eq("id", token.id);

          results.push({
            tokenId: token.id,
            creatorWallet: token.creator_wallet,
            amountSol: creatorAmount,
            success: true,
            signature,
          });
        } catch (txError) {
          console.error(`[fun-distribute] Transfer failed for ${token.ticker}:`, txError);
          
          // Update distribution record as failed
          await supabase
            .from("fun_distributions")
            .update({
              status: "failed",
            })
            .eq("id", distribution.id);

          results.push({
            tokenId: token.id,
            creatorWallet: token.creator_wallet,
            amountSol: creatorAmount,
            success: false,
            error: txError instanceof Error ? txError.message : "Transfer failed",
          });
        }
      } catch (tokenError) {
        console.error(`[fun-distribute] Error processing ${token.ticker}:`, tokenError);
        results.push({
          tokenId: token.id,
          creatorWallet: token.creator_wallet,
          amountSol: 0,
          success: false,
          error: tokenError instanceof Error ? tokenError.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalDistributed = results.filter(r => r.success).reduce((sum, r) => sum + r.amountSol, 0);

    console.log(`[fun-distribute] Complete: ${successCount}/${results.length} distributions, ${totalDistributed} SOL total`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        totalDistributedSol: totalDistributed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fun-distribute] Error:", error);
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
