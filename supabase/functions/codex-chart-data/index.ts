import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CODEX_URL = "https://graph.codex.io/graphql";

function buildGetTokenBarsQuery(params: {
  symbol: string;
  resolution: string;
  countback: number;
  currencyCode: string;
  statsType: string;
  removeEmptyBars: boolean;
  from?: number;
  to?: number;
}): string {
  const args: string[] = [
    `symbol: "${params.symbol}"`,
    `resolution: "${params.resolution}"`,
    `countback: ${params.countback}`,
    `from: ${params.from ?? 0}`,
    `to: ${params.to ?? Math.floor(Date.now() / 1000)}`,
    `currencyCode: "${params.currencyCode}"`,
    `statsType: ${params.statsType}`,
    `removeEmptyBars: ${params.removeEmptyBars}`,
  ];

  return `{
    getTokenBars(${args.join(", ")}) {
      o
      h
      l
      c
      t
      volume
      buyVolume
      sellVolume
      buys
      sells
      buyers
      sellers
      traders
      transactions
      liquidity
    }
  }`;
}

function buildGetBarsQuery(params: {
  symbol: string;
  resolution: string;
  countback: number;
  currencyCode: string;
  removeEmptyBars: boolean;
  from?: number;
  to?: number;
}): string {
  const args: string[] = [
    `symbol: "${params.symbol}"`,
    `resolution: "${params.resolution}"`,
    `countback: ${params.countback}`,
    `from: ${params.from ?? 0}`,
    `to: ${params.to ?? Math.floor(Date.now() / 1000)}`,
    `currencyCode: "${params.currencyCode}"`,
    `removeEmptyBars: ${params.removeEmptyBars}`,
  ];

  return `{
    getBars(${args.join(", ")}) {
      o
      h
      l
      c
      t
      volume
    }
  }`;
}

serve(async (req: Request) => {
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

    const body = await req.json();
    const {
      query = "getTokenBars",
      tokenAddress,
      pairAddress,
      networkId = 1399811149,
      resolution = "15",
      countback = 300,
      from = 0,
      to = Math.floor(Date.now() / 1000),
      currencyCode = "USD",
      statsType = "FILTERED",
      removeEmptyBars = true,
    } = body;

    const symbol = tokenAddress
      ? `${tokenAddress}:${networkId}`
      : pairAddress
      ? `${pairAddress}:${networkId}`
      : null;

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: "tokenAddress or pairAddress required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isGetBars = query === "getBars";

    const graphqlQuery = isGetBars
      ? buildGetBarsQuery({
          symbol,
          resolution: String(resolution),
          countback: Math.min(countback, 1500),
          currencyCode,
          removeEmptyBars,
          from,
          to,
        })
      : buildGetTokenBarsQuery({
          symbol,
          resolution: String(resolution),
          countback: Math.min(countback, 1500),
          currencyCode,
          statsType,
          removeEmptyBars,
          from,
          to,
        });

    const codexRes = await fetch(CODEX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ query: graphqlQuery }),
    });

    if (!codexRes.ok) {
      const errText = await codexRes.text();
      console.error("Codex API error:", codexRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Codex API error", status: codexRes.status, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await codexRes.json();

    if (data.errors) {
      const isPairNotFound = data.errors.some((e: any) =>
        e.message?.toLowerCase().includes("pair not found") ||
        e.message?.toLowerCase().includes("not found")
      );
      if (isPairNotFound) {
        console.log("[codex-chart-data] Pair not found for", symbol, "- returning empty bars");
        return new Response(
          JSON.stringify({ bars: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Codex GraphQL errors:", JSON.stringify(data.errors));
      return new Response(
        JSON.stringify({ error: "Codex GraphQL error", details: data.errors }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bars = isGetBars ? data.data?.getBars : data.data?.getTokenBars;

    return new Response(JSON.stringify({ bars }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
