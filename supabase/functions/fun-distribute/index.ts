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

    const creatorResults: Array<{
      tokenId: string;
      tokenName: string;
      creatorWallet: string;
      amountSol: number;
      success: boolean;
      signature?: string;
      error?: string;
    }> = [];

    const buybackResults: Array<{
      tokenId: string;
      tokenName: string;
      amountSol: number;
      tokensBought?: number;
      success: boolean;
      signature?: string;
      error?: string;
    }> = [];

    // Get previous distributions to calculate undistributed fees
    const { data: previousDistributions } = await supabase
      .from("fun_distributions")
      .select("fun_token_id, amount_sol, distribution_type")
      .eq("status", "completed");

    // Calculate total distributed per token (all types)
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

        if (undistributed < MIN_DISTRIBUTION_SOL) {
          console.log(`[fun-distribute] Skipping ${token.ticker}: undistributed amount too small (${undistributed} SOL)`);
          continue;
        }

        // Calculate shares
        const creatorAmount = undistributed * CREATOR_FEE_SHARE;
        const buybackAmount = undistributed * BUYBACK_FEE_SHARE;
        const systemAmount = undistributed * SYSTEM_FEE_SHARE;

        console.log(`[fun-distribute] ${token.ticker}: Creator ${creatorAmount}, Buyback ${buybackAmount}, System ${systemAmount} SOL`);

        // 1. Send creator share
        if (creatorAmount >= MIN_DISTRIBUTION_SOL) {
          const creatorResult = await sendDistribution(
            supabase,
            connection,
            treasuryKeypair,
            token,
            token.creator_wallet,
            creatorAmount,
            "creator"
          );
          creatorResults.push({
            tokenId: token.id,
            tokenName: token.name,
            creatorWallet: token.creator_wallet,
            amountSol: creatorAmount,
            ...creatorResult,
          });
        }

        // 2. Record buyback (for now just record, actual buyback can be manual or separate process)
        if (buybackAmount >= MIN_DISTRIBUTION_SOL) {
          // Record buyback entry
          const { data: buyback, error: buybackError } = await supabase
            .from("fun_buybacks")
            .insert({
              fun_token_id: token.id,
              amount_sol: buybackAmount,
              status: "pending",
            })
            .select()
            .single();

          if (!buybackError) {
            buybackResults.push({
              tokenId: token.id,
              tokenName: token.name,
              amountSol: buybackAmount,
              success: true,
            });

            // Also record in distributions for tracking
            await supabase.from("fun_distributions").insert({
              fun_token_id: token.id,
              creator_wallet: TREASURY_WALLET,
              amount_sol: buybackAmount,
              distribution_type: "buyback",
              status: "completed",
            });
          }
        }

        // 3. Record system fee (kept in treasury)
        if (systemAmount >= MIN_DISTRIBUTION_SOL) {
          await supabase.from("fun_distributions").insert({
            fun_token_id: token.id,
            creator_wallet: TREASURY_WALLET,
            amount_sol: systemAmount,
            distribution_type: "system",
            status: "completed",
          });
        }

        // Update token last distribution time
        await supabase
          .from("fun_tokens")
          .update({
            last_distribution_at: new Date().toISOString(),
          })
          .eq("id", token.id);

      } catch (tokenError) {
        console.error(`[fun-distribute] Error processing ${token.ticker}:`, tokenError);
        creatorResults.push({
          tokenId: token.id,
          tokenName: token.name,
          creatorWallet: token.creator_wallet,
          amountSol: 0,
          success: false,
          error: tokenError instanceof Error ? tokenError.message : "Unknown error",
        });
      }
    }

    const successCount = creatorResults.filter(r => r.success).length;
    const totalDistributed = creatorResults.filter(r => r.success).reduce((sum, r) => sum + r.amountSol, 0);
    const totalBuybacks = buybackResults.filter(r => r.success).reduce((sum, r) => sum + r.amountSol, 0);

    console.log(`[fun-distribute] Complete: ${successCount} creator distributions (${totalDistributed} SOL), ${buybackResults.length} buybacks (${totalBuybacks} SOL)`);

    return new Response(
      JSON.stringify({
        success: true,
        creatorDistributions: creatorResults.length,
        creatorSuccessful: successCount,
        totalDistributedSol: totalDistributed,
        buybacksRecorded: buybackResults.length,
        totalBuybackSol: totalBuybacks,
        creatorResults,
        buybackResults,
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

async function sendDistribution(
  supabase: any,
  connection: Connection,
  treasuryKeypair: Keypair,
  token: any,
  recipientWallet: string,
  amount: number,
  distributionType: string
): Promise<{ success: boolean; signature?: string; error?: string }> {
  // Create distribution record first (pending)
  const { data: distribution, error: insertError } = await supabase
    .from("fun_distributions")
    .insert({
      fun_token_id: token.id,
      creator_wallet: recipientWallet,
      amount_sol: amount,
      distribution_type: distributionType,
      status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    console.error(`[fun-distribute] Failed to create distribution record:`, insertError);
    return { success: false, error: insertError.message };
  }

  try {
    const recipientPubkey = new PublicKey(recipientWallet);
    const lamports = Math.floor(amount * 1e9);

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

    console.log(`[fun-distribute] Sent ${amount} SOL to ${recipientWallet}, sig: ${signature}`);

    // Update distribution record as completed
    await supabase
      .from("fun_distributions")
      .update({
        status: "completed",
        signature,
      })
      .eq("id", distribution.id);

    return { success: true, signature };
  } catch (txError) {
    console.error(`[fun-distribute] Transfer failed:`, txError);

    // Update distribution record as failed
    await supabase
      .from("fun_distributions")
      .update({
        status: "failed",
      })
      .eq("id", distribution.id);

    return { success: false, error: txError instanceof Error ? txError.message : "Transfer failed" };
  }
}
