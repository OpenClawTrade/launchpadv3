import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Official TUNA token CA on Solana
export const TUNA_TOKEN_CA = "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump";

export interface TunaTokenData {
  price: number;
  change24h: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  timestamp: number;
}

interface UseTunaTokenDataOptions {
  enabled?: boolean;
}

export function useTunaTokenData(options: UseTunaTokenDataOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["tuna-token-data", TUNA_TOKEN_CA],
    queryFn: async (): Promise<TunaTokenData> => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dexscreener-proxy?token=${TUNA_TOKEN_CA}`,
        {
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch TUNA token data");
      }

      const data = await response.json();
      
      return {
        price: data.price || 0,
        change24h: data.change24h || 0,
        marketCap: data.marketCap || 0,
        liquidity: data.liquidity || 0,
        volume24h: data.volume24h || 0,
        timestamp: data.timestamp || Date.now(),
      };
    },
    enabled,
    staleTime: 30000, // 30 second cache
    refetchInterval: 60000, // Refresh every minute
  });
}
