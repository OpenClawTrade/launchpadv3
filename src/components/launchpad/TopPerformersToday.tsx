import { useFunTopPerformers, TopPerformer } from "@/hooks/useFunTopPerformers";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Flame, TrendingUp, Coins } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

function getRankBadge(rank: number) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-black font-bold text-sm shadow-lg shadow-yellow-500/30">
        🥇
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 text-black font-bold text-sm shadow-lg shadow-gray-400/30">
        🥈
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 text-white font-bold text-sm shadow-lg shadow-amber-600/30">
        🥉
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-muted-foreground font-bold text-sm">
      #{rank}
    </div>
  );
}

function TokenRow({ token, rank }: { token: TopPerformer; rank: number }) {
  const isTopThree = rank <= 3;

  return (
    <Link
      to={`/token/${token.dbc_pool_address || token.id}`}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:scale-[1.02] group",
        isTopThree
          ? "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 hover:border-primary/40"
          : "bg-secondary/50 hover:bg-secondary/80 border border-transparent"
      )}
    >
      {getRankBadge(rank)}

      <div className="relative">
        {token.image_url ? (
          <img
            src={token.image_url}
            alt={token.name}
            className="w-10 h-10 rounded-lg object-cover border border-border/50"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Coins className="w-5 h-5 text-primary" />
          </div>
        )}
        {isTopThree && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center animate-pulse">
            <Flame className="w-2.5 h-2.5 text-primary-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {token.name}
          </span>
          <span className="text-xs text-muted-foreground">${token.ticker}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{token.claim_count} claim{token.claim_count !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="text-right">
        <div className={cn(
          "font-bold text-sm",
          isTopThree ? "text-primary" : "text-green-500"
        )}>
          +{token.total_fees_24h.toFixed(4)} SOL
        </div>
        <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
          <TrendingUp className="w-3 h-3" />
          <span>24h fees</span>
        </div>
      </div>
    </Link>
  );
}

export function TopPerformersToday() {
  const { data: topPerformers, isLoading, error } = useFunTopPerformers(10);

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Failed to load top performers</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Top Earners Today</h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>Updates every 5min</span>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      ) : topPerformers && topPerformers.length > 0 ? (
        <div className="space-y-2">
          {topPerformers.map((token, index) => (
            <TokenRow key={token.id} token={token} rank={index + 1} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 space-y-4">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <Trophy className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold">No fees claimed today</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Tokens that generate trading fees will appear here
          </p>
        </div>
      )}
    </div>
  );
}
