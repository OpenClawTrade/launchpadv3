import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SearchResult {
  chainId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string | null;
  priceChange24h: number | null;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  imageUrl: string | null;
}

async function searchTokens(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(
    `${supabaseUrl}/functions/v1/dexscreener-search?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
    }
  );

  if (!response.ok) throw new Error(`Search failed: ${response.status}`);
  const data = await response.json();
  return data.pairs || [];
}

export function useTokenSearch(query: string) {
  return useQuery({
    queryKey: ["token-search", query],
    queryFn: () => searchTokens(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}
