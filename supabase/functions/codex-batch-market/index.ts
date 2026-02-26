import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOLANA_NETWORK_ID = 1399811149;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("CODEX_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "CODEX_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { addresses } = await req.json().catch(() => ({}));
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return new Response(
        JSON.stringify({ error: "addresses array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit to 25 addresses per batch
    const validAddresses = addresses
      .filter((a: string) => typeof a === "string" && /^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(a))
      .slice(0, 25);

    if (validAddresses.length === 0) {
      return new Response(
        JSON.stringify({ results: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build tokens list for filterTokens query
    const tokensListStr = validAddresses.map((a: string) => `"${a}"`).join(", ");

    const query = `{
  filterTokens(
    filters: { network: [${SOLANA_NETWORK_ID}] }
    rankings: { attribute: marketCap, direction: DESC }
    tokens: [${tokensListStr}]
    limit: ${validAddresses.length}
  ) {
    results {
      token { address }
      holders
      marketCap
      volume24
      change24
      priceUSD
    }
  }
}`;

    const res = await fetch("https://graph.codex.io/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[codex-batch-market] API error:", res.status, text);
      return new Response(
        JSON.stringify({ error: "Codex API error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    if (data.errors) {
      console.error("[codex-batch-market] GraphQL errors:", JSON.stringify(data.errors));
    }

    const rawResults = data?.data?.filterTokens?.results || [];
    const results: Record<string, any> = {};

    for (const r of rawResults) {
      const addr = r.token?.address;
      if (!addr) continue;
      results[addr] = {
        marketCapUsd: r.marketCap ? parseFloat(r.marketCap) : 0,
        holders: r.holders ?? 0,
        change24h: r.change24 ? parseFloat(r.change24) : 0,
        priceUsd: r.priceUSD ? parseFloat(r.priceUSD) : 0,
        volume24hUsd: r.volume24 ? parseFloat(r.volume24) : 0,
      };
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[codex-batch-market] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
