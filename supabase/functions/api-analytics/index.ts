import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Hash API key using the same method as api-claim-fees (with encryption key)
async function hashApiKey(apiKey: string): Promise<string> {
  const encryptionKey = Deno.env.get("API_ENCRYPTION_KEY") || "";
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey + encryptionKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const walletAddress = url.searchParams.get("wallet");
    const launchpadId = url.searchParams.get("launchpad");
    const period = url.searchParams.get("period") || "7d"; // 24h, 7d, 30d

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: "wallet parameter required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get account
    const { data: account } = await supabaseAdmin
      .from("api_accounts")
      .select("id, total_fees_earned, total_fees_paid_out, created_at")
      .eq("wallet_address", walletAddress)
      .single();

    if (!account) {
      return new Response(
        JSON.stringify({ error: "Account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate period start
    const now = new Date();
    let periodStart: Date;
    switch (period) {
      case "24h":
        periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "30d":
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // 7d
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get launchpads with stats
    let launchpadsQuery = supabaseAdmin
      .from("api_launchpads")
      .select("id, name, subdomain, status, total_volume_sol, total_fees_sol, created_at")
      .eq("api_account_id", account.id);

    if (launchpadId) {
      launchpadsQuery = launchpadsQuery.eq("id", launchpadId);
    }

    const { data: launchpads } = await launchpadsQuery;

    // Get fee distributions for the period
    const { data: feeDistributions } = await supabaseAdmin
      .from("api_fee_distributions")
      .select("api_user_share, platform_share, created_at, status, launchpad_id")
      .eq("api_account_id", account.id)
      .gte("created_at", periodStart.toISOString())
      .order("created_at", { ascending: true });

    // Calculate daily breakdown
    const dailyData: Record<string, { volume: number; fees: number; trades: number }> = {};
    
    for (const dist of feeDistributions || []) {
      const date = new Date(dist.created_at).toISOString().split("T")[0];
      if (!dailyData[date]) {
        dailyData[date] = { volume: 0, fees: 0, trades: 0 };
      }
      dailyData[date].fees += dist.api_user_share || 0;
      dailyData[date].trades += 1;
      // Volume is approximated from fee (fee is ~1.5% of volume for API trades)
      dailyData[date].volume += ((dist.api_user_share || 0) / 0.015);
    }

    // Get API usage logs count
    const { count: usageCount } = await supabaseAdmin
      .from("api_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("api_account_id", account.id)
      .gte("created_at", periodStart.toISOString());

    // Summary stats
    const totalFeesInPeriod = (feeDistributions || []).reduce((sum, d) => sum + (d.api_user_share || 0), 0);
    const totalTradesInPeriod = feeDistributions?.length || 0;
    const pendingFees = (feeDistributions || [])
      .filter(d => d.status === "pending")
      .reduce((sum, d) => sum + (d.api_user_share || 0), 0);

    return new Response(
      JSON.stringify({
        account: {
          totalEarned: account.total_fees_earned || 0,
          totalPaidOut: account.total_fees_paid_out || 0,
          pendingFees,
          memberSince: account.created_at,
        },
        period: {
          start: periodStart.toISOString(),
          end: now.toISOString(),
          label: period,
        },
        summary: {
          totalFees: totalFeesInPeriod,
          totalTrades: totalTradesInPeriod,
          totalVolume: totalFeesInPeriod / 0.015, // Approximate
          apiCalls: usageCount || 0,
        },
        launchpads: launchpads || [],
        dailyBreakdown: Object.entries(dailyData).map(([date, data]) => ({
          date,
          ...data,
        })).sort((a, b) => a.date.localeCompare(b.date)),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[api-analytics] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
