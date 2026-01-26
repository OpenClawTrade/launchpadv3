import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

      // Fetch via Edge Function proxy to avoid CORS/timeout issues
      const { data, error: fetchError } = await supabase.functions.invoke("dexscreener-proxy", {
        body: null,
        headers: { "Content-Type": "application/json" },
      });

      // Add token as query param by calling with GET-like behavior
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dexscreener-proxy?token=${AI67X_TOKEN_ADDRESS}`,
        {
          headers: {
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch price from proxy");
      }

      const result = await response.json();

      if (result.price !== undefined) {
        setPrice(result.price);
        setChange24h(result.change24h || 0);

        // Cache the result
        const cacheData: PriceData = {
          price: result.price,
          change24h: result.change24h || 0,
          timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      } else {
        setPrice(0);
        setChange24h(0);
      }

      setError(null);
    } catch (err) {
      console.error("Error fetching ai67x price:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      // Use cached data if available, even if stale
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: PriceData = JSON.parse(cached);
        setPrice(data.price);
        setChange24h(data.change24h);
      }
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
