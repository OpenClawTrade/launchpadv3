import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_LAUNCHES_PER_HOUR = 2;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP from headers (Cloudflare, Vercel, or direct)
    const clientIP = 
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    console.log("[check-launch-rate] Client IP:", clientIP);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

    // Count launches from this IP in the last hour
    const { data: recentLaunches, error } = await supabase
      .from("launch_rate_limits")
      .select("launched_at")
      .eq("ip_address", clientIP)
      .gte("launched_at", oneHourAgo)
      .order("launched_at", { ascending: true });

    if (error) {
      console.error("[check-launch-rate] DB error:", error);
      throw error;
    }

    const launchCount = recentLaunches?.length || 0;
    console.log("[check-launch-rate] Recent launches:", launchCount);

    if (launchCount >= MAX_LAUNCHES_PER_HOUR) {
      // Calculate time until oldest launch expires
      const oldestLaunch = new Date(recentLaunches![0].launched_at);
      const expiresAt = new Date(oldestLaunch.getTime() + RATE_LIMIT_WINDOW_MS);
      const waitSeconds = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);

      return new Response(
        JSON.stringify({
          allowed: false,
          launchCount,
          maxLaunches: MAX_LAUNCHES_PER_HOUR,
          waitSeconds: Math.max(0, waitSeconds),
          message: `You've already launched ${launchCount} coins in the last 60 minutes. Please wait.`,
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(
      JSON.stringify({
        allowed: true,
        launchCount,
        maxLaunches: MAX_LAUNCHES_PER_HOUR,
        remaining: MAX_LAUNCHES_PER_HOUR - launchCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[check-launch-rate] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to check rate limit" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
