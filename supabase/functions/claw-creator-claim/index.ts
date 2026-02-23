import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_CLAIM_SOL = 0.01;
const MAX_SINGLE_CLAIM_SOL = 5.0;
const CREATOR_SHARE = 0.3;
const CLAIM_COOLDOWN_MS = 60 * 60 * 1000;
const CLAIM_LOCK_SECONDS = 60;
const TREASURY_RESERVE_SOL = 0.05;

/**
 * Calculate claimable amount for a twitter user.
 * Uses fun_fee_claims / claw_fee_claims as source of truth (actual on-chain claims).
 * Subtracts already-paid distributions to get the remaining claimable amount.
 */
async function calculateClaimable(
  supabase: any,
  normalizedUsername: string,
  targetTokenIds: string[],
  funTokenIds: string[],
  clawTokenIds: string[],
) {
  let totalCreatorEarned = 0;
  const tokenEarnings: Record<string, number> = {};

  // Get actual claimed fees from fun_fee_claims for fun tokens
  const funTargetIds = targetTokenIds.filter((id) => funTokenIds.includes(id));
  if (funTargetIds.length > 0) {
    const { data: feeClaims } = await supabase
      .from("fun_fee_claims")
      .select("fun_token_id, claimed_sol")
      .in("fun_token_id", funTargetIds);

    for (const fc of feeClaims || []) {
      const earned = (fc.claimed_sol || 0) * CREATOR_SHARE;
      tokenEarnings[fc.fun_token_id] = (tokenEarnings[fc.fun_token_id] || 0) + earned;
      totalCreatorEarned += earned;
    }
  }

  // Also check claw_fee_claims for claw tokens
  const clawTargetIds = targetTokenIds.filter((id) => clawTokenIds.includes(id) && !funTokenIds.includes(id));
  if (clawTargetIds.length > 0) {
    const { data: feeClaims } = await supabase
      .from("claw_fee_claims")
      .select("fun_token_id, claimed_sol")
      .in("fun_token_id", clawTargetIds);

    for (const fc of feeClaims || []) {
      const earned = (fc.claimed_sol || 0) * CREATOR_SHARE;
      tokenEarnings[fc.fun_token_id] = (tokenEarnings[fc.fun_token_id] || 0) + earned;
      totalCreatorEarned += earned;
    }
  }

  // Get already-paid distributions for THIS specific user
  const { data: distributions } = await supabase
    .from("claw_distributions")
    .select("amount_sol, fun_token_id")
    .in("fun_token_id", targetTokenIds)
    .eq("distribution_type", "creator_claim")
    .eq("status", "completed")
    .eq("twitter_username", normalizedUsername);

  const totalCreatorPaid = (distributions || []).reduce((sum: number, d: any) => sum + (d.amount_sol || 0), 0);
  const paidPerToken: Record<string, number> = {};
  for (const d of distributions || []) {
    paidPerToken[d.fun_token_id] = (paidPerToken[d.fun_token_id] || 0) + (d.amount_sol || 0);
  }

  let claimable = Math.max(0, totalCreatorEarned - totalCreatorPaid);

  // Safety cap
  if (claimable > MAX_SINGLE_CLAIM_SOL) {
    console.log(`[claw-creator-claim] ⚠️ Capping claim from ${claimable.toFixed(6)} to ${MAX_SINGLE_CLAIM_SOL} SOL`);
    claimable = MAX_SINGLE_CLAIM_SOL;
  }

  return { claimable, totalCreatorEarned, totalCreatorPaid, tokenEarnings, paidPerToken };
}

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
    const treasuryKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");

    if (!treasuryKey || !heliusRpcUrl) return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limit check
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

    // ===== SECURITY FIX: Only find tokens OWNED by this Twitter user =====
    
    // Source 1: fun_tokens via agent_social_posts (post_author must match username)
    const { data: socialPosts } = await supabase
      .from("agent_social_posts")
      .select("fun_token_id")
      .ilike("post_author", normalizedUsername)
      .eq("platform", "twitter")
      .eq("status", "completed")
      .not("fun_token_id", "is", null);

    const funTokenIds = [...new Set((socialPosts || []).map((p: any) => p.fun_token_id).filter(Boolean))];

    // Source 2: claw_tokens — ONLY those created by agents with matching twitter_handle
    let clawTokenIds: string[] = [];
    const { data: matchingAgents } = await supabase
      .from("claw_agents")
      .select("id")
      .ilike("twitter_handle", normalizedUsername);

    if (matchingAgents && matchingAgents.length > 0) {
      const agentIds = matchingAgents.map((a: any) => a.id);
      const { data: agentClawTokens } = await supabase
        .from("claw_tokens")
        .select("id")
        .in("agent_id", agentIds);
      clawTokenIds = (agentClawTokens || []).map((t: any) => t.id);
    }

    // Source 3: Also check claw_agent_tokens for agent->token mappings
    if (matchingAgents && matchingAgents.length > 0) {
      const agentIds = matchingAgents.map((a: any) => a.id);
      const { data: agentTokenLinks } = await supabase
        .from("claw_agent_tokens")
        .select("fun_token_id")
        .in("agent_id", agentIds);
      const linkedIds = (agentTokenLinks || []).map((t: any) => t.fun_token_id);
      clawTokenIds = [...new Set([...clawTokenIds, ...linkedIds])];
    }

    const allTokenIds = [...new Set([...funTokenIds, ...clawTokenIds])];
    const targetTokenIds = tokenIds?.length ? allTokenIds.filter((id: string) => tokenIds.includes(id)) : allTokenIds;

    if (targetTokenIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `No tokens found launched by @${normalizedUsername}`,
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Initial calculation for checkOnly / display
    const initialCalc = await calculateClaimable(supabase, normalizedUsername, targetTokenIds, funTokenIds, clawTokenIds);

    console.log(`[claw-creator-claim] @${normalizedUsername}: earned=${initialCalc.totalCreatorEarned.toFixed(6)}, paid=${initialCalc.totalCreatorPaid.toFixed(6)}, claimable=${initialCalc.claimable.toFixed(6)}, tokens=${targetTokenIds.length}`);

    if (checkOnly) {
      return new Response(JSON.stringify({
        success: true, canClaim, remainingSeconds, nextClaimAt,
        pendingAmount: initialCalc.claimable,
        totalEarned: initialCalc.totalCreatorEarned,
        totalClaimed: initialCalc.totalCreatorPaid,
        minClaimAmount: MIN_CLAIM_SOL,
        meetsMinimum: initialCalc.claimable >= MIN_CLAIM_SOL,
        tokenCount: targetTokenIds.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!canClaim) {
      return new Response(JSON.stringify({ success: false, error: `Rate limited. Next claim in ${Math.floor(remainingSeconds / 60)}m`, rateLimited: true, remainingSeconds, pendingAmount: initialCalc.claimable }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (initialCalc.claimable < MIN_CLAIM_SOL) {
      return new Response(JSON.stringify({ success: false, error: `Minimum claim is ${MIN_CLAIM_SOL} SOL. Current: ${initialCalc.claimable.toFixed(6)} SOL`, pendingAmount: initialCalc.claimable }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Acquire lock
    const { data: lockAcquired } = await supabase.rpc("acquire_claw_creator_claim_lock", { p_twitter_username: normalizedUsername, p_duration_seconds: CLAIM_LOCK_SECONDS });
    if (!lockAcquired) {
      return new Response(JSON.stringify({ success: false, error: "Another claim in progress", locked: true }), { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
      // ===== SECURITY FIX: Re-verify claimable amount AFTER acquiring lock =====
      // This prevents race conditions where two requests pass the initial check
      // but only one should actually be paid out.
      const verifiedCalc = await calculateClaimable(supabase, normalizedUsername, targetTokenIds, funTokenIds, clawTokenIds);
      
      if (verifiedCalc.claimable < MIN_CLAIM_SOL) {
        console.log(`[claw-creator-claim] ⚠️ Post-lock verification failed: claimable=${verifiedCalc.claimable.toFixed(6)} < ${MIN_CLAIM_SOL}`);
        return new Response(JSON.stringify({ success: false, error: `Nothing left to claim after verification. Another claim may have just completed.`, pendingAmount: verifiedCalc.claimable }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Also re-check rate limit after lock (prevent race condition)
      const { data: recentClaim } = await supabase
        .from("claw_distributions")
        .select("created_at")
        .eq("distribution_type", "creator_claim")
        .eq("status", "completed")
        .eq("twitter_username", normalizedUsername)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentClaim) {
        const timeSinceRecent = Date.now() - new Date(recentClaim.created_at).getTime();
        if (timeSinceRecent < CLAIM_COOLDOWN_MS) {
          const secs = Math.ceil((CLAIM_COOLDOWN_MS - timeSinceRecent) / 1000);
          console.log(`[claw-creator-claim] ⚠️ Post-lock rate limit hit: ${secs}s remaining`);
          return new Response(JSON.stringify({ success: false, error: `Rate limited. Try again in ${Math.floor(secs / 60)}m`, rateLimited: true, remainingSeconds: secs }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const claimable = verifiedCalc.claimable;

      let treasuryKeypair: Keypair;
      try {
        if (treasuryKey.startsWith("[")) treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(treasuryKey)));
        else treasuryKeypair = Keypair.fromSecretKey(bs58.decode(treasuryKey));
      } catch { throw new Error("Invalid treasury configuration"); }

      const connection = new Connection(heliusRpcUrl, "confirmed");
      const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
      const treasuryBalanceSol = treasuryBalance / 1e9;

      console.log(`[claw-creator-claim] Treasury: ${treasuryBalanceSol.toFixed(6)} SOL, claiming: ${claimable.toFixed(6)} SOL`);

      if (treasuryBalanceSol < claimable + TREASURY_RESERVE_SOL) {
        throw new Error(`Insufficient treasury balance (${treasuryBalanceSol.toFixed(4)} SOL available, need ${(claimable + TREASURY_RESERVE_SOL).toFixed(4)} SOL)`);
      }

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
        const tokenEarned = verifiedCalc.tokenEarnings[tokenId] || 0;
        const tokenPaid = verifiedCalc.paidPerToken[tokenId] || 0;
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
