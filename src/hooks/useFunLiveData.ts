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

// Fetch live pool data from backend function (Helius RPC decode)
const getBackendBaseUrl = (): string => {
  const normalize = (url: string) => url.replace(/\/+$/, "");
  const backendUrl = import.meta.env.VITE_SUPABASE_URL;
  if (backendUrl && typeof backendUrl === "string") return normalize(backendUrl);
  return "";
};

function buildFunPoolStateUrl(poolAddress: string, mintAddress?: string | null): string {
  const base = getBackendBaseUrl();
  if (!base) return "";
  const params = new URLSearchParams();
  params.set("pool", poolAddress);
  if (mintAddress) params.set("mint", mintAddress);
  return `${base}/functions/v1/fun-pool-state?${params.toString()}`;
}

// Poll every 5 seconds for live data (reliable list refresh)
const POLL_INTERVAL = 5000;
const LIVE_BATCH_SIZE = 5;

// Cache for responses
const poolCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1500; // 1.5 seconds cache

export function useFunLiveData(): UseFunLiveDataResult {
  const [tokens, setTokens] = useState<FunToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const abortControllerRef = useRef<AbortController | null>(null);
  const baseTokensRef = useRef<FunToken[]>([]);

  const fetchPoolStateDirect = async (
    poolAddress: string,
    mintAddress?: string | null
  ): Promise<PoolStateResponse | null> => {
    const cached = poolCache.get(poolAddress);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const c = cached.data;
      return {
        priceSol: c.priceSol ?? 0.00000003,
        marketCapSol: c.marketCapSol ?? 30,
        holderCount: c.holderCount ?? 0,
        bondingProgress: c.bondingProgress ?? 0,
        realSolReserves: c.realSolReserves ?? 0,
        isGraduated: !!c.isGraduated,
      };
    }

    try {
      const url = buildFunPoolStateUrl(poolAddress, mintAddress);
      if (!url) return null;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) return null;

      const data = await response.json();
      poolCache.set(poolAddress, { data, timestamp: Date.now() });

      return {
        priceSol: data.priceSol ?? 0.00000003,
        marketCapSol: data.marketCapSol ?? 30,
        holderCount: data.holderCount ?? 0,
        bondingProgress: data.bondingProgress ?? 0,
        realSolReserves: data.realSolReserves ?? 0,
        isGraduated: !!data.isGraduated,
      };
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.debug("[useFunLiveData] fun-pool-state fetch failed for", poolAddress);
      }
      return null;
    }
  };

  // Parse Meteora pool data into our format
  const parsePoolData = (data: any): PoolStateResponse => {
    const realSol = parseFloat(data.real_base_amount || data.real_sol_reserves || 0) / 1e9;
    const virtualSol = parseFloat(data.virtual_base_amount || data.virtual_sol_reserves || 30e9) / 1e9;
    const virtualTokens = parseFloat(data.virtual_quote_amount || data.virtual_token_reserves || 1e15) / 1e6;
    
    const priceSol = virtualTokens > 0 ? virtualSol / virtualTokens : 0.00000003;
    const totalSupply = 1_000_000_000;
    const marketCapSol = priceSol * totalSupply;
    const graduationThreshold = 85;
    const bondingProgress = Math.min((realSol / graduationThreshold) * 100, 100);
    
    return {
      priceSol,
      marketCapSol,
      holderCount: data.holder_count || 0,
      bondingProgress,
      realSolReserves: realSol,
      isGraduated: bondingProgress >= 100,
    };
  };

  // Fetch base tokens from database (less frequent)
  const fetchBaseTokens = useCallback(async () => {
    try {
      const { data: funTokens, error: fetchError } = await supabase
        .from("fun_tokens")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      
      // Map database tokens to our FunToken type with default live values
      const typedTokens: FunToken[] = (funTokens || []).map(t => ({
        ...t,
        holder_count: 0,
        market_cap_sol: 30,
        bonding_progress: 0,
      }));
      
      baseTokensRef.current = typedTokens;
      return typedTokens;
    } catch (err) {
      console.error("[useFunLiveData] Error fetching base tokens:", err);
      return [];
    }
  }, []);

  // Refresh live data from backend function for all tokens
  const refreshLiveData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const baseTokens = baseTokensRef.current;
    if (baseTokens.length === 0) return;

    try {
      const enriched: FunToken[] = [];

      for (let i = 0; i < baseTokens.length; i += LIVE_BATCH_SIZE) {
        const batch = baseTokens.slice(i, i + LIVE_BATCH_SIZE);
        const batchEnriched = await Promise.all(
          batch.map(async (token) => {
            const defaults = {
              holder_count: 0,
              market_cap_sol: 30,
              bonding_progress: 0,
              price_sol: token.price_sol || 0.00000003,
            };

            if (token.dbc_pool_address && token.dbc_pool_address.length > 30) {
              const poolState = await fetchPoolStateDirect(token.dbc_pool_address, token.mint_address);
              if (poolState) {
                return {
                  ...token,
                  holder_count: poolState.holderCount || 0,
                  market_cap_sol: poolState.marketCapSol || 30,
                  bonding_progress: poolState.bondingProgress || 0,
                  price_sol: poolState.priceSol || token.price_sol || 0.00000003,
                };
              }
            }

            return {
              ...token,
              holder_count: defaults.holder_count,
              market_cap_sol: defaults.market_cap_sol,
              bonding_progress: defaults.bonding_progress,
              price_sol: defaults.price_sol,
            };
          })
        );

        enriched.push(...batchEnriched);
      }

      setTokens(enriched);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error("[useFunLiveData] Error refreshing live data:", err);
      }
    }
  }, []);

  // Full fetch (database + live data)
  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    await fetchBaseTokens();
    await refreshLiveData();
    setIsLoading(false);
  }, [fetchBaseTokens, refreshLiveData]);

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
            baseTokensRef.current = [
              { 
                ...newToken, 
                holder_count: 0, 
                market_cap_sol: 30, 
                bonding_progress: 0,
                price_sol: 0.00000003,
              },
              ...baseTokensRef.current,
            ];
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
            baseTokensRef.current = baseTokensRef.current.map((t) => 
              t.id === updatedToken.id ? { ...t, ...updatedToken } : t
            );
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
            baseTokensRef.current = baseTokensRef.current.filter((t) => t.id !== deletedId);
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

  // Fast polling for live pool data (every 2 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshLiveData();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [refreshLiveData]);

  return {
    tokens,
    isLoading,
    error,
    lastUpdate,
    refetch: fetchTokens,
  };
}
