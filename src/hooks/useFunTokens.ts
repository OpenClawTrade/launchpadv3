import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const DBC_API_URL = "https://dbc-api.meteora.ag";
const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD_SOL = 85;

// Cache for Meteora responses to avoid hammering the API
const poolCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1500; // 1.5 seconds cache

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

type LiveFields = Pick<FunToken, "price_sol" | "holder_count" | "market_cap_sol" | "bonding_progress">;

interface UseFunTokensResult {
  tokens: FunToken[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date;
  refetch: () => Promise<void>;
}

const BASE_POLL_INTERVAL_MS = 15_000;
const LIVE_POLL_INTERVAL_MS = 2_000;
const LIVE_BATCH_SIZE = 5;

const DEFAULT_LIVE: LiveFields = {
  holder_count: 0,
  market_cap_sol: 30,
  bonding_progress: 0,
  price_sol: 0.00000003,
};

// Parse Meteora pool data into our format (browser-side)
function parsePoolData(data: any): LiveFields {
  const realSol = parseFloat(data.real_base_amount || data.real_sol_reserves || 0) / 1e9;
  const virtualSol = parseFloat(data.virtual_base_amount || data.virtual_sol_reserves || 30e9) / 1e9;
  const virtualTokens = parseFloat(data.virtual_quote_amount || data.virtual_token_reserves || 1e15) / 1e6;
  
  const priceSol = virtualTokens > 0 ? virtualSol / virtualTokens : 0.00000003;
  const marketCapSol = priceSol * TOTAL_SUPPLY;
  const bondingProgress = Math.min((realSol / GRADUATION_THRESHOLD_SOL) * 100, 100);
  
  return {
    price_sol: priceSol,
    market_cap_sol: marketCapSol,
    holder_count: data.holder_count || 0,
    bonding_progress: bondingProgress,
  };
}

// Fetch pool state directly from Meteora DBC API (browser-side)
async function fetchPoolStateDirect(poolAddress: string, signal?: AbortSignal): Promise<LiveFields | null> {
  // Check cache first
  const cached = poolCache.get(poolAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return parsePoolData(cached.data);
  }

  try {
    const response = await fetch(`${DBC_API_URL}/pools/${poolAddress}`, {
      headers: { 'Accept': 'application/json' },
      signal,
    });

    if (response.ok) {
      const data = await response.json();
      poolCache.set(poolAddress, { data, timestamp: Date.now() });
      return parsePoolData(data);
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      console.debug('[useFunTokens] Direct Meteora fetch failed for', poolAddress);
    }
  }
  return null;
}

export function useFunTokens(): UseFunTokensResult {
  const [tokens, setTokens] = useState<FunToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

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
    const { data: funTokens, error: fetchError } = await supabase
      .from("fun_tokens")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;

    // Map DB rows to FunToken with live fields set to defaults
    // (holder_count, market_cap_sol, bonding_progress don't exist in DB)
    return (funTokens || []).map((t) => ({
      ...t,
      holder_count: DEFAULT_LIVE.holder_count,
      market_cap_sol: DEFAULT_LIVE.market_cap_sol,
      bonding_progress: DEFAULT_LIVE.bonding_progress,
      price_sol: t.price_sol ?? DEFAULT_LIVE.price_sol,
    })) as FunToken[];
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch live data directly from Meteora (browser-side, bypasses backend DNS issues)
  const fetchLiveForPool = useCallback(
    async (pool: string): Promise<Partial<LiveFields> | null> => {
      return fetchPoolStateDirect(pool, abortControllerRef.current?.signal);
    },
    []
  );
  const refreshLiveData = useCallback(
    async (opts?: { onlyTokenId?: string }) => {
      const currentSeq = ++liveRefreshSeq.current;
      const base = tokensRef.current;
      if (base.length === 0) return;

      const subset = opts?.onlyTokenId
        ? base.filter((t) => t.id === opts.onlyTokenId)
        : base.filter((t) => !!t.dbc_pool_address && t.dbc_pool_address.length > 30);

      if (subset.length === 0) return;

      const allResults: Array<PromiseSettledResult<{ id: string; live: Partial<LiveFields> | null }>> = [];

      for (let i = 0; i < subset.length; i += LIVE_BATCH_SIZE) {
        const batch = subset.slice(i, i + LIVE_BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map(async (token) => {
            const live = token.dbc_pool_address
              ? await fetchLiveForPool(token.dbc_pool_address)
              : null;
            return { id: token.id, live };
          })
        );
        allResults.push(...batchResults);

        // Ignore stale refreshes mid-flight
        if (currentSeq !== liveRefreshSeq.current) return;
      }

      // Ignore stale refreshes
      if (currentSeq !== liveRefreshSeq.current) return;

      const liveMap = new Map<string, Partial<LiveFields>>();
      for (const r of allResults) {
        if (r.status !== "fulfilled") continue;
        if (r.value.live) liveMap.set(r.value.id, r.value.live);
      }

      if (liveMap.size === 0) return;

      setTokens((prev) => {
        const next = prev.map((t) => {
          const live = liveMap.get(t.id);
          return live ? mergeLive(t, live) : t;
        });
        tokensRef.current = next;
        return next;
      });

      setLastUpdate(new Date());
    },
    [fetchLiveForPool, mergeLive]
  );

  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      const base = await fetchBaseTokens();
      setTokens(base);
      tokensRef.current = base;
      setError(null);
      await refreshLiveData();
      setLastUpdate(new Date());
    } catch (err) {
      console.error("[useFunTokens] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch tokens");
    } finally {
      setIsLoading(false);
    }
  }, [fetchBaseTokens, refreshLiveData]);

  // Initial fetch
  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

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

  // Base token list refresh (db) - less frequent
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchTokens();
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
    refetch: fetchTokens,
  };
}
