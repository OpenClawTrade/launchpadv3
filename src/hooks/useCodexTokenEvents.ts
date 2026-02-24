import { useQuery } from "@tanstack/react-query";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface TokenTradeEvent {
  timestamp: number;
  type: "Buy" | "Sell";
  maker: string;
  tokenAmount: number;
  totalUsd: number;
  priceUsd: number;
  txHash: string;
}

interface RawEvent {
  timestamp: number;
  eventType: string;
  eventDisplayType: string;
  maker: string;
  data: {
    amount0?: string;
    amount1?: string;
    priceUsd?: string;
    priceUsdTotal?: string;
    type?: string;
  } | null;
  transaction: { hash: string } | null;
}

function normalizeEvents(events: RawEvent[]): TokenTradeEvent[] {
  return events
    .filter((e) => e.data && (e.data.type === "Buy" || e.data.type === "Sell"))
    .map((e) => ({
      timestamp: e.timestamp,
      type: (e.data!.type as "Buy" | "Sell"),
      maker: e.maker || "",
      tokenAmount: parseFloat(e.data!.amount1 || e.data!.amount0 || "0"),
      totalUsd: parseFloat(e.data!.priceUsdTotal || "0"),
      priceUsd: parseFloat(e.data!.priceUsd || "0"),
      txHash: e.transaction?.hash || "",
    }));
}

async function fetchTokenEvents(tokenAddress: string, cursor?: string | null): Promise<{
  events: TokenTradeEvent[];
  cursor: string | null;
}> {
  const url = `${SUPABASE_URL}/functions/v1/codex-token-events`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ tokenAddress, cursor, limit: 50 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token events fetch failed: ${err}`);
  }

  const data = await res.json();
  return {
    events: normalizeEvents(data?.events || []),
    cursor: data?.cursor || null,
  };
}

export function useCodexTokenEvents(tokenAddress: string) {
  return useQuery({
    queryKey: ["codex-token-events", tokenAddress],
    queryFn: () => fetchTokenEvents(tokenAddress),
    enabled: !!tokenAddress,
    staleTime: 4_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}
