const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache ETH price for 60 seconds
let cachedPrice: number | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 60 * 1000;

async function fetchEthPrice(): Promise<number> {
  const now = Date.now();
  
  // Return cached price if still valid
  if (cachedPrice && now - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedPrice;
  }

  try {
    // Try CoinGecko first
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { headers: { 'Accept': 'application/json' } }
    );

    if (response.ok) {
      const data = await response.json();
      const price = data?.ethereum?.usd;
      if (typeof price === 'number' && price > 0) {
        cachedPrice = price;
        cacheTimestamp = now;
        return price;
      }
    }
  } catch (error) {
    console.error('CoinGecko fetch failed:', error);
  }

  // Fallback: Try Binance API
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
    if (response.ok) {
      const data = await response.json();
      const price = parseFloat(data?.price);
      if (!isNaN(price) && price > 0) {
        cachedPrice = price;
        cacheTimestamp = now;
        return price;
      }
    }
  } catch (error) {
    console.error('Binance fetch failed:', error);
  }

  // Return cached price even if stale, or default
  return cachedPrice ?? 2500;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const price = await fetchEthPrice();

    return new Response(
      JSON.stringify({
        price,
        currency: 'USD',
        symbol: 'ETH',
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
        } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch ETH price', price: cachedPrice ?? 2500 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
