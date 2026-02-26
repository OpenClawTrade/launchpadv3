import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { filterHiddenTokens } from "@/lib/hiddenTokens";
import { useEffect } from "react";

export interface TickerToken {
  id: string;
  ticker: string;
  image_url: string | null;
  price_sol?: number | null;
  price_change_24h?: number | null;
  created_at?: string;
}

interface UseTickerTokensResult {
  tokens: TickerToken[];
  isLoading: boolean;
}

// Fetch only 15 tokens for the ticker bar
async function fetchTickerTokens(): Promise<TickerToken[]> {
  const { data, error } = await supabase
    .from("fun_tokens")
    .select(`id, ticker, image_url, price_sol, price_change_24h, created_at`)
    .neq("launchpad_type", "punch")
    .order("created_at", { ascending: false })
    .limit(15);

  if (error) throw error;

  return filterHiddenTokens(data || []) as TickerToken[];
}

const QUERY_KEY = ["ticker-tokens"];

export function useTickerTokens(): UseTickerTokensResult {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchTickerTokens,
    staleTime: 1000 * 60 * 5, // 5 minutes fresh (ticker is less critical)
    gcTime: 1000 * 60 * 30, // 30 minutes cache
    refetchOnWindowFocus: false,
    refetchInterval: 1000 * 60 * 2, // Refresh every 2 minutes
  });

  // Realtime subscription for new tokens
  useEffect(() => {
    const channel = supabase
      .channel("ticker-tokens-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fun_tokens",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    tokens: data ?? [],
    isLoading,
  };
}
