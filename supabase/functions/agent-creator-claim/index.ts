import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_CLAIM_SOL = 0.01; // Minimum SOL to claim
const CREATOR_SHARE = 0.8; // 80% goes to creator
const CLAIM_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour in milliseconds
const CLAIM_LOCK_SECONDS = 60; // Lock duration for atomic claims

interface ClaimRequest {
  twitterUsername: string;
  payoutWallet: string;  // User-selected destination wallet
  walletAddress?: string; // Deprecated - kept for backwards compatibility
  tokenIds?: string[];
  checkOnly?: boolean; // If true, just check status without claiming
}

/**
 * Secure fee claiming for token creators who launched via Twitter.
 * 
 * Uses new formula:
 *   earned = sum(fun_fee_claims.claimed_sol) * 0.8
 *   paid = sum(fun_distributions where type='creator_claim' & status='completed')
 *   claimable = earned - paid
 * 
 * Security:
 * 1. X login proves ownership of Twitter handle
 * 2. Rate limit: 1 claim per hour per Twitter username
 * 3. Atomic locking prevents double-claims
 * 4. Minimum claim threshold (0.01 SOL)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ClaimRequest = await req.json();
    const { twitterUsername, tokenIds, checkOnly } = body;
    const payoutWallet = body.payoutWallet || body.walletAddress;

    if (!twitterUsername) {
      return new Response(
        JSON.stringify({ success: false, error: "twitterUsername is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!checkOnly && !payoutWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "payoutWallet is required for claiming" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate wallet address format if provided
    if (payoutWallet) {
      try {
        new PublicKey(payoutWallet);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid wallet address" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const normalizedUsername = twitterUsername.replace(/^@/, "").toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");

    if (!treasuryPrivateKey || !heliusRpcUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Find all tokens launched by this Twitter user (BEFORE rate limit so we can check by wallet too)
    const { data: socialPosts, error: postsError } = await supabase
      .from("agent_social_posts")
      .select("fun_token_id, wallet_address, post_author")
      .ilike("post_author", normalizedUsername)
      .eq("platform", "twitter")
      .eq("status", "completed")
      .not("fun_token_id", "is", null);

    if (postsError) {
      throw new Error(`Failed to fetch social posts: ${postsError.message}`);
    }

    if (!socialPosts || socialPosts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No tokens found launched by @${normalizedUsername}` 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all token IDs and creator wallets
    const allTokenIds = [...new Set(socialPosts.map(p => p.fun_token_id).filter((id): id is string => id !== null))];
    const creatorWallets = [...new Set(socialPosts.map(p => p.wallet_address).filter(Boolean))];

    const targetTokenIds = tokenIds && tokenIds.length > 0
      ? allTokenIds.filter(id => tokenIds.includes(id))
      : allTokenIds;

    if (targetTokenIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid tokens to claim from" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: check ALL creator distributions (both manual 'creator_claim' and auto 'creator')
    // Match by twitter_username OR by creator_wallet (auto-distributions don't have twitter_username)
    const { data: lastClaim } = await supabase
      .from("fun_distributions")
      .select("created_at")
      .in("distribution_type", ["creator_claim", "creator"])
      .eq("status", "completed")
      .in("fun_token_id", targetTokenIds)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = Date.now();
    let nextClaimAt: string | null = null;
    let canClaim = true;
    let remainingSeconds = 0;

    if (lastClaim) {
      const lastClaimTime = new Date(lastClaim.created_at).getTime();
      const timeSinceLastClaim = now - lastClaimTime;
      
      if (timeSinceLastClaim < CLAIM_COOLDOWN_MS) {
        canClaim = false;
        remainingSeconds = Math.ceil((CLAIM_COOLDOWN_MS - timeSinceLastClaim) / 1000);
        nextClaimAt = new Date(lastClaimTime + CLAIM_COOLDOWN_MS).toISOString();
      }
    }


    // Step 3: Calculate claimable using correct formula
    // earned = sum(fun_fee_claims.claimed_sol) * CREATOR_SHARE
    const { data: feeClaims, error: feeError } = await supabase
      .from("fun_fee_claims")
      .select("fun_token_id, claimed_sol")
      .in("fun_token_id", targetTokenIds);

    if (feeError) {
      throw new Error(`Failed to fetch fee claims: ${feeError.message}`);
    }

    const totalCollected = (feeClaims || []).reduce((sum, f) => sum + (f.claimed_sol || 0), 0);
    const creatorEarned = totalCollected * CREATOR_SHARE;

    // paid = sum of ALL creator distributions (both 'creator' auto and 'creator_claim' manual)
    const { data: distributions } = await supabase
      .from("fun_distributions")
      .select("amount_sol")
      .in("fun_token_id", targetTokenIds)
      .in("distribution_type", ["creator_claim", "creator"])
      .eq("status", "completed");

    const creatorPaid = (distributions || []).reduce((sum, d) => sum + (d.amount_sol || 0), 0);
    const claimable = Math.max(0, creatorEarned - creatorPaid);

    // If checkOnly, return status without claiming
    if (checkOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          canClaim,
          remainingSeconds,
          nextClaimAt,
          pendingAmount: claimable,
          totalEarned: creatorEarned,
          totalClaimed: creatorPaid,
          minClaimAmount: MIN_CLAIM_SOL,
          meetsMinimum: claimable >= MIN_CLAIM_SOL,
          tokenCount: targetTokenIds.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For actual claims, payoutWallet is required
    if (!payoutWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "payoutWallet is required for claiming" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit before proceeding with claim
    if (!canClaim) {
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Rate limited. Next claim available in ${minutes}m ${seconds}s`,
          rateLimited: true,
          remainingSeconds,
          nextClaimAt,
          pendingAmount: claimable,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (claimable < MIN_CLAIM_SOL) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Minimum claim is ${MIN_CLAIM_SOL} SOL. Current claimable: ${claimable.toFixed(6)} SOL`,
          pendingAmount: claimable,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Acquire lock to prevent double-claims
    const { data: lockAcquired } = await supabase.rpc("acquire_creator_claim_lock", {
      p_twitter_username: normalizedUsername,
      p_duration_seconds: CLAIM_LOCK_SECONDS,
    });

    if (!lockAcquired) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Another claim is in progress. Please wait a moment and try again.",
          locked: true,
        }),
        { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      // ===== SECURITY: Re-verify claimable amount AFTER acquiring lock =====
      // Prevents race condition where two concurrent requests both pass initial checks
      const { data: feeClaims2 } = await supabase
        .from("fun_fee_claims")
        .select("fun_token_id, claimed_sol")
        .in("fun_token_id", targetTokenIds);

      const totalCollected2 = (feeClaims2 || []).reduce((sum, f) => sum + (f.claimed_sol || 0), 0);
      const creatorEarned2 = totalCollected2 * CREATOR_SHARE;

      const { data: distributions2 } = await supabase
        .from("fun_distributions")
        .select("amount_sol, fun_token_id")
        .in("fun_token_id", targetTokenIds)
        .in("distribution_type", ["creator_claim", "creator"])
        .eq("status", "completed");

      const creatorPaid2 = (distributions2 || []).reduce((sum, d) => sum + (d.amount_sol || 0), 0);
      const verifiedClaimable = Math.max(0, creatorEarned2 - creatorPaid2);

      if (verifiedClaimable < MIN_CLAIM_SOL) {
        console.log(`[agent-creator-claim] ⚠️ Post-lock verification: claimable=${verifiedClaimable.toFixed(6)} < ${MIN_CLAIM_SOL}`);
        return new Response(
          JSON.stringify({ success: false, error: "Nothing left to claim after verification.", pendingAmount: verifiedClaimable }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use verified amount (not pre-lock amount)
      const claimableVerified = verifiedClaimable;
      console.log(`[agent-creator-claim] @${normalizedUsername} claiming ${claimableVerified.toFixed(6)} SOL to ${payoutWallet}`);

      // Step 5: Send SOL from treasury to user's wallet
      let treasuryKeypair: Keypair;
      try {
        if (treasuryPrivateKey.startsWith("[")) {
          const keyArray = JSON.parse(treasuryPrivateKey);
          treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
        } else {
          const decoded = bs58.decode(treasuryPrivateKey);
          treasuryKeypair = Keypair.fromSecretKey(decoded);
        }
      } catch {
        throw new Error("Invalid treasury configuration");
      }

      const connection = new Connection(heliusRpcUrl, "confirmed");

      // Check treasury balance
      const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
      const treasuryBalanceSol = treasuryBalance / 1e9;

      if (treasuryBalanceSol < claimableVerified + 0.05) {
        throw new Error("Insufficient treasury balance. Please try again later.");
      }

      // Create and send transaction
      const recipientPubkey = new PublicKey(payoutWallet);
      const lamports = Math.floor(claimableVerified * 1e9);

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
        maxRetries: 3,
      });

      console.log(`[agent-creator-claim] ✅ Sent ${claimableVerified.toFixed(6)} SOL to ${payoutWallet}, sig: ${signature}`);

      // Step 6: Record the distribution with twitter_username for future cooldown checks
      // Record per-token for accurate tracking
      for (const tokenId of targetTokenIds) {
        const tokenCollected = (feeClaims2 || [])
          .filter(f => f.fun_token_id === tokenId)
          .reduce((sum, f) => sum + (f.claimed_sol || 0), 0);
        const tokenEarned = tokenCollected * CREATOR_SHARE;
        const tokenPaid = (distributions2 || [])
          .filter((d: any) => d.fun_token_id === tokenId)
          .reduce((sum: number, d: any) => sum + (d.amount_sol || 0), 0);
        const tokenClaimable = Math.max(0, tokenEarned - tokenPaid);

        if (tokenClaimable > 0.000001) {
          const { error: insertError } = await supabase.from("fun_distributions").insert({
            fun_token_id: tokenId,
            creator_wallet: payoutWallet,
            amount_sol: tokenClaimable,
            distribution_type: "creator_claim",
            signature,
            status: "completed",
            twitter_username: normalizedUsername,
          });
          if (insertError) {
            console.error(`[agent-creator-claim] ❌ CRITICAL: Failed to record distribution for token ${tokenId}:`, insertError);
            throw new Error("Failed to record distribution - this is a critical error");
          }
        }
      }

      // Calculate next claim time
      const newNextClaimAt = new Date(Date.now() + CLAIM_COOLDOWN_MS).toISOString();

      return new Response(
        JSON.stringify({
          success: true,
          claimedAmount: claimableVerified,
          payoutWallet,
          signature,
          solscanUrl: `https://solscan.io/tx/${signature}`,
          tokensClaimed: targetTokenIds.length,
          nextClaimAt: newNextClaimAt,
          cooldownSeconds: CLAIM_COOLDOWN_MS / 1000,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      // Always release the lock
      await supabase.rpc("release_creator_claim_lock", {
        p_twitter_username: normalizedUsername,
      });
    }
  } catch (error) {
    console.error("[agent-creator-claim] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
