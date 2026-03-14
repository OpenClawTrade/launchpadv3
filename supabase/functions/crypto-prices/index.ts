const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cached: { data: Record<string, { price: number; change24h: number }>; timestamp: number } | null = null;
const CACHE_TTL = 60000;
const FETCH_TIMEOUT = 6000;

async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

async function fromCoinGecko() {
  const r = await fetchWithTimeout(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=usd&include_24hr_change=true",
    { headers: { Accept: "application/json" } }
  );
  if (!r.ok) return null;
  const d = await r.json();
  return {
    btc: { price: d.bitcoin?.usd ?? 0, change24h: d.bitcoin?.usd_24h_change ?? 0 },
    eth: { price: d.ethereum?.usd ?? 0, change24h: d.ethereum?.usd_24h_change ?? 0 },
    bnb: { price: d.binancecoin?.usd ?? 0, change24h: d.binancecoin?.usd_24h_change ?? 0 },
  };
}

async function fromBinance() {
  const symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT"];
  const results: Record<string, { price: number; change24h: number }> = {};
  const keys = ["btc", "eth", "bnb"];
  
  for (let i = 0; i < symbols.length; i++) {
    try {
      const r = await fetchWithTimeout(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbols[i]}`);
      if (r.ok) {
        const d = await r.json();
        results[keys[i]] = { price: parseFloat(d.lastPrice) || 0, change24h: parseFloat(d.priceChangePercent) || 0 };
      }
    } catch {}
  }
  return Object.keys(results).length === 3 ? results : null;
}

async function fromCryptoCompare() {
  try {
    const r = await fetchWithTimeout("https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC,ETH,BNB&tsyms=USD");
    if (!r.ok) return null;
    const d = await r.json();
    const raw = d.RAW;
    return {
      btc: { price: raw?.BTC?.USD?.PRICE ?? 0, change24h: raw?.BTC?.USD?.CHANGEPCT24HOUR ?? 0 },
      eth: { price: raw?.ETH?.USD?.PRICE ?? 0, change24h: raw?.ETH?.USD?.CHANGEPCT24HOUR ?? 0 },
      bnb: { price: raw?.BNB?.USD?.PRICE ?? 0, change24h: raw?.BNB?.USD?.CHANGEPCT24HOUR ?? 0 },
    };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sources = [fromBinance, fromCoinGecko, fromCryptoCompare];
    for (const source of sources) {
      try {
        const result = await source();
        if (result && result.btc?.price > 0) {
          cached = { data: result, timestamp: Date.now() };
          console.log("[crypto-prices] Success from", source.name);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.log("[crypto-prices]", source.name, "failed:", e);
      }
    }

    if (cached) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "All sources failed" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    if (cached) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
