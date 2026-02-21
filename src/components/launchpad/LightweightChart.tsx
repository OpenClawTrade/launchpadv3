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
  height = 300,
  showVolume = true,
  isPositive = true,
  markers = [],
}: LightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const colors = useMemo(() => ({
    backgroundColor: "#0F172A",
    textColor: "rgba(148, 163, 184, 0.8)",
    gridColor: "rgba(148, 163, 184, 0.06)",
    upColor: "#22c55e",
    downColor: "#ef4444",
    areaTopColor: isPositive ? "rgba(34, 211, 238, 0.3)" : "rgba(239, 68, 68, 0.3)",
    areaBottomColor: isPositive ? "rgba(34, 211, 238, 0.0)" : "rgba(239, 68, 68, 0.0)",
    lineColor: isPositive ? "#22D3EE" : "#ef4444",
    volumeUpColor: "rgba(34, 197, 94, 0.25)",
    volumeDownColor: "rgba(239, 68, 68, 0.25)",
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
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.25 : 0.1,
        },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: "rgba(34, 211, 238, 0.3)",
          labelBackgroundColor: "#1e293b",
        },
        horzLine: {
          color: "rgba(34, 211, 238, 0.3)",
          labelBackgroundColor: "#1e293b",
        },
      },
    });

    chartRef.current = chart;

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
        wickUpColor: colors.upColor,
        wickDownColor: colors.downColor,
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

      if (showVolume && (data as CandleData[])[0]?.volume !== undefined) {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: colors.volumeUpColor,
          priceFormat: { type: "volume" },
          priceScaleId: "",
        });

        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
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
      });

      mainSeries.setData(
        (data as AreaData[]).map((d) => ({
          time: d.time as any,
          value: d.value,
        }))
      );
    }

    // Add migration/event markers
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
        className="flex items-center justify-center rounded-lg"
        style={{ height, backgroundColor: "#0F172A" }}
      >
        <p className="text-xs text-muted-foreground font-mono">Waiting for trade data...</p>
      </div>
    );
  }

  return (
    <div
      ref={chartContainerRef}
      className="w-full rounded-lg overflow-hidden"
      style={{ height, backgroundColor: "#0F172A" }}
    />
  );
}
