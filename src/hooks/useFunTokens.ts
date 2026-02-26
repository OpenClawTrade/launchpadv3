import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { filterHiddenTokens } from "@/lib/hiddenTokens";

const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD_SOL = 85;

const getBackendBaseUrl = (): string => {
  const normalize = (url: string) => url.replace(/\/+$/, "");
  const backendUrl = import.meta.env.VITE_SUPABASE_URL;
  if (backendUrl && typeof backendUrl === "string") return normalize(backendUrl);
  return "";
};

// Cache for pool-state responses - 60 second TTL to match server cache
const poolCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 60 seconds cache - matches server-side cache

// LocalStorage hydration so tokens render instantly even if the DB request is slow/cold
const FUN_TOKENS_CACHE_KEY = "funTokensCache:v2";
const FUN_TOKENS_CACHE_TTL = 1000 * 60 * 10; // 10 minutes

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
  price_change_24h?: number | null;
  volume_24h_sol: number;
  total_fees_earned: number;
  holder_count?: number;
  market_cap_sol?: number;
  bonding_progress?: number;
  trading_fee_bps?: number;
  fee_mode?: string | null;
  last_distribution_at: string | null;
  created_at: string;
  updated_at: string;
}

type LiveFields = Pick<FunToken, "price_sol" | "holder_count" | "market_cap_sol" | "bonding_progress">;

interface UseFunTokensResult {
  tokens: FunToken[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date;
  refetch: () => Promise<void>;
}

const DEFAULT_LIVE: LiveFields = {
  holder_count: 0,
  market_cap_sol: 30,
  bonding_progress: 0,
  price_sol: 0.00000003,
};

type FunTokensCachePayload = {
  ts: number;
  tokens: FunToken[];
};

function readFunTokensCache(): FunToken[] | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    const raw = localStorage.getItem(FUN_TOKENS_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as FunTokensCachePayload;
    if (!parsed?.ts || !Array.isArray(parsed.tokens)) return undefined;
    if (Date.now() - parsed.ts > FUN_TOKENS_CACHE_TTL) {
      localStorage.removeItem(FUN_TOKENS_CACHE_KEY);
      return undefined;
    }
    if (parsed.tokens.length === 0) return undefined;
    return parsed.tokens;
  } catch {
    localStorage.removeItem(FUN_TOKENS_CACHE_KEY);
    return undefined;
  }
}

function writeFunTokensCache(tokens: FunToken[]) {
  try {
    if (typeof window === "undefined") return;
    if (tokens.length === 0) return;
    const payload: FunTokensCachePayload = { ts: Date.now(), tokens };
    localStorage.setItem(FUN_TOKENS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

function buildFunPoolStateUrl(poolAddress: string, mintAddress?: string | null): string {
  const base = getBackendBaseUrl();
  if (!base) return "";
  const params = new URLSearchParams();
  params.set("pool", poolAddress);
  if (mintAddress) params.set("mint", mintAddress);
  return `${base}/functions/v1/fun-pool-state?${params.toString()}`;
}

async function fetchPoolStateDirect(
  poolAddress: string,
  mintAddress?: string | null,
  signal?: AbortSignal
): Promise<LiveFields | null> {
  const cached = poolCache.get(poolAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    const c = cached.data;
    return {
      price_sol: c.priceSol ?? DEFAULT_LIVE.price_sol,
      market_cap_sol: c.marketCapSol ?? DEFAULT_LIVE.market_cap_sol,
      bonding_progress: c.bondingProgress ?? DEFAULT_LIVE.bonding_progress,
      holder_count: c.holderCount ?? DEFAULT_LIVE.holder_count,
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
      signal,
    });

    if (!response.ok) return null;

    const data = await response.json();

    const normalized = {
      priceSol: data.priceSol,
      marketCapSol: data.marketCapSol,
      bondingProgress: data.bondingProgress,
      holderCount: data.holderCount,
      source: data.source,
    };

    poolCache.set(poolAddress, { data: normalized, timestamp: Date.now() });

    return {
      price_sol: normalized.priceSol ?? DEFAULT_LIVE.price_sol,
      market_cap_sol: normalized.marketCapSol ?? DEFAULT_LIVE.market_cap_sol,
      bonding_progress: normalized.bondingProgress ?? DEFAULT_LIVE.bonding_progress,
      holder_count: normalized.holderCount ?? DEFAULT_LIVE.holder_count,
    };
  } catch {
    return null;
  }
}

// Core fetch function - used by React Query
async function fetchFunTokensFromDB(): Promise<FunToken[]> {
  const { data: funTokens, error: fetchError } = await supabase
    .from("fun_tokens")
    .select(`
      id, name, ticker, description, image_url, creator_wallet, mint_address,
      dbc_pool_address, status, price_sol, price_change_24h, volume_24h_sol,
      total_fees_earned, holder_count, market_cap_sol, bonding_progress,
      trading_fee_bps, fee_mode, last_distribution_at, created_at, updated_at
    `)
    .neq("launchpad_type", "punch")
    .order("created_at", { ascending: false })
    .limit(100);

  if (fetchError) throw fetchError;

  const mapped = (funTokens || []).map((t) => ({
    ...t,
    holder_count: t.holder_count ?? DEFAULT_LIVE.holder_count,
    market_cap_sol: t.market_cap_sol ?? DEFAULT_LIVE.market_cap_sol,
    bonding_progress: t.bonding_progress ?? DEFAULT_LIVE.bonding_progress,
    price_sol: t.price_sol ?? DEFAULT_LIVE.price_sol,
  })) as FunToken[];

  const filtered = filterHiddenTokens(mapped);
  
  // Persist to localStorage for next visit
  writeFunTokensCache(filtered);
  
  return filtered;
}

// Query key for React Query
const FUN_TOKENS_QUERY_KEY = ["fun-tokens-list"];

export function useFunTokens(): UseFunTokensResult {
  const queryClient = useQueryClient();
  const lastUpdateRef = useRef(new Date());

  // React Query with aggressive caching
  const {
    data: tokens = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: FUN_TOKENS_QUERY_KEY,
    queryFn: fetchFunTokensFromDB,
    // CRITICAL: These settings make data appear instantly
    staleTime: 1000 * 60 * 2, // Data is fresh for 2 minutes - no refetch
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on tab switch
    refetchOnMount: false, // Don't refetch if we have data
    refetchInterval: 1000 * 60, // Background refresh every 60s
    // Use localStorage as initial data for instant render
    initialData: readFunTokensCache,
    initialDataUpdatedAt: () => {
      // Tell React Query when the cached data was last updated
      const cached = localStorage.getItem(FUN_TOKENS_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as FunTokensCachePayload;
          return parsed.ts;
        } catch {
          return 0;
        }
      }
      return 0;
    },
  });

  // Update lastUpdate when data changes
  useEffect(() => {
    if (tokens.length > 0) {
      lastUpdateRef.current = new Date();
    }
  }, [tokens]);

  // Realtime subscription for inserts/updates/deletes
  useEffect(() => {
    const channel = supabase
      .channel("fun-tokens-realtime-v2")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fun_tokens",
        },
        (payload) => {
          // Update React Query cache directly for instant UI updates
          queryClient.setQueryData<FunToken[]>(FUN_TOKENS_QUERY_KEY, (prev) => {
            if (!prev) return prev;

            if (payload.eventType === "INSERT") {
              const newToken = payload.new as FunToken;
              const withDefaults = {
                ...newToken,
                holder_count: newToken.holder_count ?? DEFAULT_LIVE.holder_count,
                market_cap_sol: newToken.market_cap_sol ?? DEFAULT_LIVE.market_cap_sol,
                bonding_progress: newToken.bonding_progress ?? DEFAULT_LIVE.bonding_progress,
                price_sol: newToken.price_sol ?? DEFAULT_LIVE.price_sol,
              };
              const updated = [withDefaults, ...prev];
              writeFunTokensCache(updated);
              return updated;
            } else if (payload.eventType === "UPDATE") {
              const updatedToken = payload.new as FunToken;
              const updated = prev.map((t) =>
                t.id === updatedToken.id ? { ...t, ...updatedToken } : t
              );
              writeFunTokensCache(updated);
              return updated;
            } else if (payload.eventType === "DELETE") {
              const deletedId = (payload.old as any).id as string;
              const updated = prev.filter((t) => t.id !== deletedId);
              writeFunTokensCache(updated);
              return updated;
            }
            return prev;
          });
          lastUpdateRef.current = new Date();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleRefetch = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    tokens,
    isLoading: isLoading && tokens.length === 0, // Only show loading if we have no data
    error: error ? (error instanceof Error ? error.message : "Failed to fetch tokens") : null,
    lastUpdate: lastUpdateRef.current,
    refetch: handleRefetch,
  };
}
