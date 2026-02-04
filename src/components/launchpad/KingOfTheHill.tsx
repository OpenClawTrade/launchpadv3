import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Crown, Copy, CheckCircle, Users, Clock, Gem, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSolPrice } from "@/hooks/useSolPrice";
import { PumpBadge } from "@/components/tunabook/PumpBadge";

interface FunToken {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  mint_address: string | null;
  dbc_pool_address: string | null;
  status: string;
  bonding_progress?: number;
  market_cap_sol?: number;
  holder_count?: number;
  trading_fee_bps?: number;
  fee_mode?: string | null;
  agent_id?: string;
  launchpad_type?: string;
  created_at: string;
}

interface KingOfTheHillProps {
  tokens?: FunToken[];
  isLoading?: boolean;
}

const GRADUATION_THRESHOLD = 85;

function TokenCard({ token, rank }: { token: any; rank: number }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { solPrice } = useSolPrice();

  // Reduced animation frequency - only trigger on hover instead of continuous intervals
  // This eliminates constant JS timers and reduces CPU usage significantly

  const copyAddress = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (token.mint_address) {
      navigator.clipboard.writeText(token.mint_address);
      setCopied(true);
      toast({ title: "Copied!", description: "Contract address copied" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Use bonding_progress directly from the hook (already 0-100 range)
  const progress = token.bonding_progress ?? 0;
  const marketCapUsd = (token.market_cap_sol ?? 0) * (solPrice || 0);
  
  // Calculate real SOL reserves from progress percentage
  const realSolReserves = (progress / 100) * GRADUATION_THRESHOLD;
  
  // Trading fee percentage (default 2%)
  const tradingFeePct = (token.trading_fee_bps ?? 200) / 100;
  
  // Check if token has holder rewards
  const isHolderRewards = token.fee_mode === 'holders';
  const isPumpFun = token.launchpad_type === 'pumpfun';
  
  // Trade URL logic - pump.fun tokens link to SubTuna (they all have communities)
  const tradeUrl = isPumpFun 
    ? `/t/${token.ticker}` 
    : token.agent_id 
      ? `/t/${token.ticker}` 
      : `/launchpad/${token.mint_address || token.dbc_pool_address || token.id}`;

  const getRankStyles = (r: number) => {
    if (r === 1) return "border-primary/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-lg shadow-primary/10";
    if (r === 2) return "border-border/50 bg-card/80";
    return "border-border/50 bg-card/80";
  };

  const getRankBadgeStyles = (r: number) => {
    if (r === 1) return "bg-primary text-primary-foreground";
    if (r === 2) return "bg-muted-foreground/80 text-background";
    return "bg-amber-700 text-white";
  };

  return (
    <Link
      to={tradeUrl}
      className={cn(
        "relative flex flex-col p-2 sm:p-4 rounded-lg sm:rounded-xl border transition-all duration-200 hover:scale-[1.02] hover:shadow-xl group hover:animate-koth-pulse",
        getRankStyles(rank)
      )}
    >
      {/* Rank Badge */}
      <div 
        className={cn(
          "absolute -top-1.5 -left-1.5 sm:-top-2 sm:-left-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-bold shadow-md z-10",
          getRankBadgeStyles(rank)
        )}
      >
        #{rank}
      </div>

      {/* Header: Image + Name + CA */}
      <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className="relative flex-shrink-0">
          {token.image_url ? (
            <img
              src={token.image_url}
              alt={token.name}
              className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg object-cover border border-border/50"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
          ) : (
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg bg-primary/20 flex items-center justify-center text-xs sm:text-sm font-bold text-primary">
              {token.ticker?.slice(0, 2)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-1">
            {token.name}
            {(token.fee_mode === "holder_rewards" || token.fee_mode === "holders") && (
              <span title="Holder Rewards" aria-label="Holder Rewards">
                <Gem className="w-3 h-3 text-accent flex-shrink-0" />
              </span>
            )}
            {(token.agent_id || isPumpFun) && (
              <span title="AI Agent Token" className="flex-shrink-0">
                <Bot className="w-3 h-3 text-purple-400" />
              </span>
            )}
            {isPumpFun && (
              <PumpBadge 
                mintAddress={token.mint_address} 
                showText={false} 
                size="sm"
                className="px-0 py-0 bg-transparent hover:bg-transparent"
              />
            )}
          </h3>
          <span className="text-[10px] sm:text-xs text-muted-foreground">${token.ticker}</span>
        </div>

        {/* Copy CA Button */}
        <button
          onClick={copyAddress}
          className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/80 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title="Copy contract address"
        >
          {copied ? (
            <CheckCircle className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>CA</span>
        </button>
      </div>

      {/* Stats Row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-2 sm:mb-3 text-[10px] sm:text-sm">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">MC:</span>
          <span className="font-semibold text-primary">
            ${marketCapUsd >= 1000 ? `${(marketCapUsd / 1000).toFixed(1)}K` : marketCapUsd.toFixed(0)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className="font-semibold">{token.holder_count ?? 0}</span>
        </div>
        {/* Trading fee badge */}
        <Badge 
          variant="outline" 
          className={cn(
            "text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0",
            tradingFeePct !== 2 ? "border-primary/50 text-primary" : "border-border text-muted-foreground"
          )}
        >
          {tradingFeePct}%
        </Badge>
      </div>

      {/* Progress */}
      <div className="mb-2 sm:mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] sm:text-xs text-muted-foreground">Progress</span>
          <span className={cn(
            "text-[10px] sm:text-sm font-bold",
            progress >= 50 ? "text-primary" : "text-foreground"
          )}>
            {progress.toFixed(1)}%
          </span>
        </div>
        <Progress 
          value={Math.min(progress, 100)} 
          className={cn(
            "h-1.5 sm:h-2",
            progress >= 80 && "shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
          )}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[9px] sm:text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          <span className="truncate">{formatDistanceToNow(new Date(token.created_at), { addSuffix: true })}</span>
        </div>
        <span className="font-medium tabular-nums hidden sm:inline">
          {realSolReserves.toFixed(2)} / {GRADUATION_THRESHOLD} SOL
        </span>
      </div>
    </Link>
  );
}

export function KingOfTheHill({ tokens: propTokens, isLoading: propLoading }: KingOfTheHillProps) {
  // Use props instead of calling useFunTokens - eliminates duplicate query
  const isLoading = propLoading ?? false;

  // Filter to active tokens and sort by bonding_progress (highest first), take top 3
  const tokens = useMemo(() => {
    if (!propTokens || propTokens.length === 0) return [];
    
    return propTokens
      .filter(t => t.status === "active")
      .sort((a, b) => (b.bonding_progress ?? 0) - (a.bonding_progress ?? 0))
      .slice(0, 3);
  }, [propTokens]);

  // No error state needed - parent handles errors

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Crown className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold">King of the Hill</h2>
          <span className="text-sm text-muted-foreground hidden sm:inline">— Soon to Graduate</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-2 sm:p-4 rounded-xl border border-border bg-card">
              <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                <Skeleton className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-1 sm:space-y-2">
                  <Skeleton className="h-3 sm:h-4 w-16 sm:w-24" />
                  <Skeleton className="h-2 sm:h-3 w-10 sm:w-16" />
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Skeleton className="h-3 sm:h-4 w-full" />
                <Skeleton className="h-1.5 sm:h-2 w-full" />
                <Skeleton className="h-2 sm:h-3 w-20 sm:w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!tokens || tokens.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Crown className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-bold">King of the Hill</h2>
        <span className="text-sm text-muted-foreground hidden sm:inline">— Soon to Graduate</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tokens.map((token, index) => (
          <TokenCard key={token.id} token={token} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}
