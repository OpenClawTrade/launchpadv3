import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  mint: string | null;
  imageUrl: string | null;
  createdAt: string;
  totalFeesEarned: number;
  volume24h: number;
  marketCapSol: number;
  priceSol: number;
  holderCount: number;
  poolAddress: string | null;
}

interface ClaimableAgent {
  id: string;
  name: string;
  walletAddress: string;
  avatarUrl: string | null;
  description: string | null;
  launchedAt: string;
  tokensLaunched: number;
  totalFeesEarned: number;
  totalFeesClaimed: number;
  unclaimedFees: number;
  verified: boolean;
  tokens: TokenInfo[];
}

/**
 * Find agents and tokens by Twitter username.
 * Searches both:
 * 1. Agents with matching style_source_username (claimed agents)
 * 2. Tokens launched via Twitter by matching post_author (unclaimed tokens)
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

    const { twitterUsername } = await req.json();

    if (!twitterUsername || typeof twitterUsername !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "twitterUsername is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize username (remove @ if present, lowercase)
    const normalizedUsername = twitterUsername.replace(/^@/, "").toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Strategy 1: Find agents by style_source_username (existing path)
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select(`
        id,
        name,
        wallet_address,
        verified_at,
        created_at,
        avatar_url,
        description,
        style_source_username,
        total_tokens_launched,
        total_fees_earned_sol,
        total_fees_claimed_sol
      `)
      .ilike("style_source_username", normalizedUsername)
      .order("created_at", { ascending: false });

    if (agentsError) {
      console.error("[agent-find-by-twitter] Agents query error:", agentsError);
    }

    // Strategy 2: Find tokens launched via Twitter by post_author
    const { data: socialPosts, error: postsError } = await supabase
      .from("agent_social_posts")
      .select(`
        id,
        post_author,
        fun_token_id,
        wallet_address,
        created_at,
        post_url
      `)
      .ilike("post_author", normalizedUsername)
      .eq("platform", "twitter")
      .eq("status", "completed")
      .not("fun_token_id", "is", null)
      .order("created_at", { ascending: false });

    if (postsError) {
      console.error("[agent-find-by-twitter] Social posts query error:", postsError);
    }

    // Get token IDs from social posts
    const tokenIds = (socialPosts || [])
      .map(p => p.fun_token_id)
      .filter((id): id is string => id !== null);

    // Fetch full token details
    let tokenDetails: any[] = [];
    if (tokenIds.length > 0) {
      const { data: tokens } = await supabase
        .from("fun_tokens")
        .select(`
          id,
          name,
          ticker,
          mint_address,
          image_url,
          created_at,
          total_fees_earned,
          volume_24h_sol,
          market_cap_sol,
          price_sol,
          holder_count,
          dbc_pool_address,
          creator_wallet,
          agent_id
        `)
        .in("id", tokenIds);

      tokenDetails = tokens || [];
    }

    // Calculate fees earned for each token from fee claims
    const tokenFeesMap = new Map<string, number>();
    if (tokenIds.length > 0) {
      const { data: feeClaims } = await supabase
        .from("fun_fee_claims")
        .select("fun_token_id, claimed_sol")
        .in("fun_token_id", tokenIds);

      for (const claim of feeClaims || []) {
        if (claim.fun_token_id) {
          const current = tokenFeesMap.get(claim.fun_token_id) || 0;
          tokenFeesMap.set(claim.fun_token_id, current + (claim.claimed_sol || 0));
        }
      }
    }

    // Get UNCLAIMED fees - fee claims that haven't been distributed to creator yet
    const tokenUnclaimedMap = new Map<string, number>();
    if (tokenIds.length > 0) {
      const { data: unclaimedFeeClaims } = await supabase
        .from("fun_fee_claims")
        .select("fun_token_id, claimed_sol")
        .in("fun_token_id", tokenIds)
        .eq("creator_distributed", false);

      for (const claim of unclaimedFeeClaims || []) {
        if (claim.fun_token_id) {
          const current = tokenUnclaimedMap.get(claim.fun_token_id) || 0;
          tokenUnclaimedMap.set(claim.fun_token_id, current + (claim.claimed_sol || 0));
        }
      }
    }

    // Build agents list with tokens
    const claimableAgents: ClaimableAgent[] = [];

    // Process existing agents
    for (const agent of agents || []) {
      const { data: agentTokens } = await supabase
        .from("fun_tokens")
        .select(`
          id,
          name,
          ticker,
          mint_address,
          image_url,
          created_at,
          total_fees_earned,
          volume_24h_sol,
          market_cap_sol,
          price_sol,
          holder_count,
          dbc_pool_address
        `)
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false });

      const tokens: TokenInfo[] = (agentTokens || []).map(t => ({
        id: t.id,
        symbol: t.ticker,
        name: t.name,
        mint: t.mint_address,
        imageUrl: t.image_url,
        createdAt: t.created_at,
        totalFeesEarned: tokenFeesMap.get(t.id) || (t.total_fees_earned || 0),
        volume24h: t.volume_24h_sol || 0,
        marketCapSol: t.market_cap_sol || 0,
        priceSol: t.price_sol || 0,
        holderCount: t.holder_count || 0,
        poolAddress: t.dbc_pool_address,
      }));

      const totalFeesEarned = tokens.reduce((sum, t) => sum + t.totalFeesEarned, 0);
      const totalFeesClaimed = agent.total_fees_claimed_sol || 0;

      claimableAgents.push({
        id: agent.id,
        name: agent.name,
        walletAddress: agent.wallet_address,
        avatarUrl: agent.avatar_url,
        description: agent.description,
        launchedAt: agent.created_at,
        tokensLaunched: tokens.length,
        totalFeesEarned: totalFeesEarned * 0.8, // 80% creator share
        totalFeesClaimed,
        unclaimedFees: Math.max(0, (totalFeesEarned * 0.8) - totalFeesClaimed),
        verified: agent.verified_at !== null,
        tokens,
      });
    }

    // Process tokens from social posts that may not have agents yet
    // Group by creator wallet
    const walletTokensMap = new Map<string, TokenInfo[]>();
    
    for (const post of socialPosts || []) {
      const token = tokenDetails.find(t => t.id === post.fun_token_id);
      if (!token) continue;

      // Skip if already associated with an agent we found
      if (claimableAgents.some(a => a.tokens.some(t => t.id === token.id))) continue;

      const wallet = post.wallet_address || token.creator_wallet;
      if (!wallet) continue;

      const tokenInfo: TokenInfo = {
        id: token.id,
        symbol: token.ticker,
        name: token.name,
        mint: token.mint_address,
        imageUrl: token.image_url,
        createdAt: token.created_at,
        totalFeesEarned: tokenFeesMap.get(token.id) || (token.total_fees_earned || 0),
        volume24h: token.volume_24h_sol || 0,
        marketCapSol: token.market_cap_sol || 0,
        priceSol: token.price_sol || 0,
        holderCount: token.holder_count || 0,
        poolAddress: token.dbc_pool_address,
      };

      const existing = walletTokensMap.get(wallet) || [];
      existing.push(tokenInfo);
      walletTokensMap.set(wallet, existing);
    }

    // Create pseudo-agents for wallet groups without actual agents
    for (const [wallet, tokens] of walletTokensMap.entries()) {
      const totalFeesEarned = tokens.reduce((sum, t) => sum + t.totalFeesEarned, 0);
      const unclaimedFees = tokens.reduce((sum, t) => {
        return sum + (tokenUnclaimedMap.get(t.id) || 0);
      }, 0);

      claimableAgents.push({
        id: `wallet_${wallet.slice(0, 8)}`,
        name: `@${normalizedUsername}`,
        walletAddress: wallet,
        avatarUrl: tokens[0]?.imageUrl || null,
        description: `Tokens launched via Twitter by @${normalizedUsername}`,
        launchedAt: tokens[0]?.createdAt || new Date().toISOString(),
        tokensLaunched: tokens.length,
        totalFeesEarned: totalFeesEarned * 0.8, // 80% creator share
        totalFeesClaimed: 0,
        unclaimedFees: unclaimedFees * 0.8,
        verified: false,
        tokens,
      });
    }

    console.log(
      `[agent-find-by-twitter] Found ${claimableAgents.length} agents/groups with ${claimableAgents.reduce((sum, a) => sum + a.tokens.length, 0)} total tokens for @${normalizedUsername}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        twitterUsername: normalizedUsername,
        agents: claimableAgents,
        summary: {
          totalAgents: claimableAgents.length,
          totalTokens: claimableAgents.reduce((sum, a) => sum + a.tokens.length, 0),
          totalFeesEarned: claimableAgents.reduce((sum, a) => sum + a.totalFeesEarned, 0),
          totalUnclaimedFees: claimableAgents.reduce((sum, a) => sum + a.unclaimedFees, 0),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agent-find-by-twitter] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
