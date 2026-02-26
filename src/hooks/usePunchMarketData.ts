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

  const fetchAll = useCallback(() => {
    const now = Date.now();
    const freshAddrs: string[] = [];
    const staleAddrs: string[] = [];

    for (const t of tokens) {
      if (!t.mint_address) continue;
      const age = now - new Date(t.created_at).getTime();
      if (age < ONE_HOUR_MS) {
        freshAddrs.push(t.mint_address);
      } else {
        staleAddrs.push(t.mint_address);
      }
    }

    if (freshAddrs.length > 0) fetchBatch(freshAddrs);
    if (staleAddrs.length > 0) fetchBatch(staleAddrs);
  }, [tokens, fetchBatch]);

  // Initial fetch
  useEffect(() => {
    if (tokens.length === 0) return;
    // Fetch all on mount
    const allAddrs = tokens.filter((t) => t.mint_address).map((t) => t.mint_address!);
    if (allAddrs.length > 0) fetchBatch(allAddrs);
  }, [tokens.length]); // Only re-fetch all when token count changes

  // Fresh tokens polling (5s)
  useEffect(() => {
    if (tokens.length === 0) return;

    const poll = () => {
      const now = Date.now();
      const freshAddrs = tokens
        .filter((t) => t.mint_address && now - new Date(t.created_at).getTime() < ONE_HOUR_MS)
        .map((t) => t.mint_address!);
      if (freshAddrs.length > 0) fetchBatch(freshAddrs);
    };

    freshTimerRef.current = setInterval(poll, FRESH_INTERVAL);
    return () => clearInterval(freshTimerRef.current);
  }, [tokens, fetchBatch]);

  // Stale tokens polling (5min)
  useEffect(() => {
    if (tokens.length === 0) return;

    const poll = () => {
      const now = Date.now();
      const staleAddrs = tokens
        .filter((t) => t.mint_address && now - new Date(t.created_at).getTime() >= ONE_HOUR_MS)
        .map((t) => t.mint_address!);
      if (staleAddrs.length > 0) fetchBatch(staleAddrs);
    };

    staleTimerRef.current = setInterval(poll, STALE_INTERVAL);
    return () => clearInterval(staleTimerRef.current);
  }, [tokens, fetchBatch]);

  return data;
}
