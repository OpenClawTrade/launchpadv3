import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Use DB-level aggregation to avoid 1000-row limit
    const { data: statsJson, error: rpcError } = await supabase.rpc("get_agent_token_stats");

    if (rpcError) {
      throw new Error(`RPC error: ${rpcError.message}`);
    }

    const stats = statsJson || {
      totalMarketCap: 0,
      totalVolume: 0,
      totalTokensLaunched: 0,
      totalAgents: 0,
      totalAgentPosts: 0,
      totalAgentFeesEarned: 0,
      totalAgentPayouts: 0,
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
