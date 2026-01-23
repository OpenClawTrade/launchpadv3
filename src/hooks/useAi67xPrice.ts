import { useState, useEffect, useCallback } from "react";

const AI67X_TOKEN_ADDRESS = "6UwN87i8wwFZSDGXDM77C3k7S81KQovuKr3ssH8Lpump";
const CACHE_KEY = "ai67x_price_cache";
const CACHE_DURATION = 30000; // 30 seconds

interface PriceData {
  price: number;
  change24h: number;
  timestamp: number;
}

export function useAi67xPrice() {
  const [price, setPrice] = useState<number>(0);
  const [change24h, setChange24h] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = useCallback(async () => {
    try {
      // Check localStorage cache first
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: PriceData = JSON.parse(cached);
        if (Date.now() - data.timestamp < CACHE_DURATION) {
          setPrice(data.price);
          setChange24h(data.change24h);
          setIsLoading(false);
          return;
        }
      }

      // Fetch from DexScreener API (supports pump.fun tokens)
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${AI67X_TOKEN_ADDRESS}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch price");
      }

      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        // Get the most liquid pair
        const pair = data.pairs.sort((a: any, b: any) => 
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];
        
        const tokenPrice = parseFloat(pair.priceUsd) || 0;
        const priceChange = parseFloat(pair.priceChange?.h24) || 0;
        
        setPrice(tokenPrice);
        setChange24h(priceChange);
        
        // Cache the result
        const cacheData: PriceData = {
          price: tokenPrice,
          change24h: priceChange,
          timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      } else {
        // No pairs found - token might not be trading yet
        setPrice(0);
        setChange24h(0);
      }
      
      setError(null);
    } catch (err) {
      console.error("Error fetching ai67x price:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchPrice, 30000);
    
    return () => clearInterval(interval);
  }, [fetchPrice]);

  return { price, change24h, isLoading, error, refetch: fetchPrice };
}
