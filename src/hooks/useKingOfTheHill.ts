import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { filterHiddenTokens } from "@/lib/hiddenTokens";
import { useEffect } from "react";

const DEFAULT_LIVE = {
  holder_count: 0,
  market_cap_sol: 30,
  bonding_progress: 0,
  price_sol: 0.00000003,
};

export interface KingToken {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  mint_address: string | null;
  dbc_pool_address: string | null;
  status: string;
  bonding_progress?: number;
  market_cap_sol?: number;
  holder_count?: number;
  trading_fee_bps?: number;
  fee_mode?: string | null;
  agent_id?: string | null;
  launchpad_type?: string | null;
  trading_agent_id?: string | null;
  is_trading_agent_token?: boolean;
  created_at: string;
}

interface UseKingOfTheHillResult {
  tokens: KingToken[];
  isLoading: boolean;
  error: string | null;
}

// Fetch top tokens by bonding progress + newest trading agent token
async function fetchKingOfTheHill(): Promise<KingToken[]> {
  const selectFields = `
    id, name, ticker, image_url, mint_address, dbc_pool_address, status,
    bonding_progress, market_cap_sol, holder_count, trading_fee_bps, fee_mode,
    agent_id, launchpad_type, trading_agent_id, is_trading_agent_token, created_at
  `;

  // Fetch top 3 by bonding progress
  const { data: topTokens, error: topError } = await supabase
    .from("fun_tokens")
    .select(selectFields)
    .eq("status", "active")
    .order("bonding_progress", { ascending: false })
    .limit(3);

  if (topError) throw topError;

  // Fetch newest trading agent token (last 24 hours) for guaranteed visibility
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: newestTradingAgent } = await supabase
    .from("fun_tokens")
    .select(selectFields)
    .eq("status", "active")
    .eq("is_trading_agent_token", true)
    .gte("created_at", oneDayAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  // Merge: top tokens + newest trading agent (deduplicated)
  const merged = [...(topTokens || [])];
  if (newestTradingAgent?.[0]) {
    const exists = merged.some((t) => t.id === newestTradingAgent[0].id);
    if (!exists) {
      merged.push(newestTradingAgent[0]);
    }
  }

  const mapped = merged.slice(0, 3).map((t) => ({
    ...t,
    holder_count: t.holder_count ?? DEFAULT_LIVE.holder_count,
    market_cap_sol: t.market_cap_sol ?? DEFAULT_LIVE.market_cap_sol,
    bonding_progress: t.bonding_progress ?? DEFAULT_LIVE.bonding_progress,
  })) as KingToken[];

  return filterHiddenTokens(mapped);
}

const QUERY_KEY = ["king-of-the-hill"];

export function useKingOfTheHill(): UseKingOfTheHillResult {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchKingOfTheHill,
    staleTime: 1000 * 60 * 2, // 2 minutes fresh
    gcTime: 1000 * 60 * 30, // 30 minutes cache
    refetchOnWindowFocus: false,
    refetchInterval: 1000 * 30, // Refresh every 30s (more important section)
  });

  // Realtime subscription to invalidate on token changes
  useEffect(() => {
    const channel = supabase
      .channel("king-of-hill-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fun_tokens",
        },
        () => {
          // Any change could affect top 3, invalidate
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
