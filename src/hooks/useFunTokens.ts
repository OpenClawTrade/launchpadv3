import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FunToken {
  id: string;
  name: string;
  ticker: string;
  description: string | null;
  image_url: string | null;
  creator_wallet: string;
  mint_address: string | null;
  dbc_pool_address: string | null;
  status: string;
  price_sol: number;
  volume_24h_sol: number;
  total_fees_earned: number;
  holder_count?: number;
  market_cap_sol?: number;
  bonding_progress?: number;
  last_distribution_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UseFunTokensResult {
  tokens: FunToken[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFunTokens(): UseFunTokensResult {
  const [tokens, setTokens] = useState<FunToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      // Fetch fun_tokens
      const { data: funTokens, error: fetchError } = await supabase
        .from("fun_tokens")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Enrich with live data from pool-state if available
      const enrichedTokens = await Promise.all(
        (funTokens || []).map(async (token) => {
          let liveData = {
            holder_count: 0,
            market_cap_sol: token.price_sol * 1_000_000_000,
            bonding_progress: 0,
          };

          // Try to get live data from pool-state
          if (token.dbc_pool_address) {
            try {
              const { data } = await supabase.functions.invoke("pool-state", {
                body: { poolAddress: token.dbc_pool_address },
              });
              if (data?.success) {
                liveData = {
                  holder_count: data.holderCount || 0,
                  market_cap_sol: data.marketCapSol || liveData.market_cap_sol,
                  bonding_progress: data.bondingProgress || 0,
                };
              }
            } catch (e) {
              // Silently fail, use defaults
            }
          }

          return {
            ...token,
            ...liveData,
          };
        })
      );

      setTokens(enrichedTokens);
      setError(null);
    } catch (err) {
      console.error("[useFunTokens] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch tokens");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Real-time subscription for new tokens
  useEffect(() => {
    const channel = supabase
      .channel("fun-tokens-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fun_tokens",
        },
        (payload) => {
          console.log("[useFunTokens] Realtime update:", payload.eventType);
          
          if (payload.eventType === "INSERT") {
            const newToken = payload.new as FunToken;
            setTokens((prev) => [
              { ...newToken, holder_count: 0, market_cap_sol: 30, bonding_progress: 0 },
              ...prev,
            ]);
          } else if (payload.eventType === "UPDATE") {
            const updatedToken = payload.new as FunToken;
            setTokens((prev) =>
              prev.map((t) => (t.id === updatedToken.id ? { ...t, ...updatedToken } : t))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any).id;
            setTokens((prev) => prev.filter((t) => t.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Poll for live data every minute
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTokens();
    }, 60_000); // 1 minute

    return () => clearInterval(interval);
  }, [fetchTokens]);

  return {
    tokens,
    isLoading,
    error,
    refetch: fetchTokens,
  };
}
