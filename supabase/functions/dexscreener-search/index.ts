import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ pairs: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[dexscreener-search] Searching: "${query}"`);

    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
      }
    );

    if (!response.ok) {
      console.error(`[dexscreener-search] API error: ${response.status}`);
      return new Response(
        JSON.stringify({ pairs: [], error: `API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const pairs = (data.pairs || []).slice(0, 20).map((p: any) => ({
      chainId: p.chainId,
      pairAddress: p.pairAddress,
      baseToken: {
        address: p.baseToken?.address,
        name: p.baseToken?.name,
        symbol: p.baseToken?.symbol,
      },
      priceUsd: p.priceUsd,
      priceChange24h: p.priceChange?.h24 ?? null,
      marketCap: p.marketCap || p.fdv || 0,
      liquidity: p.liquidity?.usd || 0,
      volume24h: p.volume?.h24 || 0,
      imageUrl: p.info?.imageUrl || null,
    }));

    return new Response(JSON.stringify({ pairs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[dexscreener-search] Error:", error);
    return new Response(
      JSON.stringify({ pairs: [], error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
