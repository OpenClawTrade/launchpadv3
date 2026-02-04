import { Link } from "react-router-dom";
import { Rocket, Clock, Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useJustLaunched, type JustLaunchedToken } from "@/hooks/useJustLaunched";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PumpBadge } from "@/components/tunabook/PumpBadge";

function formatUsdMarketCap(marketCapSol: number, solPrice: number): string {
  const usdValue = marketCapSol * solPrice;
  if (!Number.isFinite(usdValue) || usdValue <= 0) return "$0";
  if (usdValue >= 1_000_000) {
    return `$${(usdValue / 1_000_000).toFixed(2)}M`;
  } else if (usdValue >= 1_000) {
    return `$${(usdValue / 1_000).toFixed(1)}K`;
  } else {
    return `$${usdValue.toFixed(0)}`;
  }
}

function JustLaunchedCard({ token }: { token: JustLaunchedToken }) {
  const { solPrice } = useSolPrice();
  const linkPath = token.agent_id ? `/t/${token.ticker}` : `/launchpad/${token.mint_address || token.id}`;

  return (
    <Link
      to={linkPath}
      className={cn(
        "flex-shrink-0 w-[160px] sm:w-[180px] p-3 rounded-lg border border-border bg-card/80",
        "hover:border-primary/50 hover:bg-secondary/50 transition-all duration-200 group"
      )}
    >
      <div className="flex items-center gap-2.5 mb-2">
        {token.image_url ? (
          <img
            src={token.image_url}
            alt={token.name}
            className="w-9 h-9 rounded-lg object-cover border border-border/50"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
            {token.ticker?.slice(0, 2)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-1">
            {token.name}
            {token.launchpad_type === 'pumpfun' ? (
              <PumpBadge size="sm" showText={false} mintAddress={token.mint_address ?? undefined} />
            ) : token.agent_id ? (
              <Bot className="w-3 h-3 text-purple-400 flex-shrink-0" />
            ) : null}
          </h3>
          <span className="text-[10px] text-muted-foreground">${token.ticker}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-semibold text-primary">
          {formatUsdMarketCap(token.market_cap_sol ?? 0, solPrice)}
        </span>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-2.5 h-2.5" />
          <span>{formatDistanceToNow(new Date(token.created_at), { addSuffix: false })}</span>
        </div>
      </div>
    </Link>
  );
}

export function JustLaunched() {
  // Use dedicated hook that fetches ONLY 10 recent tokens
  const { tokens, isLoading } = useJustLaunched();

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Rocket className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Just Launched</h2>
          <span className="text-sm text-muted-foreground hidden sm:inline">— Last 24 Hours</span>
        </div>
        <div className="flex gap-3 pb-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-shrink-0 w-[160px] sm:w-[180px] p-3 rounded-lg border border-border bg-card/80">
              <div className="flex items-center gap-2.5 mb-2">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-2 w-10" />
                </div>
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tokens.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Rocket className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Just Launched</h2>
        <span className="text-sm text-muted-foreground hidden sm:inline">— Last 24 Hours</span>
      </div>
      
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-3">
          {tokens.map((token) => (
            <JustLaunchedCard key={token.id} token={token} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
