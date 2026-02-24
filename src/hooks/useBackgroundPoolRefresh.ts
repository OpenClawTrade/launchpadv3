import { useEffect, useRef } from "react";

const REFRESH_INTERVAL_MS = 60_000; // 60s matches server cache TTL

interface TokenToRefresh {
  dbc_pool_address?: string | null;
  mint_address?: string | null;
  status?: string | null;
}

/**
 * Proactively calls fun-pool-state for visible tokens to keep DB data fresh.
 * This ensures listing pages (King of the Hill, Just Launched) show up-to-date
 * bonding progress & market cap without requiring users to visit each token page.
 */
export function useBackgroundPoolRefresh(tokens: TokenToRefresh[]) {
  const lastRefreshRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!tokens.length) return;

    const base = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!base || !key) return;

    // Only refresh active/bonding tokens with a pool address
    const eligible = tokens.filter(
      (t) => t.dbc_pool_address && t.status !== "graduated"
    );
    if (!eligible.length) return;

    const refresh = () => {
      const now = Date.now();
      for (const token of eligible) {
        const pool = token.dbc_pool_address!;
        const lastTime = lastRefreshRef.current[pool] || 0;
        if (now - lastTime < REFRESH_INTERVAL_MS) continue;

        lastRefreshRef.current[pool] = now;

        const params = new URLSearchParams({ pool });
        if (token.mint_address) params.set("mint", token.mint_address);

        fetch(`${base}/functions/v1/fun-pool-state?${params}`, {
          headers: { apikey: key, "Content-Type": "application/json" },
        }).catch(() => {
          // Silent fail — next cycle will retry
        });
      }
    };

    // Immediate refresh on mount
    refresh();

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [tokens]);
}
