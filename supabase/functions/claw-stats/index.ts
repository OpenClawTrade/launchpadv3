import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory cache (5 minute TTL)
let cachedStats: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (cachedStats && Date.now() - cachedStats.timestamp < CACHE_TTL_MS) {
      return new Response(
        JSON.stringify({ success: true, stats: cachedStats.data, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Total tokens count (from fun_tokens - the live data table)
    const { count: totalTokensCount } = await supabase
      .from("fun_tokens")
      .select("id", { count: "exact", head: true });

    // All tokens for market cap
    const { data: funTokens } = await supabase
      .from("fun_tokens")
      .select("id, market_cap_sol, agent_id, total_fees_earned")
      .limit(1000);

    // Sum total_fees_earned directly from fun_tokens
    const totalAgentFeesEarned = (funTokens || []).reduce(
      (sum: number, t: any) => sum + Number(t?.total_fees_earned || 0), 0
    );

    // Agent posts count
    const { count: agentPostsCount } = await supabase
      .from("agent_post_history")
      .select("id", { count: "exact", head: true });

    // Active agents count
    const { count: totalAgents } = await supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    // Agent payouts
    const { data: payoutRows } = await supabase
      .from("agent_fee_distributions")
      .select("amount_sol");

    const totalAgentPayouts = (payoutRows || []).reduce(
      (sum: number, r: any) => sum + Number(r.amount_sol || 0), 0
    );

    const totalTokensLaunched = totalTokensCount || 0;
    const totalMarketCap = (funTokens || []).reduce(
      (sum: number, t: any) => sum + Number(t?.market_cap_sol || 0), 0
    );

    const stats = {
      totalMarketCap,
      totalAgentFeesEarned,
      totalTokensLaunched,
      totalVolume: totalMarketCap * 10,
      totalAgents: totalAgents || 0,
      totalAgentPosts: agentPostsCount || 0,
      totalAgentPayouts,
    };

    cachedStats = { data: stats, timestamp: Date.now() };

    return new Response(
      JSON.stringify({ success: true, stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[claw-stats] Error:", error);

    if (cachedStats) {
      return new Response(
        JSON.stringify({ success: true, stats: cachedStats.data, stale: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
