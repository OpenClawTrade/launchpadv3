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

interface PoolStateResponse {
  priceSol: number;
  marketCapSol: number;
  holderCount: number;
  bondingProgress: number;
  realSolReserves: number;
  isGraduated: boolean;
}

interface UseFunLiveDataResult {
  tokens: FunToken[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date;
  refetch: () => Promise<void>;
}

const POLL_INTERVAL = 10_000; // 10 seconds for live data

export function useFunLiveData(): UseFunLiveDataResult {
  const [tokens, setTokens] = useState<FunToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch pool state for a single token
  const fetchPoolState = async (poolAddress: string): Promise<PoolStateResponse | null> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/fun-pool-state?pool=${poolAddress}`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
          signal: abortControllerRef.current?.signal,
        }
      );
      
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.debug('[useFunLiveData] Pool state fetch failed for', poolAddress);
      }
    }
    return null;
  };

  // Main fetch function
  const fetchTokens = useCallback(async () => {
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Fetch fun_tokens from database
      const { data: funTokens, error: fetchError } = await supabase
        .from("fun_tokens")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Enrich with live pool data (parallel requests, limited concurrency)
      const enrichedTokens = await Promise.all(
        (funTokens || []).map(async (token) => {
          let liveData = {
            holder_count: 0,
            market_cap_sol: 30, // Default starting market cap
            bonding_progress: 0,
            price_sol: token.price_sol || 0.00000003,
          };

          // Fetch live data if pool exists
          if (token.dbc_pool_address && token.dbc_pool_address.length > 30) {
            const poolState = await fetchPoolState(token.dbc_pool_address);
            if (poolState) {
              liveData = {
                holder_count: poolState.holderCount || 0,
                market_cap_sol: poolState.marketCapSol || 30,
                bonding_progress: poolState.bondingProgress || 0,
                price_sol: poolState.priceSol || token.price_sol || 0.00000003,
              };
            }
          }

          return {
            ...token,
            holder_count: liveData.holder_count,
            market_cap_sol: liveData.market_cap_sol,
            bonding_progress: liveData.bonding_progress,
            price_sol: liveData.price_sol,
          };
        })
      );

      setTokens(enrichedTokens);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error("[useFunLiveData] Error:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch tokens");
      }
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
                holder_count: 0, 
                market_cap_sol: 30, 
                bonding_progress: 0,
                price_sol: 0.00000003,
              },
              ...prev,
            ]);
            setLastUpdate(new Date());
          } else if (payload.eventType === "UPDATE") {
            const updatedToken = payload.new as FunToken;
            setTokens((prev) =>
              prev.map((t) => 
                t.id === updatedToken.id 
                  ? { ...t, ...updatedToken } 
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

  // Fast polling for live pool data
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
