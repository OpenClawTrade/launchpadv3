import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { BondingCurveProgress } from "./BondingCurveProgress";
import { Token } from "@/hooks/useLaunchpad";
import { useSolPrice } from "@/hooks/useSolPrice";
import { TrendingUp, TrendingDown, Users, Clock, ChevronRight, Zap, Sparkles, Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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

interface TokenCardProps {
  token: Token & { trading_fee_bps?: number; fee_mode?: 'creator' | 'holder_rewards'; agent_id?: string | null; launchpad_type?: string | null };
}

export function TokenCard({ token }: TokenCardProps) {
  const { solPrice } = useSolPrice();
  const isGraduated = token.status === 'graduated';
  const priceChange = (token as any).price_change_24h || 0;
  const isPositive = priceChange >= 0;
  const isHot = token.volume_24h_sol > 1;
  const isNew = Date.now() - new Date(token.created_at).getTime() < 24 * 60 * 60 * 1000;
  const tradingFeePct = ((token as any).trading_fee_bps || 200) / 100; // Convert bps to %
  const isHolderRewards = token.fee_mode === 'holder_rewards';
  const isPumpFun = token.launchpad_type === 'pumpfun';
  
  // Trade URL logic - pump.fun tokens link externally
  const tradeUrl = isPumpFun 
    ? `https://pump.fun/${token.mint_address}` 
    : token.agent_id 
      ? `/t/${token.ticker}` 
      : `/launchpad/${token.mint_address}`;
  const CardWrapper = isPumpFun ? 'a' : Link;
  const cardProps = isPumpFun 
    ? { href: tradeUrl, target: "_blank", rel: "noopener noreferrer" }
    : { to: tradeUrl };

  return (
    <CardWrapper {...cardProps as any}>
      <Card className="relative overflow-hidden p-4 hover:bg-secondary/50 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group">
        {/* Hot indicator glow */}
        {isHot && !isGraduated && (
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />
        )}

        <div className="flex gap-4">
          {/* Token Image */}
          <div className="relative">
            <Avatar className="h-14 w-14 rounded-xl border-2 border-border group-hover:border-primary/50 transition-colors shadow-sm">
              <AvatarImage src={token.image_url || undefined} alt={token.name} className="object-cover" />
              <AvatarFallback className="text-lg font-bold bg-gradient-to-br from-primary/20 to-primary/5 text-primary rounded-xl">
                {token.ticker.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            {/* Status indicator - calculate progress from real reserves */}
            {(() => {
              const threshold = token.graduation_threshold_sol || 85;
              const progress = token.real_sol_reserves > 0 ? (token.real_sol_reserves / threshold) * 100 : 0;
              
              if (isGraduated) {
                return (
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-background">
                    <Sparkles className="h-2.5 w-2.5 text-white" />
                  </div>
                );
              } else if (progress >= 80) {
                return (
                  <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1 border-2 border-background animate-pulse">
                    <Zap className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">
                {token.name}
              </h3>
              <Badge variant="secondary" className="text-xs font-mono px-1.5 py-0">
                ${token.ticker}
              </Badge>
              {isNew && !isGraduated && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0">
                  NEW
                </Badge>
              )}
              {isGraduated && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">
                  LIVE
                </Badge>
              )}
              {isHot && !isGraduated && (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-1.5 py-0">
                  🔥 HOT
                </Badge>
              )}
              {/* Holder Rewards badge */}
              {isHolderRewards && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">
                  💎 HOLDER
                </Badge>
              )}
              {/* AI Agent badge */}
              {token.agent_id && (
                <Link 
                  to={`/t/${token.ticker}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-0.5 bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full hover:bg-purple-500/30 transition-colors"
                  title="AI Agent Token - Click to visit community"
                >
                  <Bot className="h-3 w-3" />
                  <span className="text-[10px] font-medium">AI</span>
                </Link>
              )}
              {/* pump.fun badge */}
              {isPumpFun && (
                <PumpBadge mintAddress={token.mint_address} />
              )}
              {/* Trading fee badge - show if not default 2% */}
              <Badge 
                variant="outline" 
                className={`text-[10px] px-1.5 py-0 ${tradingFeePct !== 2 ? 'border-primary/50 text-primary' : 'border-border text-muted-foreground'}`}
              >
                {tradingFeePct}% fee
              </Badge>
            </div>

            {/* Creator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <span>by</span>
              <span className="font-medium text-foreground/80 truncate max-w-[100px]">
                {token.profiles?.display_name || token.creator_wallet.slice(0, 6) + '...'}
              </span>
              {token.profiles?.verified_type && (
                <VerifiedBadge type={token.profiles.verified_type as 'blue' | 'gold'} />
              )}
              <span className="text-muted-foreground/60">•</span>
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(token.created_at), { addSuffix: false })}</span>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-3 mt-2.5 text-xs flex-wrap">
              {/* Market cap in USD with change */}
              <div className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded-md">
                <span className="text-foreground font-semibold">
                  {formatUsdMarketCap(token.market_cap_sol, solPrice)}
                </span>
                <div className={`flex items-center gap-0.5 ${isPositive ? "text-green-500" : "text-red-500"}`}>
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span className="font-medium">{isPositive ? "+" : ""}{priceChange.toFixed(1)}%</span>
                </div>
              </div>
              
              {/* Holders */}
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{token.holder_count}</span>
              </div>

              {/* Volume if significant */}
              {token.volume_24h_sol > 0 && (
                <div className="text-muted-foreground">
                  <span className="text-foreground/70">Vol:</span> {token.volume_24h_sol.toFixed(1)} SOL
                </div>
              )}
            </div>

            {/* Bonding Curve - Compact - Use real_sol_reserves for accurate progress */}
            {!isGraduated && (
              <div className="mt-3">
                <BondingCurveProgress
                  realSolReserves={token.real_sol_reserves}
                  graduationThreshold={token.graduation_threshold_sol || 85}
                  showDetails={false}
                  compact
                />
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="flex items-center self-center">
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </Card>
    </CardWrapper>
  );
}
