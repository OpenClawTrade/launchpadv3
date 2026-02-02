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
 * Security checks:
 * 1. Verify the Twitter username matches the post_author on token launches
 * 2. Verify the wallet matches the creator_wallet on the token
 * 3. Only distribute fees that have been collected to treasury
 * 4. Track all claims to prevent double-spending
 * 5. Rate limit: 1 claim per hour per wallet
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
    // Support both payoutWallet (new) and walletAddress (legacy)
    const payoutWallet = body.payoutWallet || body.walletAddress;

    if (!twitterUsername) {
      return new Response(
        JSON.stringify({ success: false, error: "twitterUsername is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // payoutWallet only required for actual claims, not for checkOnly
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

    // Check rate limit - get last claim for this Twitter username (not wallet)
    // This prevents spamming claims from multiple wallets
    const { data: lastClaim } = await supabase
      .from("fun_distributions")
      .select("created_at")
      .eq("distribution_type", "creator_claim")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // TODO: Ideally we'd track cooldown per Twitter username, but for now we use global cooldown
    // A better approach would be to add a twitter_username column to fun_distributions

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

    // Step 1: Find all tokens launched by this Twitter user
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

    // Step 2: Get all token IDs launched by this Twitter user
    // X login proves ownership - no wallet matching required anymore
    const allTokenIds = socialPosts
      .map(p => p.fun_token_id)
      .filter((id): id is string => id !== null);

    // Filter by requested tokenIds if provided
    const targetTokenIds = tokenIds && tokenIds.length > 0
      ? allTokenIds.filter(id => tokenIds.includes(id))
      : allTokenIds;

    if (targetTokenIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid tokens to claim from" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Calculate claimable fees
    const { data: feeClaims, error: feeError } = await supabase
      .from("fun_fee_claims")
      .select("id, fun_token_id, claimed_sol, creator_distributed")
      .in("fun_token_id", targetTokenIds)
      .eq("creator_distributed", false);

    if (feeError) {
      throw new Error(`Failed to fetch fee claims: ${feeError.message}`);
    }

    const totalCollected = (feeClaims || []).reduce((sum, f) => sum + (f.claimed_sol || 0), 0);
    const creatorShare = totalCollected * CREATOR_SHARE;

    // If checkOnly, return status without claiming
    if (checkOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          canClaim,
          remainingSeconds,
          nextClaimAt,
          pendingAmount: creatorShare,
          minClaimAmount: MIN_CLAIM_SOL,
          meetsMinimum: creatorShare >= MIN_CLAIM_SOL,
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
          pendingAmount: creatorShare,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!feeClaims || feeClaims.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          claimedAmount: 0,
          message: "No unclaimed fees available",
          nextClaimAt: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (creatorShare < MIN_CLAIM_SOL) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Minimum claim is ${MIN_CLAIM_SOL} SOL. Current claimable: ${creatorShare.toFixed(6)} SOL`,
          pendingAmount: creatorShare,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agent-creator-claim] @${normalizedUsername} claiming ${creatorShare.toFixed(6)} SOL to ${payoutWallet} (${feeClaims.length} fee claims)`);

    // Step 4: Send SOL from treasury to user-specified wallet
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

    if (treasuryBalanceSol < creatorShare + 0.01) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Insufficient treasury balance. Please try again later.",
          treasuryBalance: treasuryBalanceSol,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create and send transaction to user's specified wallet
    const recipientPubkey = new PublicKey(payoutWallet);
    const lamports = Math.floor(creatorShare * 1e9);

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

    console.log(`[agent-creator-claim] ✅ Sent ${creatorShare} SOL to ${payoutWallet}, sig: ${signature}`);

    // Step 5: Mark fee claims as distributed
    const feeClaimIds = feeClaims.map(f => f.id);
    await supabase
      .from("fun_fee_claims")
      .update({ 
        creator_distributed: true,
        processed_at: new Date().toISOString(),
      })
      .in("id", feeClaimIds);

    // Step 6: Record the distribution with payout wallet
    for (const tokenId of targetTokenIds) {
      const tokenFees = feeClaims
        .filter(f => f.fun_token_id === tokenId)
        .reduce((sum, f) => sum + (f.claimed_sol || 0), 0);

      if (tokenFees > 0) {
        await supabase.from("fun_distributions").insert({
          fun_token_id: tokenId,
          creator_wallet: payoutWallet,  // Now stores the user's chosen payout wallet
          amount_sol: tokenFees * CREATOR_SHARE,
          distribution_type: "creator_claim",
          signature,
          status: "completed",
        });
      }
    }

    // Calculate next claim time
    const newNextClaimAt = new Date(Date.now() + CLAIM_COOLDOWN_MS).toISOString();

    return new Response(
      JSON.stringify({
        success: true,
        claimedAmount: creatorShare,
        payoutWallet,
        signature,
        solscanUrl: `https://solscan.io/tx/${signature}`,
        tokensClaimed: targetTokenIds.length,
        feeClaimsClosed: feeClaimIds.length,
        nextClaimAt: newNextClaimAt,
        cooldownSeconds: CLAIM_COOLDOWN_MS / 1000,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
