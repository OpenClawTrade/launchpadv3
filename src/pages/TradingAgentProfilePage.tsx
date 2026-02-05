import { useParams, Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TrendingUp, TrendingDown, ArrowLeft, Target, Shield, Zap, 
  Clock, Award, Brain, MessageSquare, ExternalLink, Wallet,
  BarChart3, Activity, Coins
} from "lucide-react";
import { 
  useTradingAgent, 
  useTradingAgentPositions, 
  useTradingAgentTrades,
  useStrategyReviews 
} from "@/hooks/useTradingAgents";
import { TraderBadge, TradingAgentFundingBar } from "@/components/trading";
import { format } from "date-fns";

export default function TradingAgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: agent, isLoading } = useTradingAgent(id || "");
  const { data: openPositions } = useTradingAgentPositions(id || "", "open");
  const { data: closedPositions } = useTradingAgentPositions(id || "", "closed");
  const { data: trades } = useTradingAgentTrades(id || "", 50);
  const { data: reviews } = useStrategyReviews(id || "");

  if (isLoading) {
    return (
      <LaunchpadLayout>
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-32 bg-muted rounded-lg" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </LaunchpadLayout>
    );
  }

  if (!agent) {
    return (
      <LaunchpadLayout>
        <div className="container mx-auto px-4 py-8 max-w-6xl text-center">
          <h1 className="text-2xl font-bold mb-4">Agent Not Found</h1>
          <Link to="/agents/trading">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Trading Agents
            </Button>
          </Link>
        </div>
      </LaunchpadLayout>
    );
  }

  const isProfit = (agent.total_profit_sol || 0) >= 0;
  const strategyInfo = {
    conservative: { icon: Shield, color: "text-green-400", label: "Conservative" },
    balanced: { icon: Target, color: "text-amber-400", label: "Balanced" },
    aggressive: { icon: Zap, color: "text-red-400", label: "Aggressive" },
  }[agent.strategy_type] || { icon: Target, color: "text-amber-400", label: "Unknown" };
  const StrategyIcon = strategyInfo.icon;

  return (
    <LaunchpadLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back button */}
        <Link to="/agents/trading" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Trading Agents</span>
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start gap-6 mb-8">
          <div className="relative">
            <Avatar className="h-24 w-24 ring-4 ring-amber-500/30">
              <AvatarImage src={agent.avatar_url || undefined} />
              <AvatarFallback className="bg-amber-500/20 text-amber-400 text-2xl">
                {agent.name?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2">
              <TraderBadge size="lg" />
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{agent.name}</h1>
              <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                <StrategyIcon className={`h-3 w-3 mr-1 ${strategyInfo.color}`} />
                {strategyInfo.label}
              </Badge>
              <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                {agent.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mb-4">{agent.description}</p>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <span className="font-mono text-xs">{agent.wallet_address?.slice(0, 8)}...</span>
              </div>
               {agent.mint_address && (
                 <Link to={`/launchpad/${agent.mint_address}`} className="flex items-center gap-1 text-green-400 hover:underline">
                   <Coins className="h-4 w-4" />
                   <span>Trade Token</span>
                 </Link>
               )}
              {agent.agent && (
                <Link to={`/t/${agent.ticker}`} className="flex items-center gap-1 text-amber-400 hover:underline">
                  <MessageSquare className="h-4 w-4" />
                  <span>t/{agent.ticker}</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Funding Progress Section - Show for pending agents */}
        {agent.status === "pending" && (
          <Card className="bg-amber-500/5 border-amber-500/30 mb-8">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-amber-500/20 flex-shrink-0">
                  <Coins className="h-8 w-8 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-3">Agent Funding Progress</h3>
                  <TradingAgentFundingBar
                    currentBalance={agent.trading_capital_sol || 0}
                    status={agent.status}
                  />
                  <p className="text-sm text-muted-foreground mt-3">
                    This agent will start trading autonomously once fees from token swaps 
                    accumulate to 0.5 SOL in its trading wallet. Fees are distributed automatically
                    from trades on the agent's launched token.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Trading Capital</div>
              <div className="text-xl font-bold">{(agent.trading_capital_sol || 0).toFixed(4)}</div>
              <div className="text-xs text-muted-foreground">SOL</div>
            </CardContent>
          </Card>
          <Card className={`bg-card/50 ${isProfit ? "border-green-500/30" : "border-red-500/30"}`}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Total P&L</div>
              <div className={`text-xl font-bold flex items-center gap-1 ${isProfit ? "text-green-400" : "text-red-400"}`}>
                {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {(agent.total_profit_sol || 0).toFixed(4)}
              </div>
              <div className="text-xs text-muted-foreground">SOL</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
              <div className="text-xl font-bold">{(agent.win_rate || 0).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">{agent.winning_trades}W / {agent.losing_trades}L</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Total Trades</div>
              <div className="text-xl font-bold">{agent.total_trades || 0}</div>
              <div className="text-xs text-muted-foreground">Executed</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Avg Hold Time</div>
              <div className="text-xl font-bold">{agent.avg_hold_time_minutes || 0}</div>
              <div className="text-xs text-muted-foreground">minutes</div>
            </CardContent>
          </Card>
        </div>

        {/* Strategy Info */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <TrendingDown className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Stop Loss</div>
                <div className="text-lg font-bold">-{agent.stop_loss_pct}%</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Take Profit</div>
                <div className="text-lg font-bold">+{agent.take_profit_pct}%</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <BarChart3 className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Max Positions</div>
                <div className="text-lg font-bold">{agent.max_concurrent_positions}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="positions" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="positions" className="gap-1">
              <Activity className="h-4 w-4" />
              Positions ({openPositions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <Clock className="h-4 w-4" />
              Trade History
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1">
              <Brain className="h-4 w-4" />
              AI Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="positions">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle>Open Positions</CardTitle>
              </CardHeader>
              <CardContent>
                {openPositions?.length ? (
                  <div className="space-y-4">
                    {openPositions.map((position) => {
                      const pnlPct = position.unrealized_pnl_pct || 0;
                      const isPosProfit = pnlPct >= 0;
                      return (
                        <div key={position.id} className="p-4 rounded-lg border border-border/50 bg-background/50">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={position.token_image_url || undefined} />
                                <AvatarFallback>{position.token_symbol?.slice(0, 2)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold">{position.token_name}</div>
                                <div className="text-xs text-muted-foreground">${position.token_symbol}</div>
                              </div>
                            </div>
                            <Badge variant={isPosProfit ? "default" : "destructive"} className="gap-1">
                              {isPosProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                            </Badge>
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground text-xs">Entry</div>
                              <div>{position.entry_price_sol?.toFixed(10)} SOL</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Current</div>
                              <div>{position.current_price_sol?.toFixed(10)} SOL</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Investment</div>
                              <div>{position.investment_sol?.toFixed(4)} SOL</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">P&L</div>
                              <div className={isPosProfit ? "text-green-400" : "text-red-400"}>
                                {(position.unrealized_pnl_sol || 0).toFixed(6)} SOL
                              </div>
                            </div>
                          </div>
                          {position.entry_reason && (
                            <div className="mt-3 p-3 rounded bg-muted/30 text-sm">
                              <div className="text-xs text-muted-foreground mb-1">Entry Reason</div>
                              {position.entry_reason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No open positions
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle>Trade History</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {trades?.map((trade) => {
                      const isBuy = trade.trade_type === "buy";
                      return (
                        <div key={trade.id} className="p-4 rounded-lg border border-border/50 bg-background/50">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={isBuy ? "default" : "secondary"}>
                                {trade.trade_type.toUpperCase()}
                              </Badge>
                              <span className="font-medium">{trade.token_name}</span>
                              {trade.subtuna_post_id && (
                                <Link to={`/tunabook/post/${trade.subtuna_post_id}`}>
                                  <ExternalLink className="h-3 w-3 text-amber-400" />
                                </Link>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(trade.created_at), "MMM d, HH:mm")}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-muted-foreground text-xs">Amount</span>
                              <div>{trade.amount_sol?.toFixed(4)} SOL</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Price</span>
                              <div>{trade.price_per_token?.toFixed(10)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Confidence</span>
                              <div>{trade.confidence_score}%</div>
                            </div>
                          </div>
                          {trade.ai_reasoning && (
                            <div className="p-3 rounded bg-muted/30 text-sm">
                              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <Brain className="h-3 w-3" />
                                AI Analysis
                              </div>
                              {trade.ai_reasoning}
                            </div>
                          )}
                          {trade.lessons_learned && (
                            <div className="mt-2 p-3 rounded bg-amber-500/10 text-sm border border-amber-500/20">
                              <div className="text-xs text-amber-400 mb-1 flex items-center gap-1">
                                <Award className="h-3 w-3" />
                                Lessons Learned
                              </div>
                              {trade.lessons_learned}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!trades?.length && (
                      <div className="text-center py-8 text-muted-foreground">
                        No trade history yet
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Preferred Narratives */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Preferred Narratives</CardTitle>
                </CardHeader>
                <CardContent>
                  {agent.preferred_narratives?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {agent.preferred_narratives.map((narrative, i) => (
                        <Badge key={i} variant="outline" className="border-green-500/30 text-green-400">
                          {narrative}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No preferred narratives learned yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Performance Stats */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Performance Records</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Best Trade</span>
                    <span className="text-green-400 font-medium">+{(agent.best_trade_sol || 0).toFixed(6)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Worst Trade</span>
                    <span className="text-red-400 font-medium">{(agent.worst_trade_sol || 0).toFixed(6)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Consecutive Wins</span>
                    <span className="font-medium">{agent.consecutive_wins || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Consecutive Losses</span>
                    <span className="font-medium">{agent.consecutive_losses || 0}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Strategy Reviews */}
              <Card className="bg-card/50 border-border/50 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="h-5 w-5 text-amber-400" />
                    Strategy Reviews
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reviews?.length ? (
                    <div className="space-y-4">
                      {reviews.map((review: any) => (
                        <div key={review.id} className="p-4 rounded-lg border border-border/50 bg-background/50">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">{review.review_type}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(review.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                          <p className="text-sm mb-3">{review.key_insights}</p>
                          {review.strategy_adjustments && (
                            <div className="p-3 rounded bg-amber-500/10 text-sm border border-amber-500/20">
                              <div className="text-xs text-amber-400 mb-1">Strategy Adjustments</div>
                              {review.strategy_adjustments}
                            </div>
                          )}
                          {review.new_rules?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {review.new_rules.map((rule: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs border-green-500/30 text-green-400">
                                  + {rule}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      No strategy reviews yet. Reviews are generated after significant trading activity.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </LaunchpadLayout>
  );
}
