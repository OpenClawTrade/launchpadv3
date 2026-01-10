import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatSolAmount } from "@/hooks/useLaunchpad";
import { format } from "date-fns";

interface PriceChartProps {
  tokenId: string;
  currentPrice: number;
  priceChange24h?: number;
}

type TimeRange = "1h" | "24h" | "7d" | "30d" | "all";

interface PricePoint {
  timestamp: string;
  price_sol: number;
  volume_sol: number;
}

export function PriceChart({ tokenId, currentPrice, priceChange24h = 0 }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");

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
    enabled: !!tokenId,
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

  if (isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-[200px] w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-2xl font-bold">{formatSolAmount(currentPrice)} SOL</p>
          <p className={`text-sm font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
            {isPositive ? "+" : ""}{priceChange24h.toFixed(2)}% (24h)
          </p>
        </div>
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
      </div>

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
    </Card>
  );
}
