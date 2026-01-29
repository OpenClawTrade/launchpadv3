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

    // Public runtime config (lets the frontend work even when Vite env vars are not injected)
    const meteoraApiUrlRaw =
      Deno.env.get("VITE_METEORA_API_URL") ?? Deno.env.get("METEORA_API_URL") ?? "";
    const meteoraApiUrl = meteoraApiUrlRaw.trim();

    // Get Helius RPC URL from HELIUS_RPC_URL secret (not VITE_ prefixed)
    const heliusRpcUrlRaw = Deno.env.get("HELIUS_RPC_URL") ?? "";
    const heliusRpcUrl = heliusRpcUrlRaw.trim();
    
    console.log("[public-config] HELIUS_RPC_URL set:", !!heliusRpcUrl, "starts with https://mainnet.helius:", heliusRpcUrl.startsWith("https://mainnet.helius"));

    return new Response(JSON.stringify({ privyAppId, meteoraApiUrl, heliusRpcUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("public-config error:", e);
    return new Response(
      JSON.stringify({ privyAppId: "", meteoraApiUrl: "", heliusRpcUrl: "", error: "Failed to load config" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
