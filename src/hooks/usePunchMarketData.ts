import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TokenMarketData {
  marketCapUsd: number;
  holders: number;
  change24h: number;
  priceUsd: number;
  volume24hUsd: number;
}

const FRESH_INTERVAL = 5_000; // 5 seconds for tokens < 1 hour old
const STALE_INTERVAL = 5 * 60_000; // 5 minutes for tokens > 1 hour old
const ONE_HOUR_MS = 60 * 60 * 1000;

interface TokenWithAge {
  mint_address: string;
  created_at: string;
}

export function usePunchMarketData(tokens: TokenWithAge[]) {
  const [data, setData] = useState<Record<string, TokenMarketData>>({});
  const freshTimerRef = useRef<ReturnType<typeof setInterval>>();
  const staleTimerRef = useRef<ReturnType<typeof setInterval>>();
  // Serialize addresses to stabilize dependencies
  const addressKey = tokens.map((t) => t.mint_address).join(",");

  const fetchBatch = useCallback(async (addresses: string[]) => {
    if (addresses.length === 0) return;
    try {
      const { data: result, error } = await supabase.functions.invoke("codex-batch-market", {
        body: { addresses },
      });
      if (error || !result?.results) return;
      setData((prev) => ({ ...prev, ...result.results }));
    } catch (err) {
      console.error("[usePunchMarketData] fetch error:", err);
    }
  }, []);

  // Initial fetch + when token list changes
  useEffect(() => {
    const allAddrs = tokens.filter((t) => t.mint_address).map((t) => t.mint_address!);
    if (allAddrs.length > 0) {
      fetchBatch(allAddrs);
      // Retry once after 3s for tokens that Codex hasn't indexed yet
      const retryTimer = setTimeout(() => fetchBatch(allAddrs), 3000);
      return () => clearTimeout(retryTimer);
    }
  }, [addressKey, fetchBatch]);

  // Fresh tokens polling (5s)
  useEffect(() => {
    const poll = () => {
      const now = Date.now();
      const freshAddrs = tokens
        .filter((t) => t.mint_address && now - new Date(t.created_at).getTime() < ONE_HOUR_MS)
        .map((t) => t.mint_address!);
      if (freshAddrs.length > 0) fetchBatch(freshAddrs);
    };

    freshTimerRef.current = setInterval(poll, FRESH_INTERVAL);
    return () => clearInterval(freshTimerRef.current);
  }, [addressKey, fetchBatch]);

  // Stale tokens polling (5min)
  useEffect(() => {
    const poll = () => {
      const now = Date.now();
      const staleAddrs = tokens
        .filter((t) => t.mint_address && now - new Date(t.created_at).getTime() >= ONE_HOUR_MS)
        .map((t) => t.mint_address!);
      if (staleAddrs.length > 0) fetchBatch(staleAddrs);
    };

    staleTimerRef.current = setInterval(poll, STALE_INTERVAL);
    return () => clearInterval(staleTimerRef.current);
  }, [addressKey, fetchBatch]);

  return data;
}
