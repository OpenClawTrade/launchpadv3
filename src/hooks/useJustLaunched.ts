import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { filterHiddenTokens } from "@/lib/hiddenTokens";
import { useEffect } from "react";

export interface JustLaunchedToken {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  mint_address: string | null;
  market_cap_sol?: number | null;
  agent_id?: string | null;
  status?: string | null;
  launchpad_type?: string | null;
  trading_agent_id?: string | null;
  is_trading_agent_token?: boolean;
  created_at: string;
}

interface UseJustLaunchedResult {
  tokens: JustLaunchedToken[];
  isLoading: boolean;
  error: string | null;
}

// Fetch only the 10 most recent tokens from last 24 hours
async function fetchJustLaunched(): Promise<JustLaunchedToken[]> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("fun_tokens")
    .select(`
      id, name, ticker, image_url, mint_address, market_cap_sol,
      agent_id, status, launchpad_type, trading_agent_id, is_trading_agent_token, created_at
    `)
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;

  return filterHiddenTokens(data || []) as JustLaunchedToken[];
}

const QUERY_KEY = ["just-launched"];

export function useJustLaunched(): UseJustLaunchedResult {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchJustLaunched,
    staleTime: 1000 * 60 * 2, // 2 minutes fresh
    gcTime: 1000 * 60 * 30, // 30 minutes cache
    refetchOnWindowFocus: false,
    refetchInterval: 1000 * 60, // Refresh every 60s
  });

  // Realtime subscription for new tokens
  useEffect(() => {
    const channel = supabase
      .channel("just-launched-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fun_tokens",
        },
        () => {
          // New token added, invalidate
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
    error: error ? (error instanceof Error ? error.message : "Failed to fetch") : null,
  };
}
