import { useState, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  Image,
  Download,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Trophy,
  Link as LinkIcon,
  Repeat2
} from "lucide-react";
import { useBannerGenerator } from "@/hooks/useBannerGenerator";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { usePhantomWallet } from "@/hooks/usePhantomWallet";
import { VersionedTransaction } from "@solana/web3.js";
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

type MainTab = "tokens" | "top" | "claimed" | "buybacks" | "creators";

export default function ClaudeLauncherPage() {
  const { toast } = useToast();
  const { solPrice } = useSolPrice();
  const isMobile = useIsMobile();
  const { tokens, isLoading: tokensLoading, lastUpdate, refetch } = useFunTokens();

  // Main tabs
  const [activeTab, setActiveTab] = useState<MainTab>("tokens");
  
  // Pagination
  const [tokensPage, setTokensPage] = useState(1);
  const [claimedPage, setClaimedPage] = useState(1);
  const pageSize = 15;

  // Data hooks
  const { data: feeClaimsData, isLoading: claimsLoading } = useFunFeeClaims({ page: claimedPage, pageSize });
  const { data: summary } = useFunFeeClaimsSummary();
  const { data: distributions = [] } = useFunDistributions();
  const { data: buybacks = [], isLoading: buybacksLoading } = useFunBuybacks();
  const { data: topPerformers = [], isLoading: topPerformersLoading } = useFunTopPerformers(10);

  // Generator state
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
  
  // Phantom wallet
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

  // Computed stats
  const totalCreatorPaid = useMemo(() => 
    distributions.filter(d => d.status === 'completed').reduce((sum, d) => sum + d.amount_sol, 0), 
    [distributions]
  );
  const totalBuybacks = useMemo(() => 
    buybacks.filter(b => b.status === 'completed').reduce((sum, b) => sum + b.amount_sol, 0), 
    [buybacks]
  );

  // Creators data
  const creatorsData = useMemo(() => {
    const creatorMap = new Map<string, { wallet: string; tokens: number; totalEarned: number }>();
    
    tokens.forEach(token => {
      const existing = creatorMap.get(token.creator_wallet) || { 
        wallet: token.creator_wallet, 
        tokens: 0, 
        totalEarned: 0 
      };
      existing.tokens++;
      creatorMap.set(token.creator_wallet, existing);
    });
    
    distributions.filter(d => d.status === 'completed').forEach(dist => {
      const existing = creatorMap.get(dist.creator_wallet);
      if (existing) {
        existing.totalEarned += dist.amount_sol;
      }
    });
    
    return Array.from(creatorMap.values()).sort((a, b) => b.totalEarned - a.totalEarned);
  }, [tokens, distributions]);

  // Helpers
  const isValidSolanaAddress = (address: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const shortenAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

  const formatSOL = (amount: number) => amount.toFixed(6);

  const formatUsd = (sol: number) => {
    if (!solPrice) return `${formatSOL(sol)} SOL`;
    return `$${(sol * solPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Generator handlers
  const handleRandomize = useCallback(async () => {
    setIsGenerating(true);
    setMeme(null);
    clearBanner();
    
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: {} });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");

      if (data?.meme) {
        setMeme(data.meme);
        toast({ title: "Token Generated! 🎲", description: `${data.meme.name} ($${data.meme.ticker}) is ready!` });
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed to generate", variant: "destructive" });
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

  const performLaunch = useCallback(async (tokenToLaunch: MemeToken) => {
    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      toast({ title: "Invalid wallet", description: "Enter a valid Solana address", variant: "destructive" });
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

      if (error) throw new Error(error.message || error.toString());
      if (!data?.success) throw new Error(data?.error || "Launch failed");

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
      toast({ title: "🚀 Token Launched!", description: `${data.name || tokenToLaunch.name} is now live!` });
      setMeme(null);
      clearBanner();
      setCustomToken({ name: "", ticker: "", description: "", imageUrl: "", websiteUrl: "", twitterUrl: "", telegramUrl: "", discordUrl: "" });
      setCustomImageFile(null);
      setCustomImagePreview(null);
      setWalletAddress("");
      refetch();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to launch";
      setLaunchResult({ success: false, error: msg });
      setShowResultModal(true);
      toast({ title: "Launch Failed", description: msg.slice(0, 100), variant: "destructive" });
    } finally {
      setIsLaunching(false);
    }
  }, [walletAddress, toast, clearBanner, refetch]);

  const handleLaunch = useCallback(async () => {
    if (!meme) {
      toast({ title: "No token", description: "Generate a token first", variant: "destructive" });
      return;
    }
    await performLaunch(meme);
  }, [meme, performLaunch, toast]);

  const handleCustomImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setCustomImageFile(file);
    setCustomImagePreview(URL.createObjectURL(file));
  }, [toast]);

  const handleCustomLaunch = useCallback(async () => {
    if (!customToken.name.trim() || !customToken.ticker.trim()) {
      toast({ title: "Missing info", description: "Name and ticker required", variant: "destructive" });
      return;
    }
    if (!customImageFile && !customToken.imageUrl.trim()) {
      toast({ title: "Image required", variant: "destructive" });
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
      toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    }
  }, [customToken, performLaunch, toast, uploadCustomImageIfNeeded]);

  const handleDescribeGenerate = useCallback(async () => {
    if (!describePrompt.trim()) {
      toast({ title: "Enter description", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    setDescribedToken(null);
    clearBanner();
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: { description: describePrompt } });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);
      if (data?.meme) {
        setDescribedToken(data.meme);
        if (data.meme.imageUrl) {
          await generateBanner({ imageUrl: data.meme.imageUrl, tokenName: data.meme.name, ticker: data.meme.ticker });
        }
        toast({ title: "Token Generated! 🎨", description: `${data.meme.name} ($${data.meme.ticker})` });
      }
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : "Error", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [describePrompt, toast, clearBanner, generateBanner]);

  const handleDescribeLaunch = useCallback(async () => {
    if (!describedToken) {
      toast({ title: "Generate first", variant: "destructive" });
      return;
    }
    await performLaunch(describedToken);
  }, [describedToken, performLaunch, toast]);

  // Phantom handlers
  const uploadPhantomImageIfNeeded = useCallback(async (): Promise<string> => {
    if (!phantomImageFile) return phantomToken.imageUrl;
    const fileExt = phantomImageFile.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `token-images/${fileName}`;
    const { error } = await supabase.storage.from('post-images').upload(filePath, phantomImageFile);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
    return urlData.publicUrl;
  }, [phantomImageFile, phantomToken.imageUrl]);

  const handlePhantomRandomize = useCallback(async () => {
    setIsPhantomGenerating(true);
    setPhantomMeme(null);
    clearBanner();
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: {} });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);
      if (data?.meme) {
        setPhantomMeme(data.meme);
        toast({ title: "Token Generated! 🎲", description: `${data.meme.name} ($${data.meme.ticker})` });
      }
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : "Error", variant: "destructive" });
    } finally {
      setIsPhantomGenerating(false);
    }
  }, [toast, clearBanner]);

  const handlePhantomDescribeGenerate = useCallback(async () => {
    if (!phantomDescribePrompt.trim()) {
      toast({ title: "Enter description", variant: "destructive" });
      return;
    }
    setIsPhantomGenerating(true);
    setPhantomMeme(null);
    clearBanner();
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: { description: phantomDescribePrompt } });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);
      if (data?.meme) {
        setPhantomMeme(data.meme);
        toast({ title: "Generated! 🎨", description: `${data.meme.name} ($${data.meme.ticker})` });
      }
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : "Error", variant: "destructive" });
    } finally {
      setIsPhantomGenerating(false);
    }
  }, [phantomDescribePrompt, toast, clearBanner]);

  const handlePhantomImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setPhantomImageFile(file);
    setPhantomImagePreview(URL.createObjectURL(file));
  }, [toast]);

  const handlePhantomLaunch = useCallback(async () => {
    if (!phantomWallet.isConnected || !phantomWallet.address) {
      toast({ title: "Connect Phantom", variant: "destructive" });
      return;
    }

    let tokenData: MemeToken;
    if (phantomInputMode === "custom") {
      if (!phantomToken.name.trim() || !phantomToken.ticker.trim()) {
        toast({ title: "Missing info", variant: "destructive" });
        return;
      }
      if (!phantomImageFile && !phantomToken.imageUrl) {
        toast({ title: "Image required", variant: "destructive" });
        return;
      }
      try {
        const imageUrl = await uploadPhantomImageIfNeeded();
        tokenData = { ...phantomToken, imageUrl, name: phantomToken.name.slice(0, 20), ticker: phantomToken.ticker.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) };
      } catch {
        toast({ title: "Upload failed", variant: "destructive" });
        return;
      }
    } else {
      if (!phantomMeme) {
        toast({ title: "Generate first", variant: "destructive" });
        return;
      }
      tokenData = phantomMeme;
    }

    setIsPhantomLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke("fun-phantom-create", {
        body: {
          name: tokenData.name,
          ticker: tokenData.ticker,
          description: tokenData.description,
          imageUrl: tokenData.imageUrl,
          websiteUrl: tokenData.websiteUrl,
          twitterUrl: tokenData.twitterUrl,
          telegramUrl: tokenData.telegramUrl,
          discordUrl: tokenData.discordUrl,
          creatorWallet: phantomWallet.address,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to prepare");

      const { configTxBase64, poolTxBase64, mintAddress, dbcPoolAddress } = data;

      const configTx = VersionedTransaction.deserialize(Buffer.from(configTxBase64, 'base64'));
      const poolTx = VersionedTransaction.deserialize(Buffer.from(poolTxBase64, 'base64'));

      toast({ title: "Sign Config Transaction", description: "Approve in Phantom..." });
      const signedConfig = await phantomWallet.signTransaction(configTx);
      if (!signedConfig) throw new Error("Config signing cancelled");
      
      const rpcUrl = import.meta.env.VITE_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const configSig = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendTransaction',
          params: [
            Buffer.from(signedConfig.serialize()).toString('base64'), 
            { skipPreflight: false, preflightCommitment: 'confirmed' }
          ]
        })
      }).then(r => r.json());

      if (configSig.error) throw new Error(configSig.error.message || 'Config TX failed');
      
      toast({ title: "Sign Pool Transaction", description: "Approve in Phantom..." });
      const signedPool = await phantomWallet.signTransaction(poolTx);
      if (!signedPool) throw new Error("Pool signing cancelled");
      
      const poolSig = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendTransaction',
          params: [
            Buffer.from(signedPool.serialize()).toString('base64'), 
            { skipPreflight: false, preflightCommitment: 'confirmed' }
          ]
        })
      }).then(r => r.json());

      if (poolSig.error) throw new Error(poolSig.error.message || 'Pool TX failed');

      // Phase 2: Record in DB
      await supabase.functions.invoke("fun-phantom-create", {
        body: {
          confirmed: true,
          mintAddress,
          dbcPoolAddress,
          name: tokenData.name,
          ticker: tokenData.ticker,
          description: tokenData.description,
          imageUrl: tokenData.imageUrl,
          websiteUrl: tokenData.websiteUrl,
          twitterUrl: tokenData.twitterUrl,
          telegramUrl: tokenData.telegramUrl,
          discordUrl: tokenData.discordUrl,
          creatorWallet: phantomWallet.address,
        },
      });

      setLaunchResult({
        success: true,
        name: tokenData.name,
        ticker: tokenData.ticker,
        mintAddress,
        imageUrl: tokenData.imageUrl,
        onChainSuccess: true,
        solscanUrl: `https://solscan.io/token/${mintAddress}`,
        tradeUrl: `https://axiom.trade/meme/${dbcPoolAddress}?chain=sol`,
        message: "Token launched with your Phantom wallet!",
      });
      setShowResultModal(true);
      toast({ title: "🚀 Token Launched!", description: `${tokenData.name} is live!` });
      setPhantomMeme(null);
      setPhantomToken({ name: "", ticker: "", description: "", imageUrl: "", websiteUrl: "", twitterUrl: "", telegramUrl: "", discordUrl: "" });
      setPhantomImageFile(null);
      setPhantomImagePreview(null);
      refetch();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Launch failed";
      toast({ title: "Failed", description: msg.slice(0, 100), variant: "destructive" });
    } finally {
      setIsPhantomLaunching(false);
    }
  }, [phantomWallet, phantomInputMode, phantomToken, phantomMeme, phantomImageFile, uploadPhantomImageIfNeeded, toast, refetch]);

  // Tab content renderers
  const renderTokensTab = () => {
    const paginatedTokens = tokens.slice((tokensPage - 1) * pageSize, tokensPage * pageSize);
    const totalPages = Math.ceil(tokens.length / pageSize);

    return (
      <div className="claude-card">
        <div className="claude-section-header px-5 py-4 border-b border-[hsl(220,12%,20%)]">
          <div className="claude-section-icon"><BarChart3 /></div>
          <span className="claude-section-title">Live Tokens</span>
          <span className="ml-auto text-sm text-[hsl(220,10%,45%)]">{tokens.length} total</span>
        </div>
        
        <div className="claude-table-wrapper">
          <table className="claude-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Token</th>
                <th className="text-right">Market Cap</th>
                <th className="text-center" style={{ width: 100 }}>Progress</th>
                <th className="text-right" style={{ width: 100 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tokensLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td><Skeleton className="h-4 w-6 bg-[hsl(220,12%,18%)]" /></td>
                    <td>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-xl bg-[hsl(220,12%,18%)]" />
                        <div>
                          <Skeleton className="h-4 w-24 mb-1 bg-[hsl(220,12%,18%)]" />
                          <Skeleton className="h-3 w-16 bg-[hsl(220,12%,18%)]" />
                        </div>
                      </div>
                    </td>
                    <td><Skeleton className="h-4 w-20 ml-auto bg-[hsl(220,12%,18%)]" /></td>
                    <td><Skeleton className="h-2 w-full bg-[hsl(220,12%,18%)]" /></td>
                    <td><Skeleton className="h-8 w-16 ml-auto bg-[hsl(220,12%,18%)]" /></td>
                  </tr>
                ))
              ) : paginatedTokens.length === 0 ? (
                <tr>
                  <td colSpan={5} className="claude-empty">No tokens yet. Be the first!</td>
                </tr>
              ) : (
                paginatedTokens.map((token, idx) => (
                  <tr key={token.id}>
                    <td className="text-[hsl(220,10%,45%)]">{(tokensPage - 1) * pageSize + idx + 1}</td>
                    <td>
                      <div className="claude-token-cell">
                        <div className="claude-avatar">
                          {token.image_url ? (
                            <img src={token.image_url} alt={token.name} />
                          ) : (
                            <span className="text-xs font-bold text-[hsl(220,10%,45%)]">{token.ticker?.slice(0, 2)}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{token.name}</span>
                            <button onClick={() => copyToClipboard(token.mint_address!)} className="claude-copy-btn">
                              {copiedAddress === token.mint_address ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[hsl(220,10%,45%)]">
                            <span className="text-[hsl(160,70%,50%)] font-mono">${token.ticker}</span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{token.holder_count || 0}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="font-semibold">{formatUsd(token.market_cap_sol || 0)}</div>
                      <div className="text-xs text-[hsl(220,10%,45%)]">{formatSOL(token.market_cap_sol || 0)} SOL</div>
                    </td>
                    <td>
                      <div className="claude-progress">
                        <div className="claude-progress-bar" style={{ width: `${token.bonding_progress || 0}%` }} />
                      </div>
                      <div className="text-xs text-center text-[hsl(220,10%,45%)] mt-1">{(token.bonding_progress || 0).toFixed(1)}%</div>
                    </td>
                    <td className="text-right">
                      <a
                        href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}?chain=sol`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="claude-link"
                      >
                        Trade <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="claude-pagination">
            <span className="claude-pagination-info">
              {(tokensPage - 1) * pageSize + 1}–{Math.min(tokensPage * pageSize, tokens.length)} of {tokens.length}
            </span>
            <div className="claude-pagination-buttons">
              <button className="claude-page-btn" disabled={tokensPage === 1} onClick={() => setTokensPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <button className="claude-page-btn" disabled={tokensPage >= totalPages} onClick={() => setTokensPage(p => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTopTab = () => (
    <div className="claude-card">
      <div className="claude-section-header px-5 py-4 border-b border-[hsl(220,12%,20%)]">
        <div className="claude-section-icon"><Trophy /></div>
        <span className="claude-section-title">Top Performers</span>
      </div>
      
      <div className="claude-table-wrapper">
        <table className="claude-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Token</th>
              <th className="text-right">Market Cap</th>
              <th className="text-right">24h Volume</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {topPerformersLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td><Skeleton className="h-4 w-6 bg-[hsl(220,12%,18%)]" /></td>
                  <td><Skeleton className="h-10 w-32 bg-[hsl(220,12%,18%)]" /></td>
                  <td><Skeleton className="h-4 w-20 ml-auto bg-[hsl(220,12%,18%)]" /></td>
                  <td><Skeleton className="h-4 w-20 ml-auto bg-[hsl(220,12%,18%)]" /></td>
                  <td><Skeleton className="h-8 w-16 ml-auto bg-[hsl(220,12%,18%)]" /></td>
                </tr>
              ))
            ) : topPerformers.length === 0 ? (
              <tr><td colSpan={5} className="claude-empty">No performers yet</td></tr>
            ) : (
              topPerformers.map((token: any, idx: number) => (
                <tr key={token.id}>
                  <td className="text-[hsl(220,10%,45%)]">{idx + 1}</td>
                  <td>
                    <div className="claude-token-cell">
                      <div className="claude-avatar">
                        {token.image_url ? <img src={token.image_url} alt={token.name} /> : <span className="text-xs font-bold text-[hsl(220,10%,45%)]">{token.ticker?.slice(0, 2)}</span>}
                      </div>
                      <div>
                        <span className="font-medium">{token.name}</span>
                        <div className="text-xs text-[hsl(160,70%,50%)] font-mono">${token.ticker}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right font-semibold">{formatUsd(token.market_cap_sol || 0)}</td>
                  <td className="text-right text-[hsl(160,70%,50%)]">{formatSOL(token.volume_24h_sol || 0)} SOL</td>
                  <td className="text-right">
                    <a href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}?chain=sol`} target="_blank" rel="noopener noreferrer" className="claude-link">
                      Trade <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderClaimedTab = () => {
    const claims = feeClaimsData?.items || [];
    const totalClaims = feeClaimsData?.count || 0;
    const totalPages = Math.ceil(totalClaims / pageSize);

    return (
      <div className="claude-card">
        <div className="claude-section-header px-5 py-4 border-b border-[hsl(220,12%,20%)]">
          <div className="claude-section-icon"><LinkIcon /></div>
          <span className="claude-section-title">Claimed Fees from Pools</span>
          <div className="ml-auto claude-total-badge">
            Total: <strong>{formatSOL(summary?.totalClaimedSol || 0)} SOL</strong>
          </div>
        </div>
        
        <div className="claude-table-wrapper">
          <table className="claude-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Creator Wallet</th>
                <th className="text-right">Amount (SOL)</th>
                <th className="text-right">Time</th>
                <th className="text-right">TX</th>
              </tr>
            </thead>
            <tbody>
              {claimsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td><Skeleton className="h-10 w-32 bg-[hsl(220,12%,18%)]" /></td>
                    <td><Skeleton className="h-6 w-28 bg-[hsl(220,12%,18%)]" /></td>
                    <td><Skeleton className="h-4 w-20 ml-auto bg-[hsl(220,12%,18%)]" /></td>
                    <td><Skeleton className="h-4 w-24 ml-auto bg-[hsl(220,12%,18%)]" /></td>
                    <td><Skeleton className="h-4 w-12 ml-auto bg-[hsl(220,12%,18%)]" /></td>
                  </tr>
                ))
              ) : claims.length === 0 ? (
                <tr><td colSpan={5} className="claude-empty">No claims yet</td></tr>
              ) : (
                claims.map((claim) => (
                  <tr key={claim.id}>
                    <td>
                      <div className="claude-token-cell">
                        <div className="claude-avatar">
                          {claim.fun_token?.image_url ? <img src={claim.fun_token.image_url} alt={claim.fun_token.name} /> : <span className="text-xs font-bold text-[hsl(220,10%,45%)]">{claim.fun_token?.ticker?.slice(0, 2)}</span>}
                        </div>
                        <div>
                          <span className="font-medium">{claim.fun_token?.name || "Unknown"}</span>
                          <div className="text-xs text-[hsl(160,70%,50%)] font-mono">${claim.fun_token?.ticker}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="claude-wallet">
                        <Wallet className="claude-wallet-icon" />
                        {shortenAddress(claim.fun_token?.creator_wallet || claim.pool_address)}
                        <button onClick={() => copyToClipboard(claim.fun_token?.creator_wallet || claim.pool_address)} className="claude-copy-btn">
                          {copiedAddress === (claim.fun_token?.creator_wallet || claim.pool_address) ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="text-right claude-amount-positive">+{formatSOL(claim.claimed_sol)} SOL</td>
                    <td className="text-right claude-time">{formatDistanceToNow(new Date(claim.claimed_at), { addSuffix: true })}</td>
                    <td className="text-right">
                      {claim.signature ? (
                        <a href={`https://solscan.io/tx/${claim.signature}`} target="_blank" rel="noopener noreferrer" className="claude-link">
                          View <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-[hsl(220,10%,45%)]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="claude-pagination">
            <span className="claude-pagination-info">{(claimedPage - 1) * pageSize + 1}–{Math.min(claimedPage * pageSize, totalClaims)} of {totalClaims}</span>
            <div className="claude-pagination-buttons">
              <button className="claude-page-btn" disabled={claimedPage === 1} onClick={() => setClaimedPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <button className="claude-page-btn" disabled={claimedPage >= totalPages} onClick={() => setClaimedPage(p => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBuybacksTab = () => (
    <div className="claude-card">
      <div className="claude-section-header px-5 py-4 border-b border-[hsl(220,12%,20%)]">
        <div className="claude-section-icon"><Repeat2 /></div>
        <span className="claude-section-title">Buybacks</span>
        <div className="ml-auto claude-total-badge">
          Total: <strong>{formatSOL(totalBuybacks)} SOL</strong>
        </div>
      </div>
      
      <div className="claude-table-wrapper">
        <table className="claude-table">
          <thead>
            <tr>
              <th>Token</th>
              <th className="text-right">Amount (SOL)</th>
              <th className="text-right">Tokens Bought</th>
              <th className="text-right">Status</th>
              <th className="text-right">TX</th>
            </tr>
          </thead>
          <tbody>
            {buybacksLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td><Skeleton className="h-10 w-32 bg-[hsl(220,12%,18%)]" /></td>
                  <td><Skeleton className="h-4 w-20 ml-auto bg-[hsl(220,12%,18%)]" /></td>
                  <td><Skeleton className="h-4 w-20 ml-auto bg-[hsl(220,12%,18%)]" /></td>
                  <td><Skeleton className="h-6 w-20 ml-auto bg-[hsl(220,12%,18%)]" /></td>
                  <td><Skeleton className="h-4 w-12 ml-auto bg-[hsl(220,12%,18%)]" /></td>
                </tr>
              ))
            ) : buybacks.length === 0 ? (
              <tr><td colSpan={5} className="claude-empty">No buybacks yet</td></tr>
            ) : (
              buybacks.map((bb) => (
                <tr key={bb.id}>
                  <td>
                    <div className="claude-token-cell">
                      <div className="claude-avatar">
                        {bb.fun_token?.image_url ? <img src={bb.fun_token.image_url} alt={bb.fun_token.name} /> : <span className="text-xs font-bold text-[hsl(220,10%,45%)]">{bb.fun_token?.ticker?.slice(0, 2)}</span>}
                      </div>
                      <div>
                        <span className="font-medium">{bb.fun_token?.name || "Unknown"}</span>
                        <div className="text-xs text-[hsl(160,70%,50%)] font-mono">${bb.fun_token?.ticker}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right font-semibold">{formatSOL(bb.amount_sol)} SOL</td>
                  <td className="text-right text-[hsl(220,10%,65%)]">{bb.tokens_bought?.toLocaleString() || "—"}</td>
                  <td className="text-right">
                    <span className={`claude-badge ${bb.status === 'completed' ? 'claude-badge-success' : ''}`}>
                      {bb.status}
                    </span>
                  </td>
                  <td className="text-right">
                    {bb.signature ? (
                      <a href={`https://solscan.io/tx/${bb.signature}`} target="_blank" rel="noopener noreferrer" className="claude-link">
                        View <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-[hsl(220,10%,45%)]">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCreatorsTab = () => (
    <div className="claude-card">
      <div className="claude-section-header px-5 py-4 border-b border-[hsl(220,12%,20%)]">
        <div className="claude-section-icon"><Users /></div>
        <span className="claude-section-title">Creators</span>
        <span className="ml-auto text-sm text-[hsl(220,10%,45%)]">{creatorsData.length} total</span>
      </div>
      
      <div className="claude-table-wrapper">
        <table className="claude-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Wallet</th>
              <th className="text-right">Tokens</th>
              <th className="text-right">Total Earned</th>
            </tr>
          </thead>
          <tbody>
            {creatorsData.length === 0 ? (
              <tr><td colSpan={4} className="claude-empty">No creators yet</td></tr>
            ) : (
              creatorsData.slice(0, 100).map((creator, idx) => (
                <tr key={creator.wallet}>
                  <td className="text-[hsl(220,10%,45%)]">{idx + 1}</td>
                  <td>
                    <div className="claude-wallet">
                      <Wallet className="claude-wallet-icon" />
                      {shortenAddress(creator.wallet)}
                      <button onClick={() => copyToClipboard(creator.wallet)} className="claude-copy-btn">
                        {copiedAddress === creator.wallet ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="text-right font-medium">{creator.tokens}</td>
                  <td className="text-right claude-amount-positive">+{formatSOL(creator.totalEarned)} SOL</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="claude-theme">
      {/* Header */}
      <header className="claude-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[hsl(160,70%,50%)] flex items-center justify-center">
              <Rocket className="h-5 w-5 text-[hsl(220,15%,8%)]" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Claude Launcher</h1>
              <p className="text-xs text-[hsl(220,10%,45%)]">AI Token Factory</p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs text-[hsl(220,10%,45%)]">
              <span className="w-2 h-2 bg-[hsl(160,70%,50%)] rounded-full animate-pulse" />
              {lastUpdate ? formatDistanceToNow(lastUpdate, { addSuffix: true }) : "Live"}
            </div>
            <Button onClick={() => refetch()} variant="ghost" size="sm" className="claude-btn-ghost">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="claude-stat-card">
            <div className="flex items-center gap-2 mb-1 text-sm text-[hsl(220,10%,45%)]">
              <BarChart3 className="h-4 w-4 text-[hsl(160,70%,50%)]" /> Tokens
            </div>
            <div className="claude-stat-value">{tokens.length}</div>
          </div>
          <div className="claude-stat-card">
            <div className="flex items-center gap-2 mb-1 text-sm text-[hsl(220,10%,45%)]">
              <Coins className="h-4 w-4 text-[hsl(160,70%,50%)]" /> Creator Paid
            </div>
            <div className="claude-stat-value">{formatSOL(totalCreatorPaid)}</div>
            <div className="claude-stat-label">{formatUsd(totalCreatorPaid)}</div>
          </div>
          <div className="claude-stat-card">
            <div className="flex items-center gap-2 mb-1 text-sm text-[hsl(220,10%,45%)]">
              <ArrowDownCircle className="h-4 w-4 text-[hsl(200,80%,55%)]" /> Buybacks
            </div>
            <div className="claude-stat-value">{formatSOL(totalBuybacks)}</div>
            <div className="claude-stat-label">{formatUsd(totalBuybacks)}</div>
          </div>
          <div className="claude-stat-card">
            <div className="flex items-center gap-2 mb-1 text-sm text-[hsl(220,10%,45%)]">
              <Users className="h-4 w-4 text-[hsl(45,90%,55%)]" /> Creators
            </div>
            <div className="claude-stat-value">{creatorsData.length}</div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="mb-6 overflow-x-auto pb-2">
          <div className="claude-tabs-container">
            {[
              { id: "tokens" as MainTab, icon: BarChart3, label: "Tokens", count: tokens.length },
              { id: "top" as MainTab, icon: Trophy, label: "Top" },
              { id: "claimed" as MainTab, icon: LinkIcon, label: "Claimed", count: summary?.claimCount },
              { id: "buybacks" as MainTab, icon: Repeat2, label: "Buybacks", count: buybacks.length },
              { id: "creators" as MainTab, icon: Users, label: "Creators", count: creatorsData.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`claude-tab ${activeTab === tab.id ? "active" : ""}`}
              >
                <tab.icon className="claude-tab-icon" />
                <span>{tab.label}</span>
                {tab.count !== undefined && <span className="text-[hsl(220,10%,45%)]">({tab.count})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mb-12 claude-animate-in">
          {activeTab === "tokens" && renderTokensTab()}
          {activeTab === "top" && renderTopTab()}
          {activeTab === "claimed" && renderClaimedTab()}
          {activeTab === "buybacks" && renderBuybacksTab()}
          {activeTab === "creators" && renderCreatorsTab()}
        </div>

        {/* Generator Section */}
        <div className="border-t border-[hsl(220,12%,20%)] pt-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Launch Your Token</h2>
            <p className="text-[hsl(220,10%,45%)]">AI-generated or custom tokens with instant trading</p>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="claude-card-elevated p-6">
              {/* Mode Selector */}
              <div className="claude-mode-selector mb-6">
                {[
                  { id: "random", label: "Random", icon: Shuffle },
                  { id: "describe", label: "Describe", icon: Sparkles },
                  { id: "custom", label: "Custom", icon: Image },
                  { id: "phantom", label: "Phantom", icon: Wallet },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setGeneratorMode(mode.id as any)}
                    className={`claude-mode-btn ${generatorMode === mode.id ? "active" : ""}`}
                  >
                    <mode.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{mode.label}</span>
                  </button>
                ))}
              </div>

              {/* Random Mode */}
              {generatorMode === "random" && (
                <div className="space-y-6">
                  <div className="claude-preview-box">
                    <div className="claude-preview-avatar">
                      {meme?.imageUrl ? (
                        <img src={meme.imageUrl} alt={meme.name} />
                      ) : (
                        <Bot className="h-8 w-8 text-[hsl(220,10%,45%)]" />
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
                            <span className="text-[hsl(160,70%,50%)] font-semibold">$</span>
                            <Input
                              value={meme.ticker}
                              onChange={(e) => setMeme({ ...meme, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) })}
                              className="claude-input w-24 font-mono"
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
                        <p className="text-[hsl(220,10%,45%)] py-4">Click Generate to create a token</p>
                      )}
                    </div>
                  </div>

                  <Button onClick={handleRandomize} disabled={isGenerating || isLaunching} className="claude-btn-secondary w-full h-12">
                    {isGenerating ? <><Shuffle className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Shuffle className="h-4 w-4 mr-2" /> Generate Token</>}
                  </Button>

                  {meme && (
                    <>
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
                          className="flex-1 claude-btn-ghost border border-[hsl(220,12%,20%)]"
                        >
                          <Download className="h-4 w-4 mr-2" /> Avatar
                        </Button>
                        <Button
                          onClick={() => generateBanner({ imageUrl: meme.imageUrl, tokenName: meme.name, ticker: meme.ticker })}
                          disabled={isBannerGenerating}
                          className="flex-1 claude-btn-ghost border border-[hsl(220,12%,20%)]"
                        >
                          <Image className="h-4 w-4 mr-2" /> Banner
                        </Button>
                      </div>

                      {bannerUrl && (
                        <div className="p-4 bg-[hsl(220,12%,14%)] rounded-xl border border-[hsl(220,12%,20%)]">
                          <p className="text-xs text-[hsl(220,10%,45%)] mb-2">Banner Preview:</p>
                          <img src={bannerUrl} alt="Banner" className="w-full rounded-lg border border-[hsl(220,12%,20%)]" />
                          <Button onClick={() => downloadBanner(bannerUrl, meme.ticker)} className="claude-btn-primary w-full mt-3">
                            <Download className="h-4 w-4 mr-2" /> Download Banner
                          </Button>
                        </div>
                      )}

                      <div className="pt-6 border-t border-[hsl(220,12%,20%)]">
                        <label className="text-sm font-medium mb-2 block">Your Solana wallet</label>
                        <Input placeholder="Enter your SOL wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} className="claude-input font-mono text-sm mb-2" />
                        <p className="text-xs text-[hsl(220,10%,45%)] mb-4">You'll receive 50% of all trading fees</p>
                        <Button onClick={handleLaunch} disabled={isLaunching || !walletAddress || !meme} className="claude-btn-primary w-full h-12 text-base">
                          {isLaunching ? <><Rocket className="h-5 w-5 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-5 w-5 mr-2" /> Launch Token</>}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Describe Mode */}
              {generatorMode === "describe" && (
                <div className="space-y-6">
                  <div className="p-5 bg-[hsl(220,12%,14%)] rounded-2xl border border-[hsl(220,12%,20%)] space-y-4">
                    <Textarea value={describePrompt} onChange={(e) => setDescribePrompt(e.target.value)} placeholder="Describe your meme concept... (e.g., 'A friendly robot cat')" className="claude-input min-h-[120px] resize-none" />
                    <Button onClick={handleDescribeGenerate} disabled={isGenerating || !describePrompt.trim()} className="claude-btn-secondary w-full h-11">
                      {isGenerating ? <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate from Description</>}
                    </Button>
                  </div>

                  {describedToken && (
                    <div className="space-y-4">
                      <div className="claude-preview-box">
                        <div className="claude-preview-avatar border-2 border-[hsl(160,70%,50%)]">
                          {describedToken.imageUrl && <img src={describedToken.imageUrl} alt={describedToken.name} />}
                        </div>
                        <div>
                          <h3 className="font-semibold">{describedToken.name}</h3>
                          <span className="text-[hsl(160,70%,50%)] font-mono">${describedToken.ticker}</span>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-[hsl(220,12%,20%)]">
                        <Input placeholder="Enter your SOL wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} className="claude-input font-mono text-sm mb-4" />
                        <Button onClick={handleDescribeLaunch} disabled={isLaunching || !walletAddress} className="claude-btn-primary w-full h-12">
                          {isLaunching ? <><Rocket className="h-5 w-5 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-5 w-5 mr-2" /> Launch Token</>}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Custom Mode */}
              {generatorMode === "custom" && (
                <div className="space-y-6">
                  <div className="p-5 bg-[hsl(220,12%,14%)] rounded-2xl border border-[hsl(220,12%,20%)] space-y-4">
                    <div className="claude-preview-box">
                      <div className="claude-preview-avatar">
                        {customImagePreview || customToken.imageUrl ? (
                          <img src={customImagePreview || customToken.imageUrl} alt="Token" />
                        ) : (
                          <Image className="h-8 w-8 text-[hsl(220,10%,45%)]" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input value={customToken.name} onChange={(e) => setCustomToken({ ...customToken, name: e.target.value.slice(0, 20) })} className="claude-input font-semibold" placeholder="Token name" maxLength={20} />
                        <div className="flex items-center gap-2">
                          <span className="text-[hsl(160,70%,50%)] font-semibold">$</span>
                          <Input value={customToken.ticker} onChange={(e) => setCustomToken({ ...customToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })} className="claude-input w-28 font-mono" placeholder="TICKER" maxLength={10} />
                        </div>
                      </div>
                    </div>
                    <Textarea value={customToken.description} onChange={(e) => setCustomToken({ ...customToken, description: e.target.value })} placeholder="Description (optional)" className="claude-input min-h-[80px]" />
                    <Input type="file" accept="image/*" onChange={handleCustomImageChange} className="claude-input text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={customToken.websiteUrl || ""} onChange={(e) => setCustomToken({ ...customToken, websiteUrl: e.target.value })} className="claude-input text-sm" placeholder="Website URL" />
                      <Input value={customToken.twitterUrl || ""} onChange={(e) => setCustomToken({ ...customToken, twitterUrl: e.target.value })} className="claude-input text-sm" placeholder="Twitter URL" />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-[hsl(220,12%,20%)]">
                    <label className="text-sm font-medium mb-2 block">Your Solana wallet</label>
                    <Input placeholder="Enter your SOL wallet address..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} className="claude-input font-mono text-sm mb-4" />
                    <Button onClick={handleCustomLaunch} disabled={isLaunching || !walletAddress || !customToken.name.trim() || !customToken.ticker.trim()} className="claude-btn-primary w-full h-12 text-base">
                      {isLaunching ? <><Rocket className="h-5 w-5 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-5 w-5 mr-2" /> Launch Token</>}
                    </Button>
                  </div>
                </div>
              )}

              {/* Phantom Mode */}
              {generatorMode === "phantom" && (
                <div className="space-y-6">
                  <div className="p-4 bg-[hsl(220,12%,14%)] rounded-xl border border-[hsl(220,12%,20%)]">
                    {phantomWallet.isConnected ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[hsl(260,50%,25%)] flex items-center justify-center">
                            <Wallet className="h-5 w-5 text-[hsl(260,50%,70%)]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Connected</p>
                            <p className="text-xs font-mono text-[hsl(220,10%,45%)]">{shortenAddress(phantomWallet.address)}</p>
                          </div>
                        </div>
                        <Button onClick={phantomWallet.disconnect} variant="ghost" size="sm" className="text-[hsl(220,10%,45%)]">Disconnect</Button>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Wallet className="h-10 w-10 mx-auto mb-3 text-[hsl(220,10%,45%)]" />
                        <p className="text-sm text-[hsl(220,10%,45%)] mb-4">Connect Phantom to launch with your wallet</p>
                        <Button onClick={phantomWallet.connect} className="claude-btn-primary">
                          <Wallet className="h-4 w-4 mr-2" /> Connect Phantom
                        </Button>
                      </div>
                    )}
                  </div>

                  {phantomWallet.isConnected && (
                    <>
                      {/* Sub-mode selector */}
                      <div className="claude-mode-selector">
                        {[
                          { id: "random", label: "Random", icon: Shuffle },
                          { id: "describe", label: "Describe", icon: Sparkles },
                          { id: "custom", label: "Custom", icon: Image },
                        ].map((mode) => (
                          <button key={mode.id} onClick={() => { setPhantomInputMode(mode.id as any); setPhantomMeme(null); }} className={`claude-mode-btn ${phantomInputMode === mode.id ? "active" : ""}`}>
                            <mode.icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{mode.label}</span>
                          </button>
                        ))}
                      </div>

                      {phantomInputMode === "random" && (
                        <div className="space-y-4">
                          <div className="claude-preview-box">
                            <div className="claude-preview-avatar">
                              {phantomMeme?.imageUrl ? <img src={phantomMeme.imageUrl} alt={phantomMeme.name} /> : <Bot className="h-8 w-8 text-[hsl(220,10%,45%)]" />}
                            </div>
                            <div className="flex-1">
                              {phantomMeme ? (
                                <>
                                  <p className="font-semibold">{phantomMeme.name}</p>
                                  <p className="text-[hsl(160,70%,50%)] font-mono">${phantomMeme.ticker}</p>
                                </>
                              ) : (
                                <p className="text-[hsl(220,10%,45%)]">Generate a token</p>
                              )}
                            </div>
                          </div>
                          <Button onClick={handlePhantomRandomize} disabled={isPhantomGenerating} className="claude-btn-secondary w-full h-11">
                            {isPhantomGenerating ? <><Shuffle className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Shuffle className="h-4 w-4 mr-2" /> AI Randomize Token</>}
                          </Button>
                        </div>
                      )}

                      {phantomInputMode === "describe" && (
                        <div className="space-y-4">
                          <Textarea value={phantomDescribePrompt} onChange={(e) => setPhantomDescribePrompt(e.target.value)} placeholder="Describe your meme concept..." className="claude-input min-h-[100px] resize-none" />
                          <Button onClick={handlePhantomDescribeGenerate} disabled={isPhantomGenerating || !phantomDescribePrompt.trim()} className="claude-btn-secondary w-full h-11">
                            {isPhantomGenerating ? <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate from Description</>}
                          </Button>
                          {phantomMeme && (
                            <div className="claude-preview-box">
                              <div className="claude-preview-avatar border-2 border-[hsl(160,70%,50%)]">
                                {phantomMeme.imageUrl && <img src={phantomMeme.imageUrl} alt={phantomMeme.name} />}
                              </div>
                              <div>
                                <p className="font-semibold">{phantomMeme.name}</p>
                                <p className="text-[hsl(160,70%,50%)] font-mono">${phantomMeme.ticker}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {phantomInputMode === "custom" && (
                        <div className="space-y-4">
                          <div className="claude-preview-box">
                            <div className="claude-preview-avatar">
                              {phantomImagePreview || phantomToken.imageUrl ? <img src={phantomImagePreview || phantomToken.imageUrl} alt="Token" /> : <Image className="h-8 w-8 text-[hsl(220,10%,45%)]" />}
                            </div>
                            <div className="flex-1 space-y-2">
                              <Input value={phantomToken.name} onChange={(e) => setPhantomToken({ ...phantomToken, name: e.target.value.slice(0, 20) })} className="claude-input font-semibold" placeholder="Token name" maxLength={20} />
                              <div className="flex items-center gap-2">
                                <span className="text-[hsl(160,70%,50%)] font-semibold">$</span>
                                <Input value={phantomToken.ticker} onChange={(e) => setPhantomToken({ ...phantomToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })} className="claude-input w-28 font-mono" placeholder="TICKER" maxLength={10} />
                              </div>
                            </div>
                          </div>
                          <Input type="file" accept="image/*" onChange={handlePhantomImageChange} className="claude-input text-sm" />
                          <Textarea value={phantomToken.description} onChange={(e) => setPhantomToken({ ...phantomToken, description: e.target.value })} placeholder="Description (optional)" className="claude-input min-h-[60px]" />
                        </div>
                      )}

                      <div className="p-3 bg-[hsl(160,70%,50%,0.1)] border border-[hsl(160,70%,50%,0.3)] rounded-xl">
                        <p className="text-sm text-[hsl(160,70%,60%)]">
                          💡 You pay ~0.02 SOL and receive 50% of trading fees directly to your wallet.
                        </p>
                      </div>

                      <Button
                        onClick={handlePhantomLaunch}
                        disabled={isPhantomLaunching || (phantomInputMode === "custom" ? !phantomToken.name.trim() || !phantomToken.ticker.trim() : !phantomMeme)}
                        className="claude-btn-primary w-full h-12 text-base"
                      >
                        {isPhantomLaunching ? <><Rocket className="h-5 w-5 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-5 w-5 mr-2" /> Launch with Phantom</>}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Result Modal */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="bg-[hsl(220,14%,10%)] border-[hsl(220,12%,20%)] text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {launchResult?.success ? (
                <><PartyPopper className="h-6 w-6 text-[hsl(160,70%,50%)]" /> Token Launched!</>
              ) : (
                <><AlertTriangle className="h-6 w-6 text-[hsl(0,65%,55%)]" /> Launch Failed</>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {launchResult?.success ? "Token launched successfully" : "Token launch failed"}
            </DialogDescription>
          </DialogHeader>

          {launchResult?.success ? (
            <div className="space-y-4">
              <div className="claude-preview-box">
                {launchResult.imageUrl && <img src={launchResult.imageUrl} alt={launchResult.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-[hsl(160,70%,50%)]" />}
                <div>
                  <h3 className="font-bold text-lg">{launchResult.name}</h3>
                  <span className="text-[hsl(160,70%,50%)] font-mono">${launchResult.ticker}</span>
                </div>
              </div>

              <div className={`p-3 rounded-xl ${launchResult.onChainSuccess ? "bg-[hsl(160,70%,50%,0.1)] border border-[hsl(160,70%,50%,0.3)]" : "bg-[hsl(45,90%,55%,0.1)] border border-[hsl(45,90%,55%,0.3)]"}`}>
                <p className="text-sm">{launchResult.message}</p>
              </div>

              {launchResult.mintAddress && (
                <div className="space-y-2">
                  <label className="text-xs text-[hsl(220,10%,45%)]">Contract Address</label>
                  <div className="flex items-center gap-2 p-3 bg-[hsl(220,12%,14%)] rounded-xl border border-[hsl(220,12%,20%)]">
                    <code className="flex-1 text-sm font-mono text-[hsl(220,10%,65%)] break-all">{launchResult.mintAddress}</code>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(launchResult.mintAddress!)} className="shrink-0">
                      {copiedAddress === launchResult.mintAddress ? <CheckCircle className="h-4 w-4 text-[hsl(160,70%,50%)]" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {launchResult.solscanUrl && (
                  <Button variant="outline" className="flex-1 border-[hsl(220,12%,20%)] hover:bg-[hsl(220,12%,18%)]" asChild>
                    <a href={launchResult.solscanUrl} target="_blank" rel="noopener noreferrer">
                      Solscan <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                )}
                {launchResult.tradeUrl && (
                  <Button className="flex-1 claude-btn-primary" asChild>
                    <a href={launchResult.tradeUrl} target="_blank" rel="noopener noreferrer">
                      Trade Now <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-[hsl(0,65%,55%,0.1)] border border-[hsl(0,65%,55%,0.2)] rounded-xl">
                <p className="text-sm text-[hsl(0,65%,70%)]">{launchResult?.error || "An unknown error occurred"}</p>
              </div>
              <Button onClick={() => setShowResultModal(false)} className="w-full claude-btn-secondary">Try Again</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
