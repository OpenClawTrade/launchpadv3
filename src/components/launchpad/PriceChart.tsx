import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatSolAmount } from "@/hooks/useLaunchpad";
import { format } from "date-fns";
import { ExternalLink, BarChart3, LineChart } from "lucide-react";

interface PriceChartProps {
  tokenId: string;
  currentPrice: number;
  priceChange24h?: number;
  mintAddress?: string;
  poolAddress?: string;
  status?: string;
}

type TimeRange = "1h" | "24h" | "7d" | "30d" | "all";
type ChartView = "internal" | "dextools";

interface PricePoint {
  timestamp: string;
  price_sol: number;
  volume_sol: number;
}

export function PriceChart({ 
  tokenId, 
  currentPrice, 
  priceChange24h = 0,
  mintAddress,
  poolAddress,
  status
}: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  
  // Show DEXTools by default for graduated tokens with pool address
  const isGraduated = status === 'graduated' && !!poolAddress;
  const [chartView, setChartView] = useState<ChartView>(isGraduated ? "dextools" : "internal");

  const { data: priceHistory = [], isLoading } = useQuery({
    queryKey: ["token-price-history", tokenId, timeRange],
    queryFn: async () => {
      let timeFilter = new Date();
      switch (timeRange) {
        case "1h":
          timeFilter.setHours(timeFilter.getHours() - 1);
          break;
        case "24h":
          timeFilter.setDate(timeFilter.getDate() - 1);
          break;
        case "7d":
          timeFilter.setDate(timeFilter.getDate() - 7);
          break;
        case "30d":
          timeFilter.setDate(timeFilter.getDate() - 30);
          break;
        case "all":
          timeFilter = new Date(0);
          break;
      }

      const { data, error } = await supabase
        .from("token_price_history")
        .select("timestamp, price_sol, volume_sol")
        .eq("token_id", tokenId)
        .gte("timestamp", timeFilter.toISOString())
        .order("timestamp", { ascending: true });

      if (error) throw error;
      return (data || []) as PricePoint[];
    },
    enabled: !!tokenId && chartView === "internal",
    staleTime: 30000,
  });

  const chartData = useMemo(() => {
    if (priceHistory.length === 0) {
      // Generate placeholder data if no history
      const now = Date.now();
      return [
        { time: now - 3600000, price: currentPrice * 0.98, formattedTime: "Earlier" },
        { time: now, price: currentPrice, formattedTime: "Now" },
      ];
    }

    return priceHistory.map((point) => ({
      time: new Date(point.timestamp).getTime(),
      price: Number(point.price_sol),
      volume: Number(point.volume_sol),
      formattedTime: format(new Date(point.timestamp), timeRange === "1h" ? "HH:mm" : "MMM d HH:mm"),
    }));
  }, [priceHistory, currentPrice, timeRange]);

  const isPositive = priceChange24h >= 0;
  const chartColor = isPositive ? "hsl(var(--chart-2))" : "hsl(var(--destructive))";

  const timeRanges: TimeRange[] = ["1h", "24h", "7d", "30d", "all"];

  // DEXTools embed URL - using pool address for graduated tokens
  const dextoolsUrl = poolAddress 
    ? `https://www.dextools.io/widget-chart/en/solana/pe-light/${poolAddress}?theme=dark&chartType=1&chartResolution=15&drawingToolbars=false`
    : null;

  // External link to DEXTools full page
  const dextoolsPageUrl = poolAddress
    ? `https://www.dextools.io/app/en/solana/pair-explorer/${poolAddress}`
    : mintAddress
    ? `https://www.dextools.io/app/en/solana/pair-explorer/${mintAddress}`
    : null;

  if (isLoading && chartView === "internal") {
    return (
      <Card className="p-4">
        <Skeleton className="h-[300px] w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-2xl font-bold">{formatSolAmount(currentPrice)} SOL</p>
          <p className={`text-sm font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
            {isPositive ? "+" : ""}{priceChange24h.toFixed(2)}% (24h)
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Chart Source Toggle - only show if graduated with pool */}
          {isGraduated && (
            <Tabs value={chartView} onValueChange={(v) => setChartView(v as ChartView)} className="mr-2">
              <TabsList className="h-8">
                <TabsTrigger value="dextools" className="h-7 px-2 text-xs gap-1">
                  <BarChart3 className="h-3 w-3" />
                  DEXTools
                </TabsTrigger>
                <TabsTrigger value="internal" className="h-7 px-2 text-xs gap-1">
                  <LineChart className="h-3 w-3" />
                  Simple
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Time Range - only for internal chart */}
          {chartView === "internal" && (
            <div className="flex gap-1">
              {timeRanges.map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setTimeRange(range)}
                >
                  {range.toUpperCase()}
                </Button>
              ))}
            </div>
          )}

          {/* External Link */}
          {dextoolsPageUrl && (
            <a href={dextoolsPageUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Chart */}
      {chartView === "dextools" && dextoolsUrl ? (
        <div className="relative w-full" style={{ height: "400px" }}>
          <iframe
            src={dextoolsUrl}
            title="DEXTools Chart"
            className="w-full h-full rounded-lg border-0"
            style={{ 
              backgroundColor: "transparent",
              colorScheme: "dark"
            }}
            allow="clipboard-read; clipboard-write"
          />
          <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm rounded px-2 py-1 text-xs text-muted-foreground">
            Powered by DEXTools
          </div>
        </div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="formattedTime"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["auto", "auto"]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(value) => formatSolAmount(value)}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number) => [formatSolAmount(value) + " SOL", "Price"]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                strokeWidth={2}
                fill="url(#priceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Info banner for bonding tokens */}
      {!isGraduated && (
        <div className="mt-3 text-xs text-muted-foreground text-center bg-secondary/50 rounded-lg py-2">
          🚀 Advanced charts available after graduation to DEX
        </div>
      )}
    </Card>
  );
}
