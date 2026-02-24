import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface CodexBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
  buys?: number;
  sells?: number;
  buyers?: number;
  sellers?: number;
  traders?: number;
  transactions?: number;
  liquidity?: number;
}

export type ChartType = "candlestick" | "line" | "area";
export type CurrencyCode = "USD" | "TOKEN";
export type StatsType = "FILTERED" | "UNFILTERED";

export const RESOLUTIONS = [
  { label: "1s", value: "1S" },
  { label: "5s", value: "5S" },
  { label: "15s", value: "15S" },
  { label: "30s", value: "30S" },
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "30m", value: "30" },
  { label: "1h", value: "60" },
  { label: "4h", value: "240" },
  { label: "12h", value: "720" },
  { label: "1D", value: "1D" },
  { label: "7D", value: "7D" },
  { label: "1W", value: "1W" },
] as const;

export type Resolution = (typeof RESOLUTIONS)[number]["value"];

interface CodexRawBars {
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  t: number[];
  volume?: number[];
  buyVolume?: number[];
  sellVolume?: number[];
  buys?: number[];
  sells?: number[];
  buyers?: number[];
  sellers?: number[];
  traders?: number[];
  transactions?: number[];
  liquidity?: number[];
}

function transformBars(raw: CodexRawBars | null | undefined): CodexBar[] {
  if (!raw || !raw.t || raw.t.length === 0) return [];

  const len = raw.t.length;
  const bars: CodexBar[] = [];
  const num = (v: unknown) => (typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0);

  for (let i = 0; i < len; i++) {
    bars.push({
      time: num(raw.t[i]),
      open: num(raw.o?.[i]),
      high: num(raw.h?.[i]),
      low: num(raw.l?.[i]),
      close: num(raw.c?.[i]),
      volume: num(raw.volume?.[i]),
      buyVolume: raw.buyVolume ? num(raw.buyVolume[i]) : undefined,
      sellVolume: raw.sellVolume ? num(raw.sellVolume[i]) : undefined,
      buys: raw.buys ? num(raw.buys[i]) : undefined,
      sells: raw.sells ? num(raw.sells[i]) : undefined,
      buyers: raw.buyers ? num(raw.buyers[i]) : undefined,
      sellers: raw.sellers ? num(raw.sellers[i]) : undefined,
      traders: raw.traders ? num(raw.traders[i]) : undefined,
      transactions: raw.transactions ? num(raw.transactions[i]) : undefined,
      liquidity: raw.liquidity ? num(raw.liquidity[i]) : undefined,
    });
  }

  // Sort ascending by time
  bars.sort((a, b) => a.time - b.time);
  return bars;
}

async function fetchBars(params: {
  tokenAddress: string;
  networkId: number;
  resolution: string;
  countback: number;
  currencyCode: string;
  statsType: string;
  from?: number;
  to?: number;
}): Promise<CodexBar[]> {
  const url = `${SUPABASE_URL}/functions/v1/codex-chart-data`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({
      query: "getTokenBars",
      tokenAddress: params.tokenAddress,
      networkId: params.networkId,
      resolution: params.resolution,
      countback: params.countback,
      currencyCode: params.currencyCode,
      statsType: params.statsType,
      from: params.from,
      to: params.to,
      removeEmptyBars: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chart data fetch failed: ${err}`);
  }

  const data = await res.json();
  return transformBars(data.bars);
}

export function useCodexChart(
  tokenAddress: string,
  networkId = 1399811149
) {
  const [resolution, setResolution] = useState<Resolution>("15");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>("USD");
  const [statsType, setStatsType] = useState<StatsType>("FILTERED");
  const [showVolume, setShowVolume] = useState(true);

  const queryKey = useMemo(
    () => ["codex-chart", tokenAddress, networkId, resolution, currencyCode, statsType],
    [tokenAddress, networkId, resolution, currencyCode, statsType]
  );

  const {
    data: bars = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () =>
      fetchBars({
        tokenAddress,
        networkId,
        resolution,
        countback: 1500,
        currencyCode,
        statsType,
      }),
    enabled: !!tokenAddress,
    staleTime: 30_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  const latestBar = useMemo(() => (bars.length > 0 ? bars[bars.length - 1] : null), [bars]);

  const cycleChartType = useCallback(() => {
    setChartType((prev) => {
      if (prev === "candlestick") return "line";
      if (prev === "line") return "area";
      return "candlestick";
    });
  }, []);

  return {
    bars,
    isLoading,
    error,
    latestBar,
    resolution,
    setResolution,
    chartType,
    setChartType,
    cycleChartType,
    currencyCode,
    setCurrencyCode,
    statsType,
    setStatsType,
    showVolume,
    setShowVolume,
    refetch,
  };
}
