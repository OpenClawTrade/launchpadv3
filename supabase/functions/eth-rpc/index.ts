import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Priority: explicit ETH_MAINNET_RPC_URL (e.g. QuickNode) > Alchemy key > public fallback
  const explicitUrl = Deno.env.get("ETH_MAINNET_RPC_URL");
  const ALCHEMY_KEY = Deno.env.get("ALCHEMY_BSC_API_KEY"); // same Alchemy account works for ETH
  const rpcUrl =
    (explicitUrl && explicitUrl.startsWith("https://") && explicitUrl) ||
    (ALCHEMY_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : "https://ethereum-rpc.publicnode.com");

  try {
    const body = await req.text();
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const data = await res.text();
    return new Response(data, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ETH RPC proxy error:", error);
    return new Response(JSON.stringify({ error: "RPC request failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
