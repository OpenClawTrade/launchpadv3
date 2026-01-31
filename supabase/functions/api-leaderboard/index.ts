import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");

    // Call the RPC function
    const { data: leaderboard, error: leaderboardError } = await supabase.rpc(
      "get_api_leaderboard",
      { p_limit: Math.min(limit, 100) }
    );

    if (leaderboardError) {
      console.error("Leaderboard error:", leaderboardError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch leaderboard" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get total API users count
    const { count: totalUsers } = await supabase
      .from("api_accounts")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // Get total platform volume from all API launchpads
    const { data: volumeData } = await supabase
      .from("api_launchpads")
      .select("total_volume_sol");
    
    const totalPlatformVolume = volumeData?.reduce(
      (sum, lp) => sum + (lp.total_volume_sol || 0),
      0
    ) || 0;

    // Format wallet addresses for display
    const formattedLeaderboard = (leaderboard || []).map((entry: any) => ({
      ...entry,
      wallet_display: entry.wallet_address
        ? `${entry.wallet_address.slice(0, 4)}...${entry.wallet_address.slice(-4)}`
        : "Unknown",
      pending_fees: Math.max(0, (entry.total_fees_earned || 0) - (entry.total_fees_paid_out || 0)),
    }));

    return new Response(
      JSON.stringify({
        leaderboard: formattedLeaderboard,
        total_api_users: totalUsers || 0,
        total_platform_volume: totalPlatformVolume,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
