import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_CLAIM_SOL = 0.01;
const CREATOR_SHARE = 0.8;
const CLAIM_COOLDOWN_MS = 60 * 60 * 1000;
const CLAIM_LOCK_SECONDS = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { twitterUsername, tokenIds, checkOnly } = body;
    const payoutWallet = body.payoutWallet || body.walletAddress;

    if (!twitterUsername) return new Response(JSON.stringify({ success: false, error: "twitterUsername is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!checkOnly && !payoutWallet) return new Response(JSON.stringify({ success: false, error: "payoutWallet is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (payoutWallet) {
      try { new PublicKey(payoutWallet); } catch { return new Response(JSON.stringify({ success: false, error: "Invalid wallet address" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    }

    const normalizedUsername = twitterUsername.replace(/^@/, "").toLowerCase();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clawTreasuryKey = Deno.env.get("CLAW_TREASURY_PRIVATE_KEY");
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");

    if (!clawTreasuryKey || !heliusRpcUrl) return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limit check via claw_distributions
    const { data: lastClaim } = await supabase
      .from("claw_distributions")
      .select("created_at")
      .eq("distribution_type", "creator_claim")
      .eq("status", "completed")
      .eq("twitter_username", normalizedUsername)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = Date.now();
    let canClaim = true;
    let remainingSeconds = 0;
    let nextClaimAt: string | null = null;

    if (lastClaim) {
      const timeSince = now - new Date(lastClaim.created_at).getTime();
      if (timeSince < CLAIM_COOLDOWN_MS) {
        canClaim = false;
        remainingSeconds = Math.ceil((CLAIM_COOLDOWN_MS - timeSince) / 1000);
        nextClaimAt = new Date(new Date(lastClaim.created_at).getTime() + CLAIM_COOLDOWN_MS).toISOString();
      }
    }

    // Find tokens by creator wallet or agent style_source_username
    // For Claw Mode, we look at claw_tokens directly
    const { data: clawTokens } = await supabase
      .from("claw_tokens")
      .select("id")
      .eq("status", "active");

    const allTokenIds = (clawTokens || []).map(t => t.id);
    const targetTokenIds = tokenIds?.length ? allTokenIds.filter((id: string) => tokenIds.includes(id)) : allTokenIds;

    if (targetTokenIds.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No valid Claw tokens to claim from" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Calculate claimable from claw_fee_claims
    const { data: feeClaims } = await supabase.from("claw_fee_claims").select("fun_token_id, claimed_sol").in("fun_token_id", targetTokenIds);
    const totalCollected = (feeClaims || []).reduce((sum, f) => sum + (f.claimed_sol || 0), 0);
    const creatorEarned = totalCollected * CREATOR_SHARE;

    const { data: distributions } = await supabase.from("claw_distributions").select("amount_sol").in("fun_token_id", targetTokenIds).eq("distribution_type", "creator_claim").eq("status", "completed");
    const creatorPaid = (distributions || []).reduce((sum, d) => sum + (d.amount_sol || 0), 0);
    const claimable = Math.max(0, creatorEarned - creatorPaid);

    if (checkOnly) {
      return new Response(JSON.stringify({ success: true, canClaim, remainingSeconds, nextClaimAt, pendingAmount: claimable, totalEarned: creatorEarned, totalClaimed: creatorPaid, minClaimAmount: MIN_CLAIM_SOL, meetsMinimum: claimable >= MIN_CLAIM_SOL, tokenCount: targetTokenIds.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!canClaim) {
      return new Response(JSON.stringify({ success: false, error: `Rate limited. Next claim in ${Math.floor(remainingSeconds / 60)}m`, rateLimited: true, remainingSeconds, pendingAmount: claimable }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (claimable < MIN_CLAIM_SOL) {
      return new Response(JSON.stringify({ success: false, error: `Minimum claim is ${MIN_CLAIM_SOL} SOL. Current: ${claimable.toFixed(6)} SOL`, pendingAmount: claimable }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Acquire lock
    const { data: lockAcquired } = await supabase.rpc("acquire_claw_creator_claim_lock", { p_twitter_username: normalizedUsername, p_duration_seconds: CLAIM_LOCK_SECONDS });
    if (!lockAcquired) {
      return new Response(JSON.stringify({ success: false, error: "Another claim in progress", locked: true }), { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
      let treasuryKeypair: Keypair;
      try {
        if (clawTreasuryKey.startsWith("[")) treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(clawTreasuryKey)));
        else treasuryKeypair = Keypair.fromSecretKey(bs58.decode(clawTreasuryKey));
      } catch { throw new Error("Invalid treasury configuration"); }

      const connection = new Connection(heliusRpcUrl, "confirmed");
      const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
      if (treasuryBalance / 1e9 < claimable + 0.01) throw new Error("Insufficient Claw treasury balance");

      const recipientPubkey = new PublicKey(payoutWallet);
      const lamports = Math.floor(claimable * 1e9);
      const transaction = new Transaction().add(SystemProgram.transfer({ fromPubkey: treasuryKeypair.publicKey, toPubkey: recipientPubkey, lamports }));
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = treasuryKeypair.publicKey;
      const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], { commitment: "confirmed", maxRetries: 3 });

      console.log(`[claw-creator-claim] ✅ Sent ${claimable.toFixed(6)} SOL to ${payoutWallet}, sig: ${signature}`);

      for (const tokenId of targetTokenIds) {
        const tokenCollected = (feeClaims || []).filter(f => f.fun_token_id === tokenId).reduce((sum, f) => sum + (f.claimed_sol || 0), 0);
        const tokenEarned = tokenCollected * CREATOR_SHARE;
        const tokenPaid = (distributions || []).filter((d: any) => d.fun_token_id === tokenId).reduce((sum: number, d: any) => sum + (d.amount_sol || 0), 0);
        const tokenClaimable = Math.max(0, tokenEarned - tokenPaid);
        if (tokenClaimable > 0) {
          await supabase.from("claw_distributions").insert({ fun_token_id: tokenId, creator_wallet: payoutWallet, amount_sol: tokenClaimable, distribution_type: "creator_claim", signature, status: "completed", twitter_username: normalizedUsername });
        }
      }

      return new Response(JSON.stringify({ success: true, claimedAmount: claimable, payoutWallet, signature, solscanUrl: `https://solscan.io/tx/${signature}`, tokensClaimed: targetTokenIds.length, nextClaimAt: new Date(Date.now() + CLAIM_COOLDOWN_MS).toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } finally {
      await supabase.rpc("release_claw_creator_claim_lock", { p_twitter_username: normalizedUsername });
    }
  } catch (error) {
    console.error("[claw-creator-claim] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
