const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache ETH price data for 30 seconds
interface CachedData {
  price: number;
  change24h: number;
  timestamp: number;
}

let cachedData: CachedData | null = null;
const CACHE_DURATION_MS = 30 * 1000;

async function fetchEthPriceWithChange(): Promise<{ price: number; change24h: number }> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION_MS) {
    return { price: cachedData.price, change24h: cachedData.change24h };
  }

  try {
    // CoinGecko with 24h change
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true',
      { headers: { 'Accept': 'application/json' } }
    );

    if (response.ok) {
      const data = await response.json();
      const price = data?.ethereum?.usd;
      const change24h = data?.ethereum?.usd_24h_change;
      
      if (typeof price === 'number' && price > 0) {
        cachedData = { 
          price, 
          change24h: typeof change24h === 'number' ? change24h : 0,
          timestamp: now 
        };
        return { price: cachedData.price, change24h: cachedData.change24h };
      }
    }
  } catch (error) {
    console.error('CoinGecko fetch failed:', error);
  }

  // Fallback: Try Binance API (24hr ticker)
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT');
    if (response.ok) {
      const data = await response.json();
      const price = parseFloat(data?.lastPrice);
      const change24h = parseFloat(data?.priceChangePercent);
      
      if (!isNaN(price) && price > 0) {
        cachedData = { 
          price, 
          change24h: !isNaN(change24h) ? change24h : 0,
          timestamp: now 
        };
        return { price: cachedData.price, change24h: cachedData.change24h };
      }
    }
  } catch (error) {
    console.error('Binance fetch failed:', error);
  }

  // Return cached data even if stale, or default
  return cachedData 
    ? { price: cachedData.price, change24h: cachedData.change24h }
    : { price: 2500, change24h: 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { price, change24h } = await fetchEthPriceWithChange();

    return new Response(
      JSON.stringify({
        price,
        change24h,
        source: 'coingecko',
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30',
        } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch ETH price', 
        price: cachedData?.price ?? 2500,
        change24h: cachedData?.change24h ?? 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
