import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CLIENT_ID_KEY = "saturn:visitor-id";

function getClientId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

/** Fire-and-forget tracker for a single token page visit (debounced per-tab per session). */
export function useTrackTokenView(tokenAddress?: string | null) {
  useEffect(() => {
    if (!tokenAddress) return;
    const addr = tokenAddress.trim();
    if (!addr) return;

    // Per-tab session debounce so route remounts don't double-fire.
    const sessionKey = `tv:${addr.toLowerCase()}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    supabase.functions
      .invoke("track-token-view", {
        body: { tokenAddress: addr, clientId: getClientId() },
      })
      .catch((err) => console.warn("[track-token-view] failed:", err));
  }, [tokenAddress]);
}

export interface TokenViewCount {
  view_count: number;
  unique_count: number;
}

/** Batch-fetch view counts for a list of token addresses. */
export function useTokenViewCounts(addresses: (string | null | undefined)[]) {
  const normalized = useMemo(() => {
    const set = new Set<string>();
    for (const a of addresses) {
      if (!a) continue;
      const trimmed = a.trim().toLowerCase();
      if (trimmed) set.add(trimmed);
    }
    return [...set].sort();
  }, [addresses]);

  const key = normalized.join(",");

  return useQuery({
    queryKey: ["token-view-counts", key],
    queryFn: async (): Promise<Record<string, TokenViewCount>> => {
      if (normalized.length === 0) return {};
      const { data, error } = await supabase
        .from("token_views")
        .select("token_address, view_count, unique_count")
        .in("token_address", normalized);
      if (error) throw error;
      const map: Record<string, TokenViewCount> = {};
      for (const row of data ?? []) {
        map[row.token_address] = {
          view_count: Number(row.view_count ?? 0),
          unique_count: Number(row.unique_count ?? 0),
        };
      }
      return map;
    },
    enabled: normalized.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function formatViewCount(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
