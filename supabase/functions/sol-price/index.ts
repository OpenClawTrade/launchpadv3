import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache price for 30 seconds server-side
let cachedPrice: { price: number; change24h: number; timestamp: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Return cached price if still valid
    if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify({
        price: cachedPrice.price,
        change24h: cachedPrice.change24h,
        cached: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try CoinGecko first
    try {
      const cgResponse = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true",
        { headers: { "Accept": "application/json" } }
      );
      
      if (cgResponse.ok) {
        const data = await cgResponse.json();
        if (data.solana?.usd) {
          cachedPrice = {
            price: data.solana.usd,
            change24h: data.solana.usd_24h_change || 0,
            timestamp: Date.now(),
          };
          
          return new Response(JSON.stringify({
            price: cachedPrice.price,
            change24h: cachedPrice.change24h,
            source: "coingecko",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } catch (e) {
      console.log("[sol-price] CoinGecko failed:", e);
    }

    // Fallback to Binance
    try {
      const binanceResponse = await fetch(
        "https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT"
      );
      
      if (binanceResponse.ok) {
        const data = await binanceResponse.json();
        const price = parseFloat(data.lastPrice);
        const change24h = parseFloat(data.priceChangePercent);
        
        if (!isNaN(price)) {
          cachedPrice = {
            price,
            change24h: change24h || 0,
            timestamp: Date.now(),
          };
          
          return new Response(JSON.stringify({
            price: cachedPrice.price,
            change24h: cachedPrice.change24h,
            source: "binance",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } catch (e) {
      console.log("[sol-price] Binance failed:", e);
    }

    // Return cached price even if expired, or fallback
    if (cachedPrice) {
      return new Response(JSON.stringify({
        price: cachedPrice.price,
        change24h: cachedPrice.change24h,
        stale: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ultimate fallback
    return new Response(JSON.stringify({
      price: 150,
      change24h: 0,
      fallback: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[sol-price] Error:", error);
    return new Response(JSON.stringify({
      price: cachedPrice?.price || 150,
      change24h: cachedPrice?.change24h || 0,
      error: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
