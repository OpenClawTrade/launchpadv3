import { useEffect, useRef, useMemo } from "react";
import { createChart, ColorType, CandlestickSeries, AreaSeries, HistogramSeries, IChartApi } from "lightweight-charts";

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface AreaData {
  time: number;
  value: number;
}

export interface ChartMarker {
  time: number;
  label: string;
  color?: string;
}

interface LightweightChartProps {
  data: CandleData[] | AreaData[];
  chartType?: "candlestick" | "area";
  height?: number;
  showVolume?: boolean;
  isPositive?: boolean;
  markers?: ChartMarker[];
}

export function LightweightChart({
  data,
  chartType = "candlestick",
  height = 380,
  showVolume = true,
  isPositive = true,
  markers = [],
}: LightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Dexscreener/Birdeye palette: teal bullish, orange bearish
  const colors = useMemo(() => ({
    backgroundColor: "#0F172A",
    textColor: "rgba(148, 163, 184, 0.6)",
    gridColor: "rgba(51, 65, 85, 0.15)",
    upColor: "#22D3EE",
    downColor: "#F97316",
    upWickColor: "rgba(34, 211, 238, 0.7)",
    downWickColor: "rgba(249, 115, 22, 0.7)",
    areaTopColor: isPositive ? "rgba(34, 211, 238, 0.18)" : "rgba(249, 115, 22, 0.18)",
    areaBottomColor: "rgba(15, 23, 42, 0)",
    lineColor: isPositive ? "#22D3EE" : "#F97316",
    volumeUpColor: "rgba(34, 211, 238, 0.12)",
    volumeDownColor: "rgba(249, 115, 22, 0.10)",
    crosshairColor: "rgba(148, 163, 184, 0.15)",
  }), [isPositive]);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.backgroundColor },
        textColor: colors.textColor,
        fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: colors.gridColor, style: 1 },
        horzLines: { color: colors.gridColor, style: 1 },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: {
          top: 0.08,
          bottom: showVolume ? 0.22 : 0.08,
        },
        entireTextOnly: true,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: 0, // Normal mode
        vertLine: {
          color: colors.crosshairColor,
          width: 1,
          style: 2, // Dashed
          labelVisible: false, // No floating label — clean look
        },
        horzLine: {
          color: colors.crosshairColor,
          width: 1,
          style: 2,
          labelVisible: false, // No floating label
        },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    // Remove TradingView watermark
    const watermarkEl = chartContainerRef.current.querySelector('a[href*="tradingview"]');
    if (watermarkEl) (watermarkEl as HTMLElement).style.display = 'none';

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    let mainSeries: any;

    if (chartType === "candlestick") {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: colors.upColor,
        downColor: colors.downColor,
        borderUpColor: colors.upColor,
        borderDownColor: colors.downColor,
        wickUpColor: colors.upWickColor,
        wickDownColor: colors.downWickColor,
      });

      mainSeries.setData(
        (data as CandleData[]).map((d) => ({
          time: d.time as any,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
      );

      // Subtle volume histogram
      if (showVolume && (data as CandleData[])[0]?.volume !== undefined) {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "",
        });

        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
        });

        volumeSeries.setData(
          (data as CandleData[]).map((d) => ({
            time: d.time as any,
            value: d.volume || 0,
            color: d.close >= d.open ? colors.volumeUpColor : colors.volumeDownColor,
          }))
        );
      }
    } else {
      mainSeries = chart.addSeries(AreaSeries, {
        lineColor: colors.lineColor,
        topColor: colors.areaTopColor,
        bottomColor: colors.areaBottomColor,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: colors.lineColor,
        crosshairMarkerBackgroundColor: colors.backgroundColor,
      });

      mainSeries.setData(
        (data as AreaData[]).map((d) => ({
          time: d.time as any,
          value: d.value,
        }))
      );
    }

    // Migration/graduation markers
    if (markers.length > 0 && mainSeries) {
      const chartMarkers = markers.map((m) => ({
        time: m.time as any,
        position: 'aboveBar' as const,
        color: m.color || '#F97316',
        shape: 'arrowDown' as const,
        text: m.label,
      }));
      mainSeries.setMarkers(chartMarkers);
    }

    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, chartType, height, showVolume, colors, markers]);

  if (data.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg"
        style={{ height, backgroundColor: "#0F172A" }}
      >
        <div className="h-px w-3/4 opacity-20" style={{ background: 'linear-gradient(90deg, transparent, #22D3EE, transparent)' }} />
        <p className="text-[11px] text-muted-foreground/60 font-mono tracking-wider">Waiting for trade data…</p>
        <div className="h-px w-3/4 opacity-20" style={{ background: 'linear-gradient(90deg, transparent, #22D3EE, transparent)' }} />
      </div>
    );
  }

  return (
    <div
      ref={chartContainerRef}
      className="w-full overflow-hidden relative"
      style={{ height, backgroundColor: "#0F172A" }}
    />
  );
}
