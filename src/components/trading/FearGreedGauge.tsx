import { useFearGreedIndex } from "@/hooks/useFearGreedIndex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";

export function FearGreedGauge() {
  const { data, isLoading, error } = useFearGreedIndex();

  const getColor = (value: number) => {
    if (value <= 25) return "text-red-500";
    if (value <= 45) return "text-orange-400";
    if (value <= 55) return "text-yellow-400";
    if (value <= 75) return "text-lime-400";
    return "text-green-500";
  };

  const getBgColor = (value: number) => {
    if (value <= 25) return "bg-red-500";
    if (value <= 45) return "bg-orange-400";
    if (value <= 55) return "bg-yellow-400";
    if (value <= 75) return "bg-lime-400";
    return "bg-green-500";
  };

  const getLabel = (classification: string) => {
    return classification.charAt(0).toUpperCase() + classification.slice(1);
  };

  if (error) {
    return null;
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-amber-400" />
          Fear & Greed Index
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-16 mx-auto" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-20 mx-auto" />
          </div>
        ) : data ? (
          <div className="space-y-3">
            {/* Value Display */}
            <div className="text-center">
              <span className={`text-3xl font-bold ${getColor(data.value)}`}>
                {data.value}
              </span>
              <span className="text-muted-foreground text-sm">/100</span>
            </div>

            {/* Gauge Bar */}
            <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 overflow-hidden">
              <div
                className="absolute top-0 h-full w-1 bg-white shadow-lg transition-all duration-500"
                style={{ left: `calc(${data.value}% - 2px)` }}
              />
            </div>

            {/* Labels */}
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Extreme Fear</span>
              <span>Neutral</span>
              <span>Extreme Greed</span>
            </div>

            {/* Classification Badge */}
            <div className="text-center">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getBgColor(data.value)} text-black`}
              >
                {getLabel(data.value_classification)}
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
