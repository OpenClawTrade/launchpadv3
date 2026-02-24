import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Column = "new" | "completing" | "completed";

function buildQuery(column: Column, limit: number): string {
  let filters: string;
  let rankings: string;

  switch (column) {
    case "new":
      filters = `{ network: [1399811149], launchpadName: ["Pump.fun"], launchpadCompleted: false, launchpadMigrated: false }`;
      rankings = `{ attribute: createdAt, direction: DESC }`;
      break;
    case "completing":
      filters = `{ network: [1399811149], launchpadName: ["Pump.fun"], launchpadCompleted: false, launchpadMigrated: false, launchpadGraduationPercent: { gte: 50 } }`;
      rankings = `{ attribute: createdAt, direction: DESC }`;
      break;
    case "completed":
      filters = `{ network: [1399811149], launchpadName: ["Pump.fun"], launchpadMigrated: true }`;
      rankings = `{ attribute: createdAt, direction: DESC }`;
      break;
  }

  return `{
  filterTokens(
    filters: ${filters}
    rankings: ${rankings}
    limit: ${limit}
  ) {
    results {
      createdAt
      holders
      liquidity
      marketCap
      volume24
      change24
      token {
        info {
          address
          name
          symbol
          imageSmallUrl
          imageLargeUrl
        }
        socialLinks {
          twitter
          website
          telegram
          discord
        }
        launchpad {
          graduationPercent
          poolAddress
          launchpadName
          completed
          migrated
          completedAt
          migratedAt
        }
      }
    }
  }
}`;
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

    const { column = "new", limit = 50 } = await req.json().catch(() => ({}));
    const validColumn = (["new", "completing", "completed"] as Column[]).includes(column) ? column : "new";
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

    const query = buildQuery(validColumn as Column, safeLimit);

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

    const results = data?.data?.filterTokens?.results ?? [];

    const tokens = results.map((r: any) => ({
      address: r.token?.info?.address ?? null,
      name: r.token?.info?.name ?? "Unknown",
      symbol: r.token?.info?.symbol ?? "???",
      imageUrl: r.token?.info?.imageSmallUrl || r.token?.info?.imageLargeUrl || null,
      marketCap: r.marketCap ? parseFloat(r.marketCap) : 0,
      volume24h: r.volume24 ? parseFloat(r.volume24) : 0,
      change24h: r.change24 ? parseFloat(r.change24) : 0,
      holders: r.holders ?? 0,
      liquidity: r.liquidity ? parseFloat(r.liquidity) : 0,
      graduationPercent: r.token?.launchpad?.graduationPercent ?? 0,
      poolAddress: r.token?.launchpad?.poolAddress ?? null,
      launchpadName: r.token?.launchpad?.launchpadName ?? "Pump.fun",
      completed: r.token?.launchpad?.completed ?? false,
      migrated: r.token?.launchpad?.migrated ?? false,
      completedAt: r.token?.launchpad?.completedAt ?? null,
      migratedAt: r.token?.launchpad?.migratedAt ?? null,
      createdAt: r.createdAt ?? null,
      twitterUrl: r.token?.socialLinks?.twitter ?? null,
      websiteUrl: r.token?.socialLinks?.website ?? null,
      telegramUrl: r.token?.socialLinks?.telegram ?? null,
      discordUrl: r.token?.socialLinks?.discord ?? null,
    }));

    return new Response(JSON.stringify({ tokens, column: validColumn }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("codex-filter-tokens error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
