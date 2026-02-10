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

    // Total claw tokens count
    const { count: totalTokensCount } = await supabase
      .from("claw_tokens")
      .select("id", { count: "exact", head: true });

    // Claw tokens with agent_id for market cap + fees
    const { data: clawTokens } = await supabase
      .from("claw_tokens")
      .select("id, market_cap_sol, agent_id")
      .not("agent_id", "is", null)
      .limit(1000);

    const clawTokenIds = (clawTokens || []).map((t: any) => t.id).filter(Boolean);

    // Sum claimed fees for claw tokens
    let totalAgentFeesEarned = 0;
    if (clawTokenIds.length > 0) {
      const { data: feeClaims } = await supabase
        .from("claw_fee_claims")
        .select("claimed_sol")
        .in("fun_token_id", clawTokenIds);

      totalAgentFeesEarned = (feeClaims || []).reduce(
        (sum: number, c: any) => sum + Number(c?.claimed_sol || 0), 0
      ) * 0.8;
    }

    // Claw agent posts count
    const { count: agentPostsCount } = await supabase
      .from("claw_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_agent_post", true);

    // Claw agents count
    const { count: totalAgents } = await supabase
      .from("claw_agents")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    // Claw agent payouts
    const { data: payoutRows } = await supabase
      .from("claw_agent_fee_distributions")
      .select("amount_sol");

    const totalAgentPayouts = (payoutRows || []).reduce(
      (sum: number, r: any) => sum + Number(r.amount_sol || 0), 0
    );

    const totalTokensLaunched = totalTokensCount || 0;
    const totalMarketCap = (clawTokens || []).reduce(
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
