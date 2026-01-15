import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFunTokens } from "@/hooks/useFunTokens";
import { useFunFeeClaims, useFunDistributions, useFunBuybacks } from "@/hooks/useFunFeeData";
import { 
  Shuffle, 
  Rocket, 
  Sparkles, 
  TrendingUp, 
  Users, 
  BarChart3, 
  Clock,
  RefreshCw,
  Zap,
  ExternalLink,
  Copy,
  CheckCircle,
  Coins,
  ArrowDownCircle,
  Wallet,
  AlertTriangle,
  PartyPopper,
  Key
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

interface MemeToken {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
}

interface LaunchResult {
  success: boolean;
  name?: string;
  ticker?: string;
  mintAddress?: string;
  imageUrl?: string;
  onChainSuccess?: boolean;
  solscanUrl?: string;
  tradeUrl?: string;
  message?: string;
  error?: string;
}

export default function FunLauncherPage() {
  const { toast } = useToast();
  const { tokens, isLoading: tokensLoading, refetch } = useFunTokens();
  const { data: feeClaims = [], isLoading: claimsLoading } = useFunFeeClaims();
  const { data: distributions = [] } = useFunDistributions();
  const { data: buybacks = [], isLoading: buybacksLoading } = useFunBuybacks();
  
  const [meme, setMeme] = useState<MemeToken | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // Update timestamp
  useEffect(() => {
    const interval = setInterval(() => setLastUpdate(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const isValidSolanaAddress = (address: string) => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleRandomize = useCallback(async () => {
    console.log("[FunLauncher] Randomize clicked");
    setIsGenerating(true);
    setMeme(null);
    
    try {
      console.log("[FunLauncher] Calling fun-generate...");
      const { data, error } = await supabase.functions.invoke("fun-generate", {
        body: {}
      });

      console.log("[FunLauncher] fun-generate response:", { data, error });

      if (error) {
        console.error("[FunLauncher] fun-generate error:", error);
        throw error;
      }

      // Handle backend returning success: false
      if (data && !data.success) {
        console.error("[FunLauncher] fun-generate returned failure:", data.error);
        throw new Error(data.error || "Generation failed on server");
      }

      if (data?.meme) {
        console.log("[FunLauncher] Meme generated:", data.meme);
        setMeme(data.meme);
        toast({
          title: "Meme Generated! 🎲",
          description: `${data.meme.name} ($${data.meme.ticker}) is ready!`,
        });
      } else {
        console.error("[FunLauncher] No meme in response:", data);
        throw new Error("No meme data returned from server");
      }
    } catch (error) {
      console.error("[FunLauncher] Generate error:", error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate meme",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  const handleLaunch = useCallback(async () => {
    if (!meme) {
      toast({
        title: "No meme to launch",
        description: "Click Randomize first to generate a meme token",
        variant: "destructive",
      });
      return;
    }

    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      toast({
        title: "Invalid wallet address",
        description: "Please enter a valid Solana wallet address",
        variant: "destructive",
      });
      return;
    }

    setIsLaunching(true);
    console.log("[FunLauncher] Starting token launch:", { name: meme.name, ticker: meme.ticker, wallet: walletAddress });

    try {
      console.log("[FunLauncher] Calling fun-create...");
      const { data, error } = await supabase.functions.invoke("fun-create", {
        body: {
          name: meme.name,
          ticker: meme.ticker,
          description: meme.description,
          imageUrl: meme.imageUrl,
          creatorWallet: walletAddress,
        }
      });

      console.log("[FunLauncher] fun-create response:", { data, error });

      // Handle HTTP-level errors
      if (error) {
        console.error("[FunLauncher] fun-create HTTP error:", error);
        // Try to extract more info from the error
        const errorMsg = error.message || error.toString();
        throw new Error(`Server error: ${errorMsg}`);
      }

      // Handle application-level failures
      if (!data?.success) {
        console.error("[FunLauncher] fun-create returned failure:", data);
        throw new Error(data?.error || "Launch failed - no details provided");
      }

      console.log("[FunLauncher] ✅ Token launched successfully:", data);

      // Set result and show modal
      setLaunchResult({
        success: true,
        name: data.name || meme.name,
        ticker: data.ticker || meme.ticker,
        mintAddress: data.mintAddress,
        imageUrl: data.imageUrl || meme.imageUrl,
        onChainSuccess: data.onChainSuccess,
        solscanUrl: data.solscanUrl,
        tradeUrl: data.tradeUrl,
        message: data.message,
      });
      setShowResultModal(true);

      toast({
        title: "🚀 Token Launched!",
        description: `${data.name || meme.name} is now live on Solana!`,
      });

      // Clear form
      setMeme(null);
      setWalletAddress("");
      
      // Refresh token list
      refetch();

    } catch (error) {
      console.error("[FunLauncher] Launch error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to launch token";
      
      setLaunchResult({
        success: false,
        error: errorMessage,
      });
      setShowResultModal(true);

      toast({
        title: "Launch Failed",
        description: errorMessage.length > 100 ? errorMessage.slice(0, 100) + "..." : errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLaunching(false);
    }
  }, [meme, walletAddress, toast, refetch]);

  const formatSOL = (sol: number) => {
    if (sol >= 1000) return `${(sol / 1000).toFixed(1)}K`;
    if (sol >= 1) return sol.toFixed(2);
    return sol.toFixed(6);
  };

  // Calculate totals
  const totalClaimed = feeClaims.reduce((sum, c) => sum + Number(c.claimed_sol || 0), 0);
  const totalBuybacks = buybacks.reduce((sum, b) => sum + Number(b.amount_sol || 0), 0);
  const creatorDistributions = distributions.filter(d => d.distribution_type === 'creator');
  const totalCreatorPaid = creatorDistributions.reduce((sum, d) => sum + Number(d.amount_sol || 0), 0);

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white">
      {/* Header Bar */}
      <header className="border-b border-[#1a1a1f] bg-[#0d0d0f]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-6 w-6 text-[#00d4aa]" />
            <span className="text-lg font-bold">ai69x</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Link to="/vanity">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
              >
                <Key className="h-4 w-4 mr-1" />
                Vanity
              </Button>
            </Link>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetch()}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Token Generator */}
          <div className="lg:col-span-1 space-y-4">
            {/* Generator Card */}
            <Card className="bg-[#12121a] border-[#1a1a1f] p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#00d4aa]" />
                  AI Meme Generator
                </h2>
                <Badge variant="outline" className="border-[#00d4aa]/30 text-[#00d4aa] text-xs">
                  FREE
                </Badge>
              </div>

              {/* Preview */}
              <div className="bg-[#0d0d0f] rounded-lg p-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-[#1a1a1f] flex-shrink-0 border-2 border-[#1a1a1f]">
                    {isGenerating ? (
                      <Skeleton className="w-full h-full bg-[#1a1a1f]" />
                    ) : meme?.imageUrl ? (
                      <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Shuffle className="h-8 w-8 text-gray-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {isGenerating ? (
                      <>
                        <Skeleton className="h-5 w-24 bg-[#1a1a1f] mb-2" />
                        <Skeleton className="h-4 w-16 bg-[#1a1a1f] mb-2" />
                        <Skeleton className="h-3 w-full bg-[#1a1a1f]" />
                      </>
                    ) : meme ? (
                      <>
                        <h3 className="font-bold text-white truncate">{meme.name}</h3>
                        <span className="text-[#00d4aa] font-mono text-sm">${meme.ticker}</span>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{meme.description}</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">Click Randomize to generate</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Randomize Button */}
              <Button
                onClick={handleRandomize}
                disabled={isGenerating || isLaunching}
                className="w-full bg-[#1a1a1f] hover:bg-[#252530] text-white border border-[#2a2a35] mb-3"
              >
                {isGenerating ? (
                  <><Shuffle className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Shuffle className="h-4 w-4 mr-2" /> Randomize</>
                )}
              </Button>

              {/* Wallet & Launch */}
              {meme && (
                <div className="space-y-3 pt-3 border-t border-[#1a1a1f]">
                  <Input
                    placeholder="Your SOL wallet address..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="bg-[#0d0d0f] border-[#1a1a1f] text-white placeholder:text-gray-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Receive 50% of trading fees every 30 min
                  </p>
                  <Button
                    onClick={handleLaunch}
                    disabled={isLaunching || !walletAddress}
                    className="w-full bg-[#00d4aa] hover:bg-[#00b894] text-black font-semibold"
                  >
                    {isLaunching ? (
                      <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</>
                    ) : (
                      <><Rocket className="h-4 w-4 mr-2" /> Launch Token</>
                    )}
                  </Button>
                </div>
              )}
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-[#12121a] border-[#1a1a1f] p-4">
                <div className="text-2xl font-bold text-white">{tokens.length}</div>
                <div className="text-xs text-gray-400">Total Tokens</div>
              </Card>
              <Card className="bg-[#12121a] border-[#1a1a1f] p-4">
                <div className="text-2xl font-bold text-[#00d4aa]">{formatSOL(totalClaimed)}</div>
                <div className="text-xs text-gray-400">Fees Claimed</div>
              </Card>
            </div>

            {/* Fee Split Info */}
            <Card className="bg-[#12121a] border-[#1a1a1f] p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Fee Distribution</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Creator Share</span>
                  <span className="text-[#00d4aa] font-semibold">50%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Buybacks</span>
                  <span className="text-blue-400 font-semibold">30%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">System/Expenses</span>
                  <span className="text-gray-400 font-semibold">20%</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Panel - Tabbed Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="tokens" className="w-full">
              <TabsList className="w-full bg-[#12121a] border border-[#1a1a1f] p-1 mb-4 grid grid-cols-3">
                <TabsTrigger 
                  value="tokens" 
                  className="data-[state=active]:bg-[#1a1a1f] data-[state=active]:text-white text-gray-400 text-xs sm:text-sm"
                >
                  <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Tokens</span> ({tokens.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="claims" 
                  className="data-[state=active]:bg-[#1a1a1f] data-[state=active]:text-white text-gray-400 text-xs sm:text-sm"
                >
                  <Coins className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Claimed</span> ({feeClaims.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="creator-fees" 
                  className="data-[state=active]:bg-[#1a1a1f] data-[state=active]:text-white text-gray-400 text-xs sm:text-sm"
                >
                  <Wallet className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Creator Fees</span> ({creatorDistributions.length})
                </TabsTrigger>
              </TabsList>

              {/* Tokens Tab */}
              <TabsContent value="tokens">
                <Card className="bg-[#12121a] border-[#1a1a1f]">
                  <div className="p-4 border-b border-[#1a1a1f] flex items-center justify-between">
                    <h2 className="font-semibold text-white flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-[#00d4aa]" />
                      Live Tokens
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-[#00d4aa] rounded-full animate-pulse" />
                      <span className="text-xs text-gray-400">Real-time</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-[#1a1a1f]">
                          <th className="text-left p-3 font-medium">#</th>
                          <th className="text-left p-3 font-medium">Token</th>
                          <th className="text-right p-3 font-medium">Price</th>
                          <th className="text-right p-3 font-medium">Market Cap</th>
                          <th className="text-right p-3 font-medium">Holders</th>
                          <th className="text-center p-3 font-medium">Progress</th>
                          <th className="text-right p-3 font-medium">Age</th>
                          <th className="text-center p-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokensLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i} className="border-b border-[#1a1a1f]">
                              <td className="p-3"><Skeleton className="h-4 w-6 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-8 w-32 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-16 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-16 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-12 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-20 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-12 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-6 w-16 bg-[#1a1a1f]" /></td>
                            </tr>
                          ))
                        ) : tokens.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-gray-500">
                              No tokens launched yet. Be the first!
                            </td>
                          </tr>
                        ) : (
                          tokens.map((token, index) => (
                            <tr 
                              key={token.id} 
                              className="border-b border-[#1a1a1f] hover:bg-[#1a1a1f]/50 transition-colors"
                            >
                              <td className="p-3 text-sm text-gray-400">{index + 1}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1a1a1f] flex-shrink-0">
                                    {token.image_url ? (
                                      <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs font-bold">
                                        {token.ticker?.slice(0, 2)}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-medium text-white text-sm">{token.name}</div>
                                    <div className="text-xs text-gray-400 font-mono">${token.ticker}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <span className="text-sm text-white font-mono">
                                  {formatSOL(token.price_sol)} SOL
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <span className="text-sm text-white">
                                  {formatSOL(token.market_cap_sol || 30)} SOL
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Users className="h-3 w-3 text-gray-400" />
                                  <span className="text-sm text-white">{token.holder_count || 0}</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex flex-col items-center gap-1">
                                  <Progress 
                                    value={token.bonding_progress || 0} 
                                    className="h-1.5 w-16 bg-[#1a1a1f] [&>div]:bg-[#00d4aa]" 
                                  />
                                  <span className="text-xs text-gray-400">
                                    {(token.bonding_progress || 0).toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <span className="text-xs text-gray-400">
                                  {formatDistanceToNow(new Date(token.created_at), { addSuffix: false })}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center justify-center gap-1">
                                  {token.mint_address && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(token.mint_address!)}
                                      className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                                    >
                                      {copiedAddress === token.mint_address ? (
                                        <CheckCircle className="h-3.5 w-3.5 text-[#00d4aa]" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    className="h-7 px-2 text-xs text-[#00d4aa] hover:bg-[#00d4aa]/10"
                                  >
                                    <a 
                                      href={`https://axiom.trade/meme/${token.mint_address}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Trade
                                      <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>

              {/* Claimed Fees Tab */}
              <TabsContent value="claims">
                <Card className="bg-[#12121a] border-[#1a1a1f]">
                  <div className="p-4 border-b border-[#1a1a1f] flex items-center justify-between">
                    <h2 className="font-semibold text-white flex items-center gap-2">
                      <Coins className="h-4 w-4 text-[#00d4aa]" />
                      Claimed Fees from Pools
                    </h2>
                    <Badge className="bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/30">
                      Total: {formatSOL(totalClaimed)} SOL
                    </Badge>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-[#1a1a1f]">
                          <th className="text-left p-3 font-medium">Token</th>
                          <th className="text-left p-3 font-medium">Creator Wallet</th>
                          <th className="text-right p-3 font-medium">Amount (SOL)</th>
                          <th className="text-right p-3 font-medium">Time</th>
                          <th className="text-center p-3 font-medium">TX</th>
                        </tr>
                      </thead>
                      <tbody>
                        {claimsLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i} className="border-b border-[#1a1a1f]">
                              <td className="p-3"><Skeleton className="h-4 w-24 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-20 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-16 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-16 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-12 bg-[#1a1a1f]" /></td>
                            </tr>
                          ))
                        ) : feeClaims.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-gray-500">
                              No fees claimed yet. Cron runs every 30 minutes.
                            </td>
                          </tr>
                        ) : (
                          feeClaims.map((claim) => (
                            <tr 
                              key={claim.id} 
                              className="border-b border-[#1a1a1f] hover:bg-[#1a1a1f]/50 transition-colors"
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {claim.fun_token?.image_url && (
                                    <img 
                                      src={claim.fun_token.image_url} 
                                      alt={claim.fun_token.name} 
                                      className="w-6 h-6 rounded-full"
                                    />
                                  )}
                                  <div>
                                    <div className="text-sm text-white">{claim.fun_token?.name || "Unknown"}</div>
                                    <div className="text-xs text-gray-400">${claim.fun_token?.ticker}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Wallet className="h-3 w-3 text-gray-400" />
                                  <span className="text-sm text-gray-300 font-mono">
                                    {shortenAddress(claim.fun_token?.creator_wallet || "")}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(claim.fun_token?.creator_wallet || "")}
                                    className="h-5 w-5 p-0 text-gray-500 hover:text-white"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <span className="text-sm text-[#00d4aa] font-semibold">
                                  +{formatSOL(Number(claim.claimed_sol))} SOL
                                </span>
                              </td>
                              <td className="p-3 text-right text-xs text-gray-400">
                                {formatDistanceToNow(new Date(claim.claimed_at), { addSuffix: true })}
                              </td>
                              <td className="p-3 text-center">
                                {claim.signature ? (
                                  <a
                                    href={`https://solscan.io/tx/${claim.signature}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#00d4aa] hover:underline text-xs flex items-center justify-center gap-1"
                                  >
                                    View <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-gray-500 text-xs">-</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>

              {/* Buybacks Tab - Coming Soon */}
              {/* This tab is hidden from the UI until buyback execution is implemented */}

              {/* Creator Fees Tab */}
              <TabsContent value="creator-fees">
                <Card className="bg-[#12121a] border-[#1a1a1f]">
                  <div className="p-4 border-b border-[#1a1a1f] flex items-center justify-between">
                    <h2 className="font-semibold text-white flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-[#00d4aa]" />
                      Creator Fee Distributions (50%)
                    </h2>
                    <Badge className="bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/30">
                      Total Paid: {formatSOL(totalCreatorPaid)} SOL
                    </Badge>
                  </div>

                  {/* Info Banner */}
                  <div className="p-4 bg-[#00d4aa]/5 border-b border-[#1a1a1f]">
                    <p className="text-xs text-gray-400">
                      50% of all claimed trading fees are automatically distributed to token creators every 5 minutes.
                      The wallet address entered during token launch receives the payments.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-[#1a1a1f]">
                          <th className="text-left p-3 font-medium">Token</th>
                          <th className="text-left p-3 font-medium">Creator Wallet</th>
                          <th className="text-right p-3 font-medium">Amount (SOL)</th>
                          <th className="text-center p-3 font-medium">Status</th>
                          <th className="text-right p-3 font-medium">Time</th>
                          <th className="text-center p-3 font-medium">TX</th>
                        </tr>
                      </thead>
                      <tbody>
                        {creatorDistributions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-gray-500">
                              No creator fees distributed yet. Distributions run every 5 minutes after fee claims.
                            </td>
                          </tr>
                        ) : (
                          creatorDistributions.map((dist) => (
                            <tr 
                              key={dist.id} 
                              className="border-b border-[#1a1a1f] hover:bg-[#1a1a1f]/50 transition-colors"
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {dist.fun_token?.image_url && (
                                    <img 
                                      src={dist.fun_token.image_url} 
                                      alt={dist.fun_token.name} 
                                      className="w-6 h-6 rounded-full"
                                    />
                                  )}
                                  <div>
                                    <div className="text-sm text-white">{dist.fun_token?.name || "Unknown"}</div>
                                    <div className="text-xs text-gray-400">${dist.fun_token?.ticker}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Wallet className="h-3 w-3 text-gray-400" />
                                  <span className="text-sm text-gray-300 font-mono">
                                    {shortenAddress(dist.creator_wallet)}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(dist.creator_wallet)}
                                    className="h-5 w-5 p-0 text-gray-500 hover:text-white"
                                  >
                                    {copiedAddress === dist.creator_wallet ? (
                                      <CheckCircle className="h-3 w-3 text-[#00d4aa]" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <span className="text-sm text-[#00d4aa] font-semibold">
                                  +{formatSOL(Number(dist.amount_sol))} SOL
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <Badge 
                                  className={
                                    dist.status === 'completed' 
                                      ? "bg-green-500/10 text-green-400 border-green-500/30" 
                                      : dist.status === 'pending'
                                      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                                      : "bg-red-500/10 text-red-400 border-red-500/30"
                                  }
                                >
                                  {dist.status}
                                </Badge>
                              </td>
                              <td className="p-3 text-right text-xs text-gray-400">
                                {formatDistanceToNow(new Date(dist.created_at), { addSuffix: true })}
                              </td>
                              <td className="p-3 text-center">
                                {dist.signature ? (
                                  <a
                                    href={`https://solscan.io/tx/${dist.signature}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#00d4aa] hover:underline text-xs flex items-center justify-center gap-1"
                                  >
                                    View <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-gray-500 text-xs">-</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Bottom Info */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#12121a] border-[#1a1a1f] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-[#00d4aa]" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">AI Generated</div>
                <div className="text-xs text-gray-400">Unique meme tokens</div>
              </div>
            </div>
          </Card>
          <Card className="bg-[#12121a] border-[#1a1a1f] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center">
                <Rocket className="h-5 w-5 text-[#00d4aa]" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Free Launch</div>
                <div className="text-xs text-gray-400">No fees to create</div>
              </div>
            </div>
          </Card>
          <Card className="bg-[#12121a] border-[#1a1a1f] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-[#00d4aa]" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">50% Revenue</div>
                <div className="text-xs text-gray-400">Trading fees to you</div>
              </div>
            </div>
          </Card>
          <Card className="bg-[#12121a] border-[#1a1a1f] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-[#00d4aa]" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">30min Payouts</div>
                <div className="text-xs text-gray-400">Automatic to wallet</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Launch Result Modal */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="bg-[#12121a] border-[#1a1a1f] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {launchResult?.success ? (
                <>
                  <PartyPopper className="h-5 w-5 text-[#00d4aa]" />
                  Token Launched!
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Launch Failed
                </>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {launchResult?.success ? "Your token has been launched successfully" : "Token launch failed"}
            </DialogDescription>
          </DialogHeader>

          {launchResult?.success ? (
            <div className="space-y-4">
              {/* Token Preview */}
              <div className="flex items-center gap-4 p-4 bg-[#0d0d0f] rounded-lg">
                {launchResult.imageUrl && (
                  <img 
                    src={launchResult.imageUrl} 
                    alt={launchResult.name} 
                    className="w-16 h-16 rounded-full object-cover border-2 border-[#00d4aa]"
                  />
                )}
                <div>
                  <h3 className="font-bold text-lg">{launchResult.name}</h3>
                  <span className="text-[#00d4aa] font-mono">${launchResult.ticker}</span>
                </div>
              </div>

              {/* Status */}
              <div className={`p-3 rounded-lg ${launchResult.onChainSuccess ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                <p className="text-sm">
                  {launchResult.message}
                </p>
              </div>

              {/* Contract Address */}
              {launchResult.mintAddress && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Contract Address (CA)</label>
                  <div className="flex items-center gap-2 p-3 bg-[#0d0d0f] rounded-lg">
                    <code className="flex-1 text-sm font-mono text-gray-300 break-all">
                      {launchResult.mintAddress}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(launchResult.mintAddress!)}
                      className="shrink-0"
                    >
                      {copiedAddress === launchResult.mintAddress ? (
                        <CheckCircle className="h-4 w-4 text-[#00d4aa]" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Links */}
              <div className="flex gap-2">
                {launchResult.solscanUrl && (
                  <Button
                    variant="outline"
                    className="flex-1 border-[#1a1a1f] hover:bg-[#1a1a1f]"
                    asChild
                  >
                    <a href={launchResult.solscanUrl} target="_blank" rel="noopener noreferrer">
                      View on Solscan
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                )}
                {launchResult.tradeUrl && (
                  <Button
                    className="flex-1 bg-[#00d4aa] hover:bg-[#00b894] text-black"
                    asChild
                  >
                    <a href={launchResult.tradeUrl} target="_blank" rel="noopener noreferrer">
                      Trade Now
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">
                  {launchResult?.error || "An unknown error occurred"}
                </p>
              </div>
              <Button
                onClick={() => setShowResultModal(false)}
                className="w-full bg-[#1a1a1f] hover:bg-[#252530]"
              >
                Try Again
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
