// Real-time candlestick chart for a Unicurve bonding token.
// Builds OHLCV from the rows in `bonding_trades` and live-appends new trades
// via a Supabase Realtime channel — no cron, no polling. Auto-fits to ~120 candles.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart, CandlestickSeries, HistogramSeries, ColorType,
  type IChartApi, type ISeriesApi, type Time, type UTCTimestamp,
} from "lightweight-charts";
import { supabase } from "@/integrations/supabase/client";

type Bucket = "1m" | "5m" | "1h" | "1d";
const SECONDS: Record<Bucket, number> = { "1m": 60, "5m": 300, "1h": 3600, "1d": 86400 };

interface RawTrade {
  created_at: string;
  side: string;
  eth_amount: number;
  token_amount: number;
  price_eth: number | null;
}

interface Candle {
  time: UTCTimestamp;
  open: number; high: number; low: number; close: number;
  volume: number;
}

function bucketTrades(rows: RawTrade[], bucketSec: number): { candles: Candle[]; volumes: { time: UTCTimestamp; value: number; color: string }[] } {
  if (!rows.length) return { candles: [], volumes: [] };
  const sorted = [...rows].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const map = new Map<number, Candle & { _last: number }>();
  for (const r of sorted) {
    const price = r.price_eth ?? (r.token_amount > 0 ? r.eth_amount / r.token_amount : 0);
    if (!price) continue;
    const t = Math.floor(new Date(r.created_at).getTime() / 1000 / bucketSec) * bucketSec;
    const existing = map.get(t);
    if (!existing) {
      map.set(t, { time: t as UTCTimestamp, open: price, high: price, low: price, close: price, volume: r.eth_amount, _last: price });
    } else {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
      existing.volume += r.eth_amount;
    }
  }
  const candles = [...map.values()].sort((a, b) => (a.time as number) - (b.time as number)).map(({ _last, ...c }) => c);
  const volumes = candles.map((c) => ({
    time: c.time, value: c.volume,
    color: c.close >= c.open ? "rgba(16,185,129,0.55)" : "rgba(244,63,94,0.55)",
  }));
  return { candles, volumes };
}

interface Props { tokenAddress: string }

export function BondingPriceChart({ tokenAddress }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [bucket, setBucket] = useState<Bucket>("5m");
  const [trades, setTrades] = useState<RawTrade[]>([]);
  const [loading, setLoading] = useState(true);

  // Build chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "hsl(var(--pop-ink))",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
      },
      grid: {
        vertLines: { color: "hsl(var(--pop-ink) / 0.06)" },
        horzLines: { color: "hsl(var(--pop-ink) / 0.06)" },
      },
      rightPriceScale: { borderColor: "hsl(var(--pop-ink) / 0.2)", scaleMargins: { top: 0.1, bottom: 0.3 } },
      timeScale: { borderColor: "hsl(var(--pop-ink) / 0.2)", timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height: 360,
      crosshair: { mode: 1 },
    });
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", downColor: "#f43f5e",
      borderUpColor: "#10b981", borderDownColor: "#f43f5e",
      wickUpColor: "#10b981", wickDownColor: "#f43f5e",
      priceFormat: { type: "price", precision: 12, minMove: 0.000000000001 },
    });
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "rgba(16,185,129,0.5)",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    chartRef.current = chart;
    candleSeriesRef.current = candle;
    volSeriesRef.current = vol;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, []);

  // Initial load + realtime subscribe
  useEffect(() => {
    if (!tokenAddress) return;
    const addr = tokenAddress.toLowerCase();
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("bonding_trades")
        .select("created_at,side,eth_amount,token_amount,price_eth")
        .eq("token_address", addr)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (!cancelled) {
        setTrades((data as RawTrade[]) ?? []);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`bonding_trades:${addr}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bonding_trades", filter: `token_address=eq.${addr}` },
        (payload) => {
          const row = payload.new as RawTrade;
          setTrades((prev) => [...prev, row]);
        },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [tokenAddress]);

  // Push data into chart whenever bucket or trades change
  const { candles, volumes } = useMemo(() => bucketTrades(trades, SECONDS[bucket]), [trades, bucket]);
  useEffect(() => {
    if (!candleSeriesRef.current || !volSeriesRef.current || !chartRef.current) return;
    candleSeriesRef.current.setData(candles);
    volSeriesRef.current.setData(volumes);
    if (candles.length) chartRef.current.timeScale().fitContent();
  }, [candles, volumes]);

  return (
    <div className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-pop-mono uppercase tracking-[0.12em] text-pop-ink/70">Price · ETH</p>
        <div className="flex items-center gap-1">
          {(["1m", "5m", "1h", "1d"] as Bucket[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={`px-2 py-0.5 text-[11px] font-pop-mono border ${
                bucket === b ? "bg-pop-ink text-pop-cream border-pop-ink" : "bg-pop-cream border-pop-ink/30 text-pop-ink/70"
              }`}
            >
              {b.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="w-full" style={{ minHeight: 360 }} />
      {!loading && trades.length === 0 && (
        <p className="text-center text-[12px] text-pop-ink/50 py-2">Waiting for the first trade…</p>
      )}
    </div>
  );
}
