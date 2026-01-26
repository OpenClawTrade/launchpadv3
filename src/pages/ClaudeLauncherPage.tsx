import { useState, useCallback, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFunTokens } from "@/hooks/useFunTokens";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useFunFeeClaims, useFunFeeClaimsSummary, useFunDistributions, useFunBuybacks } from "@/hooks/useFunFeeData";
import { useFunTopPerformers } from "@/hooks/useFunTopPerformers";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { 
  Shuffle, 
  Rocket, 
  Sparkles, 
  TrendingUp, 
  Users, 
  Clock,
  RefreshCw,
  ExternalLink,
  Copy,
  CheckCircle,
  Coins,
  ArrowDownCircle,
  Wallet,
  AlertTriangle,
  PartyPopper,
  Bot,
  Globe,
  Twitter,
  Image,
  Download,
  ChevronLeft,
  ChevronRight,
  Zap,
  BarChart3
} from "lucide-react";
import { useBannerGenerator } from "@/hooks/useBannerGenerator";
import { formatDistanceToNow } from "date-fns";
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

export default function ClaudeLauncherPage() {
  const { toast } = useToast();
  const { solPrice } = useSolPrice();
  const isMobile = useIsMobile();
  const { tokens, isLoading: tokensLoading, lastUpdate, refetch } = useFunTokens();

  const [tokensPage, setTokensPage] = useState(1);
  const tokensPageSize = 10;

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
  const [phantomDescribePrompt, setPhantomDescribePrompt] = useState("");
  const [phantomInputMode, setPhantomInputMode] = useState<"random" | "describe" | "custom">("random");
  
  const { 
    generateBanner, 
    downloadBanner, 
    clearBanner, 
    isGenerating: isBannerGenerating, 
    bannerUrl 
  } = useBannerGenerator();
  
  const [bannerTextName, setBannerTextName] = useState("");
  const [bannerTextTicker, setBannerTextTicker] = useState("");
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

  const formatSOL = (amount: number) => {
    return amount.toFixed(4);
  };

  const formatUsd = (sol: number) => {
    if (!solPrice) return `${formatSOL(sol)} SOL`;
    return `$${(sol * solPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  // Phantom mode handlers
  const uploadPhantomImageIfNeeded = useCallback(async (): Promise<string> => {
    if (!phantomImageFile) return phantomToken.imageUrl;

    const fileExt = phantomImageFile.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `token-images/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, phantomImageFile);
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
    return urlData.publicUrl;
  }, [phantomImageFile, phantomToken.imageUrl]);

  const handlePhantomRandomize = useCallback(async () => {
    setIsPhantomGenerating(true);
    setPhantomMeme(null);
    clearBanner();
    
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", {
        body: {}
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");

      if (data?.meme) {
        setPhantomMeme(data.meme);
        toast({
          title: "Token Generated! 🎲",
          description: `${data.meme.name} ($${data.meme.ticker}) is ready!`,
        });
      }
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate meme",
        variant: "destructive",
      });
    } finally {
      setIsPhantomGenerating(false);
    }
  }, [toast, clearBanner]);

  const handlePhantomDescribeGenerate = useCallback(async () => {
    if (!phantomDescribePrompt.trim()) {
      toast({
        title: "Enter a description",
        description: "Describe the meme character you want to create",
        variant: "destructive",
      });
      return;
    }

    setIsPhantomGenerating(true);
    setPhantomMeme(null);
    clearBanner();
    
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", {
        body: { description: phantomDescribePrompt }
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");

      if (data?.meme) {
        setPhantomMeme(data.meme);
        toast({
          title: "Token Generated! 🎨",
          description: `${data.meme.name} ($${data.meme.ticker}) created from your description!`,
        });
      }
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate meme",
        variant: "destructive",
      });
    } finally {
      setIsPhantomGenerating(false);
    }
  }, [phantomDescribePrompt, toast, clearBanner]);

  const handlePhantomImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Image too large", description: "Max 5MB allowed", variant: "destructive" });
        return;
      }

      setPhantomImageFile(file);
      setPhantomImagePreview(URL.createObjectURL(file));
    },
    [toast]
  );

  const handlePhantomLaunch = useCallback(async () => {
    if (!phantomWallet.isConnected || !phantomWallet.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your Phantom wallet first",
        variant: "destructive",
      });
      return;
    }

    const tokenToLaunch = phantomMeme || phantomToken;
    
    if (!tokenToLaunch.name.trim() || !tokenToLaunch.ticker.trim()) {
      toast({
        title: "Missing token info",
        description: "Name and ticker are required",
        variant: "destructive",
      });
      return;
    }

    if (!phantomMeme && !phantomImageFile && !phantomToken.imageUrl.trim()) {
      toast({
        title: "Image required",
        description: "Please upload an image or generate a token",
        variant: "destructive",
      });
      return;
    }

    setIsPhantomLaunching(true);

    try {
      let imageUrl = tokenToLaunch.imageUrl;
      if (phantomImageFile) {
        imageUrl = await uploadPhantomImageIfNeeded();
      }

      // Phase 1: Get unsigned transactions (token NOT recorded in DB yet)
      const { data, error } = await supabase.functions.invoke("fun-phantom-create", {
        body: {
          name: tokenToLaunch.name.slice(0, 20),
          ticker: tokenToLaunch.ticker.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
          description: tokenToLaunch.description || "",
          imageUrl,
          websiteUrl: tokenToLaunch.websiteUrl,
          twitterUrl: tokenToLaunch.twitterUrl,
          telegramUrl: tokenToLaunch.telegramUrl,
          discordUrl: tokenToLaunch.discordUrl,
          phantomWallet: phantomWallet.address,
        },
      });

      if (error) throw new Error(error.message || "Failed to prepare transaction");
      if (!data?.success) throw new Error(data?.error || "Failed to prepare transaction");

      // Get RPC URL from localStorage or env
      const rpcUrl = localStorage.getItem("heliusRpcUrl") || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      
      // Process unsigned transactions
      const unsignedTxs = data.unsignedTransactions || [];
      if (unsignedTxs.length === 0) {
        throw new Error("No transactions to sign");
      }

      // Sign and send each transaction
      for (let i = 0; i < unsignedTxs.length; i++) {
        const txBuffer = Buffer.from(unsignedTxs[i], "base64");
        
        let transaction: Transaction | VersionedTransaction;
        try {
          transaction = VersionedTransaction.deserialize(txBuffer);
        } catch {
          transaction = Transaction.from(txBuffer);
        }

        const signedTx = await phantomWallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });

        await connection.confirmTransaction(signature, "confirmed");
        console.log(`[ClaudeLauncher] Transaction ${i + 1}/${unsignedTxs.length} confirmed:`, signature);
      }

      // Phase 2: Record token in database AFTER confirmation
      const { error: recordError } = await supabase.functions.invoke("fun-phantom-create", {
        body: {
          confirmed: true,
          name: tokenToLaunch.name.slice(0, 20),
          ticker: tokenToLaunch.ticker.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
          description: tokenToLaunch.description || "",
          imageUrl,
          websiteUrl: tokenToLaunch.websiteUrl,
          twitterUrl: tokenToLaunch.twitterUrl,
          phantomWallet: phantomWallet.address,
          mintAddress: data.mintAddress,
          dbcPoolAddress: data.dbcPoolAddress,
        },
      });

      if (recordError) {
        console.error("[ClaudeLauncher] Failed to record token:", recordError);
        // Still show success since on-chain worked
      }

      setLaunchResult({
        success: true,
        name: data.name || tokenToLaunch.name,
        ticker: data.ticker || tokenToLaunch.ticker,
        mintAddress: data.mintAddress,
        imageUrl: imageUrl,
        onChainSuccess: true,
        solscanUrl: data.solscanUrl,
        tradeUrl: data.tradeUrl,
        message: "Token launched successfully with your Phantom wallet!",
      });
      setShowResultModal(true);

      toast({
        title: "🚀 Token Launched!",
        description: `${tokenToLaunch.name} is now live!`,
      });

      setPhantomMeme(null);
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
      setPhantomDescribePrompt("");
      clearBanner();
      refetch();

    } catch (error) {
      console.error("[ClaudeLauncher] Phantom launch error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to launch token";
      
      setLaunchResult({
        success: false,
        error: errorMessage,
      });
      setShowResultModal(true);

      toast({
        title: "Launch Failed",
        description: errorMessage.slice(0, 100),
        variant: "destructive",
      });
    } finally {
      setIsPhantomLaunching(false);
    }
  }, [phantomWallet, phantomMeme, phantomToken, phantomImageFile, phantomDescribePrompt, uploadPhantomImageIfNeeded, toast, clearBanner, refetch]);

  // Stats calculations
  const totalCreatorPaid = distributions.reduce((acc, d) => acc + (d.amount_sol || 0), 0);
  const totalBuybacks = buybacks.reduce((acc, b) => acc + (b.amount_sol || 0), 0);

  return (
    <div className="claude-theme claude-page min-h-screen">
      {/* Header */}
      <header className="claude-header sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[hsl(15,70%,55%)] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-[hsl(25,30%,15%)]">Claude Launcher</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-[hsl(25,10%,55%)]">{tokens.length} tokens launched</span>
            <Button 
              onClick={() => refetch()}
              variant="ghost"
              size="sm"
              className="text-[hsl(25,15%,40%)] hover:text-[hsl(25,30%,15%)] hover:bg-[hsl(35,20%,92%)]"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <section className="text-center mb-12 claude-animate-in">
          <h1 className="text-4xl md:text-5xl font-bold text-[hsl(25,30%,15%)] mb-4">
            Launch meme tokens with AI
          </h1>
          <p className="text-lg text-[hsl(25,15%,40%)] max-w-2xl mx-auto mb-8">
            Generate unique tokens in seconds. Earn 50% of all trading fees automatically.
          </p>
          
          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              { icon: Sparkles, label: "AI Generated" },
              { icon: Rocket, label: "Free to Launch" },
              { icon: TrendingUp, label: "50% Fee Share" },
              { icon: Clock, label: "Instant Payouts" },
            ].map((feature, i) => (
              <div key={i} className="claude-pill">
                <feature.icon className="claude-pill-icon" />
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Main Grid - Generator + Stats */}
        <div className="grid lg:grid-cols-5 gap-8 mb-12">
          {/* Generator Card */}
          <div className="lg:col-span-3">
            <div className="claude-card-elevated p-6 md:p-8">
              {/* Mode Selector */}
              <div className="flex gap-2 mb-6 p-1 bg-[hsl(35,20%,92%)] rounded-xl">
                {[
                  { id: "random", label: "Randomizer", icon: Shuffle },
                  { id: "describe", label: "Describe", icon: Sparkles },
                  { id: "custom", label: "Custom", icon: Image },
                  { id: "phantom", label: "Phantom", icon: Wallet },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setGeneratorMode(mode.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                      generatorMode === mode.id
                        ? "bg-white text-[hsl(25,30%,15%)] shadow-sm"
                        : "text-[hsl(25,10%,55%)] hover:text-[hsl(25,15%,40%)]"
                    }`}
                  >
                    <mode.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{mode.label}</span>
                  </button>
                ))}
              </div>

              {/* Random Mode */}
              {generatorMode === "random" && (
                <div className="space-y-6">
                  {/* Token Preview */}
                  <div className="flex items-start gap-5 p-5 bg-[hsl(40,30%,96%)] rounded-2xl">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white border border-[hsl(35,15%,85%)] flex-shrink-0">
                      {meme?.imageUrl ? (
                        <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Bot className="h-8 w-8 text-[hsl(25,10%,75%)]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {meme ? (
                        <>
                          <Input
                            value={meme.name}
                            onChange={(e) => setMeme({ ...meme, name: e.target.value.slice(0, 20) })}
                            className="claude-input mb-2 font-semibold"
                            maxLength={20}
                          />
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[hsl(15,70%,55%)] font-semibold">$</span>
                            <Input
                              value={meme.ticker}
                              onChange={(e) => setMeme({ ...meme, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) })}
                              className="claude-input w-24 font-mono text-[hsl(15,70%,55%)]"
                              maxLength={6}
                            />
                          </div>
                          <Textarea
                            value={meme.description}
                            onChange={(e) => setMeme({ ...meme, description: e.target.value.slice(0, 280) })}
                            className="claude-input text-sm min-h-[60px] resize-none"
                            placeholder="Description"
                            maxLength={280}
                          />
                        </>
                      ) : (
                        <p className="text-[hsl(25,10%,55%)] py-4">Click Generate to create a token</p>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={handleRandomize}
                    disabled={isGenerating || isLaunching}
                    className="claude-btn-secondary w-full h-12"
                  >
                    {isGenerating ? (
                      <><Shuffle className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><Shuffle className="h-4 w-4 mr-2" /> Generate Token</>
                    )}
                  </Button>

                  {meme && (
                    <div className="flex gap-3">
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
                            toast({ title: "Avatar Downloaded!" });
                          } catch {
                            toast({ title: "Download Failed", variant: "destructive" });
                          }
                        }}
                        variant="outline"
                        className="flex-1 claude-btn-ghost border border-[hsl(35,15%,85%)]"
                      >
                        <Download className="h-4 w-4 mr-2" /> Avatar
                      </Button>
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
                        disabled={isBannerGenerating}
                        variant="outline"
                        className="flex-1 claude-btn-ghost border border-[hsl(35,15%,85%)]"
                      >
                        <Image className="h-4 w-4 mr-2" /> Banner
                      </Button>
                    </div>
                  )}

                  {bannerUrl && (
                    <div className="p-4 bg-[hsl(40,30%,96%)] rounded-xl">
                      <p className="text-xs text-[hsl(25,10%,55%)] mb-2">Banner Preview:</p>
                      <img src={bannerUrl} alt="Banner" className="w-full rounded-lg border border-[hsl(35,15%,85%)]" />
                      <Button
                        onClick={() => downloadBanner(bannerUrl, meme?.ticker || 'token')}
                        className="claude-btn-primary w-full mt-3"
                      >
                        <Download className="h-4 w-4 mr-2" /> Download Banner
                      </Button>
                    </div>
                  )}

                  {/* Wallet & Launch */}
                  <div className="pt-6 border-t border-[hsl(35,15%,85%)]">
                    <label className="text-sm font-medium text-[hsl(25,30%,15%)] mb-2 block">Your Solana wallet</label>
                    <Input
                      placeholder="Enter your SOL wallet address..."
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      className="claude-input font-mono text-sm mb-2"
                    />
                    <p className="text-xs text-[hsl(25,10%,55%)] mb-4">You'll receive 50% of all trading fees</p>
                    <Button
                      onClick={handleLaunch}
                      disabled={isLaunching || !walletAddress || !meme}
                      className="claude-btn-primary w-full h-12 text-base"
                    >
                      {isLaunching ? (
                        <><Rocket className="h-5 w-5 mr-2 animate-bounce" /> Launching...</>
                      ) : (
                        <><Rocket className="h-5 w-5 mr-2" /> Launch Token</>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Custom Mode */}
              {generatorMode === "custom" && (
                <div className="space-y-6">
                  <div className="p-5 bg-[hsl(40,30%,96%)] rounded-2xl space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white border border-[hsl(35,15%,85%)] flex-shrink-0">
                        {customImagePreview || customToken.imageUrl ? (
                          <img src={customImagePreview || customToken.imageUrl} alt="Token" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Image className="h-8 w-8 text-[hsl(25,10%,75%)]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={customToken.name}
                          onChange={(e) => setCustomToken({ ...customToken, name: e.target.value.slice(0, 20) })}
                          className="claude-input font-semibold"
                          placeholder="Token name"
                          maxLength={20}
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-[hsl(15,70%,55%)] font-semibold">$</span>
                          <Input
                            value={customToken.ticker}
                            onChange={(e) => setCustomToken({ ...customToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })}
                            className="claude-input w-28 font-mono"
                            placeholder="TICKER"
                            maxLength={10}
                          />
                        </div>
                      </div>
                    </div>

                    <Textarea
                      value={customToken.description}
                      onChange={(e) => setCustomToken({ ...customToken, description: e.target.value })}
                      placeholder="Description (optional)"
                      className="claude-input min-h-[80px]"
                    />

                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomImageChange}
                      className="claude-input text-sm"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={customToken.websiteUrl || ""}
                        onChange={(e) => setCustomToken({ ...customToken, websiteUrl: e.target.value })}
                        className="claude-input text-sm"
                        placeholder="Website URL"
                      />
                      <Input
                        value={customToken.twitterUrl || ""}
                        onChange={(e) => setCustomToken({ ...customToken, twitterUrl: e.target.value })}
                        className="claude-input text-sm"
                        placeholder="Twitter URL"
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-[hsl(35,15%,85%)]">
                    <label className="text-sm font-medium text-[hsl(25,30%,15%)] mb-2 block">Your Solana wallet</label>
                    <Input
                      placeholder="Enter your SOL wallet address..."
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      className="claude-input font-mono text-sm mb-4"
                    />
                    <Button
                      onClick={handleCustomLaunch}
                      disabled={isLaunching || !walletAddress || !customToken.name.trim() || !customToken.ticker.trim()}
                      className="claude-btn-primary w-full h-12 text-base"
                    >
                      {isLaunching ? (
                        <><Rocket className="h-5 w-5 mr-2 animate-bounce" /> Launching...</>
                      ) : (
                        <><Rocket className="h-5 w-5 mr-2" /> Launch Token</>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Describe Mode */}
              {generatorMode === "describe" && (
                <div className="space-y-6">
                  <div className="p-5 bg-[hsl(40,30%,96%)] rounded-2xl space-y-4">
                    <Textarea
                      value={describePrompt}
                      onChange={(e) => setDescribePrompt(e.target.value)}
                      placeholder="Describe your meme concept... (e.g., 'A friendly robot cat wearing sunglasses')"
                      className="claude-input min-h-[120px] resize-none"
                    />
                    <Button
                      onClick={handleDescribeGenerate}
                      disabled={isGenerating || !describePrompt.trim()}
                      className="claude-btn-secondary w-full h-11"
                    >
                      {isGenerating ? (
                        <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" /> Generate from Description</>
                      )}
                    </Button>
                  </div>

                  {describedToken && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 bg-[hsl(40,30%,96%)] rounded-xl">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[hsl(15,70%,55%)]">
                          {describedToken.imageUrl && (
                            <img src={describedToken.imageUrl} alt={describedToken.name} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-[hsl(25,30%,15%)]">{describedToken.name}</h3>
                          <span className="text-[hsl(15,70%,55%)] font-mono">${describedToken.ticker}</span>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-[hsl(35,15%,85%)]">
                        <Input
                          placeholder="Enter your SOL wallet address..."
                          value={walletAddress}
                          onChange={(e) => setWalletAddress(e.target.value)}
                          className="claude-input font-mono text-sm mb-4"
                        />
                        <Button
                          onClick={handleDescribeLaunch}
                          disabled={isLaunching || !walletAddress}
                          className="claude-btn-primary w-full h-12"
                        >
                          {isLaunching ? (
                            <><Rocket className="h-5 w-5 mr-2 animate-bounce" /> Launching...</>
                          ) : (
                            <><Rocket className="h-5 w-5 mr-2" /> Launch Token</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Phantom Mode */}
              {generatorMode === "phantom" && (
                <div className="space-y-6">
                  {/* Wallet Connection */}
                  <div className="p-4 bg-[hsl(40,30%,96%)] rounded-xl">
                    {phantomWallet.isConnected ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[hsl(260,50%,95%)] flex items-center justify-center">
                            <Wallet className="h-5 w-5 text-[hsl(260,50%,50%)]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[hsl(25,30%,15%)]">Connected</p>
                            <p className="text-xs font-mono text-[hsl(25,10%,55%)]">{shortenAddress(phantomWallet.address)}</p>
                          </div>
                        </div>
                        <Button onClick={phantomWallet.disconnect} variant="ghost" size="sm" className="text-[hsl(25,10%,55%)]">
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-[hsl(25,10%,55%)] mb-3">Connect your wallet to pay launch fees (~0.02 SOL)</p>
                        <Button onClick={phantomWallet.connect} className="claude-btn-primary">
                          <Wallet className="h-4 w-4 mr-2" /> Connect Phantom
                        </Button>
                      </div>
                    )}
                  </div>

                  {phantomWallet.isConnected && (
                    <>
                      {/* Phantom Input Mode Selector */}
                      <div className="flex gap-2 p-1 bg-[hsl(35,20%,92%)] rounded-xl">
                        {[
                          { id: "random", label: "Random", icon: Shuffle },
                          { id: "describe", label: "Describe", icon: Sparkles },
                          { id: "custom", label: "Custom", icon: Image },
                        ].map((mode) => (
                          <button
                            key={mode.id}
                            onClick={() => {
                              setPhantomInputMode(mode.id as any);
                              setPhantomMeme(null);
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                              phantomInputMode === mode.id
                                ? "bg-white text-[hsl(25,30%,15%)] shadow-sm"
                                : "text-[hsl(25,10%,55%)] hover:text-[hsl(25,15%,40%)]"
                            }`}
                          >
                            <mode.icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{mode.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Random Mode */}
                      {phantomInputMode === "random" && (
                        <>
                          <div className="flex items-start gap-5 p-5 bg-[hsl(40,30%,96%)] rounded-2xl">
                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white border border-[hsl(35,15%,85%)] flex-shrink-0">
                              {phantomMeme?.imageUrl ? (
                                <img src={phantomMeme.imageUrl} alt="Token" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Bot className="h-8 w-8 text-[hsl(25,10%,75%)]" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 space-y-2">
                              {phantomMeme ? (
                                <>
                                  <Input
                                    value={phantomMeme.name}
                                    onChange={(e) => setPhantomMeme({ ...phantomMeme, name: e.target.value.slice(0, 20) })}
                                    className="claude-input font-semibold"
                                    maxLength={20}
                                  />
                                  <div className="flex items-center gap-2">
                                    <span className="text-[hsl(15,70%,55%)] font-semibold">$</span>
                                    <Input
                                      value={phantomMeme.ticker}
                                      onChange={(e) => setPhantomMeme({ ...phantomMeme, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) })}
                                      className="claude-input w-28 font-mono"
                                      maxLength={6}
                                    />
                                  </div>
                                </>
                              ) : (
                                <p className="text-[hsl(25,10%,55%)] py-4">Click Generate to create a token</p>
                              )}
                            </div>
                          </div>

                          <Button
                            onClick={handlePhantomRandomize}
                            disabled={isPhantomGenerating}
                            className="w-full claude-btn-secondary"
                          >
                            {isPhantomGenerating ? <Shuffle className="h-4 w-4 mr-2 animate-spin" /> : <Shuffle className="h-4 w-4 mr-2" />}
                            {isPhantomGenerating ? "Generating..." : "Generate Random Token"}
                          </Button>
                        </>
                      )}

                      {/* Describe Mode */}
                      {phantomInputMode === "describe" && (
                        <>
                          <div className="p-5 bg-[hsl(40,30%,96%)] rounded-2xl space-y-4">
                            <Textarea
                              value={phantomDescribePrompt}
                              onChange={(e) => setPhantomDescribePrompt(e.target.value)}
                              placeholder="Describe your meme concept... (e.g., 'A friendly robot cat wearing sunglasses')"
                              className="claude-input min-h-[100px] resize-none"
                            />
                            <Button
                              onClick={handlePhantomDescribeGenerate}
                              disabled={isPhantomGenerating || !phantomDescribePrompt.trim()}
                              className="w-full claude-btn-secondary"
                            >
                              {isPhantomGenerating ? <Sparkles className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                              {isPhantomGenerating ? "Creating..." : "Generate from Description"}
                            </Button>
                          </div>

                          {phantomMeme && (
                            <div className="flex items-center gap-4 p-4 bg-[hsl(40,30%,96%)] rounded-xl">
                              <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[hsl(15,70%,55%)]">
                                <img src={phantomMeme.imageUrl} alt={phantomMeme.name} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <Input
                                  value={phantomMeme.name}
                                  onChange={(e) => setPhantomMeme({ ...phantomMeme, name: e.target.value.slice(0, 20) })}
                                  className="claude-input font-semibold mb-1"
                                  maxLength={20}
                                />
                                <div className="flex items-center gap-1">
                                  <span className="text-[hsl(15,70%,55%)] font-mono">$</span>
                                  <Input
                                    value={phantomMeme.ticker}
                                    onChange={(e) => setPhantomMeme({ ...phantomMeme, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) })}
                                    className="claude-input w-24 font-mono text-sm"
                                    maxLength={6}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Custom Mode */}
                      {phantomInputMode === "custom" && (
                        <div className="p-5 bg-[hsl(40,30%,96%)] rounded-2xl space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white border border-[hsl(35,15%,85%)] flex-shrink-0">
                              {(phantomImagePreview || phantomToken.imageUrl) ? (
                                <img src={phantomImagePreview || phantomToken.imageUrl} alt="Token" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Image className="h-8 w-8 text-[hsl(25,10%,75%)]" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 space-y-2">
                              <Input
                                value={phantomToken.name}
                                onChange={(e) => setPhantomToken({ ...phantomToken, name: e.target.value.slice(0, 20) })}
                                className="claude-input font-semibold"
                                placeholder="Token name"
                                maxLength={20}
                              />
                              <div className="flex items-center gap-2">
                                <span className="text-[hsl(15,70%,55%)] font-semibold">$</span>
                                <Input
                                  value={phantomToken.ticker}
                                  onChange={(e) => setPhantomToken({ ...phantomToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })}
                                  className="claude-input w-28 font-mono"
                                  placeholder="TICKER"
                                  maxLength={10}
                                />
                              </div>
                            </div>
                          </div>

                          <Textarea
                            value={phantomToken.description}
                            onChange={(e) => setPhantomToken({ ...phantomToken, description: e.target.value })}
                            placeholder="Description (optional)"
                            className="claude-input min-h-[60px]"
                          />

                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handlePhantomImageChange}
                            className="claude-input text-sm"
                          />
                        </div>
                      )}

                      <Button
                        onClick={handlePhantomLaunch}
                        disabled={isPhantomLaunching || (!phantomMeme && !phantomToken.name.trim())}
                        className="claude-btn-primary w-full h-12 text-base"
                      >
                        {isPhantomLaunching ? (
                          <><Rocket className="h-5 w-5 mr-2 animate-bounce" /> Launching...</>
                        ) : (
                          <><Rocket className="h-5 w-5 mr-2" /> Launch with Phantom</>
                        )}
                      </Button>

                      <p className="text-xs text-center text-[hsl(25,10%,55%)]">
                        You pay ~0.02 SOL and receive 50% of trading fees
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stats Sidebar */}
          <div className="lg:col-span-2 space-y-4">
            <div className="claude-stat-card">
              <div className="flex items-center gap-3 mb-1">
                <BarChart3 className="h-5 w-5 text-[hsl(15,70%,55%)]" />
                <span className="text-sm text-[hsl(25,10%,55%)]">Total Tokens</span>
              </div>
              <div className="claude-stat-value">{tokens.length.toLocaleString()}</div>
            </div>

            <div className="claude-stat-card">
              <div className="flex items-center gap-3 mb-1">
                <Coins className="h-5 w-5 text-[hsl(150,45%,40%)]" />
                <span className="text-sm text-[hsl(25,10%,55%)]">Creator Earnings</span>
              </div>
              <div className="claude-stat-value">{formatSOL(totalCreatorPaid)} SOL</div>
              <div className="claude-stat-label">{formatUsd(totalCreatorPaid)}</div>
            </div>

            <div className="claude-stat-card">
              <div className="flex items-center gap-3 mb-1">
                <ArrowDownCircle className="h-5 w-5 text-[hsl(200,50%,45%)]" />
                <span className="text-sm text-[hsl(25,10%,55%)]">Token Buybacks</span>
              </div>
              <div className="claude-stat-value">{formatSOL(totalBuybacks)} SOL</div>
              <div className="claude-stat-label">{formatUsd(totalBuybacks)}</div>
            </div>

            <div className="claude-stat-card">
              <div className="flex items-center gap-3 mb-1">
                <Zap className="h-5 w-5 text-[hsl(45,90%,50%)]" />
                <span className="text-sm text-[hsl(25,10%,55%)]">Last Update</span>
              </div>
              <div className="text-lg font-semibold text-[hsl(25,30%,15%)]">
                {lastUpdate ? formatDistanceToNow(lastUpdate, { addSuffix: true }) : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="claude-divider" />

        {/* Token Table - COMPLETELY DIFFERENT STRUCTURE */}
        <section className="claude-animate-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[hsl(25,30%,15%)]">Live Tokens</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[hsl(150,45%,40%)] rounded-full animate-pulse" />
              <span className="text-sm text-[hsl(25,10%,55%)]">Real-time</span>
            </div>
          </div>

          <div className="claude-card overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[48px_1fr_120px_100px_100px] gap-4 px-5 py-4 bg-[hsl(35,20%,92%)] border-b border-[hsl(35,15%,85%)] text-xs font-medium uppercase tracking-wide text-[hsl(25,10%,55%)]">
              <div>#</div>
              <div>Token</div>
              <div className="text-right">Market Cap</div>
              <div className="text-center">Progress</div>
              <div className="text-right">Action</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-[hsl(35,10%,90%)]">
              {tokensLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[48px_1fr_120px_100px_100px] gap-4 px-5 py-4 items-center">
                    <Skeleton className="h-4 w-6 bg-[hsl(35,20%,90%)]" />
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-xl bg-[hsl(35,20%,90%)]" />
                      <div>
                        <Skeleton className="h-4 w-24 mb-1 bg-[hsl(35,20%,90%)]" />
                        <Skeleton className="h-3 w-16 bg-[hsl(35,20%,90%)]" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-16 ml-auto bg-[hsl(35,20%,90%)]" />
                    <Skeleton className="h-2 w-full bg-[hsl(35,20%,90%)]" />
                    <Skeleton className="h-8 w-16 ml-auto bg-[hsl(35,20%,90%)]" />
                  </div>
                ))
              ) : tokens.length === 0 ? (
                <div className="p-12 text-center text-[hsl(25,10%,55%)]">
                  No tokens launched yet. Be the first!
                </div>
              ) : (
                tokens.slice((tokensPage - 1) * tokensPageSize, tokensPage * tokensPageSize).map((token, index) => (
                  <div 
                    key={token.id} 
                    className="grid grid-cols-[48px_1fr_120px_100px_100px] gap-4 px-5 py-4 items-center hover:bg-[hsl(40,30%,98%)] transition-colors"
                  >
                    <div className="text-sm text-[hsl(25,10%,55%)]">
                      {(tokensPage - 1) * tokensPageSize + index + 1}
                    </div>
                    
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="claude-avatar">
                        {token.image_url ? (
                          <img src={token.image_url} alt={token.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[hsl(25,10%,75%)] text-xs font-bold">
                            {token.ticker?.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[hsl(25,30%,15%)] truncate">{token.name}</span>
                          <button
                            onClick={() => copyToClipboard(token.mint_address!)}
                            className="text-[hsl(25,10%,70%)] hover:text-[hsl(15,70%,55%)] transition-colors"
                          >
                            {copiedAddress === token.mint_address ? (
                              <CheckCircle className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[hsl(25,10%,55%)]">
                          <span className="font-mono text-[hsl(15,70%,55%)]">${token.ticker}</span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {token.holder_count || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold text-[hsl(25,30%,15%)]">{formatUsd(token.market_cap_sol || 0)}</div>
                      <div className="text-xs text-[hsl(25,10%,55%)]">{formatSOL(token.market_cap_sol || 0)} SOL</div>
                    </div>

                    <div>
                      <div className="claude-progress">
                        <div style={{ width: `${token.bonding_progress || 0}%` }} />
                      </div>
                      <div className="text-xs text-center text-[hsl(25,10%,55%)] mt-1">
                        {(token.bonding_progress || 0).toFixed(1)}%
                      </div>
                    </div>

                    <div className="text-right">
                      <a
                        href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}?chain=sol`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[hsl(15,70%,55%)] hover:bg-[hsl(15,70%,55%,0.1)] rounded-lg transition-colors"
                      >
                        Trade
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {tokens.length > tokensPageSize && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-[hsl(35,15%,85%)] bg-[hsl(40,30%,98%)]">
                <span className="text-sm text-[hsl(25,10%,55%)]">
                  {(tokensPage - 1) * tokensPageSize + 1}–{Math.min(tokensPage * tokensPageSize, tokens.length)} of {tokens.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={tokensPage === 1}
                    onClick={() => setTokensPage(p => p - 1)}
                    className="h-8 px-3 text-[hsl(25,10%,55%)] hover:text-[hsl(25,30%,15%)] disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={tokensPage >= Math.ceil(tokens.length / tokensPageSize)}
                    onClick={() => setTokensPage(p => p + 1)}
                    className="h-8 px-3 text-[hsl(25,10%,55%)] hover:text-[hsl(25,30%,15%)] disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Launch Result Modal */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="bg-white border-[hsl(35,15%,85%)] text-[hsl(25,30%,15%)] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {launchResult?.success ? (
                <>
                  <PartyPopper className="h-6 w-6 text-[hsl(15,70%,55%)]" />
                  Token Launched!
                </>
              ) : (
                <>
                  <AlertTriangle className="h-6 w-6 text-[hsl(0,55%,50%)]" />
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
              <div className="flex items-center gap-4 p-4 bg-[hsl(40,30%,96%)] rounded-xl">
                {launchResult.imageUrl && (
                  <img
                    src={launchResult.imageUrl}
                    alt={launchResult.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[hsl(15,70%,55%)]"
                  />
                )}
                <div>
                  <h3 className="font-bold text-lg">{launchResult.name}</h3>
                  <span className="text-[hsl(15,70%,55%)] font-mono">${launchResult.ticker}</span>
                </div>
              </div>

              <div className={`p-3 rounded-xl ${launchResult.onChainSuccess ? "bg-[hsl(150,45%,40%,0.1)] border border-[hsl(150,45%,40%,0.3)]" : "bg-[hsl(45,90%,50%,0.1)] border border-[hsl(45,90%,50%,0.3)]"}`}>
                <p className="text-sm">{launchResult.message}</p>
              </div>

              {launchResult.mintAddress && (
                <div className="space-y-2">
                  <label className="text-xs text-[hsl(25,10%,55%)]">Contract Address</label>
                  <div className="flex items-center gap-2 p-3 bg-[hsl(40,30%,96%)] rounded-xl">
                    <code className="flex-1 text-sm font-mono text-[hsl(25,15%,40%)] break-all">
                      {launchResult.mintAddress}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(launchResult.mintAddress!)}
                      className="shrink-0"
                    >
                      {copiedAddress === launchResult.mintAddress ? (
                        <CheckCircle className="h-4 w-4 text-[hsl(15,70%,55%)]" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="p-3 bg-[hsl(15,70%,55%,0.1)] border border-[hsl(15,70%,55%,0.2)] rounded-xl">
                <p className="text-sm text-[hsl(15,70%,50%)] font-medium">
                  💡 Make a small initial purchase to kickstart trading and generate fees!
                </p>
              </div>

              <div className="flex gap-2">
                {launchResult.solscanUrl && (
                  <Button
                    variant="outline"
                    className="flex-1 border-[hsl(35,15%,85%)] hover:bg-[hsl(40,30%,96%)]"
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
                    className="flex-1 claude-btn-primary"
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
              <div className="p-4 bg-[hsl(0,55%,50%,0.1)] border border-[hsl(0,55%,50%,0.2)] rounded-xl">
                <p className="text-sm text-[hsl(0,55%,45%)]">{launchResult?.error || "An unknown error occurred"}</p>
              </div>
              <Button
                onClick={() => setShowResultModal(false)}
                className="w-full claude-btn-secondary"
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
