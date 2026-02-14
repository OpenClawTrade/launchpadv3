import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'sol_price_cache';
const CACHE_TTL = 30000; // 30 seconds

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
        // Only use cache if less than 2 minutes old
        if (Date.now() - parsed.timestamp < 120_000) {
          return parsed.price;
        }
        // Clear stale cache to avoid showing wrong price
        localStorage.removeItem(CACHE_KEY);
      }
    } catch {
      // Ignore cache errors
    }
    return 0; // Show 0 until fresh price loads (was 150 hardcoded)
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        setIsLoading(true);
        
        // Use edge function to avoid CORS/rate limiting
        const { data, error } = await supabase.functions.invoke('sol-price');
        
        if (error) throw error;
        
        const price = data?.price;
        
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

    // Refresh every 30 seconds
    const interval = setInterval(fetchPrice, CACHE_TTL);

    return () => clearInterval(interval);
  }, []);

  return { solPrice, isLoading };
}
