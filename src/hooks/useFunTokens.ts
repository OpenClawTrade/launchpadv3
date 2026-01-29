import { useState, useEffect, useCallback, useRef } from "react";
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
const FUN_TOKENS_CACHE_KEY = "funTokensCache:v1";
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

const BASE_POLL_INTERVAL_MS = 60_000; // 60 seconds for DB refresh (was 30s)
const LIVE_POLL_INTERVAL_MS = 60_000; // 60 seconds for live data (was 15s) - matches server cache
const LIVE_BATCH_SIZE = 10; // Larger batches = fewer iterations

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

function readFunTokensCache(): { tokens: FunToken[]; timestamp: number } | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(FUN_TOKENS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FunTokensCachePayload;
    if (!parsed?.ts || !Array.isArray(parsed.tokens)) return null;
    // Don't return expired cache, but also don't return empty arrays
    if (Date.now() - parsed.ts > FUN_TOKENS_CACHE_TTL) {
      localStorage.removeItem(FUN_TOKENS_CACHE_KEY); // Clean up expired cache
      return null;
    }
    if (parsed.tokens.length === 0) return null; // Don't use empty cache
    return { tokens: parsed.tokens, timestamp: parsed.ts };
  } catch {
    localStorage.removeItem(FUN_TOKENS_CACHE_KEY); // Clean up corrupt cache
    return null;
  }
}

function writeFunTokensCache(tokens: FunToken[]) {
  try {
    if (typeof window === "undefined") return;
    // Only cache non-empty arrays
    if (tokens.length === 0) return;
    const payload: FunTokensCachePayload = { ts: Date.now(), tokens };
    localStorage.setItem(FUN_TOKENS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError") ||
    (err instanceof Error && /aborted|abort/i.test(err.message))
  );
}

function buildFunPoolStateUrl(poolAddress: string, mintAddress?: string | null): string {
  const base = getBackendBaseUrl();
  if (!base) return "";
  const params = new URLSearchParams();
  params.set("pool", poolAddress);
  if (mintAddress) params.set("mint", mintAddress);
  return `${base}/functions/v1/fun-pool-state?${params.toString()}`;
}

// Fetch pool state via backend function (Helius RPC decode)
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

    if (!response.ok) {
      return null; // Silent fail - use cached/default data
    }

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
  } catch (e) {
    // Silent fail - use cached/default data
    return null;
  }
}

export function useFunTokens(): UseFunTokensResult {
  const initialCacheRef = useRef(readFunTokensCache());
  const initialCache = initialCacheRef.current;

  const [tokens, setTokens] = useState<FunToken[]>(() => initialCache?.tokens ?? []);
  const [isLoading, setIsLoading] = useState(() => !(initialCache?.tokens?.length));
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(() =>
    initialCache?.timestamp ? new Date(initialCache.timestamp) : new Date()
  );

  const hadCacheOnInitRef = useRef(!!initialCache?.tokens?.length);

  const tokensRef = useRef<FunToken[]>([]);
  const liveRefreshSeq = useRef(0);

  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  const mergeLive = useCallback((token: FunToken, live: Partial<LiveFields>): FunToken => {
    return {
      ...token,
      holder_count: live.holder_count ?? token.holder_count ?? DEFAULT_LIVE.holder_count,
      market_cap_sol: live.market_cap_sol ?? token.market_cap_sol ?? DEFAULT_LIVE.market_cap_sol,
      bonding_progress: live.bonding_progress ?? token.bonding_progress ?? DEFAULT_LIVE.bonding_progress,
      price_sol: live.price_sol ?? token.price_sol ?? DEFAULT_LIVE.price_sol,
    };
  }, []);

  const fetchBaseTokens = useCallback(async (): Promise<FunToken[]> => {
    // No timeout - let the request complete naturally
    // Supabase has its own internal timeout handling
    const { data: funTokens, error: fetchError } = await supabase
      .from("fun_tokens")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("[useFunTokens] Supabase error:", fetchError);
      throw fetchError;
    }

    console.log(`[useFunTokens] Fetched ${funTokens?.length || 0} tokens from DB`);

    // Map DB rows to FunToken - use cached DB values if available, else defaults
    const mapped = (funTokens || []).map((t) => ({
      ...t,
      holder_count: t.holder_count ?? DEFAULT_LIVE.holder_count,
      market_cap_sol: t.market_cap_sol ?? DEFAULT_LIVE.market_cap_sol,
      bonding_progress: t.bonding_progress ?? DEFAULT_LIVE.bonding_progress,
      price_sol: t.price_sol ?? DEFAULT_LIVE.price_sol,
    })) as FunToken[];
    
    // Filter out hidden/spam tokens
    return filterHiddenTokens(mapped);
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch live data from backend function (Helius RPC decode)
  const fetchLiveForToken = useCallback(
    async (token: FunToken): Promise<Partial<LiveFields> | null> => {
      if (!token.dbc_pool_address) return null;
      return fetchPoolStateDirect(
        token.dbc_pool_address,
        token.mint_address,
        abortControllerRef.current?.signal
      );
    },
    []
  );
  // OPTIMIZED: Only fetch live data for a SINGLE token when explicitly requested
  // The main token list now relies entirely on DB-cached values from the cron job
  // This eliminates the 500+ RPC calls that were causing rate limiting (429 errors)
  const refreshLiveData = useCallback(
    async (opts?: { onlyTokenId?: string }) => {
      // Only allow single-token refreshes to prevent mass RPC calls
      if (!opts?.onlyTokenId) {
        // Bulk refresh is now disabled - DB cache handles this via cron
        console.log("[useFunTokens] Skipping bulk live refresh - using DB cache");
        return;
      }

      const currentSeq = ++liveRefreshSeq.current;
      const base = tokensRef.current;
      const token = base.find((t) => t.id === opts.onlyTokenId);
      
      if (!token?.dbc_pool_address || token.dbc_pool_address.length <= 30) return;

      const live = await fetchLiveForToken(token);

      // Ignore stale refreshes
      if (currentSeq !== liveRefreshSeq.current) return;

      if (!live) return;

      setTokens((prev) => {
        const next = prev.map((t) => (t.id === token.id ? mergeLive(t, live) : t));
        tokensRef.current = next;
        return next;
      });

      setLastUpdate(new Date());
    },
    [fetchLiveForToken, mergeLive]
  );

  const fetchTokens = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    try {
      const base = await fetchBaseTokens();
      
      // Write to cache immediately after successful fetch
      writeFunTokensCache(base);
      
      // CRITICAL: Merge base data with existing live data to prevent overwriting
      setTokens((prev) => {
        if (prev.length === 0) {
          // First load - use base with defaults
          tokensRef.current = base;
          return base;
        }
        
        // Create a map of existing tokens with their live data
        const existingMap = new Map(prev.map(t => [t.id, t]));
        
        // Merge: use base for DB fields, but preserve live fields from existing
        const merged = base.map(baseToken => {
          const existing = existingMap.get(baseToken.id);
          if (existing) {
            // Preserve live fields (holder_count, market_cap_sol, bonding_progress, price_sol)
            return {
              ...baseToken,
              holder_count: existing.holder_count,
              market_cap_sol: existing.market_cap_sol,
              bonding_progress: existing.bonding_progress,
              price_sol: existing.price_sol !== DEFAULT_LIVE.price_sol ? existing.price_sol : baseToken.price_sol,
            };
          }
          return baseToken;
        });
        
        tokensRef.current = merged;
        return merged;
      });
      
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      // If we timed out but already have cached tokens, keep UI instant and silent.
      if (isAbortError(err) && tokensRef.current.length > 0) {
        return;
      }
      console.error("[useFunTokens] Fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch tokens");
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, [fetchBaseTokens]);

  // Initial DB fetch
  useEffect(() => {
    // If we have localStorage cache, don't flip into a global loading state.
    fetchTokens(!hadCacheOnInitRef.current);
  }, [fetchTokens]);

  // Trigger live data refresh AFTER initial DB load completes (background)
  const hasInitialLoadedRef = useRef(false);
  useEffect(() => {
    if (!isLoading && tokens.length > 0 && !hasInitialLoadedRef.current) {
      hasInitialLoadedRef.current = true;
      // Background refresh - don't block UI
      refreshLiveData();
    }
  }, [isLoading, tokens.length, refreshLiveData]);

  // Realtime subscription for inserts/updates/deletes
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
          if (payload.eventType === "INSERT") {
            const newToken = payload.new as FunToken;
            const withDefaults = mergeLive(newToken, DEFAULT_LIVE);
            setTokens((prev) => {
              const next = [withDefaults, ...prev];
              tokensRef.current = next;
              return next;
            });
            // Immediately enrich the new token if it has a pool
            void refreshLiveData({ onlyTokenId: newToken.id });
            setLastUpdate(new Date());
          } else if (payload.eventType === "UPDATE") {
            const updatedToken = payload.new as FunToken;
            setTokens((prev) => {
              const next = prev.map((t) => (t.id === updatedToken.id ? { ...t, ...updatedToken } : t));
              tokensRef.current = next;
              return next;
            });
            setLastUpdate(new Date());
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any).id as string;
            setTokens((prev) => {
              const next = prev.filter((t) => t.id !== deletedId);
              tokensRef.current = next;
              return next;
            });
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mergeLive, refreshLiveData]);

  // Base token list refresh (db) - less frequent, preserves live data
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchTokens(false); // Don't reset loading state
    }, BASE_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchTokens]);

  // Live fields refresh (pool state) - fast
  useEffect(() => {
    const interval = setInterval(() => {
      // avoid burning resources when tab isn't visible
      if (document.visibilityState !== "visible") return;
      void refreshLiveData();
    }, LIVE_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refreshLiveData]);

  return {
    tokens,
    isLoading,
    error,
    lastUpdate,
    refetch: () => fetchTokens(true),
  };
}
