import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_CLAIM_SOL = 0.01;
const CREATOR_SHARE = 0.3; // Creator gets 30% of total fees earned
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

    // Find tokens created by this Twitter user from BOTH sources:
    // 1. fun_tokens via agent_social_posts (post_author match)
    // 2. claw_tokens directly
    
    // Source 1: fun_tokens via agent_social_posts
    const { data: socialPosts } = await supabase
      .from("agent_social_posts")
      .select("fun_token_id")
      .ilike("post_author", normalizedUsername)
      .not("fun_token_id", "is", null);

    const funTokenIds = [...new Set((socialPosts || []).map(p => p.fun_token_id).filter(Boolean))];

    // Source 2: claw_tokens  
    const { data: clawTokens } = await supabase
      .from("claw_tokens")
      .select("id")
      .eq("status", "active");

    const clawTokenIds = (clawTokens || []).map(t => t.id);

    // Combine both sources
    const allTokenIds = [...new Set([...funTokenIds, ...clawTokenIds])];
    const targetTokenIds = tokenIds?.length ? allTokenIds.filter((id: string) => tokenIds.includes(id)) : allTokenIds;

    if (targetTokenIds.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No tokens found to claim from" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Calculate claimable amounts from fun_tokens.total_fees_earned
    // Fun tokens store total_fees_earned directly
    let totalCreatorEarned = 0;
    const tokenEarnings: Record<string, number> = {};

    if (funTokenIds.length > 0) {
      const funTargetIds = targetTokenIds.filter((id: string) => funTokenIds.includes(id));
      if (funTargetIds.length > 0) {
        const { data: funTokenData } = await supabase
          .from("fun_tokens")
          .select("id, total_fees_earned")
          .in("id", funTargetIds);

        for (const ft of funTokenData || []) {
          const earned = (ft.total_fees_earned || 0) * CREATOR_SHARE;
          tokenEarnings[ft.id] = earned;
          totalCreatorEarned += earned;
        }
      }
    }

    // Also check claw_fee_claims for claw tokens
    const clawTargetIds = targetTokenIds.filter((id: string) => clawTokenIds.includes(id) && !funTokenIds.includes(id));
    if (clawTargetIds.length > 0) {
      const { data: feeClaims } = await supabase.from("claw_fee_claims").select("fun_token_id, claimed_sol").in("fun_token_id", clawTargetIds);
      for (const fc of feeClaims || []) {
        const earned = (fc.claimed_sol || 0) * CREATOR_SHARE;
        tokenEarnings[fc.fun_token_id] = (tokenEarnings[fc.fun_token_id] || 0) + earned;
        totalCreatorEarned += earned;
      }
    }

    // Get already-paid distributions
    const { data: distributions } = await supabase
      .from("claw_distributions")
      .select("amount_sol, fun_token_id")
      .in("fun_token_id", targetTokenIds)
      .eq("distribution_type", "creator_claim")
      .eq("status", "completed")
      .eq("twitter_username", normalizedUsername);

    const totalCreatorPaid = (distributions || []).reduce((sum, d) => sum + (d.amount_sol || 0), 0);
    const paidPerToken: Record<string, number> = {};
    for (const d of distributions || []) {
      paidPerToken[d.fun_token_id] = (paidPerToken[d.fun_token_id] || 0) + (d.amount_sol || 0);
    }

    const claimable = Math.max(0, totalCreatorEarned - totalCreatorPaid);

    console.log(`[claw-creator-claim] User @${normalizedUsername}: earned=${totalCreatorEarned.toFixed(6)}, paid=${totalCreatorPaid.toFixed(6)}, claimable=${claimable.toFixed(6)}, tokens=${targetTokenIds.length} (fun=${funTokenIds.length}, claw=${clawTargetIds.length})`);

    if (checkOnly) {
      return new Response(JSON.stringify({
        success: true, canClaim, remainingSeconds, nextClaimAt,
        pendingAmount: claimable,
        totalEarned: totalCreatorEarned,
        totalClaimed: totalCreatorPaid,
        minClaimAmount: MIN_CLAIM_SOL,
        meetsMinimum: claimable >= MIN_CLAIM_SOL,
        tokenCount: targetTokenIds.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      if (treasuryBalance / 1e9 < claimable + 0.01) throw new Error("Insufficient treasury balance");

      const recipientPubkey = new PublicKey(payoutWallet);
      const lamports = Math.floor(claimable * 1e9);
      const transaction = new Transaction().add(SystemProgram.transfer({ fromPubkey: treasuryKeypair.publicKey, toPubkey: recipientPubkey, lamports }));
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = treasuryKeypair.publicKey;
      const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], { commitment: "confirmed", maxRetries: 3 });

      console.log(`[claw-creator-claim] ✅ Sent ${claimable.toFixed(6)} SOL to ${payoutWallet}, sig: ${signature}`);

      // Record distributions per token
      for (const tokenId of targetTokenIds) {
        const tokenEarned = tokenEarnings[tokenId] || 0;
        const tokenPaid = paidPerToken[tokenId] || 0;
        const tokenClaimable = Math.max(0, tokenEarned - tokenPaid);
        if (tokenClaimable > 0.000001) {
          await supabase.from("claw_distributions").insert({
            fun_token_id: tokenId,
            creator_wallet: payoutWallet,
            amount_sol: tokenClaimable,
            distribution_type: "creator_claim",
            signature,
            status: "completed",
            twitter_username: normalizedUsername,
          });

          // Also update fun_tokens.total_fees_claimed
          if (funTokenIds.includes(tokenId)) {
            await supabase
              .from("fun_tokens")
              .update({ total_fees_claimed: tokenPaid + tokenClaimable })
              .eq("id", tokenId);
          }
        }
      }

      return new Response(JSON.stringify({
        success: true, claimedAmount: claimable, payoutWallet, signature,
        solscanUrl: `https://solscan.io/tx/${signature}`,
        tokensClaimed: targetTokenIds.length,
        nextClaimAt: new Date(Date.now() + CLAIM_COOLDOWN_MS).toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } finally {
      await supabase.rpc("release_claw_creator_claim_lock", { p_twitter_username: normalizedUsername });
    }
  } catch (error) {
    console.error("[claw-creator-claim] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
