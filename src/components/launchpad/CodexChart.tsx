import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { useCodexChart, type CodexBar } from "@/hooks/useCodexChart";
import { CodexChartToolbar } from "./CodexChartToolbar";
import { Skeleton } from "@/components/ui/skeleton";

interface CodexChartProps {
  tokenAddress: string;
  networkId?: number;
  height?: number;
  defaultResolution?: string;
}

const COLORS = {
  bg: "#0a0a0a",
  grid: "rgba(255,255,255,0.03)",
  upColor: "#22C55E",
  downColor: "#EF4444",
  upWick: "rgba(34,197,94,0.7)",
  downWick: "rgba(239,68,68,0.7)",
  volUp: "rgba(34,197,94,0.15)",
  volDown: "rgba(239,68,68,0.12)",
  crosshair: "rgba(255,255,255,0.1)",
  text: "rgba(255,255,255,0.5)",
  areaTop: "rgba(34,197,94,0.18)",
  areaBottom: "rgba(10,10,10,0)",
  lineColor: "#22C55E",
};

export function CodexChart({
  tokenAddress,
  networkId = 1399811149,
  height = 460,
}: CodexChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    bars,
    isLoading,
    error,
    resolution,
    setResolution,
    chartType,
    cycleChartType,
    currencyCode,
    setCurrencyCode,
    statsType,
    setStatsType,
    showVolume,
    setShowVolume,
  } = useCodexChart(tokenAddress, networkId);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleFullscreen]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Chart rendering
  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;

    // Clear previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volSeriesRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.text,
        fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: COLORS.grid, style: 1 },
        horzLines: { color: COLORS.grid, style: 1 },
      },
      width: containerRef.current.clientWidth,
      height: isFullscreen ? window.innerHeight - 40 : height,
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: showVolume ? 0.22 : 0.08 },
        entireTextOnly: true,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: resolution.includes("S"),
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: 0,
        vertLine: { color: COLORS.crosshair, width: 1, style: 2, labelVisible: false },
        horzLine: { color: COLORS.crosshair, width: 1, style: 2, labelVisible: false },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    // Hide TradingView watermark
    const wm = containerRef.current.querySelector('a[href*="tradingview"]');
    if (wm) (wm as HTMLElement).style.display = "none";

    // Main series
    let mainSeries: ISeriesApi<any>;

    if (chartType === "candlestick") {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: COLORS.upColor,
        downColor: COLORS.downColor,
        borderUpColor: COLORS.upColor,
        borderDownColor: COLORS.downColor,
        wickUpColor: COLORS.upWick,
        wickDownColor: COLORS.downWick,
      });
      mainSeries.setData(
        bars.map((b) => ({
          time: b.time as any,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        }))
      );
    } else if (chartType === "line") {
      mainSeries = chart.addSeries(LineSeries, {
        color: COLORS.lineColor,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
      mainSeries.setData(
        bars.map((b) => ({ time: b.time as any, value: b.close }))
      );
    } else {
      mainSeries = chart.addSeries(AreaSeries, {
        lineColor: COLORS.lineColor,
        topColor: COLORS.areaTop,
        bottomColor: COLORS.areaBottom,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: COLORS.lineColor,
        crosshairMarkerBackgroundColor: COLORS.bg,
      });
      mainSeries.setData(
        bars.map((b) => ({ time: b.time as any, value: b.close }))
      );
    }

    mainSeriesRef.current = mainSeries;

    // Volume histogram
    if (showVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });
      volSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      volSeries.setData(
        bars.map((b) => ({
          time: b.time as any,
          value: b.volume || 0,
          color: b.close >= b.open ? COLORS.volUp : COLORS.volDown,
        }))
      );
      volSeriesRef.current = volSeries;
    }

    // Price line for last bar
    const lastBar = bars[bars.length - 1];
    if (lastBar && mainSeries) {
      mainSeries.createPriceLine({
        price: lastBar.close,
        color: lastBar.close >= lastBar.open ? COLORS.upColor : COLORS.downColor,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
      });
    }

    chart.timeScale().fitContent();

    // Resize
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: isFullscreen ? window.innerHeight - 40 : height,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        mainSeriesRef.current = null;
        volSeriesRef.current = null;
      }
    };
  }, [bars, chartType, height, showVolume, resolution, isFullscreen]);

  // Error state
  if (error && bars.length === 0) {
    return (
      <div className="flex flex-col">
        <CodexChartToolbar
          resolution={resolution}
          onResolutionChange={setResolution}
          chartType={chartType}
          onCycleChartType={cycleChartType}
          currencyCode={currencyCode}
          onCurrencyToggle={() => setCurrencyCode((p) => (p === "USD" ? "TOKEN" : "USD"))}
          statsType={statsType}
          onStatsToggle={() => setStatsType((p) => (p === "FILTERED" ? "UNFILTERED" : "FILTERED"))}
          showVolume={showVolume}
          onVolumeToggle={() => setShowVolume((p) => !p)}
          isLoading={isLoading}
          onFullscreen={toggleFullscreen}
        />
        <div
          className="flex flex-col items-center justify-center gap-2"
          style={{ height, backgroundColor: COLORS.bg }}
        >
          <div className="px-3 py-1 rounded bg-red-500/10 border border-red-500/20">
            <p className="text-[11px] font-mono text-red-400">⚠ Chart data unavailable</p>
          </div>
          <p className="text-[10px] font-mono text-white/30">Data may be delayed or unavailable for this token</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && bars.length === 0) {
    return (
      <div className="flex flex-col">
        <CodexChartToolbar
          resolution={resolution}
          onResolutionChange={setResolution}
          chartType={chartType}
          onCycleChartType={cycleChartType}
          currencyCode={currencyCode}
          onCurrencyToggle={() => setCurrencyCode((p) => (p === "USD" ? "TOKEN" : "USD"))}
          statsType={statsType}
          onStatsToggle={() => setStatsType((p) => (p === "FILTERED" ? "UNFILTERED" : "FILTERED"))}
          showVolume={showVolume}
          onVolumeToggle={() => setShowVolume((p) => !p)}
          isLoading={true}
          onFullscreen={toggleFullscreen}
        />
        <div style={{ height, backgroundColor: COLORS.bg }} className="relative overflow-hidden">
          {/* Chart skeleton */}
          <div className="absolute inset-0 flex flex-col justify-end p-4 gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                className="w-full rounded-sm"
                style={{
                  height: `${Math.random() * 30 + 10}%`,
                  maxHeight: "60px",
                  opacity: 0.08,
                  backgroundColor: "rgba(255,255,255,0.06)",
                }}
              />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] font-mono text-white/40">Loading chart data…</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ backgroundColor: COLORS.bg }}>
      <CodexChartToolbar
        resolution={resolution}
        onResolutionChange={setResolution}
        chartType={chartType}
        onCycleChartType={cycleChartType}
        currencyCode={currencyCode}
        onCurrencyToggle={() => setCurrencyCode((p) => (p === "USD" ? "TOKEN" : "USD"))}
        statsType={statsType}
        onStatsToggle={() => setStatsType((p) => (p === "FILTERED" ? "UNFILTERED" : "FILTERED"))}
        showVolume={showVolume}
        onVolumeToggle={() => setShowVolume((p) => !p)}
        isLoading={isLoading}
        onFullscreen={toggleFullscreen}
      />
      {/* Delayed data banner */}
      {error && bars.length > 0 && (
        <div className="px-2 py-0.5 text-center" style={{ backgroundColor: "rgba(239,68,68,0.08)" }}>
          <span className="text-[9px] font-mono text-red-400/80">⚠ Data may be delayed</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full overflow-hidden relative"
        style={{ height: isFullscreen ? "calc(100vh - 40px)" : height, backgroundColor: COLORS.bg }}
      />
    </div>
  );
}
