import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useCodexChart } from "@/hooks/useCodexChart";
import { CodexChartToolbar } from "./CodexChartToolbar";
import { Skeleton } from "@/components/ui/skeleton";

interface CodexChartProps {
  tokenAddress: string;
  networkId?: number;
  height?: number;
}

export function CodexChart({
  tokenAddress,
  networkId = 1399811149,
  height = 520,
}: CodexChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    bars, isLoading, error, resolution, setResolution,
    chartType, cycleChartType, currencyCode, setCurrencyCode,
    statsType, setStatsType, showVolume, setShowVolume,
  } = useCodexChart(tokenAddress, networkId);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) { el.requestFullscreen?.(); setIsFullscreen(true); }
    else { document.exitFullscreen?.(); setIsFullscreen(false); }
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [toggleFullscreen]);

  useEffect(() => {
    const h = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // ========== CHART ==========
  useEffect(() => {
    const container = containerRef.current;
    if (!container || bars.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chartH = isFullscreen ? window.innerHeight - 40 : height;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: chartH,
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0a" },
        textColor: "#888888",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: "#333333",
      },
      rightPriceScale: {
        borderColor: "#333333",
        scaleMargins: { top: 0.08, bottom: 0.30 },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderVisible: false,
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
      priceFormat: {
        type: "price",
        precision: 12,
        minMove: 0.000000000001,
      },
      priceScaleId: "right",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume", precision: 2 },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.72, bottom: 0 },
      visible: true,
      borderVisible: false,
      entireTextOnly: true,
    });

    const transformCodexBars = (raw: {
      o: number[];
      h: number[];
      l: number[];
      c: number[];
      t: number[];
      volume: number[];
      buyVolume: number[];
      sellVolume: number[];
    }) => {
      if (!raw?.o?.length) return { chartData: [], volumeData: [] };

      const chartData: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }> = [];
      const volumeData: Array<{ time: UTCTimestamp; value: number; color: string }> = [];

      for (let i = 0; i < raw.o.length; i++) {
        const time = raw.t[i] as UTCTimestamp;

        chartData.push({
          time,
          open: Number(raw.o[i]),
          high: Number(raw.h[i]),
          low: Number(raw.l[i]),
          close: Number(raw.c[i]),
        });

        volumeData.push({
          time,
          value: Number(raw.volume?.[i] || 0),
          color:
            Number(raw.buyVolume?.[i] || 0) >= Number(raw.sellVolume?.[i] || 0)
              ? "rgba(34,197,94,0.35)"
              : "rgba(239,68,68,0.30)",
        });
      }

      return { chartData, volumeData };
    };

    const rawData = {
      o: bars.map((b) => b.open),
      h: bars.map((b) => b.high),
      l: bars.map((b) => b.low),
      c: bars.map((b) => b.close),
      t: bars.map((b) => b.time),
      volume: bars.map((b) => b.volume || 0),
      buyVolume: bars.map((b) => b.buyVolume || 0),
      sellVolume: bars.map((b) => b.sellVolume || 0),
    };

    const { chartData, volumeData } = transformCodexBars(rawData);

    candleSeries.setData(chartData);
    volumeSeries.setData(volumeData);

    chart.timeScale().fitContent();
    chart.priceScale("right").applyOptions({ autoScale: true });

    chart.timeScale().applyOptions({
      rightOffset: 8,
      barSpacing: 8,
      minBarSpacing: 6,
      fixLeftEdge: false,
      fixRightEdge: false,
    });

    if (chartData.length > 0) {
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(-20, chartData.length - 80),
        to: chartData.length + 8,
      });
    }

    const paddingTimeout = window.setTimeout(() => chart.timeScale().scrollToPosition(8, false), 100);

    const toggleVolume = (show: boolean) => {
      chart.priceScale("right").applyOptions({
        scaleMargins: show ? { top: 0.08, bottom: 0.30 } : { top: 0.08, bottom: 0.08 },
      });
      volumeSeries.applyOptions({ visible: show });
      chart.timeScale().fitContent();
    };

    toggleVolume(showVolume);

    // Hide watermark if present
    const wm = container.querySelector('a[href*="tradingview"]');
    if (wm) (wm as HTMLElement).style.display = "none";

    const onResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: isFullscreen ? window.innerHeight - 40 : height,
        });
      }
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(paddingTimeout);
      window.removeEventListener("resize", onResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [bars, height, isFullscreen, showVolume]);

  // --- Toolbar props ---
  const tp = {
    resolution, onResolutionChange: setResolution,
    chartType, onCycleChartType: cycleChartType,
    currencyCode, onCurrencyToggle: () => setCurrencyCode(p => p === "USD" ? "TOKEN" : "USD"),
    statsType, onStatsToggle: () => setStatsType(p => p === "FILTERED" ? "UNFILTERED" : "FILTERED"),
    showVolume, onVolumeToggle: () => setShowVolume(p => !p),
    isLoading, onFullscreen: toggleFullscreen,
  };

  if (error && bars.length === 0) {
    return (
      <div className="flex flex-col w-full rounded-2xl overflow-hidden border border-white/10" style={{ backgroundColor: "#0a0a0a" }}>
        <CodexChartToolbar {...tp} />
        <div className="flex flex-col items-center justify-center gap-2" style={{ height }}>
          <div className="px-3 py-1 rounded bg-red-500/10 border border-red-500/20">
            <p className="text-[11px] font-mono text-red-400">⚠ Chart data unavailable</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && bars.length === 0) {
    return (
      <div className="flex flex-col w-full rounded-2xl overflow-hidden border border-white/10" style={{ backgroundColor: "#0a0a0a" }}>
        <CodexChartToolbar {...tp} isLoading={true} />
        <div style={{ height }} className="relative overflow-hidden">
          <div className="absolute inset-0 flex flex-col justify-end p-4 gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="w-full rounded-sm" style={{ height: `${Math.random() * 30 + 10}%`, maxHeight: "60px", opacity: 0.08, backgroundColor: "rgba(255,255,255,0.06)" }} />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] font-mono text-white/40">Loading chart…</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full rounded-2xl overflow-hidden border border-white/10" style={{ backgroundColor: "#0a0a0a" }}>
      <CodexChartToolbar {...tp} />
      {error && bars.length > 0 && (
        <div className="px-2 py-0.5 text-center" style={{ backgroundColor: "rgba(239,68,68,0.08)" }}>
          <span className="text-[9px] font-mono text-red-400/80">⚠ Data may be delayed</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-[520px] bg-[#0a0a0a] rounded-2xl overflow-hidden border border-[#222222]"
        style={isFullscreen ? { height: "calc(100vh - 40px)" } : undefined}
      />
    </div>
  );
}
