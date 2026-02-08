const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cache price for 30 seconds server-side
let cachedPrice: { price: number; change24h: number; timestamp: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds
const FETCH_TIMEOUT = 5000; // 5 second timeout per source

// Fetch with timeout helper
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req) => {
  // CORS preflight - must return 200 OK with headers
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
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

    // Try Jupiter first (most reliable for Solana)
    try {
      const jupiterResponse = await fetchWithTimeout(
        "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112"
      );
      
      if (jupiterResponse.ok) {
        const data = await jupiterResponse.json();
        const solData = data.data?.["So11111111111111111111111111111111111111112"];
        if (solData?.price) {
          const price = parseFloat(solData.price);
          if (!isNaN(price) && price > 0) {
            cachedPrice = {
              price,
              change24h: 0, // Jupiter v2 doesn't provide 24h change
              timestamp: Date.now(),
            };
            
            return new Response(JSON.stringify({
              price: cachedPrice.price,
              change24h: cachedPrice.change24h,
              source: "jupiter",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
    } catch (e) {
      console.log("[sol-price] Jupiter failed:", e instanceof Error ? e.message : e);
    }

    // Try Binance second
    try {
      const binanceResponse = await fetchWithTimeout(
        "https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT"
      );
      
      if (binanceResponse.ok) {
        const data = await binanceResponse.json();
        const price = parseFloat(data.lastPrice);
        const change24h = parseFloat(data.priceChangePercent);
        
        if (!isNaN(price) && price > 0) {
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
      console.log("[sol-price] Binance failed:", e instanceof Error ? e.message : e);
    }

    // Try CoinGecko last (most rate-limited)
    try {
      const cgResponse = await fetchWithTimeout(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true",
        { headers: { "Accept": "application/json" } }
      );
      
      if (cgResponse.ok) {
        const data = await cgResponse.json();
        if (data.solana?.usd && data.solana.usd > 0) {
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
      console.log("[sol-price] CoinGecko failed:", e instanceof Error ? e.message : e);
    }

    // Return cached price even if expired (stale data is better than no data)
    if (cachedPrice) {
      console.log("[sol-price] Returning stale cached price");
      return new Response(JSON.stringify({
        price: cachedPrice.price,
        change24h: cachedPrice.change24h,
        stale: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No cached price and all sources failed - return error
    console.error("[sol-price] All price sources failed, no cache available");
    return new Response(JSON.stringify({
      error: "Unable to fetch SOL price from any source",
      price: null,
    }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[sol-price] Error:", error);
    
    // Return cached price if available, otherwise error
    if (cachedPrice) {
      return new Response(JSON.stringify({
        price: cachedPrice.price,
        change24h: cachedPrice.change24h,
        error: true,
        stale: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
      price: null,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
