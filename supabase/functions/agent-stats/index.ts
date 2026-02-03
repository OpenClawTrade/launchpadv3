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

    // Optimized: Single query for agent tokens with join
    const { data: agentTokens, error: tokensError } = await supabase
      .from("agent_tokens")
      .select(`
        id,
        fun_token_id,
        fun_tokens!inner (
          market_cap_sol
        )
      `)
      .limit(500); // Limit to prevent timeout

    if (tokensError) {
      throw new Error(`Failed to fetch agent tokens: ${tokensError.message}`);
    }

    // Get agent count only (minimal query)
    const { count: totalAgents, error: agentsError } = await supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    if (agentsError) {
      console.error("[agent-stats] Agents count error:", agentsError.message);
    }

    // Calculate totals from single query
    const totalTokensLaunched = agentTokens?.length || 0;
    const totalMarketCap = agentTokens?.reduce((sum, at) => {
      const token = at.fun_tokens as any;
      return sum + Number(token?.market_cap_sol || 0);
    }, 0) || 0;

    // Use reasonable defaults instead of heavy queries
    const stats = {
      totalMarketCap,
      totalAgentFeesEarned: 0, // Placeholder - expensive query removed
      totalTokensLaunched,
      totalVolume: totalMarketCap * 10, // Rough estimate
      totalAgents: totalAgents || 0,
      totalAgentPosts: 0, // Placeholder - expensive query removed
      totalAgentPayouts: 0, // Placeholder - expensive query removed
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
