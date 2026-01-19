import { useState, useEffect } from 'react';

// Multiple price sources for resilience
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';
const CACHE_KEY = 'sol_price_cache';
const CACHE_TTL = 60000; // 1 minute

interface CachedPrice {
  price: number;
  timestamp: number;
}

export function useSolPrice() {
  const [solPrice, setSolPrice] = useState<number>(() => {
    // Try to get cached price on initial load
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedPrice = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          return parsed.price;
        }
      }
    } catch {
      // Ignore cache errors
    }
    return 150; // Fallback default
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        setIsLoading(true);
        
        // Use CoinGecko (free, no auth required)
        const response = await fetch(COINGECKO_API);
        
        if (!response.ok) {
          throw new Error('Failed to fetch SOL price');
        }
        
        const data = await response.json();
        const price = data?.solana?.usd;
        
        if (price && typeof price === 'number') {
          setSolPrice(price);
          
          // Cache the price
          const cacheData: CachedPrice = {
            price,
            timestamp: Date.now(),
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        }
      } catch (error) {
        console.debug('[useSolPrice] Error fetching price, using cached value');
        // Keep using cached/default value
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately
    fetchPrice();

    // Refresh every minute
    const interval = setInterval(fetchPrice, CACHE_TTL);

    return () => clearInterval(interval);
  }, []);

  return { solPrice, isLoading };
}
