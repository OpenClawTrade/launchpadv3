const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain", "Access-Control-Max-Age": "86400" },
    });
  }

  try {
    const body = await req.json();
    const { poolAddress, phantomWallet } = body;

    if (!poolAddress || !phantomWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: poolAddress, phantomWallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const origin = req.headers.get("origin")?.replace(/\/$/, "") || "";
    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL") || origin;

    if (!meteoraApiUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "API URL not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fun-mode-remove-lp] 📡 Calling remove-fun-lp API:", `${meteoraApiUrl}/api/pool/remove-fun-lp`);

    const response = await fetch(`${meteoraApiUrl}/api/pool/remove-fun-lp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolAddress, phantomWallet }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[fun-mode-remove-lp] ❌ API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Remove LP failed: ${errorText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fun-mode-remove-lp] ❌ Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
