import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Bot, Users, TrendingUp, ExternalLink, AlertTriangle, CheckCircle } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { formatDistanceToNow } from "date-fns";

interface InvestigationResult {
  mintAddress: string;
  totalTransactions: number;
  uniqueWallets: number;
  stats: {
    totalVolumeSol: number;
    botWalletCount: number;
    botVolumePercentage: number;
    botVolumeSol: number;
  };
  first50Buyers: Array<{
    wallet: string;
    firstBuyTime: string;
    totalBoughtSol: number;
    totalBought: number;
    totalSold: number;
    soldAll: boolean;
    lastSellTime: string | null;
    isBot: boolean;
    botReason: string[];
    txCount: number;
    firstTxSignature: string;
  }>;
  top100ByVolume: Array<{
    wallet: string;
    totalVolumeSol: number;
    totalBoughtSol: number;
    totalSoldSol: number;
    totalBought: number;
    totalSold: number;
    firstBuyTime: string;
    lastSellTime: string | null;
    isBot: boolean;
    botReason: string[];
    txCount: number;
    holdingPercent: number;
  }>;
  botWallets: Array<{
    wallet: string;
    reason: string[];
    volumeSol: number;
    txCount: number;
  }>;
}

export default function InvestigateTokenPage() {
  const [searchParams] = useSearchParams();
  const initialMint = searchParams.get("mint") || "ArkwJSy8Lo5quFKoiGLxHXSTuigPT5CsUQ8JtusUpump";
  
  const [mintAddress, setMintAddress] = useState(initialMint);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const investigate = async () => {
    if (!mintAddress) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress("Fetching transactions from Solana...");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("investigate-token", {
        body: { mintAddress, limit: 50000 },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setResult(data);
      setProgress("");
    } catch (err) {
      console.error("Investigation error:", err);
      setError(err instanceof Error ? err.message : "Investigation failed");
    } finally {
      setLoading(false);
    }
  };

  const truncateWallet = (wallet: string) => `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  const formatSOL = (sol: number) => sol.toFixed(4);
  const formatTokens = (tokens: number) => {
    if (tokens >= 1e9) return `${(tokens / 1e9).toFixed(2)}B`;
    if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(2)}M`;
    if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(2)}K`;
    return tokens.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">🔍 Token Investigation</h1>
          <p className="text-muted-foreground">
            Analyze on-chain transactions to detect bots, early buyers, and trading patterns
          </p>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Input
                placeholder="Enter token mint address..."
                value={mintAddress}
                onChange={(e) => setMintAddress(e.target.value)}
                className="font-mono text-sm"
              />
              <Button onClick={investigate} disabled={loading || !mintAddress}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Investigate
                  </>
                )}
              </Button>
            </div>
            {progress && (
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {progress}
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}
          </CardContent>
        </Card>

        {result && (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <TrendingUp className="h-4 w-4" />
                    Total Transactions
                  </div>
                  <p className="text-2xl font-bold">{result.totalTransactions.toLocaleString()}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Users className="h-4 w-4" />
                    Unique Wallets
                  </div>
                  <p className="text-2xl font-bold">{result.uniqueWallets.toLocaleString()}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Bot className="h-4 w-4" />
                    Bot Wallets
                  </div>
                  <p className="text-2xl font-bold text-destructive">{result.stats.botWalletCount}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Bot Volume %
                  </div>
                  <p className="text-2xl font-bold text-destructive">
                    {result.stats.botVolumePercentage.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Volume Stats */}
            <Card className="mb-6">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Volume</p>
                    <p className="text-xl font-bold">{formatSOL(result.stats.totalVolumeSol)} SOL</p>
                  </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bot Volume</p>
                  <p className="text-xl font-bold text-destructive">{formatSOL(result.stats.botVolumeSol)} SOL</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Organic Volume</p>
                  <p className="text-xl font-bold text-primary">
                    {formatSOL(result.stats.totalVolumeSol - result.stats.botVolumeSol)} SOL
                  </p>
                </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs for detailed data */}
            <Tabs defaultValue="first-buyers" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="first-buyers">First 50 Buyers</TabsTrigger>
                <TabsTrigger value="top-volume">Top 100 by Volume</TabsTrigger>
                <TabsTrigger value="bots">Bot Wallets ({result.stats.botWalletCount})</TabsTrigger>
              </TabsList>

              <TabsContent value="first-buyers">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">First 50 Buyers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Wallet</TableHead>
                            <TableHead>First Buy</TableHead>
                            <TableHead>Bought (SOL)</TableHead>
                            <TableHead>Tokens</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Sell</TableHead>
                            <TableHead>Bot?</TableHead>
                            <TableHead>Tx</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.first50Buyers.map((buyer, i) => (
                            <TableRow key={buyer.wallet} className={buyer.isBot ? "bg-destructive/5" : ""}>
                              <TableCell className="font-medium">{i + 1}</TableCell>
                              <TableCell>
                                <a
                                  href={`https://solscan.io/account/${buyer.wallet}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs hover:text-primary flex items-center gap-1"
                                >
                                  {truncateWallet(buyer.wallet)}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </TableCell>
                              <TableCell className="text-xs">
                                {formatDistanceToNow(new Date(buyer.firstBuyTime), { addSuffix: true })}
                              </TableCell>
                              <TableCell>{formatSOL(buyer.totalBoughtSol)}</TableCell>
                              <TableCell>{formatTokens(buyer.totalBought)}</TableCell>
                              <TableCell>
                                {buyer.soldAll ? (
                                  <Badge variant="destructive" className="text-xs">Sold All</Badge>
                                ) : buyer.totalSold > 0 ? (
                                  <Badge variant="secondary" className="text-xs">
                                    {((buyer.totalSold / buyer.totalBought) * 100).toFixed(0)}% Sold
                                  </Badge>
                                ) : (
                                  <Badge className="text-xs bg-primary">Holding</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {buyer.lastSellTime 
                                  ? formatDistanceToNow(new Date(buyer.lastSellTime), { addSuffix: true })
                                  : "-"
                                }
                              </TableCell>
                              <TableCell>
                                {buyer.isBot ? (
                                  <div className="flex items-center gap-1">
                                    <Bot className="h-4 w-4 text-destructive" />
                                    <span className="text-xs text-destructive">{buyer.botReason[0]}</span>
                                  </div>
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-primary" />
                                )}
                              </TableCell>
                              <TableCell>
                                <a
                                  href={`https://solscan.io/tx/${buyer.firstTxSignature}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  View
                                </a>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="top-volume">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top 100 by Trading Volume</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Wallet</TableHead>
                            <TableHead>Total Volume</TableHead>
                            <TableHead>Bought</TableHead>
                            <TableHead>Sold</TableHead>
                            <TableHead>Holding %</TableHead>
                            <TableHead>First Buy</TableHead>
                            <TableHead>Txs</TableHead>
                            <TableHead>Bot?</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.top100ByVolume.map((trader, i) => (
                            <TableRow key={trader.wallet} className={trader.isBot ? "bg-destructive/5" : ""}>
                              <TableCell className="font-medium">{i + 1}</TableCell>
                              <TableCell>
                                <a
                                  href={`https://solscan.io/account/${trader.wallet}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs hover:text-primary flex items-center gap-1"
                                >
                                  {truncateWallet(trader.wallet)}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </TableCell>
                              <TableCell className="font-medium">{formatSOL(trader.totalVolumeSol)} SOL</TableCell>
                              <TableCell className="text-primary">{formatSOL(trader.totalBoughtSol)}</TableCell>
                              <TableCell className="text-destructive">{formatSOL(trader.totalSoldSol)}</TableCell>
                              <TableCell>
                                {trader.holdingPercent > 0 ? (
                                  <Badge variant={trader.holdingPercent > 50 ? "default" : "secondary"}>
                                    {trader.holdingPercent.toFixed(0)}%
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">0%</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {formatDistanceToNow(new Date(trader.firstBuyTime), { addSuffix: true })}
                              </TableCell>
                              <TableCell>{trader.txCount}</TableCell>
                              <TableCell>
                                {trader.isBot ? (
                                  <div className="flex items-center gap-1">
                                    <Bot className="h-4 w-4 text-destructive" />
                                  </div>
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-primary" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bots">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Bot className="h-5 w-5 text-destructive" />
                      Detected Bot Wallets
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Wallet</TableHead>
                            <TableHead>Volume (SOL)</TableHead>
                            <TableHead>Transactions</TableHead>
                            <TableHead>Bot Reasons</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.botWallets.map((bot, i) => (
                            <TableRow key={bot.wallet} className="bg-destructive/5">
                              <TableCell className="font-medium">{i + 1}</TableCell>
                              <TableCell>
                                <a
                                  href={`https://solscan.io/account/${bot.wallet}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs hover:text-primary flex items-center gap-1"
                                >
                                  {truncateWallet(bot.wallet)}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </TableCell>
                              <TableCell>{formatSOL(bot.volumeSol)}</TableCell>
                              <TableCell>{bot.txCount}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {bot.reason.map((r, j) => (
                                    <Badge key={j} variant="destructive" className="text-xs">
                                      {r}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
