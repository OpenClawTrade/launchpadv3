import { useState, useEffect, useCallback, useRef } from "react";
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
  holder_count: number;
  market_cap_sol: number;
  bonding_progress: number;
  last_distribution_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UseFunLiveDataResult {
  tokens: FunToken[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date;
  refetch: () => Promise<void>;
}

// Poll database every 10 seconds (cached data updates every minute via cron)
const POLL_INTERVAL = 10000;

export function useFunLiveData(): UseFunLiveDataResult {
  const [tokens, setTokens] = useState<FunToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch tokens from database (already has cached pool data)
  const fetchTokens = useCallback(async () => {
    try {
      const { data: funTokens, error: fetchError } = await supabase
        .from("fun_tokens")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Map database tokens to our FunToken type
      // Pool state data is already cached in the database by the cron job
      const typedTokens: FunToken[] = (funTokens || []).map(t => {
        // Cast to any since columns may not be in types yet
        const tokenAny = t as any;
        return {
          ...t,
          holder_count: tokenAny.holder_count || 0,
          market_cap_sol: tokenAny.market_cap_sol || 30,
          bonding_progress: tokenAny.bonding_progress || 0,
          price_sol: t.price_sol || 0.00000003,
        };
      });

      setTokens(typedTokens);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("[useFunLiveData] Error fetching tokens:", err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tokens');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTokens();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTokens]);

  // Real-time subscription for database changes
  useEffect(() => {
    const channel = supabase
      .channel("fun-tokens-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fun_tokens",
        },
        (payload) => {
          console.log("[useFunLiveData] Realtime update:", payload.eventType);
          
          if (payload.eventType === "INSERT") {
            const newToken = payload.new as FunToken;
            setTokens((prev) => [
              { 
                ...newToken, 
                holder_count: newToken.holder_count || 0, 
                market_cap_sol: newToken.market_cap_sol || 30, 
                bonding_progress: newToken.bonding_progress || 0,
                price_sol: newToken.price_sol || 0.00000003,
              },
              ...prev,
            ]);
            setLastUpdate(new Date());
          } else if (payload.eventType === "UPDATE") {
            const updatedToken = payload.new as FunToken;
            setTokens((prev) =>
              prev.map((t) => 
                t.id === updatedToken.id 
                  ? { 
                      ...t, 
                      ...updatedToken,
                      holder_count: updatedToken.holder_count || t.holder_count || 0,
                      market_cap_sol: updatedToken.market_cap_sol || t.market_cap_sol || 30,
                      bonding_progress: updatedToken.bonding_progress || t.bonding_progress || 0,
                    } 
                  : t
              )
            );
            setLastUpdate(new Date());
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any).id;
            setTokens((prev) => prev.filter((t) => t.id !== deletedId));
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Polling for database refresh (data is already cached by cron)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTokens();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchTokens]);

  return {
    tokens,
    isLoading,
    error,
    lastUpdate,
    refetch: fetchTokens,
  };
}
