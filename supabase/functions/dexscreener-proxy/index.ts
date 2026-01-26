import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Cache for 30 seconds
let cache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 30000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tokenAddress = url.searchParams.get("token");

    if (!tokenAddress) {
      return new Response(
        JSON.stringify({ error: "Token address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      console.log("[dexscreener-proxy] Returning cached data");
      return new Response(JSON.stringify(cache.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[dexscreener-proxy] Fetching price for token: ${tokenAddress}`);

    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0",
        },
      }
    );

    if (!response.ok) {
      console.error(`[dexscreener-proxy] DexScreener API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: `DexScreener API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Extract price info from pairs
    let price = 0;
    let change24h = 0;

    if (data.pairs && data.pairs.length > 0) {
      // Get the most liquid pair
      const pair = data.pairs.sort((a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) =>
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];

      price = parseFloat(pair.priceUsd) || 0;
      change24h = parseFloat(pair.priceChange?.h24) || 0;
    }

    const result = { price, change24h, timestamp: Date.now() };

    // Update cache
    cache = { data: result, timestamp: Date.now() };

    console.log(`[dexscreener-proxy] Returning price: $${price}, change: ${change24h}%`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[dexscreener-proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", price: 0, change24h: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
