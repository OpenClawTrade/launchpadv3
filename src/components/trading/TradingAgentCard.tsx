import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, Shield, Zap, CheckCircle2, Copy, Check, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import type { TradingAgent } from "@/hooks/useTradingAgents";
import { TradingAgentFundingBar } from "./TradingAgentFundingBar";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
interface TradingAgentCardProps {
  agent: TradingAgent;
  rank?: number;
}

export function TradingAgentCard({ agent, rank }: TradingAgentCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const isProfit = (agent.total_profit_sol || 0) >= 0;
  const strategyIcon = {
    conservative: Shield,
    balanced: Target,
    aggressive: Zap,
  }[agent.strategy_type] || Target;
  const StrategyIcon = strategyIcon;

  const strategyColor = {
    conservative: "text-green-400",
    balanced: "text-amber-400",
    aggressive: "text-red-400",
  }[agent.strategy_type] || "text-amber-400";

  const copyCA = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (agent.mint_address) {
      navigator.clipboard.writeText(agent.mint_address);
      setCopied(true);
      toast({ title: "Copied!", description: "Contract address copied" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const launchTime = agent.created_at 
    ? formatDistanceToNow(new Date(agent.created_at), { addSuffix: true })
    : null;

  return (
    <Link to={`/agents/trading/${agent.id}`}>
      <Card className="bg-card/50 border-amber-500/20 hover:border-amber-500/50 transition-all cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Rank badge */}
            {rank && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <span className="text-amber-400 font-bold text-sm">#{rank}</span>
              </div>
            )}

            {/* Avatar with gold border */}
            <div className="relative">
              <Avatar className="h-12 w-12 ring-2 ring-amber-500/50 group-hover:ring-amber-400 transition-all">
                <AvatarImage src={agent.avatar_url || undefined} />
                <AvatarFallback className="bg-amber-500/20 text-amber-400">
                  {agent.name?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 p-0.5 bg-background rounded-full">
                <TrendingUp className="h-3 w-3 text-amber-400" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground truncate">{agent.name}</h3>
                <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-[10px] px-1.5">
                  <StrategyIcon className={`h-3 w-3 mr-1 ${strategyColor}`} />
                  {agent.strategy_type}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground">${agent.ticker}</p>
                {launchTime && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {launchTime}
                  </span>
                )}
              </div>
            </div>

            {/* CA Copy button */}
            {agent.mint_address && (
              <button
                onClick={copyCA}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/80 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Copy contract address"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-primary" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>CA</span>
              </button>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="text-center">
              <div className={`text-sm font-semibold flex items-center justify-center gap-1 ${isProfit ? "text-green-400" : "text-red-400"}`}>
                {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {(agent.total_profit_sol || 0).toFixed(4)}
              </div>
              <div className="text-[10px] text-muted-foreground">P&L (SOL)</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-foreground">
                {(agent.win_rate || 0).toFixed(1)}%
              </div>
              <div className="text-[10px] text-muted-foreground">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-foreground">
                {agent.total_trades || 0}
              </div>
              <div className="text-[10px] text-muted-foreground">Trades</div>
            </div>
          </div>

          {/* Funding Status or Capital */}
          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
            {agent.status === "pending" ? (
              <TradingAgentFundingBar
                currentBalance={agent.trading_capital_sol || 0}
                status={agent.status}
                compact
              />
            ) : agent.status === "active" ? (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Trading Active</span>
                </div>
                <span className="text-foreground font-medium">
                  {(agent.trading_capital_sol || 0).toFixed(4)} SOL
                </span>
              </div>
            ) : (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Capital</span>
                <span className="text-foreground font-medium">
                  {(agent.trading_capital_sol || 0).toFixed(4)} SOL
                </span>
              </div>
            )}
            {agent.openPositions !== undefined && agent.openPositions > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Open Positions</span>
                <span className="text-amber-400 font-medium">{agent.openPositions}</span>
              </div>
            )}
            </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function TradingAgentCardSkeleton() {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-16 bg-muted rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <div className="h-4 w-12 bg-muted rounded animate-pulse mx-auto" />
              <div className="h-2 w-8 bg-muted rounded animate-pulse mx-auto mt-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
