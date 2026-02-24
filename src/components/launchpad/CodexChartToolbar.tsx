import { memo } from "react";
import {
  RESOLUTIONS,
  type Resolution,
  type ChartType,
  type CurrencyCode,
  type StatsType,
} from "@/hooks/useCodexChart";
import {
  Maximize2,
  BarChart3,
  CandlestickChart,
  LineChart,
  AreaChart,
  Filter,
  RefreshCw,
} from "lucide-react";

interface CodexChartToolbarProps {
  resolution: Resolution;
  onResolutionChange: (r: Resolution) => void;
  chartType: ChartType;
  onCycleChartType: () => void;
  currencyCode: CurrencyCode;
  onCurrencyToggle: () => void;
  statsType: StatsType;
  onStatsToggle: () => void;
  showVolume: boolean;
  onVolumeToggle: () => void;
  isLoading: boolean;
  onFullscreen: () => void;
}

const ChartTypeIcon = ({ type }: { type: ChartType }) => {
  if (type === "candlestick") return <CandlestickChart className="h-3.5 w-3.5" />;
  if (type === "line") return <LineChart className="h-3.5 w-3.5" />;
  return <AreaChart className="h-3.5 w-3.5" />;
};

export const CodexChartToolbar = memo(function CodexChartToolbar({
  resolution,
  onResolutionChange,
  chartType,
  onCycleChartType,
  currencyCode,
  onCurrencyToggle,
  statsType,
  onStatsToggle,
  showVolume,
  onVolumeToggle,
  isLoading,
  onFullscreen,
}: CodexChartToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 overflow-x-auto scrollbar-none select-none"
         style={{ backgroundColor: "#0d0d0d" }}>
      {/* Resolution buttons */}
      <div className="flex items-center gap-px mr-2">
        {RESOLUTIONS.map((r) => (
          <button
            key={r.value}
            onClick={() => onResolutionChange(r.value as Resolution)}
            className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-all whitespace-nowrap ${
              resolution === r.value
                ? "text-green-400 bg-green-500/10 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-white/10 mx-1 shrink-0" />

      {/* Chart type */}
      <button
        onClick={onCycleChartType}
        className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-white/50 hover:text-white/80 hover:bg-white/5 rounded transition-all"
        title={`Chart: ${chartType}`}
      >
        <ChartTypeIcon type={chartType} />
        <span className="hidden sm:inline capitalize">{chartType}</span>
      </button>

      {/* Currency toggle */}
      <button
        onClick={onCurrencyToggle}
        className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-all ${
          currencyCode === "USD"
            ? "text-green-400 bg-green-500/8"
            : "text-orange-400 bg-orange-500/8"
        }`}
      >
        {currencyCode}
      </button>

      {/* Filter toggle */}
      <button
        onClick={onStatsToggle}
        className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono rounded transition-all ${
          statsType === "FILTERED"
            ? "text-blue-400 bg-blue-500/8"
            : "text-white/40 hover:text-white/60"
        }`}
        title={statsType === "FILTERED" ? "Filtered (excludes bots)" : "Unfiltered (all trades)"}
      >
        <Filter className="h-3 w-3" />
        <span className="hidden sm:inline">{statsType === "FILTERED" ? "Filtered" : "Raw"}</span>
      </button>

      {/* Volume toggle */}
      <button
        onClick={onVolumeToggle}
        className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono rounded transition-all ${
          showVolume
            ? "text-purple-400 bg-purple-500/8"
            : "text-white/40 hover:text-white/60"
        }`}
        title="Toggle volume"
      >
        <BarChart3 className="h-3 w-3" />
        <span className="hidden sm:inline">Vol</span>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Loading indicator */}
      {isLoading && (
        <RefreshCw className="h-3 w-3 text-green-400/60 animate-spin mr-1" />
      )}

      {/* Live dot */}
      <div className="flex items-center gap-1 mr-2">
        <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[9px] font-mono text-green-400/60">LIVE</span>
      </div>

      {/* Fullscreen */}
      <button
        onClick={onFullscreen}
        className="p-1 text-white/40 hover:text-white/80 hover:bg-white/5 rounded transition-all"
        title="Fullscreen (F)"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});
