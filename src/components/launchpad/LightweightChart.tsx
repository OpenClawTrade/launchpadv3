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

interface LightweightChartProps {
  data: CandleData[] | AreaData[];
  chartType?: "candlestick" | "area";
  height?: number;
  showVolume?: boolean;
  isPositive?: boolean;
}

export function LightweightChart({
  data,
  chartType = "candlestick",
  height = 300,
  showVolume = true,
  isPositive = true,
}: LightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Colors based on theme
  const colors = useMemo(() => ({
    backgroundColor: "transparent",
    textColor: "rgba(255, 255, 255, 0.6)",
    gridColor: "rgba(255, 255, 255, 0.06)",
    upColor: "#22c55e",
    downColor: "#ef4444",
    areaTopColor: isPositive ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)",
    areaBottomColor: isPositive ? "rgba(34, 197, 94, 0.0)" : "rgba(239, 68, 68, 0.0)",
    lineColor: isPositive ? "#22c55e" : "#ef4444",
    volumeUpColor: "rgba(34, 197, 94, 0.3)",
    volumeDownColor: "rgba(239, 68, 68, 0.3)",
  }), [isPositive]);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.backgroundColor },
        textColor: colors.textColor,
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
          color: "rgba(255, 255, 255, 0.2)",
          labelBackgroundColor: "rgba(0, 0, 0, 0.8)",
        },
        horzLine: {
          color: "rgba(255, 255, 255, 0.2)",
          labelBackgroundColor: "rgba(0, 0, 0, 0.8)",
        },
      },
    });

    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    if (chartType === "candlestick") {
      // Candlestick series
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: colors.upColor,
        downColor: colors.downColor,
        borderUpColor: colors.upColor,
        borderDownColor: colors.downColor,
        wickUpColor: colors.upColor,
        wickDownColor: colors.downColor,
      });

      candlestickSeries.setData(
        (data as CandleData[]).map((d) => ({
          time: d.time as any,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
      );

      // Volume series
      if (showVolume && (data as CandleData[])[0]?.volume !== undefined) {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: colors.volumeUpColor,
          priceFormat: {
            type: "volume",
          },
          priceScaleId: "",
        });

        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
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
      // Area series
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: colors.lineColor,
        topColor: colors.areaTopColor,
        bottomColor: colors.areaBottomColor,
        lineWidth: 2,
      });

      areaSeries.setData(
        (data as AreaData[]).map((d) => ({
          time: d.time as any,
          value: d.value,
        }))
      );
    }

    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, chartType, height, showVolume, colors]);

  if (data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-secondary/20 rounded-lg"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">No chart data available yet</p>
      </div>
    );
  }

  return (
    <div 
      ref={chartContainerRef} 
      className="w-full rounded-lg overflow-hidden"
      style={{ height }}
    />
  );
}
