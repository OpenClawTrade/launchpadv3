const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedPrice: { price: number; change24h: number; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds
const FETCH_TIMEOUT = 6000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

interface PriceResult {
  price: number;
  change24h: number;
  source: string;
}

async function trySource(name: string, fn: () => Promise<PriceResult | null>): Promise<PriceResult | null> {
  try {
    console.log(`[sol-price] Trying ${name}...`);
    return await fn();
  } catch (e) {
    console.log(`[sol-price] ${name} failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// Source 1: Binance.us (no geo-block like binance.com)
async function fromBinanceUS(): Promise<PriceResult | null> {
  const r = await fetchWithTimeout("https://api.binance.us/api/v3/ticker/24hr?symbol=SOLUSD");
  if (!r.ok) { console.log(`[sol-price] BinanceUS: ${r.status}`); return null; }
  const d = await r.json();
  const price = parseFloat(d.lastPrice);
  return price > 0 ? { price, change24h: parseFloat(d.priceChangePercent) || 0, source: "binance_us" } : null;
}

// Source 2: Binance global
async function fromBinance(): Promise<PriceResult | null> {
  const r = await fetchWithTimeout("https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT");
  if (!r.ok) { console.log(`[sol-price] Binance: ${r.status}`); return null; }
  const d = await r.json();
  const price = parseFloat(d.lastPrice);
  return price > 0 ? { price, change24h: parseFloat(d.priceChangePercent) || 0, source: "binance" } : null;
}

// Source 3: Jupiter
async function fromJupiter(): Promise<PriceResult | null> {
  const r = await fetchWithTimeout("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112");
  if (!r.ok) { console.log(`[sol-price] Jupiter: ${r.status}`); return null; }
  const d = await r.json();
  const price = parseFloat(d.data?.["So11111111111111111111111111111111111111112"]?.price);
  return price > 0 ? { price, change24h: 0, source: "jupiter" } : null;
}

// Source 4: CoinGecko
async function fromCoinGecko(): Promise<PriceResult | null> {
  const r = await fetchWithTimeout(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true",
    { headers: { Accept: "application/json" } }
  );
  if (!r.ok) { console.log(`[sol-price] CoinGecko: ${r.status}`); return null; }
  const d = await r.json();
  return d.solana?.usd > 0 ? { price: d.solana.usd, change24h: d.solana.usd_24h_change || 0, source: "coingecko" } : null;
}

// Source 5: DexScreener (free, no auth)
async function fromDexScreener(): Promise<PriceResult | null> {
  const r = await fetchWithTimeout("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112");
  if (!r.ok) { console.log(`[sol-price] DexScreener: ${r.status}`); return null; }
  const d = await r.json();
  const pair = d.pairs?.[0];
  if (!pair) return null;
  const price = parseFloat(pair.priceUsd);
  return price > 0 ? { price, change24h: pair.priceChange?.h24 || 0, source: "dexscreener" } : null;
}

// Source 6: CryptoCompare (free tier)
async function fromCryptoCompare(): Promise<PriceResult | null> {
  const r = await fetchWithTimeout("https://min-api.cryptocompare.com/data/price?fsym=SOL&tsyms=USD");
  if (!r.ok) { console.log(`[sol-price] CryptoCompare: ${r.status}`); return null; }
  const d = await r.json();
  return d.USD > 0 ? { price: d.USD, change24h: 0, source: "cryptocompare" } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    // Return cached if fresh
    if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify({
        price: cachedPrice.price,
        change24h: cachedPrice.change24h,
        cached: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Try sources in order of reliability
    const sources = [
      () => trySource("BinanceUS", fromBinanceUS),
      () => trySource("Binance", fromBinance),
      () => trySource("DexScreener", fromDexScreener),
      () => trySource("CryptoCompare", fromCryptoCompare),
      () => trySource("Jupiter", fromJupiter),
      () => trySource("CoinGecko", fromCoinGecko),
    ];

    for (const source of sources) {
      const result = await source();
      if (result && result.price > 0) {
        cachedPrice = { price: result.price, change24h: result.change24h, timestamp: Date.now() };
        console.log(`[sol-price] ${result.source} success: ${result.price}`);
        return new Response(JSON.stringify({
          price: result.price,
          change24h: result.change24h,
          source: result.source,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Stale cache fallback
    if (cachedPrice) {
      console.log("[sol-price] Returning stale cached price");
      return new Response(JSON.stringify({
        price: cachedPrice.price,
        change24h: cachedPrice.change24h,
        stale: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.error("[sol-price] All sources failed");
    return new Response(JSON.stringify({ error: "Unable to fetch SOL price", price: null }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (cachedPrice) {
      return new Response(JSON.stringify({
        price: cachedPrice.price,
        change24h: cachedPrice.change24h,
        stale: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Server error", price: null }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
