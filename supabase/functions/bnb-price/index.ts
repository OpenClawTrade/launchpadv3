const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CachedData {
  price: number;
  change24h: number;
  timestamp: number;
}

let cachedData: CachedData | null = null;
const CACHE_DURATION_MS = 30 * 1000;

async function fetchBnbPriceWithChange(): Promise<{ price: number; change24h: number }> {
  const now = Date.now();

  if (cachedData && now - cachedData.timestamp < CACHE_DURATION_MS) {
    return { price: cachedData.price, change24h: cachedData.change24h };
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd&include_24hr_change=true',
      { headers: { 'Accept': 'application/json' } }
    );

    if (response.ok) {
      const data = await response.json();
      const price = data?.binancecoin?.usd;
      const change24h = data?.binancecoin?.usd_24h_change;

      if (typeof price === 'number' && price > 0) {
        cachedData = {
          price,
          change24h: typeof change24h === 'number' ? change24h : 0,
          timestamp: now,
        };
        return { price: cachedData.price, change24h: cachedData.change24h };
      }
    }
  } catch (error) {
    console.error('CoinGecko fetch failed:', error);
  }

  // Fallback: Binance API
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BNBUSDT');
    if (response.ok) {
      const data = await response.json();
      const price = parseFloat(data?.lastPrice);
      const change24h = parseFloat(data?.priceChangePercent);

      if (!isNaN(price) && price > 0) {
        cachedData = {
          price,
          change24h: !isNaN(change24h) ? change24h : 0,
          timestamp: now,
        };
        return { price: cachedData.price, change24h: cachedData.change24h };
      }
    }
  } catch (error) {
    console.error('Binance fetch failed:', error);
  }

  return cachedData
    ? { price: cachedData.price, change24h: cachedData.change24h }
    : { price: 600, change24h: 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { price, change24h } = await fetchBnbPriceWithChange();

    return new Response(
      JSON.stringify({ price, change24h, source: 'coingecko' }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30',
        },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch BNB price',
        price: cachedData?.price ?? 600,
        change24h: cachedData?.change24h ?? 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
