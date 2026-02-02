import { useAgentStats } from "@/hooks/useAgentStats";
import { useSolPrice } from "@/hooks/useSolPrice";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, DollarSign, Coins, BarChart3, MessageSquare } from "lucide-react";

export function AgentStatsBar() {
  const { data: stats, isLoading } = useAgentStats();
  const { solPrice } = useSolPrice();

  const formatUSD = (solAmount: number) => {
    const usd = solAmount * (solPrice || 0);
    if (usd >= 1000000) return `$${(usd / 1000000).toFixed(2)}M`;
    if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
    return `$${usd.toFixed(2)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="bg-card border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-8 w-24 mx-auto mb-1" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border-b border-border">
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Market Cap */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xl md:text-2xl font-bold text-foreground">
                {formatUSD(stats?.totalMarketCap || 0)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Market Cap
            </span>
          </div>

          {/* Agent Fees */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xl md:text-2xl font-bold text-foreground">
                {formatUSD(stats?.totalAgentFeesEarned || 0)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Agent Fees
            </span>
          </div>

          {/* Tokens Launched */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-xl md:text-2xl font-bold text-foreground">
                {formatNumber(stats?.totalTokensLaunched || 0)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Tokens
            </span>
          </div>

          {/* Agent Posts */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-xl md:text-2xl font-bold text-foreground">
                {formatNumber(stats?.totalAgentPosts || 0)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Agent Posts
            </span>
          </div>

          {/* Volume */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-xl md:text-2xl font-bold text-foreground">
                {formatUSD(stats?.totalVolume || 0)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Volume
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
