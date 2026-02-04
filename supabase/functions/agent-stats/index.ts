import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// In-memory cache for stats (5 minute TTL)
let cachedStats: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Return cached stats if fresh
    if (cachedStats && Date.now() - cachedStats.timestamp < CACHE_TTL_MS) {
      console.log("[agent-stats] Returning cached stats");
      return new Response(
        JSON.stringify({ success: true, stats: cachedStats.data, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get total token count (fast exact count query)
    const { count: totalTokensCount, error: countError } = await supabase
      .from("fun_tokens")
      .select("id", { count: "exact", head: true });

    if (countError) {
      console.error("[agent-stats] Token count error:", countError.message);
    }

    // Fast path: use fun_tokens.agent_id instead of joining agent_tokens -> fun_tokens.
    // This avoids heavy joins on cold starts and keeps response time predictable.
    const { data: agentLaunchedTokens, error: tokensError } = await supabase
      .from("fun_tokens")
      .select("id, market_cap_sol, agent_id")
      .not("agent_id", "is", null)
      .limit(1000);

    if (tokensError) throw new Error(`Failed to fetch agent-launched tokens: ${tokensError.message}`);

    // Get agent-launched token IDs for fee calculation
    const agentTokenIds = (agentLaunchedTokens || [])
      .map(t => (t as any)?.id)
      .filter(Boolean);

    // Sum claimed fees for agent tokens (lightweight: ~356 rows total)
    let totalAgentFeesEarned = 0;
    if (agentTokenIds.length > 0) {
      const { data: feeClaims } = await supabase
        .from("fun_fee_claims")
        .select("claimed_sol")
        .in("fun_token_id", agentTokenIds);
      
      totalAgentFeesEarned = (feeClaims || []).reduce(
        (sum, c) => sum + Number((c as any)?.claimed_sol || 0), 0
      ) * 0.8; // 80% goes to agents
    }

    // Count agent posts (lightweight query)
    const { count: agentPostsCount } = await supabase
      .from("subtuna_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_agent_post", true);

    const totalAgentPosts = agentPostsCount || 0;

    // Get agent count only (minimal query)
    const { count: totalAgents, error: agentsError } = await supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    if (agentsError) {
      console.error("[agent-stats] Agents count error:", agentsError.message);
    }

    // Get total agent payouts (lightweight query on ~250 rows)
    const { data: payoutRows } = await supabase
      .from("agent_fee_distributions")
      .select("amount_sol");

    const totalAgentPayouts = payoutRows?.reduce(
      (sum, r) => sum + Number(r.amount_sol || 0), 0
    ) || 0;

    const totalTokensLaunched = totalTokensCount || 0;
    const totalMarketCap =
      agentLaunchedTokens?.reduce((sum, t) => sum + Number((t as any)?.market_cap_sol || 0), 0) || 0;

    const stats = {
      totalMarketCap,
      totalAgentFeesEarned,
      totalTokensLaunched,
      totalVolume: totalMarketCap * 10, // Rough estimate
      totalAgents: totalAgents || 0,
      totalAgentPosts,
      totalAgentPayouts,
    };

    // Cache the result
    cachedStats = { data: stats, timestamp: Date.now() };

    return new Response(
      JSON.stringify({ success: true, stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agent-stats] Error:", error);
    
    // Return cached data even if stale on error
    if (cachedStats) {
      return new Response(
        JSON.stringify({ success: true, stats: cachedStats.data, stale: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
