import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { BondingCurveProgress } from "./BondingCurveProgress";
import { Token, formatSolAmount, formatTokenAmount } from "@/hooks/useLaunchpad";
import { TrendingUp, TrendingDown, Users, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TokenCardProps {
  token: Token;
}

export function TokenCard({ token }: TokenCardProps) {
  const isGraduated = token.status === 'graduated';
  const priceChange = (token as any).price_change_24h || 0;
  const isPositive = priceChange >= 0;

  return (
    <Link to={`/launchpad/${token.mint_address}`}>
      <Card className="p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
        <div className="flex gap-4">
          {/* Token Image */}
          <Avatar className="h-16 w-16 rounded-xl border-2 border-border group-hover:border-primary transition-colors">
            <AvatarImage src={token.image_url || undefined} alt={token.name} />
            <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary rounded-xl">
              {token.ticker.slice(0, 2)}
            </AvatarFallback>
          </Avatar>

          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg truncate">{token.name}</h3>
              <Badge variant="secondary" className="text-xs">
                ${token.ticker}
              </Badge>
              {isGraduated && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                  🎓 Graduated
                </Badge>
              )}
            </div>

            {/* Creator */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <span>by</span>
              <span className="font-medium text-foreground">
                {token.profiles?.display_name || token.creator_wallet.slice(0, 6) + '...'}
              </span>
              {token.profiles?.verified_type && (
                <VerifiedBadge type={token.profiles.verified_type as 'blue' | 'gold'} />
              )}
            </div>

            {/* Description */}
            {token.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {token.description}
              </p>
            )}

            {/* Stats Row */}
            <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
              <div className="flex items-center gap-1 text-muted-foreground">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={isPositive ? "text-green-500" : "text-red-500"}>
                  {isPositive ? "+" : ""}{priceChange.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-primary font-medium">
                  {formatSolAmount(token.price_sol)} SOL
                </span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>MC: {formatSolAmount(token.market_cap_sol)}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{token.holder_count}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{formatDistanceToNow(new Date(token.created_at), { addSuffix: false })}</span>
              </div>
            </div>

            {/* Bonding Curve */}
            {!isGraduated && (
              <div className="mt-3">
                <BondingCurveProgress
                  progress={token.bonding_curve_progress}
                  realSolReserves={token.real_sol_reserves}
                  graduationThreshold={token.graduation_threshold_sol}
                  showDetails={false}
                />
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="flex items-center">
            <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
