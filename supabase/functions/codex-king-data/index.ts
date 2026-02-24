import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOLANA_NETWORK_ID = 1399811149;

/**
 * Fetches live token data from Codex for specific mint addresses.
 * Uses the `tokens` query with proper {address, networkId} input objects.
 */
function buildQuery(addresses: string[]): string {
  const ids = addresses
    .map(a => `{ address: "${a}", networkId: ${SOLANA_NETWORK_ID} }`)
    .join(", ");

  return `{
  tokens(ids: [${ids}]) {
    address
    decimals
    name
    symbol
    info {
      imageSmallUrl
    }
    socialLinks {
      twitter
      website
    }
    launchpad {
      graduationPercent
      completed
      migrated
    }
  }
}`;
}

/**
 * Use filterTokens per-address to get live market data (holders, mcap, volume).
 * We batch them in a single aliased query.
 */
function buildMarketQuery(addresses: string[]): string {
  const aliases = addresses.map((addr, i) => {
    return `t${i}: filterTokens(
      filters: { network: [${SOLANA_NETWORK_ID}] }
      rankings: { attribute: marketCap, direction: DESC }
      tokens: ["${addr}"]
      limit: 1
    ) {
      results {
        holders
        marketCap
        volume24
        liquidity
        change24
        token {
          info { address }
          launchpad { graduationPercent completed migrated }
        }
      }
    }`;
  });

  return `{ ${aliases.join("\n")} }`;
}

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

    const { addresses = [] } = await req.json().catch(() => ({}));

    if (!Array.isArray(addresses) || addresses.length === 0 || addresses.length > 10) {
      return new Response(
        JSON.stringify({ error: "Provide 1-10 addresses" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeAddresses = addresses.filter(
      (a: string) => typeof a === "string" && /^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(a)
    );

    if (safeAddresses.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid addresses" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use filterTokens with `tokens` filter param (per address) for live market data
    const query = buildMarketQuery(safeAddresses);

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
      console.error("Codex API error:", res.status, text);
      return new Response(
        JSON.stringify({ error: "Codex API error", status: res.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    if (data.errors) {
      console.error("Codex GraphQL errors:", JSON.stringify(data.errors));
      return new Response(
        JSON.stringify({ error: "GraphQL error", details: data.errors }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse aliased results
    const tokenMap: Record<string, any> = {};
    for (let i = 0; i < safeAddresses.length; i++) {
      const results = data?.data?.[`t${i}`]?.results;
      if (!results || results.length === 0) continue;
      const r = results[0];
      const addr = r.token?.info?.address ?? safeAddresses[i];
      tokenMap[addr] = {
        address: addr,
        holders: r.holders ?? 0,
        marketCap: r.marketCap ? parseFloat(r.marketCap) : 0,
        volume24h: r.volume24 ? parseFloat(r.volume24) : 0,
        liquidity: r.liquidity ? parseFloat(r.liquidity) : 0,
        change24h: r.change24 ? parseFloat(r.change24) : 0,
        graduationPercent: r.token?.launchpad?.graduationPercent ?? null,
        completed: r.token?.launchpad?.completed ?? false,
        migrated: r.token?.launchpad?.migrated ?? false,
      };
    }

    return new Response(JSON.stringify({ tokens: tokenMap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("codex-king-data error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
