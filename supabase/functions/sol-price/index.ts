import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cache price for 30 seconds server-side
let cachedPrice: { price: number; change24h: number; timestamp: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds
const FETCH_TIMEOUT = 8000; // 8 second timeout per source (increased from 5s)

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

// Get last known price from database as final fallback
async function getDbFallbackPrice(): Promise<{ price: number; change24h: number } | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return null;

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try to get cached price from a dedicated KV-style lookup
    const { data } = await supabase
      .from("fun_tokens")
      .select("market_cap_sol")
      .not("market_cap_sol", "is", null)
      .gt("market_cap_sol", 0)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      console.log("[sol-price] DB has tokens but no real price source available");
    }
    // Never return a hardcoded price - better to return null and let frontend handle it
    return null;
  } catch (e) {
    console.log("[sol-price] DB fallback failed:", e instanceof Error ? e.message : e);
    return null;
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

    const errors: string[] = [];

    // Try Jupiter first (most reliable for Solana)
    try {
      console.log("[sol-price] Trying Jupiter...");
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
            
            console.log("[sol-price] Jupiter success:", price);
            return new Response(JSON.stringify({
              price: cachedPrice.price,
              change24h: cachedPrice.change24h,
              source: "jupiter",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } else {
        errors.push(`Jupiter: ${jupiterResponse.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Jupiter: ${msg}`);
      console.log("[sol-price] Jupiter failed:", msg);
    }

    // Try Binance second
    try {
      console.log("[sol-price] Trying Binance...");
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
          
          console.log("[sol-price] Binance success:", price);
          return new Response(JSON.stringify({
            price: cachedPrice.price,
            change24h: cachedPrice.change24h,
            source: "binance",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        errors.push(`Binance: ${binanceResponse.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Binance: ${msg}`);
      console.log("[sol-price] Binance failed:", msg);
    }

    // Try CoinGecko last (most rate-limited)
    try {
      console.log("[sol-price] Trying CoinGecko...");
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
          
          console.log("[sol-price] CoinGecko success:", data.solana.usd);
          return new Response(JSON.stringify({
            price: cachedPrice.price,
            change24h: cachedPrice.change24h,
            source: "coingecko",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        errors.push(`CoinGecko: ${cgResponse.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`CoinGecko: ${msg}`);
      console.log("[sol-price] CoinGecko failed:", msg);
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

    // Try database fallback as last resort
    const dbPrice = await getDbFallbackPrice();
    if (dbPrice) {
      cachedPrice = { ...dbPrice, timestamp: Date.now() };
      return new Response(JSON.stringify({
        price: dbPrice.price,
        change24h: dbPrice.change24h,
        source: "fallback",
        stale: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No cached price and all sources failed - return error with details
    console.error("[sol-price] All price sources failed:", errors.join("; "));
    return new Response(JSON.stringify({
      error: "Unable to fetch SOL price from any source",
      details: errors,
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
