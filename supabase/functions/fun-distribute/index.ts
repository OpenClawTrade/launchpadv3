import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Treasury wallet
const TREASURY_WALLET = "FDkGeRVwRo7dyWf9CaYw9Y8ZdoDnETiPDCyu5K1ghr5r";

// Fee distribution splits for REGULAR tokens (non-API)
const CREATOR_FEE_SHARE = 0.5;    // 50% to creator
const BUYBACK_FEE_SHARE = 0.3;   // 30% for buybacks
const SYSTEM_FEE_SHARE = 0.2;    // 20% kept for system expenses

// Fee distribution splits for API-LAUNCHED tokens
// Total trading fee is 2%, split 50/50:
// - API users get 50% = 1% of total trade volume
// - Platform keeps 50% = 1% of total trade volume (stays in treasury)
const API_USER_FEE_SHARE = 0.5;   // 50% to API account owner (1% of 2%)
const API_PLATFORM_FEE_SHARE = 0.5; // 50% to platform (1% of 2%)

// Minimum SOL to distribute (avoid micro-transactions that eat gas)
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

    // STEP 1: Find all fee claims that haven't been distributed yet
    // Include api_account_id and fee_mode to check token type
    const { data: undistributedClaims, error: claimsError } = await supabase
      .from("fun_fee_claims")
      .select(`
        *,
        fun_token:fun_tokens(id, name, ticker, creator_wallet, status, api_account_id, fee_mode)
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
      claimIds: string[];
      tokenName: string;
      recipientWallet: string;
      recipientType: "creator" | "api_user";
      claimedSol: number;
      recipientAmount: number;
      platformAmount: number;
      success: boolean;
      signature?: string;
      error?: string;
    }> = [];

    let totalDistributed = 0;
    let successCount = 0;
    let failureCount = 0;
    let apiFeesRecorded = 0;

    // STEP 2: Batch claims per token and only pay once the accumulated
    // share reaches MIN_DISTRIBUTION_SOL.
    const groups = new Map<
      string,
      {
        token: any;
        recipientWallet: string;
        recipientType: "creator" | "api_user";
        apiAccountId: string | null;
        claims: any[];
        claimedSol: number;
      }
    >();

    for (const claim of undistributedClaims) {
      const token = claim.fun_token;

      if (!token) {
        console.warn(`[fun-distribute] Skipping claim ${claim.id}: no token found`);
        continue;
      }

      if (token.status !== "active") {
        console.warn(`[fun-distribute] Skipping claim ${claim.id}: token ${token.ticker} is not active`);
        continue;
      }

      const claimedSol = Number(claim.claimed_sol) || 0;
      if (claimedSol <= 0) continue;

      // Determine token type: API, holder_rewards, or regular creator
      const isApiToken = !!token.api_account_id;
      const isHolderRewards = token.fee_mode === 'holder_rewards';
      
      if (isHolderRewards) {
        // HOLDER REWARDS MODE: Route 50% to holder_reward_pool instead of creator
        // The fun-holder-distribute cron will distribute to holders every 5 minutes
        const holderAmount = claimedSol * CREATOR_FEE_SHARE; // 50% goes to holder pool
        
        // Upsert into holder_reward_pool
        const { data: existingPool } = await supabase
          .from("holder_reward_pool")
          .select("id, accumulated_sol")
          .eq("fun_token_id", token.id)
          .maybeSingle();

        if (existingPool) {
          await supabase
            .from("holder_reward_pool")
            .update({
              accumulated_sol: (existingPool.accumulated_sol || 0) + holderAmount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPool.id);
        } else {
          await supabase
            .from("holder_reward_pool")
            .insert({
              fun_token_id: token.id,
              accumulated_sol: holderAmount,
            });
        }

        // Mark claim as distributed (holders will be paid by separate cron)
        await supabase
          .from("fun_fee_claims")
          .update({ creator_distributed: true })
          .eq("id", claim.id);

        console.log(`[fun-distribute] Holder rewards token ${token.ticker}: accumulated ${holderAmount.toFixed(6)} SOL for holders`);
        continue;
      }
      
      if (isApiToken) {
        // API tokens: fees go to API account owner (will be recorded in api_fee_distributions)
        // We need to fetch the API account's fee wallet
        const { data: apiAccount } = await supabase
          .from("api_accounts")
          .select("id, fee_wallet_address, wallet_address")
          .eq("id", token.api_account_id)
          .single();

        if (!apiAccount) {
          console.warn(`[fun-distribute] Skipping claim ${claim.id}: API account ${token.api_account_id} not found`);
          continue;
        }

        const feeWallet = apiAccount.fee_wallet_address || apiAccount.wallet_address;
        const key = `api:${token.api_account_id}`;

        const existing = groups.get(key);
        if (existing) {
          existing.claims.push(claim);
          existing.claimedSol += claimedSol;
        } else {
          groups.set(key, {
            token,
            recipientWallet: feeWallet,
            recipientType: "api_user",
            apiAccountId: token.api_account_id,
            claims: [claim],
            claimedSol,
          });
        }
      } else {
        // Regular tokens: fees go to creator
        if (!token.creator_wallet) {
          console.warn(`[fun-distribute] Skipping claim ${claim.id}: no creator wallet`);
          continue;
        }

        const creatorWallet = String(token.creator_wallet);
        const key = `creator:${token.id}:${creatorWallet}`;

        const existing = groups.get(key);
        if (existing) {
          existing.claims.push(claim);
          existing.claimedSol += claimedSol;
        } else {
          groups.set(key, {
            token,
            recipientWallet: creatorWallet,
            recipientType: "creator",
            apiAccountId: null,
            claims: [claim],
            claimedSol,
          });
        }
      }
    }

    console.log(`[fun-distribute] Prepared ${groups.size} batch(es) for processing`);

    for (const group of groups.values()) {
      const token = group.token;
      const claimedSol = group.claimedSol;
      const isApiToken = group.recipientType === "api_user";

      // Calculate fee splits based on token type
      let recipientAmount: number;
      let platformAmount: number;

      if (isApiToken) {
        // API tokens: 50/50 split between API user and platform
        recipientAmount = claimedSol * API_USER_FEE_SHARE;
        platformAmount = claimedSol * API_PLATFORM_FEE_SHARE;
        console.log(
          `[fun-distribute] API Token ${token.ticker}: ${claimedSol} SOL → API User ${recipientAmount.toFixed(6)}, Platform ${platformAmount.toFixed(6)}`
        );
      } else {
        // Regular tokens: creator gets 50%, rest for buyback/system
        recipientAmount = claimedSol * CREATOR_FEE_SHARE;
        platformAmount = claimedSol * (BUYBACK_FEE_SHARE + SYSTEM_FEE_SHARE);
        console.log(
          `[fun-distribute] Regular Token ${token.ticker}: ${claimedSol} SOL → Creator ${recipientAmount.toFixed(6)}, Platform ${platformAmount.toFixed(6)}`
        );
      }

      // For API tokens, we record in api_fee_distributions but DON'T send immediately
      // API users claim manually via api-claim-fees when they want
      if (isApiToken && group.apiAccountId) {
        // Record the fee distribution for the API user (pending - they claim when ready)
        const { error: apiDistError } = await supabase
          .from("api_fee_distributions")
          .insert({
            api_account_id: group.apiAccountId,
            token_id: token.id,
            total_fee_sol: claimedSol,
            api_user_share: recipientAmount,
            platform_share: platformAmount,
            status: "pending",
          });

        if (apiDistError) {
          console.error(`[fun-distribute] Failed to record API fee distribution:`, apiDistError);
          results.push({
            claimIds: group.claims.map((c) => c.id),
            tokenName: token.name,
            recipientWallet: group.recipientWallet,
            recipientType: "api_user",
            claimedSol,
            recipientAmount,
            platformAmount,
            success: false,
            error: `DB error: ${apiDistError.message}`,
          });
          failureCount++;
          continue;
        }

        // Update API account's total fees earned
        const { data: currentAccount } = await supabase
          .from("api_accounts")
          .select("total_fees_earned")
          .eq("id", group.apiAccountId)
          .single();

        await supabase
          .from("api_accounts")
          .update({
            total_fees_earned: (currentAccount?.total_fees_earned || 0) + recipientAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", group.apiAccountId);

        // Mark claims as distributed (API user can claim anytime)
        const claimIds = group.claims.map((c) => c.id);
        await supabase
          .from("fun_fee_claims")
          .update({ creator_distributed: true })
          .in("id", claimIds);

        results.push({
          claimIds,
          tokenName: token.name,
          recipientWallet: group.recipientWallet,
          recipientType: "api_user",
          claimedSol,
          recipientAmount,
          platformAmount,
          success: true,
        });

        apiFeesRecorded++;
        successCount++;
        console.log(`[fun-distribute] ✅ Recorded ${recipientAmount.toFixed(6)} SOL for API user ${group.apiAccountId} (claimable)`);
        continue;
      }

      // For regular tokens, skip if below minimum
      if (recipientAmount < MIN_DISTRIBUTION_SOL) {
        console.log(
          `[fun-distribute] Deferring ${token.ticker}: accumulated amount ${recipientAmount.toFixed(6)} < ${MIN_DISTRIBUTION_SOL} SOL`
        );
        continue;
      }

      // STEP 3: Create distribution record FIRST (pending state) - safety net
      const { data: distribution, error: distError } = await supabase
        .from("fun_distributions")
        .insert({
          fun_token_id: token.id,
          creator_wallet: group.recipientWallet,
          amount_sol: recipientAmount,
          distribution_type: "creator",
          status: "pending",
        })
        .select()
        .single();

      if (distError) {
        console.error(`[fun-distribute] Failed to create distribution record:`, distError);
        results.push({
          claimIds: group.claims.map((c) => c.id),
          tokenName: token.name,
          recipientWallet: group.recipientWallet,
          recipientType: "creator",
          claimedSol,
          recipientAmount,
          platformAmount,
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
          console.log(
            `[fun-distribute] Sending ${recipientAmount.toFixed(6)} SOL to ${group.recipientWallet} (attempt ${attempt})`
          );

          const recipientPubkey = new PublicKey(group.recipientWallet);
          const lamports = Math.floor(recipientAmount * 1e9);

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

          txSignature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], {
            commitment: "confirmed",
            maxRetries: 3,
          });

          console.log(`[fun-distribute] ✅ Sent ${recipientAmount} SOL to ${group.recipientWallet}, sig: ${txSignature}`);
          txSuccess = true;
          break;
        } catch (e) {
          txError = e instanceof Error ? e.message : "Unknown error";
          console.error(`[fun-distribute] ❌ TX attempt ${attempt} failed:`, txError);

          if (attempt < MAX_TX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000 * attempt)); // Exponential backoff
          }
        }
      }

      // STEP 5: Update distribution record + mark ALL claims in the batch
      if (txSuccess && txSignature) {
        await supabase
          .from("fun_distributions")
          .update({
            status: "completed",
            signature: txSignature,
          })
          .eq("id", distribution.id);

        const claimIds = group.claims.map((c) => c.id);
        await supabase
          .from("fun_fee_claims")
          .update({
            creator_distributed: true,
            creator_distribution_id: distribution.id,
          })
          .in("id", claimIds);

        console.log(
          `[fun-distribute] Reserved for platform: ${platformAmount.toFixed(6)} SOL`
        );

        results.push({
          claimIds,
          tokenName: token.name,
          recipientWallet: group.recipientWallet,
          recipientType: "creator",
          claimedSol,
          recipientAmount,
          platformAmount,
          success: true,
          signature: txSignature,
        });

        totalDistributed += recipientAmount;
        successCount++;
      } else {
        // Transaction failed - mark distribution as failed but DON'T mark claims as distributed
        await supabase.from("fun_distributions").update({ status: "failed" }).eq("id", distribution.id);

        results.push({
          claimIds: group.claims.map((c) => c.id),
          tokenName: token.name,
          recipientWallet: group.recipientWallet,
          recipientType: "creator",
          claimedSol,
          recipientAmount,
          platformAmount,
          success: false,
          error: txError || "Transaction failed after retries",
        });

        failureCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[fun-distribute] ✅ Complete: ${successCount} successful (${apiFeesRecorded} API fees recorded), ${failureCount} failed, ${totalDistributed.toFixed(4)} SOL distributed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        apiFeesRecorded,
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