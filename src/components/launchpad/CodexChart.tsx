import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
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

export function CodexChart({
  tokenAddress,
  networkId = 1399811149,
  height = 520,
}: CodexChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<any> | null>(null);
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

  // ---------- CHART RENDERING ----------
  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volSeriesRef.current = null;
    }

    const chartHeight = isFullscreen ? window.innerHeight - 40 : height;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: chartHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0a" },
        textColor: "#888888",
        fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.15)", width: 1, style: 2, labelVisible: false },
        horzLine: { color: "rgba(255,255,255,0.15)", width: 1, style: 2, labelVisible: false },
      },
      rightPriceScale: {
        borderColor: "#333",
        scaleMargins: { top: 0.1, bottom: showVolume ? 0.22 : 0.08 },
        entireTextOnly: true,
      },
      timeScale: {
        borderColor: "#333",
        timeVisible: true,
        secondsVisible: resolution.includes("S"),
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    // Hide TradingView watermark
    const wm = containerRef.current.querySelector('a[href*="tradingview"]');
    if (wm) (wm as HTMLElement).style.display = "none";

    // --- Transform data ---
    const chartData: any[] = [];
    const volumeData: any[] = [];

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const time = b.time as UTCTimestamp;

      chartData.push({
        time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      });

      volumeData.push({
        time,
        value: b.volume || 0,
        color:
          (b.buyVolume || 0) >= (b.sellVolume || 0)
            ? "rgba(34,197,94,0.25)"
            : "rgba(239,68,68,0.2)",
      });
    }

    // --- Main series ---
    let mainSeries: ISeriesApi<any>;

    if (chartType === "candlestick") {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#22C55E",
        downColor: "#EF4444",
        borderVisible: false,
        borderUpColor: "#22C55E",
        borderDownColor: "#EF4444",
        wickUpColor: "#22C55E",
        wickDownColor: "#EF4444",
        priceFormat: {
          type: "price",
          precision: 12,
          minMove: 0.000000000001,
        },
      });
      mainSeries.setData(chartData);
    } else if (chartType === "line") {
      mainSeries = chart.addSeries(LineSeries, {
        color: "#22C55E",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        priceFormat: {
          type: "price",
          precision: 12,
          minMove: 0.000000000001,
        },
      });
      mainSeries.setData(
        chartData.map((d: any) => ({ time: d.time, value: d.close }))
      );
    } else {
      mainSeries = chart.addSeries(AreaSeries, {
        lineColor: "#22C55E",
        topColor: "rgba(34,197,94,0.18)",
        bottomColor: "rgba(10,10,10,0)",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        priceFormat: {
          type: "price",
          precision: 12,
          minMove: 0.000000000001,
        },
      });
      mainSeries.setData(
        chartData.map((d: any) => ({ time: d.time, value: d.close }))
      );
    }

    candleSeriesRef.current = mainSeries;

    // --- Volume series on SEPARATE price scale ---
    if (showVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
      });

      volSeries.setData(volumeData);
      volSeriesRef.current = volSeries;
    }

    // Price line for last price
    const lastBar = bars[bars.length - 1];
    if (lastBar && mainSeries) {
      mainSeries.createPriceLine({
        price: lastBar.close,
        color: lastBar.close >= lastBar.open ? "#22C55E" : "#EF4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
      });
    }

    chart.timeScale().fitContent();

    // Resize handler
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
        candleSeriesRef.current = null;
        volSeriesRef.current = null;
      }
    };
  }, [bars, chartType, height, showVolume, resolution, isFullscreen]);

  // --- Toolbar props ---
  const toolbarProps = {
    resolution,
    onResolutionChange: setResolution,
    chartType,
    onCycleChartType: cycleChartType,
    currencyCode,
    onCurrencyToggle: () => setCurrencyCode((p) => (p === "USD" ? "TOKEN" : "USD")),
    statsType,
    onStatsToggle: () => setStatsType((p) => (p === "FILTERED" ? "UNFILTERED" : "FILTERED")),
    showVolume,
    onVolumeToggle: () => setShowVolume((p) => !p),
    isLoading,
    onFullscreen: toggleFullscreen,
  };

  // Error state
  if (error && bars.length === 0) {
    return (
      <div className="flex flex-col w-full rounded-xl overflow-hidden" style={{ backgroundColor: "#0a0a0a" }}>
        <CodexChartToolbar {...toolbarProps} />
        <div
          className="flex flex-col items-center justify-center gap-2"
          style={{ height }}
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
      <div className="flex flex-col w-full rounded-xl overflow-hidden" style={{ backgroundColor: "#0a0a0a" }}>
        <CodexChartToolbar {...toolbarProps} isLoading={true} />
        <div style={{ height }} className="relative overflow-hidden">
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
    <div className="flex flex-col w-full rounded-xl overflow-hidden" style={{ backgroundColor: "#0a0a0a" }}>
      <CodexChartToolbar {...toolbarProps} />
      {/* Delayed data banner */}
      {error && bars.length > 0 && (
        <div className="px-2 py-0.5 text-center" style={{ backgroundColor: "rgba(239,68,68,0.08)" }}>
          <span className="text-[9px] font-mono text-red-400/80">⚠ Data may be delayed</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full overflow-hidden relative"
        style={{ height: isFullscreen ? "calc(100vh - 40px)" : height }}
      />
    </div>
  );
}
