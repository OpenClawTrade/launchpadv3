import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ai69xLogo from "@/assets/ai69x-logo.png";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFunTokens } from "@/hooks/useFunTokens";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useFunFeeClaims, useFunFeeClaimsSummary, useFunDistributions, useFunBuybacks } from "@/hooks/useFunFeeData";
import { useFunTopPerformers } from "@/hooks/useFunTopPerformers";
import { MemeLoadingAnimation, MemeLoadingText } from "@/components/launchpad/MemeLoadingAnimation";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { SniperStatusPanel } from "@/components/admin/SniperStatusPanel";
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
  Key,
  Bot,
  Repeat,
  Infinity as InfinityIcon,
  Globe,
  Twitter,
  MessageCircle,
  MessageSquare,
  Trophy,
  Flame,
  Scale,
  BarChart2,
  Menu,
  X
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { SolPriceDisplay } from "@/components/layout/SolPriceDisplay";
import { Ai67xPriceDisplay } from "@/components/layout/Ai67xPriceDisplay";
import { TokenTickerBar } from "@/components/launchpad/TokenTickerBar";
import { Link } from "react-router-dom";

interface MemeToken {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
  narrative?: string;
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
  const { solPrice } = useSolPrice();
  const { tokens, isLoading: tokensLoading, lastUpdate, refetch } = useFunTokens();

  const [claimsPage, setClaimsPage] = useState(1);
  const claimsPageSize = 20;

  const [tokensPage, setTokensPage] = useState(1);
  const tokensPageSize = 20;

  const { data: claimsData, isLoading: claimsLoading } = useFunFeeClaims({
    page: claimsPage,
    pageSize: claimsPageSize,
  });
  const feeClaims = claimsData?.items ?? [];
  const claimsCount = claimsData?.count ?? 0;

  const { data: distributions = [] } = useFunDistributions();
  const { data: buybacks = [], isLoading: buybacksLoading } = useFunBuybacks();
  const { data: topPerformers = [], isLoading: topPerformersLoading } = useFunTopPerformers(10);
  const [generatorMode, setGeneratorMode] = useState<"random" | "custom">("random");
  const [meme, setMeme] = useState<MemeToken | null>(null);
  const [customToken, setCustomToken] = useState<MemeToken>({
    name: "",
    ticker: "",
    description: "",
    imageUrl: "",
    websiteUrl: "",
    twitterUrl: "",
    telegramUrl: "",
    discordUrl: "",
  });
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(null);

  const [walletAddress, setWalletAddress] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  
  // Admin check for sniper panel (uses walletAddress from input field)
  const { isAdmin } = useIsAdmin(walletAddress || null);

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

  const uploadCustomImageIfNeeded = useCallback(async (): Promise<string> => {
    if (!customImageFile) return customToken.imageUrl;

    const fileExt = customImageFile.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `token-images/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, customImageFile);
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
    return urlData.publicUrl;
  }, [customImageFile, customToken.imageUrl]);

  const performLaunch = useCallback(
    async (tokenToLaunch: MemeToken) => {
      if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
        toast({
          title: "Invalid wallet address",
          description: "Please enter a valid Solana wallet address",
          variant: "destructive",
        });
        return;
      }

      setIsLaunching(true);
      console.log("[FunLauncher] Starting token launch:", {
        name: tokenToLaunch.name,
        ticker: tokenToLaunch.ticker,
        wallet: walletAddress,
      });

      try {
        console.log("[FunLauncher] Calling fun-create...");
        const { data, error } = await supabase.functions.invoke("fun-create", {
          body: {
            name: tokenToLaunch.name,
            ticker: tokenToLaunch.ticker,
            description: tokenToLaunch.description,
            imageUrl: tokenToLaunch.imageUrl,
            websiteUrl: tokenToLaunch.websiteUrl,
            twitterUrl: tokenToLaunch.twitterUrl,
            telegramUrl: tokenToLaunch.telegramUrl,
            discordUrl: tokenToLaunch.discordUrl,
            creatorWallet: walletAddress,
          },
        });

        console.log("[FunLauncher] fun-create response:", { data, error });

        // Handle HTTP-level errors
        if (error) {
          console.error("[FunLauncher] fun-create HTTP error:", error);
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
          name: data.name || tokenToLaunch.name,
          ticker: data.ticker || tokenToLaunch.ticker,
          mintAddress: data.mintAddress,
          imageUrl: data.imageUrl || tokenToLaunch.imageUrl,
          onChainSuccess: data.onChainSuccess,
          solscanUrl: data.solscanUrl,
          tradeUrl: data.tradeUrl,
          message: data.message,
        });
        setShowResultModal(true);

        toast({
          title: "🚀 Token Launched!",
          description: `${data.name || tokenToLaunch.name} is now live on Solana!`,
        });

        // Clear form
        setMeme(null);
        setCustomToken({
          name: "",
          ticker: "",
          description: "",
          imageUrl: "",
          websiteUrl: "",
          twitterUrl: "",
          telegramUrl: "",
          discordUrl: "",
        });
        setCustomImageFile(null);
        setCustomImagePreview(null);
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
    },
    [isValidSolanaAddress, refetch, toast, walletAddress]
  );

  const handleLaunch = useCallback(async () => {
    if (!meme) {
      toast({
        title: "No meme to launch",
        description: "Click Randomize first to generate a meme token",
        variant: "destructive",
      });
      return;
    }

    await performLaunch(meme);
  }, [meme, performLaunch, toast]);

  const handleCustomImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Image too large", description: "Max 5MB allowed", variant: "destructive" });
        return;
      }

      setCustomImageFile(file);
      setCustomImagePreview(URL.createObjectURL(file));
    },
    [toast]
  );

  const handleCustomLaunch = useCallback(async () => {
    if (!customToken.name.trim() || !customToken.ticker.trim()) {
      toast({
        title: "Missing token info",
        description: "Name and ticker are required",
        variant: "destructive",
      });
      return;
    }

    // Require image for custom launches
    if (!customImageFile && !customToken.imageUrl.trim()) {
      toast({
        title: "Image required",
        description: "Please upload an image for your token",
        variant: "destructive",
      });
      return;
    }

    try {
      const imageUrl = await uploadCustomImageIfNeeded();
      await performLaunch({
        ...customToken,
        name: customToken.name.slice(0, 20),
        ticker: customToken.ticker.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
        imageUrl,
      });
    } catch (e) {
      console.error('[FunLauncher] Custom launch error:', e);
      toast({
        title: 'Custom launch failed',
        description: e instanceof Error ? e.message : 'Failed to launch custom token',
        variant: 'destructive',
      });
    }
  }, [customToken, performLaunch, toast, uploadCustomImageIfNeeded]);

  const formatSOL = (sol: number) => {
    if (!Number.isFinite(sol)) return "0";
    if (sol >= 1000) return `${(sol / 1000).toFixed(1)}K`;
    if (sol >= 1) return sol.toFixed(2);
    // Prevent misleading "0.000000" for very small prices
    if (sol > 0 && sol < 0.000001) return sol.toExponential(2);
    if (sol > 0 && sol < 0.01) return sol.toFixed(8);
    return sol.toFixed(6);
  };

  const formatUsd = (marketCapSol: number) => {
    const usdValue = Number(marketCapSol || 0) * Number(solPrice || 0);
    if (!Number.isFinite(usdValue) || usdValue <= 0) return "$0";
    if (usdValue >= 1_000_000) return `$${(usdValue / 1_000_000).toFixed(2)}M`;
    if (usdValue >= 1_000) return `$${(usdValue / 1_000).toFixed(1)}K`;
    return `$${usdValue.toFixed(0)}`;
  };

  // Calculate totals - use summary for global totals, not paginated data
  const { data: claimsSummary } = useFunFeeClaimsSummary();
  const totalClaimed = claimsSummary?.totalClaimedSol ?? 0;
  const totalBuybacks = buybacks.reduce((sum, b) => sum + Number(b.amount_sol || 0), 0);
  const creatorDistributions = distributions.filter(d => d.distribution_type === 'creator');
  const totalCreatorPaid = creatorDistributions.reduce((sum, d) => sum + Number(d.amount_sol || 0), 0);

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white overflow-x-hidden">
      {/* Token Ticker Bar - bags.fm style */}
      <TokenTickerBar />
      
      {/* Header Bar */}
      <header className="border-b border-[#1a1a1f] bg-[#0d0d0f]/95 backdrop-blur sticky top-0 z-50 w-full">
        {/* Mobile: Two-line header */}
        <div className="sm:hidden">
          {/* Line 1: Logo + Burger */}
          <div className="flex items-center justify-between px-3 h-12 border-b border-[#1a1a1f]">
            <Link to="/" className="flex items-center gap-2">
              <img src={ai69xLogo} alt="ai69x" className="h-7 w-7 rounded-full" />
              <span className="text-base font-bold">ai67x</span>
            </Link>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => refetch()}
                className="text-gray-400 hover:text-white h-8 w-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 bg-[#0d0d0f] border-[#1a1a1f] p-0">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-3 p-4 border-b border-[#1a1a1f]">
                      <img src={ai69xLogo} alt="ai69x" className="h-8 w-8 rounded-full" />
                      <span className="text-lg font-bold text-white">ai67x</span>
                    </div>
                    
                    <nav className="flex-1 p-4 space-y-2">
                      <Link to="/trending" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#12121a] hover:bg-[#1a1a1f] transition-colors">
                        <TrendingUp className="h-5 w-5 text-green-400" />
                        <span className="text-white font-medium">Narratives</span>
                      </Link>
                      
                      <Link to="/api" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#12121a] hover:bg-[#1a1a1f] transition-colors">
                        <Key className="h-5 w-5 text-purple-400" />
                        <span className="text-white font-medium">API</span>
                      </Link>
                      
                      <Link to="/governance" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#12121a] hover:bg-[#1a1a1f] transition-colors">
                        <Scale className="h-5 w-5 text-cyan-400" />
                        <span className="text-white font-medium">Governance</span>
                      </Link>
                      
                      <div className="pt-4 border-t border-[#1a1a1f] space-y-2">
                        <a 
                          href="https://dune.com/ai67xlaunch/stats" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#1a1a1f] transition-colors"
                        >
                          <BarChart2 className="h-5 w-5 text-orange-400" />
                          <span className="text-gray-300">Analytics (Dune)</span>
                          <ExternalLink className="h-3 w-3 text-gray-500 ml-auto" />
                        </a>
                        
                        <a 
                          href="https://x.com/ai67x_fun" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#1a1a1f] transition-colors"
                        >
                          <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-400 fill-current">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                          <span className="text-gray-300">Follow on X</span>
                          <ExternalLink className="h-3 w-3 text-gray-500 ml-auto" />
                        </a>
                      </div>
                    </nav>
                    
                    <div className="p-4 border-t border-[#1a1a1f]">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3.5 w-3.5" />
                        Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          
          {/* Line 2: Prices */}
          <div className="flex items-center justify-center gap-3 px-3 h-10 bg-[#0a0a0c]">
            <Ai67xPriceDisplay />
            <SolPriceDisplay />
          </div>
        </div>
        
        {/* Desktop: Single-line header */}
        <div className="hidden sm:flex w-full max-w-7xl mx-auto px-4 h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={ai69xLogo} alt="ai69x" className="h-8 w-8 rounded-full" />
            <span className="text-lg font-bold">ai67x</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Ai67xPriceDisplay />
              <SolPriceDisplay />
            </div>
            
            <a 
              href="https://dune.com/ai67xlaunch/stats" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-orange-500/10 transition-colors"
              title="View Analytics on Dune"
            >
              <BarChart2 className="h-4 w-4 text-orange-400 hover:text-orange-300" />
            </a>
            
            <a 
              href="https://x.com/ai67x_fun" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/10 transition-colors"
              title="Follow us on X"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-400 hover:text-white fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            
            <Link to="/trending">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-8 px-3"
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Narratives
              </Button>
            </Link>
            
            <Link to="/api">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-8 px-3"
              >
                <Key className="h-4 w-4 mr-1" />
                API
              </Button>
            </Link>
            
            <Link to="/governance">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 h-8 px-3"
              >
                <Scale className="h-4 w-4 mr-1" />
                Governance
              </Button>
            </Link>
            
            <span className="hidden lg:flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
            </span>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetch()}
              className="text-gray-400 hover:text-white h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Intro Section */}
      <section className="border-b border-[#1a1a1f] bg-gradient-to-b from-[#0d0d0f] to-[#12121a] w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 md:py-14">
          <div className="max-w-3xl mx-auto text-center">
            
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3 leading-tight px-2">
              Autonomous Token Launchpad
            </h1>
            
            <p className="text-gray-400 text-xs sm:text-sm md:text-base mb-4 sm:mb-6 leading-relaxed max-w-2xl mx-auto px-4">
              ai67x leverages neural network inference and on-chain automation to orchestrate the entire token lifecycle. 
              Zero wallet connections. Zero manual configurations.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 sm:mb-6 px-2">
              <div className="bg-[#12121a] border border-[#1a1a1f] rounded-xl p-4">
                <div className="w-9 h-9 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center mx-auto mb-2">
                  <Zap className="h-4 w-4 text-[#00d4aa]" />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">One-Click Launch</h3>
                <p className="text-xs text-gray-500">Generate AI memes and deploy tokens instantly</p>
              </div>
              
              <div className="bg-[#12121a] border border-[#1a1a1f] rounded-xl p-4">
                <div className="w-9 h-9 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="h-4 w-4 text-[#00d4aa]" />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">50% Lifetime Fees</h3>
                <p className="text-xs text-gray-500">Creators receive half of all trading fees</p>
              </div>
              
              <div className="bg-[#12121a] border border-[#1a1a1f] rounded-xl p-4">
                <div className="w-9 h-9 rounded-lg bg-[#00d4aa]/10 flex items-center justify-center mx-auto mb-2">
                  <RefreshCw className="h-4 w-4 text-[#00d4aa]" />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">30% Buybacks</h3>
                <p className="text-xs text-gray-500">Fees dedicated to native token buybacks</p>
              </div>
            </div>

            <p className="hidden sm:block text-xs text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Every token launched through ai67x operates with a unique mechanism designed to pioneer a new narrative in decentralized finance. 
              The system is fully automated with no developer interaction required.
            </p>
          </div>
        </div>
      </section>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Panel - Token Generator */}
          <div className="lg:col-span-1 space-y-3 sm:space-y-4">
            {/* Generator Card */}
            <Card className="bg-[#12121a] border-[#1a1a1f] p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#00d4aa]" />
                  {generatorMode === "random" ? "AI Meme Generator" : "Custom Token"}
                </h2>

                {/* Mode Switcher */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setGeneratorMode("random")}
                    className={
                      generatorMode === "random"
                        ? "h-7 px-2 border-[#00d4aa]/40 text-[#00d4aa] bg-[#00d4aa]/10"
                        : "h-7 px-2 border-[#2a2a35] text-gray-300 bg-transparent"
                    }
                  >
                    Randomizer
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setGeneratorMode("custom")}
                    className={
                      generatorMode === "custom"
                        ? "h-7 px-2 border-[#00d4aa]/40 text-[#00d4aa] bg-[#00d4aa]/10"
                        : "h-7 px-2 border-[#2a2a35] text-gray-300 bg-transparent"
                    }
                  >
                    Custom
                  </Button>
                </div>
              </div>

              {generatorMode === "random" ? (
                <>
                  {/* Preview */}
                  <div className="bg-[#0d0d0f] rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-[#1a1a1f] flex-shrink-0 border-2 border-[#1a1a1f]">
                        {isGenerating ? (
                          <MemeLoadingAnimation />
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
                          <MemeLoadingText />
                        ) : meme ? (
                          <div className="space-y-2">
                            <Input
                              value={meme.name}
                              onChange={(e) => setMeme({ ...meme, name: e.target.value.slice(0, 20) })}
                              className="bg-[#1a1a1f] border-[#2a2a35] text-white font-bold text-sm h-8 px-2"
                              placeholder="Token name"
                              maxLength={20}
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-[#00d4aa] text-sm">$</span>
                              <Input
                                value={meme.ticker}
                                onChange={(e) =>
                                  setMeme({
                                    ...meme,
                                    ticker: e.target.value
                                      .toUpperCase()
                                      .replace(/[^A-Z0-9]/g, "")
                                      .slice(0, 6),
                                  })
                                }
                                className="bg-[#1a1a1f] border-[#2a2a35] text-[#00d4aa] font-mono text-sm h-7 px-2 w-20"
                                placeholder="TICKER"
                                maxLength={6}
                              />
                            </div>
                            <Textarea
                              value={meme.description}
                              onChange={(e) => setMeme({ ...meme, description: e.target.value.slice(0, 280) })}
                              className="bg-[#1a1a1f] border-[#2a2a35] text-gray-300 text-xs min-h-[60px] resize-none"
                              placeholder="Description"
                              maxLength={280}
                            />
                            
                            {/* Social Links - Collapsible */}
                            <details className="group">
                              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                Edit Socials (optional)
                              </summary>
                              <div className="mt-2 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Globe className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                  <Input
                                    value={meme.websiteUrl || ""}
                                    onChange={(e) => setMeme({ ...meme, websiteUrl: e.target.value })}
                                    className="bg-[#1a1a1f] border-[#2a2a35] text-gray-300 text-xs h-7 px-2"
                                    placeholder="Website URL"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Twitter className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                  <Input
                                    value={meme.twitterUrl || ""}
                                    onChange={(e) => setMeme({ ...meme, twitterUrl: e.target.value })}
                                    className="bg-[#1a1a1f] border-[#2a2a35] text-gray-300 text-xs h-7 px-2"
                                    placeholder="Twitter URL"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <MessageCircle className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                  <Input
                                    value={meme.telegramUrl || ""}
                                    onChange={(e) => setMeme({ ...meme, telegramUrl: e.target.value })}
                                    className="bg-[#1a1a1f] border-[#2a2a35] text-gray-300 text-xs h-7 px-2"
                                    placeholder="Telegram URL"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                  <Input
                                    value={meme.discordUrl || ""}
                                    onChange={(e) => setMeme({ ...meme, discordUrl: e.target.value })}
                                    className="bg-[#1a1a1f] border-[#2a2a35] text-gray-300 text-xs h-7 px-2"
                                    placeholder="Discord URL"
                                  />
                                </div>
                              </div>
                            </details>
                          </div>
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
                      <>
                        <Shuffle className="h-4 w-4 mr-2 animate-spin" /> Generating your next gem...
                      </>
                    ) : (
                      <>
                        <Shuffle className="h-4 w-4 mr-2" /> Randomize
                      </>
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
                      <p className="text-xs text-gray-500">Receive 50% of trading fees every few min</p>
                      <Button
                        onClick={handleLaunch}
                        disabled={isLaunching || !walletAddress}
                        className="w-full bg-[#00d4aa] hover:bg-[#00b894] text-black font-semibold"
                      >
                        {isLaunching ? (
                          <>
                            <Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4 mr-2" /> Launch Token
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Custom Form */}
                  <div className="bg-[#0d0d0f] rounded-lg p-4 mb-4 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-[#1a1a1f] flex-shrink-0 border-2 border-[#1a1a1f]">
                        {customImagePreview || customToken.imageUrl ? (
                          <img
                            src={customImagePreview || customToken.imageUrl}
                            alt={customToken.name || "Custom token"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Bot className="h-8 w-8 text-gray-600" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <Input
                          value={customToken.name}
                          onChange={(e) => setCustomToken({ ...customToken, name: e.target.value.slice(0, 20) })}
                          className="bg-[#1a1a1f] border-[#2a2a35] text-white font-bold text-sm h-8 px-2"
                          placeholder="Token name"
                          maxLength={20}
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-[#00d4aa] text-sm">$</span>
                          <Input
                            value={customToken.ticker}
                            onChange={(e) =>
                              setCustomToken({
                                ...customToken,
                                ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
                              })
                            }
                            className="bg-[#1a1a1f] border-[#2a2a35] text-[#00d4aa] font-mono text-sm h-7 px-2 w-28"
                            placeholder="TICKER"
                            maxLength={10}
                          />
                        </div>
                      </div>
                    </div>

                    <Textarea
                      value={customToken.description}
                      onChange={(e) => setCustomToken({ ...customToken, description: e.target.value })}
                      placeholder="Description"
                      className="bg-[#1a1a1f] border-[#2a2a35] text-white text-sm min-h-[80px]"
                    />

                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomImageChange}
                      className="bg-[#1a1a1f] border-[#2a2a35] text-white text-sm"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={customToken.websiteUrl || ""}
                        onChange={(e) => setCustomToken({ ...customToken, websiteUrl: e.target.value })}
                        className="bg-[#1a1a1f] border-[#2a2a35] text-white text-sm"
                        placeholder="Website URL"
                      />
                      <Input
                        value={customToken.twitterUrl || ""}
                        onChange={(e) => setCustomToken({ ...customToken, twitterUrl: e.target.value })}
                        className="bg-[#1a1a1f] border-[#2a2a35] text-white text-sm"
                        placeholder="X / Twitter URL"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={customToken.telegramUrl || ""}
                        onChange={(e) => setCustomToken({ ...customToken, telegramUrl: e.target.value })}
                        className="bg-[#1a1a1f] border-[#2a2a35] text-white text-sm"
                        placeholder="Telegram URL"
                      />
                      <Input
                        value={customToken.discordUrl || ""}
                        onChange={(e) => setCustomToken({ ...customToken, discordUrl: e.target.value })}
                        className="bg-[#1a1a1f] border-[#2a2a35] text-white text-sm"
                        placeholder="Discord URL"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-[#1a1a1f]">
                    <Input
                      placeholder="Your SOL wallet address..."
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      className="bg-[#0d0d0f] border-[#1a1a1f] text-white placeholder:text-gray-500 font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500">Receive 50% of trading fees every few min</p>
                    <Button
                      onClick={handleCustomLaunch}
                      disabled={isLaunching || !walletAddress || !customToken.name.trim() || !customToken.ticker.trim()}
                      className="w-full bg-[#00d4aa] hover:bg-[#00b894] text-black font-semibold"
                    >
                      {isLaunching ? (
                        <>
                          <Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...
                        </>
                      ) : (
                        <>
                          <Rocket className="h-4 w-4 mr-2" /> Launch Token
                        </>
                      )}
                    </Button>
                  </div>
                </>
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

            {/* Admin-only Sniper Status Panel */}
            {isAdmin && <SniperStatusPanel />}
          </div>

          {/* Right Panel - Tabbed Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="tokens" className="w-full">
              <TabsList className="w-full bg-[#12121a] border border-[#1a1a1f] p-1 mb-4 grid grid-cols-5">
                <TabsTrigger 
                  value="tokens" 
                  className="data-[state=active]:bg-[#1a1a1f] data-[state=active]:text-white text-gray-400 text-xs sm:text-sm"
                >
                  <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Tokens</span> ({tokens.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="top" 
                  className="data-[state=active]:bg-[#1a1a1f] data-[state=active]:text-[#00d4aa] text-gray-400 text-xs sm:text-sm"
                >
                  <Trophy className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Top</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="claims" 
                  className="data-[state=active]:bg-[#1a1a1f] data-[state=active]:text-white text-gray-400 text-xs sm:text-sm"
                >
                  <Coins className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Claimed</span> ({claimsCount})
                </TabsTrigger>
                <TabsTrigger 
                  value="buybacks" 
                  className="data-[state=active]:bg-[#1a1a1f] data-[state=active]:text-white text-gray-400 text-xs sm:text-sm"
                >
                  <Repeat className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Buybacks</span> ({buybacks.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="creator-fees" 
                  className="data-[state=active]:bg-[#1a1a1f] data-[state=active]:text-white text-gray-400 text-xs sm:text-sm"
                >
                  <Wallet className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Creators</span> ({creatorDistributions.length})
                </TabsTrigger>
              </TabsList>

              {/* Tokens Tab */}
              <TabsContent value="tokens">
                <Card className="bg-[#12121a] border-[#1a1a1f]">
                  <div className="p-3 sm:p-4 border-b border-[#1a1a1f] flex items-center justify-between">
                    <h2 className="font-semibold text-white flex items-center gap-2 text-sm sm:text-base">
                      <BarChart3 className="h-4 w-4 text-[#00d4aa]" />
                      Live Tokens
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-[#00d4aa] rounded-full animate-pulse" />
                      <span className="text-xs text-gray-400">Real-time</span>
                    </div>
                  </div>

                  {/* Mobile: Card Layout */}
                  <div className="sm:hidden divide-y divide-[#1a1a1f]">
                    {tokensLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="p-3 space-y-2">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full bg-[#1a1a1f]" />
                            <div className="flex-1">
                              <Skeleton className="h-4 w-24 bg-[#1a1a1f] mb-1" />
                              <Skeleton className="h-3 w-16 bg-[#1a1a1f]" />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : tokens.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">
                        No tokens launched yet. Be the first!
                      </div>
                    ) : (
                      tokens
                        .slice((tokensPage - 1) * 10, tokensPage * 10)
                        .map((token, index) => (
                        <div key={token.id} className="p-3">
                          <div className="flex items-center gap-3">
                            {/* Token image & info */}
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1a1a1f] flex-shrink-0">
                              {token.image_url ? (
                                <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs font-bold">
                                  {token.ticker?.slice(0, 2)}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white text-sm truncate">{token.name}</span>
                                <span className="text-xs text-gray-500 font-mono">${token.ticker}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                <span className="text-white font-medium">{formatUsd(token.market_cap_sol || 0)}</span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {token.holder_count || 0}
                                </span>
                                <span>{(token.bonding_progress || 0).toFixed(1)}%</span>
                              </div>
                            </div>
                            
                            {/* Trade button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="h-8 px-2 text-xs text-[#00d4aa] hover:bg-[#00d4aa]/10 flex-shrink-0"
                            >
                              <a 
                                href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Trade
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Desktop: Table Layout */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-[#1a1a1f]">
                          <th className="text-left p-3 font-medium">#</th>
                          <th className="text-left p-3 font-medium">Token</th>
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
                              <td className="p-3"><Skeleton className="h-4 w-12 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-20 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-4 w-12 bg-[#1a1a1f]" /></td>
                              <td className="p-3"><Skeleton className="h-6 w-16 bg-[#1a1a1f]" /></td>
                            </tr>
                          ))
                        ) : tokens.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-gray-500">
                              No tokens launched yet. Be the first!
                            </td>
                          </tr>
                        ) : (
                          tokens
                            .slice((tokensPage - 1) * tokensPageSize, tokensPage * tokensPageSize)
                            .map((token, index) => (
                            <tr 
                              key={token.id} 
                              className="border-b border-[#1a1a1f] hover:bg-[#1a1a1f]/50 transition-colors"
                            >
                              <td className="p-3 text-sm text-gray-400">{(tokensPage - 1) * tokensPageSize + index + 1}</td>
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
                                <span className="text-sm text-white">
                                  {formatUsd(token.market_cap_sol || 0)}
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
                                      href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}`}
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

                  {/* Tokens Pagination */}
                  {tokens.length > tokensPageSize && (
                    <div className="p-4 border-t border-[#1a1a1f] flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        Showing {(tokensPage - 1) * tokensPageSize + 1}-{Math.min(tokensPage * tokensPageSize, tokens.length)} of {tokens.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={tokensPage === 1}
                          onClick={() => setTokensPage(p => p - 1)}
                          className="h-7 px-2 text-xs bg-[#1a1a1f] border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35] disabled:opacity-50"
                        >
                          Previous
                        </Button>
                        <span className="text-xs text-gray-400">
                          Page {tokensPage} of {Math.ceil(tokens.length / tokensPageSize)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={tokensPage >= Math.ceil(tokens.length / tokensPageSize)}
                          onClick={() => setTokensPage(p => p + 1)}
                          className="h-7 px-2 text-xs bg-[#1a1a1f] border-[#2a2a35] text-gray-300 hover:bg-[#2a2a35] disabled:opacity-50"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Top Performers Tab */}
              <TabsContent value="top">
                <Card className="bg-[#12121a] border-[#1a1a1f]">
                  <div className="p-4 border-b border-[#1a1a1f] flex items-center justify-between">
                    <h2 className="font-semibold text-white flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-[#00d4aa]" />
                      Top Earners (24h)
                    </h2>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
                      <span>Updates every 5min</span>
                    </div>
                  </div>

                  <div className="divide-y divide-[#1a1a1f]">
                    {topPerformersLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-4">
                          <Skeleton className="w-8 h-8 rounded-full bg-[#1a1a1f]" />
                          <Skeleton className="w-10 h-10 rounded-lg bg-[#1a1a1f]" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-24 bg-[#1a1a1f]" />
                            <Skeleton className="h-3 w-16 bg-[#1a1a1f]" />
                          </div>
                          <Skeleton className="h-5 w-20 bg-[#1a1a1f]" />
                        </div>
                      ))
                    ) : topPerformers.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <Trophy className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                        <p className="font-medium">No fees claimed today</p>
                        <p className="text-sm mt-1">Tokens that generate trading fees will appear here</p>
                      </div>
                    ) : (
                      topPerformers.map((token, index) => {
                        const rank = index + 1;
                        const isTopThree = rank <= 3;
                        return (
                          <a
                            key={token.id}
                            href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-3 p-4 hover:bg-[#1a1a1f]/50 transition-colors ${isTopThree ? 'bg-[#00d4aa]/5' : ''}`}
                          >
                            {/* Rank Badge */}
                            {rank === 1 ? (
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-black font-bold text-sm shadow-lg shadow-yellow-500/30">
                                🥇
                              </div>
                            ) : rank === 2 ? (
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 text-black font-bold text-sm">
                                🥈
                              </div>
                            ) : rank === 3 ? (
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 text-white font-bold text-sm">
                                🥉
                              </div>
                            ) : (
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1a1a1f] text-gray-400 font-bold text-sm">
                                #{rank}
                              </div>
                            )}

                            {/* Token Image */}
                            <div className="relative">
                              {token.image_url ? (
                                <img
                                  src={token.image_url}
                                  alt={token.name}
                                  className="w-10 h-10 rounded-lg object-cover border border-[#2a2a35]"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-[#1a1a1f] flex items-center justify-center">
                                  <Coins className="w-5 h-5 text-gray-600" />
                                </div>
                              )}
                              {isTopThree && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#00d4aa] rounded-full flex items-center justify-center">
                                  <Flame className="w-2.5 h-2.5 text-black" />
                                </div>
                              )}
                            </div>

                            {/* Token Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white truncate">{token.name}</span>
                                <span className="text-xs text-gray-500">${token.ticker}</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {token.claim_count} claim{token.claim_count !== 1 ? 's' : ''}
                              </div>
                            </div>

                            {/* Fees */}
                            <div className="text-right">
                              <div className={`font-bold text-sm ${isTopThree ? 'text-[#00d4aa]' : 'text-green-500'}`}>
                                +{token.total_fees_24h.toFixed(4)} SOL
                              </div>
                              <div className="flex items-center justify-end gap-1 text-xs text-gray-500">
                                <TrendingUp className="w-3 h-3" />
                                <span>24h fees</span>
                              </div>
                            </div>
                          </a>
                        );
                      })
                    )}
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
                              No fees claimed yet. Cron runs every few minutes.
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

                  {/* Pagination */}
                  {claimsCount > claimsPageSize && (
                    <div className="p-3 border-t border-[#1a1a1f] flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        Page {claimsPage} / {Math.max(1, Math.ceil(claimsCount / claimsPageSize))} • {claimsCount} total
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-gray-300 hover:text-white"
                          disabled={claimsPage <= 1}
                          onClick={() => setClaimsPage((p) => Math.max(1, p - 1))}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-gray-300 hover:text-white"
                          disabled={claimsPage >= Math.ceil(claimsCount / claimsPageSize)}
                          onClick={() => setClaimsPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Buybacks Tab */}
              <TabsContent value="buybacks">
                <Card className="bg-[#12121a] border-[#1a1a1f]">
                  <div className="p-4 border-b border-[#1a1a1f] flex items-center justify-between">
                    <h2 className="font-semibold text-white flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-blue-400" />
                      Automated Buybacks (30%)
                    </h2>
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      Total: {formatSOL(totalBuybacks)} SOL
                    </Badge>
                  </div>

                  {/* Info Banner */}
                  <div className="p-4 bg-blue-500/5 border-b border-[#1a1a1f]">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <InfinityIcon className="h-4 w-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium mb-1">Forever Buybacks</p>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          Buybacks are automated and will continue forever. The more launches, the higher volume for every token launched through our AI launchpad, the higher the buybacks.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Buyback Stats */}
                  <div className="grid grid-cols-3 gap-4 p-4 border-b border-[#1a1a1f]">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-400">{buybacks.length}</div>
                      <div className="text-xs text-gray-500">Total Buybacks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#00d4aa]">{formatSOL(totalBuybacks)}</div>
                      <div className="text-xs text-gray-500">SOL Spent</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">30%</div>
                      <div className="text-xs text-gray-500">Of Fees</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-[#1a1a1f]">
                          <th className="text-left p-3 font-medium">Token</th>
                          <th className="text-right p-3 font-medium">SOL Spent</th>
                          <th className="text-right p-3 font-medium">Tokens Bought</th>
                          <th className="text-center p-3 font-medium">Status</th>
                          <th className="text-right p-3 font-medium">Time</th>
                          <th className="text-center p-3 font-medium">TX</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buybacks.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center">
                              <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                                  <Repeat className="h-6 w-6 text-blue-400" />
                                </div>
                                <div>
                                  <p className="text-gray-400 text-sm font-medium">Buybacks Coming Soon</p>
                                  <p className="text-gray-500 text-xs mt-1">Automated buybacks will execute as fees accumulate.</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          buybacks.map((buyback) => (
                            <tr 
                              key={buyback.id} 
                              className="border-b border-[#1a1a1f] hover:bg-[#1a1a1f]/50 transition-colors"
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {buyback.fun_token?.image_url && (
                                    <img 
                                      src={buyback.fun_token.image_url} 
                                      alt={buyback.fun_token.name} 
                                      className="w-6 h-6 rounded-full"
                                    />
                                  )}
                                  <div>
                                    <div className="font-medium text-white text-sm">{buyback.fun_token?.name || "Unknown"}</div>
                                    <div className="text-xs text-gray-500">${buyback.fun_token?.ticker || "???"}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <span className="text-sm text-blue-400 font-semibold">
                                  {formatSOL(Number(buyback.amount_sol))} SOL
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <span className="text-sm text-[#00d4aa]">
                                  {buyback.tokens_bought ? Number(buyback.tokens_bought).toLocaleString() : "-"}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <Badge 
                                  className={
                                    buyback.status === "completed" 
                                      ? "bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/30"
                                      : buyback.status === "failed"
                                      ? "bg-red-500/10 text-red-400 border-red-500/30"
                                      : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                                  }
                                >
                                  {buyback.status}
                                </Badge>
                              </td>
                              <td className="p-3 text-right text-xs text-gray-400">
                                {formatDistanceToNow(new Date(buyback.created_at), { addSuffix: true })}
                              </td>
                              <td className="p-3 text-center">
                                {buyback.signature ? (
                                  <a
                                    href={`https://solscan.io/tx/${buyback.signature}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline text-xs flex items-center justify-center gap-1"
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
                <div className="text-sm font-medium text-white">Instant Payouts</div>
                <div className="text-xs text-gray-400">Every minute to wallet</div>
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

              {/* Kickstart Note */}
              <div className="p-3 bg-[#00d4aa]/10 border border-[#00d4aa]/30 rounded-lg">
                <p className="text-sm text-[#00d4aa] font-bold">
                  💡 In order to kickstart the token, make a small purchase, cause there is no dev buy and your initial holdings are 0% supply, you receive just fees from swaps. This will help to generate more fees on your launches if you do initial buy.
                </p>
              </div>

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
