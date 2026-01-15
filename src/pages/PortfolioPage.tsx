import { useLaunchpad, formatTokenAmount, formatSolAmount, Token } from "@/hooks/useLaunchpad";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { Wallet, TrendingUp, Coins, ArrowRight, Plus, ArrowLeft } from "lucide-react";
import { useMemo } from "react";

interface HoldingWithToken {
  id: string;
  token_id: string;
  wallet_address: string;
  balance: number;
  tokens: {
    id: string;
    mint_address: string;
    name: string;
    ticker: string;
    image_url: string | null;
    price_sol: number;
    status: string;
  } | null;
}

export default function PortfolioPage() {
  const { solanaAddress, isAuthenticated, login } = useAuth();
  const { useUserHoldings, useUserTokens, useUserEarnings } = useLaunchpad();

  const { data: holdings = [], isLoading: isLoadingHoldings } = useUserHoldings(solanaAddress);
  const { data: createdTokens = [], isLoading: isLoadingCreated } = useUserTokens(solanaAddress);
  const { data: earnings } = useUserEarnings(solanaAddress, undefined);

  const portfolioStats = useMemo(() => {
    const typedHoldings = holdings as HoldingWithToken[];
    const totalValue = typedHoldings.reduce((sum, h) => {
      if (!h.tokens) return sum;
      return sum + (h.balance * h.tokens.price_sol);
    }, 0);

    const totalTokens = typedHoldings.length;
    const unclaimedEarnings = earnings?.earnings?.reduce(
      (sum: number, e: { unclaimed_sol: number }) => sum + (e.unclaimed_sol || 0),
      0
    ) || 0;

    return { totalValue, totalTokens, unclaimedEarnings };
  }, [holdings, earnings]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center py-20">
          <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
          <p className="text-muted-foreground mb-4 text-center">
            Connect your wallet to view your token portfolio
          </p>
          <Button onClick={() => login()}>Connect Wallet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4 px-4 h-14">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Portfolio</h1>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Value</p>
            <p className="text-lg font-bold text-primary">
              {formatSolAmount(portfolioStats.totalValue)} SOL
            </p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Holdings</p>
            <p className="text-lg font-bold">{portfolioStats.totalTokens}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Unclaimed Fees</p>
            <p className="text-lg font-bold text-green-500">
              {formatSolAmount(portfolioStats.unclaimedEarnings)} SOL
            </p>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="holdings" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="holdings" className="flex-1">
              Holdings
            </TabsTrigger>
            <TabsTrigger value="created" className="flex-1">
              Created ({createdTokens.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="holdings" className="mt-4">
            {isLoadingHoldings ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (holdings as HoldingWithToken[]).length === 0 ? (
              <div className="text-center py-12">
                <Coins className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No holdings yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start trading to build your portfolio
                </p>
                <Link to="/launchpad">
                  <Button className="gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Explore Tokens
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {(holdings as HoldingWithToken[]).map((holding) => {
                  if (!holding.tokens) return null;
                  const value = holding.balance * holding.tokens.price_sol;
                  const percentage = (holding.balance / 1_000_000_000) * 100;

                  return (
                    <Link key={holding.id} to={`/launchpad/${holding.tokens.mint_address}`}>
                      <Card className="p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors">
                        <Avatar className="h-10 w-10 rounded-lg">
                          <AvatarImage src={holding.tokens.image_url || undefined} />
                          <AvatarFallback className="rounded-lg text-xs font-bold">
                            {holding.tokens.ticker.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{holding.tokens.name}</p>
                            <Badge variant="secondary" className="text-xs">
                              ${holding.tokens.ticker}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatTokenAmount(holding.balance)} ({percentage.toFixed(4)}%)
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-medium">{formatSolAmount(value)} SOL</p>
                          <p className="text-xs text-muted-foreground">
                            @{formatSolAmount(holding.tokens.price_sol)}
                          </p>
                        </div>

                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="created" className="mt-4">
            {isLoadingCreated ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : createdTokens.length === 0 ? (
              <div className="text-center py-12">
                <Plus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No tokens created</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Launch your own token and earn fees from trading
                </p>
                <Link to="/launch">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Launch Token
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {createdTokens.map((token: Token) => (
                  <Link key={token.id} to={`/launchpad/${token.mint_address}`}>
                    <Card className="p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors">
                      <Avatar className="h-10 w-10 rounded-lg">
                        <AvatarImage src={token.image_url || undefined} />
                        <AvatarFallback className="rounded-lg text-xs font-bold">
                          {token.ticker.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{token.name}</p>
                          <Badge variant="secondary" className="text-xs">
                            ${token.ticker}
                          </Badge>
                          {token.status === "graduated" && (
                            <Badge className="bg-primary/20 text-primary text-xs">
                              🎓
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          MC: {formatSolAmount(token.market_cap_sol)} SOL • {token.holder_count} holders
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-medium text-primary">
                          {formatSolAmount(token.price_sol)} SOL
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vol: {formatSolAmount(token.volume_24h_sol)}
                        </p>
                      </div>

                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Link to earnings */}
        {portfolioStats.unclaimedEarnings > 0 && (
          <Link to="/earnings">
            <Card className="p-4 bg-green-500/10 border-green-500/30 hover:bg-green-500/20 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-500">Unclaimed Earnings Available</p>
                  <p className="text-sm text-muted-foreground">
                    You have {formatSolAmount(portfolioStats.unclaimedEarnings)} SOL to claim
                  </p>
                </div>
                <Button variant="secondary" size="sm" className="gap-2">
                  Claim <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
