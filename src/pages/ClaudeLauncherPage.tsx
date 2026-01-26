import { useState, useCallback, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  X,
  Image,
  Download,
  Pencil
} from "lucide-react";
import { useBannerGenerator } from "@/hooks/useBannerGenerator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { SolPriceDisplay } from "@/components/layout/SolPriceDisplay";
import { Ai67xPriceDisplay } from "@/components/layout/Ai67xPriceDisplay";
import { TokenTickerBar } from "@/components/launchpad/TokenTickerBar";
import { Link } from "react-router-dom";
import { usePhantomWallet } from "@/hooks/usePhantomWallet";
import { Transaction, Connection, VersionedTransaction } from "@solana/web3.js";
import "@/styles/claude-theme.css";

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

// Claude-styled components
const ClaudeCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-[#1a1714] border border-[#2a2520] rounded-2xl ${className}`}>
    {children}
  </div>
);

const ClaudeButton = ({ 
  children, 
  variant = "primary", 
  className = "", 
  ...props 
}: { 
  children: React.ReactNode; 
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  [key: string]: any;
}) => {
  const baseClasses = "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200";
  const variantClasses = {
    primary: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-[#0d0b0a] shadow-lg shadow-amber-500/20",
    secondary: "bg-[#252119] hover:bg-[#2a2520] text-white border border-[#3a352e]",
    ghost: "bg-transparent hover:bg-amber-500/10 text-amber-500"
  };
  
  return (
    <Button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </Button>
  );
};

export default function ClaudeLauncherPage() {
  const { toast } = useToast();
  const { solPrice } = useSolPrice();
  const isMobile = useIsMobile();
  const { tokens, isLoading: tokensLoading, lastUpdate, refetch } = useFunTokens();

  const [claimsPage, setClaimsPage] = useState(1);
  const claimsPageSize = 20;

  const [tokensPage, setTokensPage] = useState(1);
  const tokensPageSize = 20;

  const [creatorFeesPage, setCreatorFeesPage] = useState(1);
  const creatorFeesPageSize = 20;

  const { data: claimsData, isLoading: claimsLoading } = useFunFeeClaims({
    page: claimsPage,
    pageSize: claimsPageSize,
  });
  const feeClaims = claimsData?.items ?? [];
  const claimsCount = claimsData?.count ?? 0;

  const { data: distributions = [] } = useFunDistributions();
  const { data: buybacks = [], isLoading: buybacksLoading } = useFunBuybacks();
  const { data: topPerformers = [], isLoading: topPerformersLoading } = useFunTopPerformers(10);
  const [generatorMode, setGeneratorMode] = useState<"random" | "custom" | "describe" | "phantom">("random");
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
  const [describePrompt, setDescribePrompt] = useState("");
  const [describedToken, setDescribedToken] = useState<MemeToken | null>(null);
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(null);

  const [walletAddress, setWalletAddress] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  
  const { isAdmin } = useIsAdmin(walletAddress || null);
  
  const phantomWallet = usePhantomWallet();
  const [isPhantomLaunching, setIsPhantomLaunching] = useState(false);
  const [phantomToken, setPhantomToken] = useState<MemeToken>({
    name: "",
    ticker: "",
    description: "",
    imageUrl: "",
    websiteUrl: "",
    twitterUrl: "",
    telegramUrl: "",
    discordUrl: "",
  });
  const [phantomImageFile, setPhantomImageFile] = useState<File | null>(null);
  const [phantomImagePreview, setPhantomImagePreview] = useState<string | null>(null);
  const [phantomMeme, setPhantomMeme] = useState<MemeToken | null>(null);
  const [isPhantomGenerating, setIsPhantomGenerating] = useState(false);
  
  const { 
    generateBanner, 
    downloadBanner, 
    clearBanner, 
    isGenerating: isBannerGenerating, 
    bannerUrl 
  } = useBannerGenerator();
  
  const [bannerTextName, setBannerTextName] = useState("");
  const [bannerTextTicker, setBannerTextTicker] = useState("");
  const [isEditingBannerText, setIsEditingBannerText] = useState(false);
  const [bannerImageUrl, setBannerImageUrl] = useState("");

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
    setIsGenerating(true);
    setMeme(null);
    clearBanner();
    
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", {
        body: {}
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || "Generation failed on server");
      }

      if (data?.meme) {
        setMeme(data.meme);
        toast({
          title: "Token Generated! 🎲",
          description: `${data.meme.name} ($${data.meme.ticker}) is ready!`,
        });
      } else {
        throw new Error("No meme data returned from server");
      }
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate meme",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [toast, clearBanner]);

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

      try {
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

        if (error) {
          throw new Error(`Server error: ${error.message || error.toString()}`);
        }

        if (!data?.success) {
          throw new Error(data?.error || "Launch failed - no details provided");
        }

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

        setMeme(null);
        clearBanner();
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

        refetch();
      } catch (error) {
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
    [isValidSolanaAddress, refetch, toast, walletAddress, clearBanner]
  );

  const handleLaunch = useCallback(async () => {
    if (!meme) {
      toast({
        title: "No token to launch",
        description: "Click Generate first to create a token",
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
      toast({
        title: 'Custom launch failed',
        description: e instanceof Error ? e.message : 'Failed to launch custom token',
        variant: 'destructive',
      });
    }
  }, [customToken, performLaunch, toast, uploadCustomImageIfNeeded]);

  const handleDescribeGenerate = useCallback(async () => {
    if (!describePrompt.trim()) {
      toast({
        title: "Enter a description",
        description: "Describe the meme character you want to create",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setDescribedToken(null);
    clearBanner();
    
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", {
        body: { description: describePrompt }
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || "Generation failed on server");
      }

      if (data?.meme) {
        setDescribedToken(data.meme);
        
        setBannerTextName(data.meme.name);
        setBannerTextTicker(data.meme.ticker);
        setBannerImageUrl(data.meme.imageUrl);
        
        if (data.meme.imageUrl) {
          await generateBanner({
            imageUrl: data.meme.imageUrl,
            tokenName: data.meme.name,
            ticker: data.meme.ticker,
          });
        }
        
        toast({
          title: "Token Generated! 🎨",
          description: `${data.meme.name} ($${data.meme.ticker}) created from your description!`,
        });
      } else {
        throw new Error("No meme data returned from server");
      }
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate meme",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [describePrompt, toast, clearBanner, generateBanner]);

  const handleDescribeLaunch = useCallback(async () => {
    if (!describedToken) {
      toast({
        title: "No token to launch",
        description: "Generate a token from your description first",
        variant: "destructive",
      });
      return;
    }

    await performLaunch(describedToken);
  }, [describedToken, performLaunch, toast]);

  const handlePhantomRandomize = useCallback(async () => {
    setIsPhantomGenerating(true);
    setPhantomMeme(null);
    setPhantomImageFile(null);
    setPhantomImagePreview(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", {
        body: {}
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || "Generation failed on server");
      }

      if (data?.meme) {
        setPhantomMeme(data.meme);
        setPhantomToken({
          name: data.meme.name || "",
          ticker: data.meme.ticker || "",
          description: data.meme.description || "",
          imageUrl: data.meme.imageUrl || "",
          websiteUrl: data.meme.websiteUrl || "",
          twitterUrl: data.meme.twitterUrl || "",
          telegramUrl: data.meme.telegramUrl || "",
          discordUrl: data.meme.discordUrl || "",
        });
        toast({
          title: "Token Generated! 🎲",
          description: `${data.meme.name} ($${data.meme.ticker}) is ready for Phantom launch!`,
        });
      } else {
        throw new Error("No meme data returned");
      }
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate token concept",
        variant: "destructive",
      });
    } finally {
      setIsPhantomGenerating(false);
    }
  }, [toast]);

  const handlePhantomImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhantomImageFile(file);
      setPhantomMeme(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhantomImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const uploadPhantomImageIfNeeded = useCallback(async (): Promise<string> => {
    if (phantomImageFile) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(phantomImageFile);
      });
    }
    if (phantomMeme?.imageUrl) {
      return phantomMeme.imageUrl;
    }
    return phantomToken.imageUrl || "";
  }, [phantomImageFile, phantomToken.imageUrl, phantomMeme?.imageUrl]);

  const handlePhantomLaunch = useCallback(async () => {
    if (!phantomWallet.isConnected || !phantomWallet.address) {
      toast({
        title: "Connect Phantom",
        description: "Please connect your Phantom wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!phantomToken.name.trim() || !phantomToken.ticker.trim()) {
      toast({
        title: "Missing token info",
        description: "Name and ticker are required",
        variant: "destructive",
      });
      return;
    }

    if (phantomWallet.balance !== null && phantomWallet.balance < 0.02) {
      toast({
        title: "Insufficient balance",
        description: "You need at least 0.02 SOL to launch a token",
        variant: "destructive",
      });
      return;
    }

    setIsPhantomLaunching(true);

    try {
      const imageUrl = await uploadPhantomImageIfNeeded();

      const { data, error } = await supabase.functions.invoke("fun-phantom-create", {
        body: {
          name: phantomToken.name.slice(0, 32),
          ticker: phantomToken.ticker.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
          description: phantomToken.description?.slice(0, 500) || `${phantomToken.name} - A fun meme coin!`,
          imageUrl,
          websiteUrl: phantomToken.websiteUrl,
          twitterUrl: phantomToken.twitterUrl,
          phantomWallet: phantomWallet.address,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to create token");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Token creation failed");
      }

      if (data.unsignedTransactions && data.unsignedTransactions.length > 0) {
        const rpcUrl = (window as unknown as { __RUNTIME_CONFIG__?: { heliusRpcUrl?: string } }).__RUNTIME_CONFIG__?.heliusRpcUrl 
          || localStorage.getItem('heliusRpcUrl')
          || import.meta.env.VITE_HELIUS_RPC_URL
          || 'https://mainnet.helius-rpc.com/?api-key=f5b6ebeb-c3d0-422b-8785-12dfa7af0585';
        const connection = new Connection(rpcUrl, 'confirmed');

        for (let i = 0; i < data.unsignedTransactions.length; i++) {
          const txBase64 = data.unsignedTransactions[i];
          const txBuffer = Buffer.from(txBase64, 'base64');
          const tx = Transaction.from(txBuffer);

          toast({
            title: `Sign Transaction ${i + 1}/${data.unsignedTransactions.length}`,
            description: "Please confirm in Phantom wallet",
          });

          const signedTx = await phantomWallet.signTransaction(tx);
          if (!signedTx) {
            throw new Error(`User rejected transaction ${i + 1}`);
          }

          const signature = await connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });

          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight,
          }, 'confirmed');
        }
      }

      setLaunchResult({
        success: true,
        name: data.name || phantomToken.name,
        ticker: data.ticker || phantomToken.ticker,
        mintAddress: data.mintAddress,
        imageUrl: data.imageUrl || imageUrl,
        onChainSuccess: true,
        solscanUrl: data.solscanUrl,
        tradeUrl: data.tradeUrl,
        message: data.message || "Token launched with Phantom! 100% of fees go to your wallet.",
      });
      setShowResultModal(true);

      toast({
        title: "🎉 Token Launched!",
        description: "Your token is live! 100% of trading fees go to your Phantom wallet.",
      });

      phantomWallet.refreshBalance();

      setPhantomToken({
        name: "",
        ticker: "",
        description: "",
        imageUrl: "",
        websiteUrl: "",
        twitterUrl: "",
        telegramUrl: "",
        discordUrl: "",
      });
      setPhantomImageFile(null);
      setPhantomImagePreview(null);

      refetch();

    } catch (error) {
      toast({
        title: "Launch Failed",
        description: error instanceof Error ? error.message : "Failed to launch token",
        variant: "destructive",
      });
    } finally {
      setIsPhantomLaunching(false);
    }
  }, [phantomWallet, phantomToken, uploadPhantomImageIfNeeded, toast, refetch]);

  const formatSOL = (sol: number) => {
    if (!Number.isFinite(sol)) return "0";
    if (sol >= 1000) return `${(sol / 1000).toFixed(1)}K`;
    if (sol >= 1) return sol.toFixed(2);
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

  const { data: claimsSummary } = useFunFeeClaimsSummary();
  const totalClaimed = claimsSummary?.totalClaimedSol ?? 0;
  const totalBuybacks = buybacks.reduce((sum, b) => sum + Number(b.amount_sol || 0), 0);
  const creatorDistributions = distributions.filter(d => d.distribution_type === 'creator');
  const totalCreatorPaid = creatorDistributions.reduce((sum, d) => sum + Number(d.amount_sol || 0), 0);

  return (
    <div className="claude-theme min-h-screen bg-[#0d0b0a] text-[#f5f0e8] overflow-x-hidden">
      {/* Token Ticker Bar */}
      <TokenTickerBar />
      
      {/* Header Bar - Claude Style */}
      <header className="border-b border-[#2a2520] bg-[#0d0b0a]/95 backdrop-blur sticky top-0 z-50 w-full">
        {/* Mobile Header */}
        <div className="sm:hidden">
          <div className="flex items-center justify-between px-4 h-14 border-b border-[#2a2520]">
            <Link to="/claude" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Claude Launch
              </span>
            </Link>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => refetch()}
                className="text-[#a09080] hover:text-white h-8 w-8 p-0 rounded-xl"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#a09080] hover:text-white rounded-xl">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 bg-[#0d0b0a] border-[#2a2520] p-0">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-3 p-4 border-b border-[#2a2520]">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-lg font-semibold text-white">Claude Launch</span>
                    </div>
                    
                    <nav className="flex-1 p-4 space-y-2">
                      <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a1714] hover:bg-[#252119] transition-colors">
                        <Rocket className="h-5 w-5 text-amber-400" />
                        <span className="text-white font-medium">Original Theme</span>
                      </Link>
                      
                      <Link to="/trending" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a1714] hover:bg-[#252119] transition-colors">
                        <TrendingUp className="h-5 w-5 text-green-400" />
                        <span className="text-white font-medium">Narratives</span>
                      </Link>
                      
                      <Link to="/api" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a1714] hover:bg-[#252119] transition-colors">
                        <Key className="h-5 w-5 text-purple-400" />
                        <span className="text-white font-medium">API</span>
                      </Link>
                      
                      <Link to="/governance" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a1714] hover:bg-[#252119] transition-colors">
                        <Scale className="h-5 w-5 text-cyan-400" />
                        <span className="text-white font-medium">Governance</span>
                      </Link>
                    </nav>
                    
                    <div className="p-4 border-t border-[#2a2520]">
                      <div className="flex items-center gap-2 text-xs text-[#706050]">
                        <Clock className="h-3.5 w-3.5" />
                        Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          
          {/* Mobile Prices */}
          <div className="flex items-center justify-center gap-3 px-3 h-10 bg-[#0a0908]">
            <Ai67xPriceDisplay />
            <SolPriceDisplay />
          </div>
        </div>
        
        {/* Desktop Header */}
        <div className="hidden sm:flex w-full max-w-7xl mx-auto px-6 h-16 items-center justify-between">
          <Link to="/claude" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              Claude Launch
            </span>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Ai67xPriceDisplay />
              <SolPriceDisplay />
            </div>
            
            <div className="w-px h-6 bg-[#2a2520]" />
            
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-[#a09080] hover:text-amber-400 hover:bg-amber-500/10 h-9 px-3 rounded-xl">
                <Rocket className="h-4 w-4 mr-2" />
                Original Theme
              </Button>
            </Link>
            
            <Link to="/trending">
              <Button variant="ghost" size="sm" className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-9 px-3 rounded-xl">
                <TrendingUp className="h-4 w-4 mr-2" />
                Narratives
              </Button>
            </Link>
            
            <Link to="/api">
              <Button variant="ghost" size="sm" className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-9 px-3 rounded-xl">
                <Key className="h-4 w-4 mr-2" />
                API
              </Button>
            </Link>
            
            <Link to="/governance">
              <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 h-9 px-3 rounded-xl">
                <Scale className="h-4 w-4 mr-2" />
                Governance
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section - Claude Style */}
      <section className="relative overflow-hidden border-b border-[#2a2520]">
        {/* Warm gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-[#0d0b0a] to-orange-900/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center space-y-6">
            {/* Brand Title */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl shadow-amber-500/30">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
              <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                Claude Launch
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-[#a09080] max-w-2xl mx-auto leading-relaxed">
              AI-powered token generation with elegant simplicity. Create, deploy, and earn — all in one seamless experience.
            </p>

            {/* Stats Cards - Claude Style */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-xl mx-auto mt-8">
              <ClaudeCard className="p-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center mx-auto mb-3">
                  <Zap className="h-5 w-5 text-amber-400" />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">AI Generated</h3>
                <p className="text-xs text-[#706050]">Unique tokens instantly</p>
              </ClaudeCard>
              
              <ClaudeCard className="p-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="h-5 w-5 text-amber-400" />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">50% Fees</h3>
                <p className="text-xs text-[#706050]">Lifetime revenue share</p>
              </ClaudeCard>
              
              <ClaudeCard className="p-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center mx-auto mb-3">
                  <RefreshCw className="h-5 w-5 text-amber-400" />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">30% Buybacks</h3>
                <p className="text-xs text-[#706050]">Automated forever</p>
              </ClaudeCard>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Token Generator */}
          <div className="lg:col-span-1 space-y-4">
            <ClaudeCard className="p-5">
              {/* Header with Mode Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  <span>
                    {generatorMode === "random" ? "AI Generator" : generatorMode === "describe" ? "Describe & Create" : generatorMode === "phantom" ? "Phantom Launch" : "Custom Token"}
                  </span>
                </h2>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(["random", "describe", "custom", "phantom"] as const).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setGeneratorMode(mode)}
                      className={`h-8 px-3 text-xs rounded-xl transition-all ${
                        generatorMode === mode
                          ? mode === "phantom"
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "text-[#a09080] hover:text-white hover:bg-[#252119]"
                      }`}
                    >
                      {mode === "phantom" && <Wallet className="h-3 w-3 mr-1" />}
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Random Mode */}
              {generatorMode === "random" && (
                <>
                  <div className="bg-[#0d0b0a] rounded-xl p-5 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#1a1714] flex-shrink-0 border-2 border-[#2a2520]">
                        {isGenerating ? (
                          <MemeLoadingAnimation />
                        ) : meme?.imageUrl ? (
                          <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Shuffle className="h-8 w-8 text-[#504030]" />
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
                              className="bg-[#1a1714] border-[#2a2520] text-white font-semibold text-sm h-9 rounded-xl focus:border-amber-500/50 focus:ring-amber-500/20"
                              placeholder="Token name"
                              maxLength={20}
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400 text-sm font-semibold">$</span>
                              <Input
                                value={meme.ticker}
                                onChange={(e) =>
                                  setMeme({
                                    ...meme,
                                    ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6),
                                  })
                                }
                                className="bg-[#1a1714] border-[#2a2520] text-amber-400 font-mono text-sm h-8 rounded-xl w-24 focus:border-amber-500/50"
                                placeholder="TICKER"
                                maxLength={6}
                              />
                            </div>
                            <Textarea
                              value={meme.description}
                              onChange={(e) => setMeme({ ...meme, description: e.target.value.slice(0, 280) })}
                              className="bg-[#1a1714] border-[#2a2520] text-[#c0b0a0] text-xs min-h-[60px] resize-none rounded-xl focus:border-amber-500/50"
                              placeholder="Description"
                              maxLength={280}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-[#706050]">Click Generate to create a token</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleRandomize}
                    disabled={isGenerating || isLaunching}
                    className="w-full bg-[#1a1714] hover:bg-[#252119] text-white border border-[#2a2520] rounded-xl h-11 mb-3"
                  >
                    {isGenerating ? (
                      <>
                        <Shuffle className="h-4 w-4 mr-2 animate-spin" /> Generating...
                      </>
                    ) : (
                      <>
                        <Shuffle className="h-4 w-4 mr-2" /> Generate Token
                      </>
                    )}
                  </Button>

                  {meme && meme.imageUrl && (
                    <Button
                      onClick={async () => {
                        try {
                          const response = await fetch(meme.imageUrl);
                          const blob = await response.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${meme.name.replace(/[^a-zA-Z0-9]/g, "_")}_avatar.png`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          toast({ title: "Avatar Downloaded!", description: "Token avatar image saved." });
                        } catch (error) {
                          toast({ title: "Download Failed", description: "Could not download the avatar image.", variant: "destructive" });
                        }
                      }}
                      variant="outline"
                      className="w-full border-[#2a2520] text-[#a09080] hover:text-white hover:bg-[#1a1714] rounded-xl mb-3"
                    >
                      <Download className="h-4 w-4 mr-2" /> Download Avatar
                    </Button>
                  )}

                  {meme && (
                    <Button
                      onClick={() => {
                        setBannerTextName(meme.name);
                        setBannerTextTicker(meme.ticker);
                        setBannerImageUrl(meme.imageUrl);
                        generateBanner({
                          imageUrl: meme.imageUrl,
                          tokenName: meme.name,
                          ticker: meme.ticker,
                        });
                      }}
                      disabled={isBannerGenerating || !meme.imageUrl}
                      variant="outline"
                      className="w-full border-[#2a2520] text-[#a09080] hover:text-white hover:bg-[#1a1714] rounded-xl"
                    >
                      {isBannerGenerating ? (
                        <>
                          <Image className="h-4 w-4 mr-2 animate-pulse" /> Generating Banner...
                        </>
                      ) : (
                        <>
                          <Image className="h-4 w-4 mr-2" /> Generate X Banner
                        </>
                      )}
                    </Button>
                  )}

                  {bannerUrl && (
                    <div className="mt-4 p-4 bg-[#0d0b0a] rounded-xl border border-[#2a2520]">
                      <p className="text-xs text-[#706050] mb-2">Banner Preview:</p>
                      <div className="rounded-lg overflow-hidden border border-[#2a2520]">
                        <img src={bannerUrl} alt="Generated banner" className="w-full h-auto" />
                      </div>
                      <Button
                        onClick={() => downloadBanner(`${meme?.ticker || 'token'}_banner.png`)}
                        className="w-full mt-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-[#0d0b0a] font-semibold rounded-xl"
                      >
                        <Download className="h-4 w-4 mr-2" /> Download Banner
                      </Button>
                    </div>
                  )}

                  {/* Wallet & Launch */}
                  <div className="space-y-3 pt-4 border-t border-[#2a2520] mt-4">
                    <Input
                      placeholder="Your SOL wallet address..."
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      className="bg-[#0d0b0a] border-[#2a2520] text-white placeholder:text-[#504030] font-mono text-sm rounded-xl focus:border-amber-500/50"
                    />
                    <p className="text-xs text-[#706050]">Receive 50% of trading fees automatically</p>
                    <Button
                      onClick={handleLaunch}
                      disabled={isLaunching || !walletAddress || !meme}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-[#0d0b0a] font-semibold rounded-xl h-11 shadow-lg shadow-amber-500/20"
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

              {/* Custom Mode */}
              {generatorMode === "custom" && (
                <>
                  <div className="bg-[#0d0b0a] rounded-xl p-5 mb-4 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#1a1714] flex-shrink-0 border-2 border-[#2a2520]">
                        {customImagePreview || customToken.imageUrl ? (
                          <img
                            src={customImagePreview || customToken.imageUrl}
                            alt={customToken.name || "Custom token"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Bot className="h-8 w-8 text-[#504030]" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <Input
                          value={customToken.name}
                          onChange={(e) => setCustomToken({ ...customToken, name: e.target.value.slice(0, 20) })}
                          className="bg-[#1a1714] border-[#2a2520] text-white font-semibold text-sm h-9 rounded-xl"
                          placeholder="Token name"
                          maxLength={20}
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 text-sm font-semibold">$</span>
                          <Input
                            value={customToken.ticker}
                            onChange={(e) =>
                              setCustomToken({
                                ...customToken,
                                ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
                              })
                            }
                            className="bg-[#1a1714] border-[#2a2520] text-amber-400 font-mono text-sm h-8 rounded-xl w-28"
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
                      className="bg-[#1a1714] border-[#2a2520] text-white text-sm min-h-[80px] rounded-xl"
                    />

                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomImageChange}
                      className="bg-[#1a1714] border-[#2a2520] text-white text-sm rounded-xl"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={customToken.websiteUrl || ""}
                        onChange={(e) => setCustomToken({ ...customToken, websiteUrl: e.target.value })}
                        className="bg-[#1a1714] border-[#2a2520] text-white text-sm rounded-xl"
                        placeholder="Website URL"
                      />
                      <Input
                        value={customToken.twitterUrl || ""}
                        onChange={(e) => setCustomToken({ ...customToken, twitterUrl: e.target.value })}
                        className="bg-[#1a1714] border-[#2a2520] text-white text-sm rounded-xl"
                        placeholder="X / Twitter URL"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-[#2a2520]">
                    <Input
                      placeholder="Your SOL wallet address..."
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      className="bg-[#0d0b0a] border-[#2a2520] text-white placeholder:text-[#504030] font-mono text-sm rounded-xl"
                    />
                    <p className="text-xs text-[#706050]">Receive 50% of trading fees automatically</p>
                    <Button
                      onClick={handleCustomLaunch}
                      disabled={isLaunching || !walletAddress || !customToken.name.trim() || !customToken.ticker.trim()}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-[#0d0b0a] font-semibold rounded-xl h-11"
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

              {/* Describe Mode */}
              {generatorMode === "describe" && (
                <>
                  <div className="bg-[#0d0b0a] rounded-xl p-5 mb-4 space-y-4">
                    <Textarea
                      value={describePrompt}
                      onChange={(e) => setDescribePrompt(e.target.value)}
                      placeholder="Describe your meme concept... (e.g., 'A friendly robot cat wearing sunglasses and a cape')"
                      className="bg-[#1a1714] border-[#2a2520] text-white text-sm min-h-[100px] resize-none rounded-xl"
                    />
                    
                    <Button
                      onClick={handleDescribeGenerate}
                      disabled={isGenerating || !describePrompt.trim()}
                      className="w-full bg-[#1a1714] hover:bg-[#252119] text-white border border-[#2a2520] rounded-xl"
                    >
                      {isGenerating ? (
                        <>
                          <Sparkles className="h-4 w-4 mr-2 animate-spin" /> Creating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" /> Generate from Description
                        </>
                      )}
                    </Button>
                  </div>

                  {describedToken && (
                    <div className="space-y-4">
                      <div className="bg-[#0d0b0a] rounded-xl p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#1a1714] flex-shrink-0 border-2 border-amber-500/30">
                            {describedToken.imageUrl && (
                              <img src={describedToken.imageUrl} alt={describedToken.name} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{describedToken.name}</h3>
                            <span className="text-amber-400 font-mono text-sm">${describedToken.ticker}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-[#2a2520]">
                        <Input
                          placeholder="Your SOL wallet address..."
                          value={walletAddress}
                          onChange={(e) => setWalletAddress(e.target.value)}
                          className="bg-[#0d0b0a] border-[#2a2520] text-white placeholder:text-[#504030] font-mono text-sm rounded-xl"
                        />
                        <Button
                          onClick={handleDescribeLaunch}
                          disabled={isLaunching || !walletAddress}
                          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-[#0d0b0a] font-semibold rounded-xl h-11"
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
                    </div>
                  )}
                </>
              )}

              {/* Phantom Mode */}
              {generatorMode === "phantom" && (
                <>
                  <div className="bg-[#0d0b0a] rounded-xl p-5 mb-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-purple-400" />
                        <span className="text-sm font-semibold text-white">Phantom Wallet Launch</span>
                      </div>
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        100% Fees to You
                      </Badge>
                    </div>

                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-xs text-[#c0b0a0]">
                      <p className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-purple-400">Phantom Mode:</strong> You pay the launch fee (~0.02 SOL) and receive 100% of all trading fees.
                        </span>
                      </p>
                    </div>

                    {!phantomWallet.isConnected ? (
                      <Button
                        onClick={phantomWallet.connect}
                        disabled={phantomWallet.isConnecting}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl"
                      >
                        {phantomWallet.isConnecting ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Connecting...
                          </>
                        ) : !phantomWallet.isPhantomInstalled ? (
                          <>
                            <ExternalLink className="h-4 w-4 mr-2" /> Install Phantom
                          </>
                        ) : (
                          <>
                            <Wallet className="h-4 w-4 mr-2" /> Connect Phantom Wallet
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between bg-[#1a1714] rounded-xl p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
                              <Wallet className="h-4 w-4 text-purple-400" />
                            </div>
                            <div>
                              <div className="text-sm font-mono text-white">
                                {phantomWallet.address?.slice(0, 4)}...{phantomWallet.address?.slice(-4)}
                              </div>
                              <div className="text-xs text-[#706050]">
                                {phantomWallet.isLoadingBalance ? "Loading..." : phantomWallet.balance !== null ? `${phantomWallet.balance.toFixed(4)} SOL` : "Balance unavailable"}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={phantomWallet.disconnect}
                            className="text-[#a09080] hover:text-white rounded-xl"
                          >
                            Disconnect
                          </Button>
                        </div>

                        <Button
                          onClick={handlePhantomRandomize}
                          disabled={isPhantomGenerating}
                          className="w-full bg-gradient-to-r from-purple-600/80 to-purple-700/80 hover:from-purple-600 hover:to-purple-700 text-white border border-purple-500/30 rounded-xl"
                          variant="outline"
                        >
                          {isPhantomGenerating ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating...
                            </>
                          ) : (
                            <>
                              <Shuffle className="h-4 w-4 mr-2" /> AI Randomize Token
                            </>
                          )}
                        </Button>

                        {isPhantomGenerating && (
                          <div className="flex flex-col items-center justify-center py-6">
                            <MemeLoadingAnimation />
                            <MemeLoadingText />
                          </div>
                        )}

                        {!isPhantomGenerating && (
                          <>
                            <div className="flex items-center gap-4">
                              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#1a1714] flex-shrink-0 border-2 border-purple-500/30">
                                {phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl ? (
                                  <img
                                    src={phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl}
                                    alt={phantomToken.name || "Token"}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Bot className="h-8 w-8 text-[#504030]" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={phantomToken.name}
                                  onChange={(e) => setPhantomToken({ ...phantomToken, name: e.target.value.slice(0, 32) })}
                                  className="bg-[#1a1714] border-[#2a2520] text-white font-semibold text-sm h-9 rounded-xl"
                                  placeholder="Token name"
                                  maxLength={32}
                                />
                                <div className="flex items-center gap-2">
                                  <span className="text-purple-400 text-sm font-semibold">$</span>
                                  <Input
                                    value={phantomToken.ticker}
                                    onChange={(e) =>
                                      setPhantomToken({
                                        ...phantomToken,
                                        ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
                                      })
                                    }
                                    className="bg-[#1a1714] border-[#2a2520] text-purple-400 font-mono text-sm h-8 rounded-xl w-28"
                                    placeholder="TICKER"
                                    maxLength={10}
                                  />
                                </div>
                              </div>
                            </div>

                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handlePhantomImageChange}
                              className="bg-[#1a1714] border-[#2a2520] text-white text-sm rounded-xl"
                            />

                            <Button
                              onClick={handlePhantomLaunch}
                              disabled={isPhantomLaunching || !phantomToken.name.trim() || !phantomToken.ticker.trim()}
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl h-11"
                            >
                              {isPhantomLaunching ? (
                                <>
                                  <Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...
                                </>
                              ) : (
                                <>
                                  <Rocket className="h-4 w-4 mr-2" /> Launch with Phantom
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </ClaudeCard>

            {/* Admin Panel */}
            {isAdmin && walletAddress && (
              <SniperStatusPanel creatorWallet={walletAddress} />
            )}
          </div>

          {/* Right Panel - Tokens List */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="tokens" className="w-full">
              <TabsList className="w-full bg-[#1a1714] border border-[#2a2520] p-1.5 mb-4 grid grid-cols-5 rounded-2xl">
                {[
                  { value: "tokens", icon: BarChart3, label: "Tokens", count: tokens.length },
                  { value: "top", icon: Trophy, label: "Top", color: "text-amber-400" },
                  { value: "claims", icon: Coins, label: "Claimed", count: claimsCount },
                  { value: "buybacks", icon: Repeat, label: "Buybacks", count: buybacks.length },
                  { value: "creator-fees", icon: Wallet, label: "Creators", count: creatorDistributions.length },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={`data-[state=active]:bg-[#252119] data-[state=active]:text-white text-[#706050] text-xs sm:text-sm rounded-xl ${tab.color || ""}`}
                  >
                    <tab.icon className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.count !== undefined && ` (${tab.count})`}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Tokens Tab */}
              <TabsContent value="tokens">
                <ClaudeCard>
                  <div className="p-4 border-b border-[#2a2520] flex items-center justify-between">
                    <h2 className="font-semibold text-white flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-amber-400" />
                      Live Tokens
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                      <span className="text-xs text-[#706050]">Real-time</span>
                    </div>
                  </div>

                  <div className="divide-y divide-[#2a2520]">
                    {tokensLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="p-4 flex items-center gap-4">
                          <Skeleton className="h-10 w-10 rounded-xl bg-[#252119]" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-24 bg-[#252119] mb-1" />
                            <Skeleton className="h-3 w-16 bg-[#252119]" />
                          </div>
                        </div>
                      ))
                    ) : tokens.length === 0 ? (
                      <div className="p-8 text-center text-[#706050]">
                        No tokens launched yet. Be the first!
                      </div>
                    ) : (
                      tokens.slice((tokensPage - 1) * tokensPageSize, tokensPage * tokensPageSize).map((token, index) => (
                        <div key={token.id} className="p-4 hover:bg-[#1a1714]/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="text-sm text-[#706050] w-6">{(tokensPage - 1) * tokensPageSize + index + 1}</div>
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#252119] flex-shrink-0">
                              {token.image_url ? (
                                <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[#504030] text-xs font-bold">
                                  {token.ticker?.slice(0, 2)}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white text-sm truncate">{token.name}</span>
                                <span className="text-xs text-[#706050] font-mono">${token.ticker}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-[#706050]">
                                <span className="text-white font-medium">{formatUsd(token.market_cap_sol || 0)}</span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {token.holder_count || 0}
                                </span>
                                <Progress
                                  value={token.bonding_progress || 0}
                                  className="h-1.5 w-12 bg-[#252119] [&>div]:bg-amber-500"
                                />
                                <span>{(token.bonding_progress || 0).toFixed(1)}%</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {token.mint_address && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(token.mint_address!)}
                                  className="h-8 w-8 p-0 text-[#706050] hover:text-white rounded-xl"
                                >
                                  {copiedAddress === token.mint_address ? (
                                    <CheckCircle className="h-3.5 w-3.5 text-amber-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="h-8 px-3 text-xs text-amber-400 hover:bg-amber-500/10 rounded-xl"
                              >
                                <a
                                  href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}?chain=sol`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Trade
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {tokens.length > tokensPageSize && (
                    <div className="p-4 border-t border-[#2a2520] flex items-center justify-between">
                      <span className="text-xs text-[#706050]">
                        {(tokensPage - 1) * tokensPageSize + 1}-{Math.min(tokensPage * tokensPageSize, tokens.length)} of {tokens.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={tokensPage === 1}
                          onClick={() => setTokensPage((p) => p - 1)}
                          className="h-8 px-3 text-xs bg-[#252119] border-[#2a2520] text-[#a09080] hover:bg-[#2a2520] rounded-xl disabled:opacity-50"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={tokensPage >= Math.ceil(tokens.length / tokensPageSize)}
                          onClick={() => setTokensPage((p) => p + 1)}
                          className="h-8 px-3 text-xs bg-[#252119] border-[#2a2520] text-[#a09080] hover:bg-[#2a2520] rounded-xl disabled:opacity-50"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </ClaudeCard>
              </TabsContent>

              {/* Placeholder for other tabs - matching structure but with Claude styling */}
              <TabsContent value="top">
                <ClaudeCard className="p-6 text-center">
                  <Trophy className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                  <h3 className="font-semibold text-white mb-2">Top Performers</h3>
                  <p className="text-sm text-[#706050]">Top earning tokens will appear here</p>
                </ClaudeCard>
              </TabsContent>

              <TabsContent value="claims">
                <ClaudeCard className="p-6 text-center">
                  <Coins className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                  <h3 className="font-semibold text-white mb-2">Fee Claims</h3>
                  <p className="text-sm text-[#706050]">Claimed fees: {formatSOL(totalClaimed)} SOL</p>
                </ClaudeCard>
              </TabsContent>

              <TabsContent value="buybacks">
                <ClaudeCard className="p-6 text-center">
                  <Repeat className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                  <h3 className="font-semibold text-white mb-2">Automated Buybacks</h3>
                  <p className="text-sm text-[#706050]">Total buybacks: {formatSOL(totalBuybacks)} SOL</p>
                </ClaudeCard>
              </TabsContent>

              <TabsContent value="creator-fees">
                <ClaudeCard className="p-6 text-center">
                  <Wallet className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                  <h3 className="font-semibold text-white mb-2">Creator Distributions</h3>
                  <p className="text-sm text-[#706050]">Total paid: {formatSOL(totalCreatorPaid)} SOL</p>
                </ClaudeCard>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Sparkles, title: "AI Generated", desc: "Unique tokens" },
            { icon: Rocket, title: "Free Launch", desc: "No fees to create" },
            { icon: TrendingUp, title: "50% Revenue", desc: "Trading fees to you" },
            { icon: Clock, title: "Instant Payouts", desc: "Every minute" },
          ].map((stat, i) => (
            <ClaudeCard key={i} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{stat.title}</div>
                  <div className="text-xs text-[#706050]">{stat.desc}</div>
                </div>
              </div>
            </ClaudeCard>
          ))}
        </div>
      </div>

      {/* Launch Result Modal */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="bg-[#1a1714] border-[#2a2520] text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {launchResult?.success ? (
                <>
                  <PartyPopper className="h-5 w-5 text-amber-400" />
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
              <div className="flex items-center gap-4 p-4 bg-[#0d0b0a] rounded-xl">
                {launchResult.imageUrl && (
                  <img
                    src={launchResult.imageUrl}
                    alt={launchResult.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500"
                  />
                )}
                <div>
                  <h3 className="font-bold text-lg">{launchResult.name}</h3>
                  <span className="text-amber-400 font-mono">${launchResult.ticker}</span>
                </div>
              </div>

              <div className={`p-3 rounded-xl ${launchResult.onChainSuccess ? "bg-green-500/10 border border-green-500/30" : "bg-amber-500/10 border border-amber-500/30"}`}>
                <p className="text-sm">{launchResult.message}</p>
              </div>

              {launchResult.mintAddress && (
                <div className="space-y-2">
                  <label className="text-xs text-[#706050]">Contract Address</label>
                  <div className="flex items-center gap-2 p-3 bg-[#0d0b0a] rounded-xl">
                    <code className="flex-1 text-sm font-mono text-[#a09080] break-all">
                      {launchResult.mintAddress}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(launchResult.mintAddress!)}
                      className="shrink-0 rounded-xl"
                    >
                      {copiedAddress === launchResult.mintAddress ? (
                        <CheckCircle className="h-4 w-4 text-amber-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-sm text-amber-400 font-medium">
                  💡 Make a small initial purchase to kickstart your token and generate trading fees!
                </p>
              </div>

              <div className="flex gap-2">
                {launchResult.solscanUrl && (
                  <Button
                    variant="outline"
                    className="flex-1 border-[#2a2520] hover:bg-[#252119] rounded-xl"
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
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-[#0d0b0a] rounded-xl"
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
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-sm text-red-400">{launchResult?.error || "An unknown error occurred"}</p>
              </div>
              <Button
                onClick={() => setShowResultModal(false)}
                className="w-full bg-[#252119] hover:bg-[#2a2520] rounded-xl"
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
