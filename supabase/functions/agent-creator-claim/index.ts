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

interface ClaimRequest {
  twitterUsername: string;
  walletAddress: string;
  tokenIds?: string[];
}

/**
 * Secure fee claiming for token creators who launched via Twitter.
 * 
 * Security checks:
 * 1. Verify the Twitter username matches the post_author on token launches
 * 2. Verify the wallet matches the creator_wallet on the token
 * 3. Only distribute fees that have been collected to treasury
 * 4. Track all claims to prevent double-spending
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
    const { twitterUsername, walletAddress, tokenIds } = body;

    if (!twitterUsername || !walletAddress) {
      return new Response(
        JSON.stringify({ success: false, error: "twitterUsername and walletAddress are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate wallet address format
    try {
      new PublicKey(walletAddress);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid wallet address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Step 2: Verify wallet ownership - wallet must match what was used in launch
    const validTokenIds = socialPosts
      .filter(p => {
        // Wallet must match what was specified in the launch
        return p.wallet_address?.toLowerCase() === walletAddress.toLowerCase();
      })
      .map(p => p.fun_token_id)
      .filter((id): id is string => id !== null);

    if (validTokenIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Wallet ${walletAddress.slice(0, 8)}... does not match any tokens launched by @${normalizedUsername}` 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter by requested tokenIds if provided
    const targetTokenIds = tokenIds && tokenIds.length > 0
      ? validTokenIds.filter(id => tokenIds.includes(id))
      : validTokenIds;

    if (targetTokenIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid tokens to claim from" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Calculate claimable fees
    // Get total fees collected for these tokens
    const { data: feeClaims, error: feeError } = await supabase
      .from("fun_fee_claims")
      .select("id, fun_token_id, claimed_sol, creator_distributed")
      .in("fun_token_id", targetTokenIds)
      .eq("creator_distributed", false);

    if (feeError) {
      throw new Error(`Failed to fetch fee claims: ${feeError.message}`);
    }

    if (!feeClaims || feeClaims.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          claimedAmount: 0,
          message: "No unclaimed fees available" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate creator's share (80% of collected fees)
    const totalCollected = feeClaims.reduce((sum, f) => sum + (f.claimed_sol || 0), 0);
    const creatorShare = totalCollected * CREATOR_SHARE;

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

    console.log(`[agent-creator-claim] @${normalizedUsername} claiming ${creatorShare.toFixed(6)} SOL (${feeClaims.length} fee claims)`);

    // Step 4: Send SOL from treasury
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

    // Create and send transaction
    const recipientPubkey = new PublicKey(walletAddress);
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

    console.log(`[agent-creator-claim] ✅ Sent ${creatorShare} SOL to ${walletAddress}, sig: ${signature}`);

    // Step 5: Mark fee claims as distributed
    const feeClaimIds = feeClaims.map(f => f.id);
    await supabase
      .from("fun_fee_claims")
      .update({ 
        creator_distributed: true,
        processed_at: new Date().toISOString(),
      })
      .in("id", feeClaimIds);

    // Step 6: Record the distribution
    for (const tokenId of targetTokenIds) {
      const tokenFees = feeClaims
        .filter(f => f.fun_token_id === tokenId)
        .reduce((sum, f) => sum + (f.claimed_sol || 0), 0);

      if (tokenFees > 0) {
        await supabase.from("fun_distributions").insert({
          fun_token_id: tokenId,
          creator_wallet: walletAddress,
          amount_sol: tokenFees * CREATOR_SHARE,
          distribution_type: "creator_claim",
          signature,
          status: "completed",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        claimedAmount: creatorShare,
        signature,
        solscanUrl: `https://solscan.io/tx/${signature}`,
        tokensClaimed: targetTokenIds.length,
        feeClaimsClosed: feeClaimIds.length,
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
