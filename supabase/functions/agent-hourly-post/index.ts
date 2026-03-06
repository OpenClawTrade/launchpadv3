import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// DISABLED: Agent posting system is disabled while we remake the trading agent architecture
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  console.log("[agent-hourly-post] DISABLED - agent posting system is shut down");
  return new Response(
    JSON.stringify({ success: true, disabled: true, reason: "Agent posting system is disabled" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
