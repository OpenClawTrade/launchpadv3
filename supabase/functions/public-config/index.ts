import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const appIdRaw = Deno.env.get("VITE_PRIVY_APP_ID") ?? Deno.env.get("PRIVY_APP_ID") ?? "";
    const privyAppId = appIdRaw.trim();

    return new Response(JSON.stringify({ privyAppId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("public-config error:", e);
    return new Response(JSON.stringify({ privyAppId: "", error: "Failed to load config" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
