import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBannerGenerator } from "@/hooks/useBannerGenerator";
import { MemeLoadingAnimation, MemeLoadingText } from "@/components/launchpad/MemeLoadingAnimation";
import { usePhantomWallet } from "@/hooks/usePhantomWallet";
import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { debugLog } from "@/lib/debugLogger";
import { getRpcUrl } from "@/hooks/useSolanaWallet";

import {
  Shuffle,
  Rocket,
  Sparkles,
  RefreshCw,
  Wallet,
  AlertTriangle,
  Globe,
  Twitter,
  MessageCircle,
  MessageSquare,
  Image,
  Download,
  Pencil,
  Bot,
  Coins
} from "lucide-react";

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
  tokenId?: string;
  onChainSuccess?: boolean;
  solscanUrl?: string;
  tradeUrl?: string;
  message?: string;
  error?: string;
}

interface TokenLauncherProps {
  onLaunchSuccess: () => void;
  onShowResult: (result: LaunchResult) => void;
}

export function TokenLauncher({ onLaunchSuccess, onShowResult }: TokenLauncherProps) {
  const { toast } = useToast();
  const phantomWallet = usePhantomWallet();

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

  // Phantom specific state
  const [isPhantomLaunching, setIsPhantomLaunching] = useState(false);
  const [phantomTradingFee, setPhantomTradingFee] = useState(200);
  const [phantomSubMode, setPhantomSubMode] = useState<"random" | "describe" | "custom">("random");
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

  // Banner generation
  const { generateBanner, downloadBanner, clearBanner, isGenerating: isBannerGenerating, bannerUrl } = useBannerGenerator();
  const [bannerTextName, setBannerTextName] = useState("");
  const [bannerTextTicker, setBannerTextTicker] = useState("");
  const [isEditingBannerText, setIsEditingBannerText] = useState(false);
  const [bannerImageUrl, setBannerImageUrl] = useState("");

  const isValidSolanaAddress = (address: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);

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
        toast({ title: "Meme Generated! 🎲", description: `${data.meme.name} ($${data.meme.ticker}) is ready!` });
      } else {
        throw new Error("No meme data returned");
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
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

  // IMPORTANT: Avoid sending giant base64 images to backend functions (can hang / exceed limits)
  const uploadDataUrlImageIfNeeded = useCallback(async (imageUrl: string, ticker: string): Promise<string> => {
    if (!imageUrl || !imageUrl.startsWith("data:image")) return imageUrl;

    debugLog('info', 'Uploading generated image to storage (pre-flight)', {
      ticker,
      bytesApprox: Math.round(imageUrl.length * 0.75),
    });

    const [meta, base64Data] = imageUrl.split(',');
    if (!base64Data) throw new Error('Invalid base64 image data');

    const contentTypeMatch = meta?.match(/data:(.*?);base64/);
    const contentType = contentTypeMatch?.[1] || 'image/png';
    const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('png') ? 'png' : 'png';

    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const filePath = `fun-tokens/${Date.now()}-${ticker.toLowerCase()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('post-images')
      .upload(filePath, bytes, { contentType, upsert: true });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
    debugLog('info', 'Generated image uploaded', { publicUrl: urlData.publicUrl });
    return urlData.publicUrl;
  }, []);

  const performLaunch = useCallback(async (tokenToLaunch: MemeToken) => {
    debugLog('info', '🚀 Launch started', { 
      name: tokenToLaunch.name, 
      ticker: tokenToLaunch.ticker,
      wallet: walletAddress?.slice(0, 8) + '...',
    });

    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      debugLog('error', 'Invalid wallet address', { walletAddress });
      toast({ title: "Invalid wallet address", description: "Please enter a valid Solana wallet address", variant: "destructive" });
      return;
    }

    debugLog('info', 'Wallet validated', { wallet: walletAddress.slice(0, 8) + '...' });
    setIsLaunching(true);
    
    // Show progress toast immediately
    toast({ 
      title: "🚀 Creating Token...", 
      description: "Preparing on-chain transactions (5-15 seconds)..." 
    });

    const startTime = Date.now();
    debugLog('info', 'Calling fun-create Edge Function...');

    try {
      // Pre-flight: ensure we send a small, stable payload to the backend
      const imageUrlToSend = await uploadDataUrlImageIfNeeded(tokenToLaunch.imageUrl, tokenToLaunch.ticker);
      debugLog('info', 'Prepared launch payload', {
        imageUrlType: imageUrlToSend?.startsWith('data:image') ? 'data_url' : 'url',
        imageUrlLength: imageUrlToSend?.length,
      });

      // Hard timeout so we never get stuck with "nothing happens"
      const timeoutMs = 35_000;
      const invokePromise = supabase.functions.invoke("fun-create", {
        body: {
          name: tokenToLaunch.name,
          ticker: tokenToLaunch.ticker,
          description: tokenToLaunch.description,
          imageUrl: imageUrlToSend,
          websiteUrl: tokenToLaunch.websiteUrl,
          twitterUrl: tokenToLaunch.twitterUrl,
          telegramUrl: tokenToLaunch.telegramUrl,
          discordUrl: tokenToLaunch.discordUrl,
          creatorWallet: walletAddress,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`fun-create timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
      });

      const { data, error } = (await Promise.race([invokePromise, timeoutPromise])) as any;

      const elapsed = Date.now() - startTime;
      debugLog('info', `Edge Function responded in ${elapsed}ms`, { 
        hasData: !!data, 
        hasError: !!error,
        dataKeys: data ? Object.keys(data) : [],
      });

      if (error) {
        const msg = error.message || "";
        debugLog('error', 'Edge Function error', { 
          message: msg, 
          name: error.name,
          elapsed,
        });

        if (msg.toLowerCase().includes("max usage reached")) {
          throw new Error("RPC provider is at max usage. Please top up credits or try again later.");
        }

        // Check for rate limit
        if (msg.includes("429") || msg.toLowerCase().includes("rate")) {
          throw new Error('Rate limited. Please wait a few minutes before launching again.');
        }
        throw new Error(`Server error: ${msg}`);
      }
      
      if (!data?.success) {
        const msg = String(data?.error || "Launch failed");
        debugLog('error', 'Launch failed (data.success=false)', { 
          error: msg,
          data,
          elapsed,
        });
        if (msg.toLowerCase().includes("max usage reached")) {
          throw new Error("RPC provider is at max usage. Please top up credits or try again later.");
        }
        throw new Error(msg);
      }

      // Success!
      debugLog('info', '✅ Token launched successfully!', { 
        mintAddress: data.mintAddress,
        elapsed,
      });

      onShowResult({
        success: true,
        name: tokenToLaunch.name,
        ticker: tokenToLaunch.ticker,
        mintAddress: data.mintAddress,
        tokenId: data.tokenId,
        imageUrl: tokenToLaunch.imageUrl,
        onChainSuccess: true,
        solscanUrl: data.solscanUrl,
        tradeUrl: data.tradeUrl,
        message: "🚀 Token launched successfully!",
      });

      toast({ title: "🚀 Token Launched!", description: `${tokenToLaunch.name} is now live on Solana!` });

      // Clear form
      setMeme(null);
      clearBanner();
      setCustomToken({ name: "", ticker: "", description: "", imageUrl: "", websiteUrl: "", twitterUrl: "", telegramUrl: "", discordUrl: "" });
      setCustomImageFile(null);
      setCustomImagePreview(null);
      setWalletAddress("");
      onLaunchSuccess();
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : "Failed to launch token";
      const elapsed = Date.now() - startTime;
      
      debugLog('error', 'Launch failed with exception', { 
        message: errorMessage,
        elapsed,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      
      // Improve error messages for common cases
        if (errorMessage.includes('AbortError') || errorMessage.includes('timeout')) {
          errorMessage = 'Timed out waiting for server. The launch may still complete—wait ~60s and check the token list before retrying.';
        debugLog('warn', 'Detected timeout/abort error');
      } else if (errorMessage.includes('504') || errorMessage.includes('Gateway')) {
        errorMessage = 'Server timeout. Please try again in a moment.';
        debugLog('warn', 'Detected gateway timeout (504)');
      } else if (errorMessage.includes('CORS') || errorMessage.includes('Access-Control')) {
        debugLog('error', 'CORS error detected - response headers missing');
      }
      
      onShowResult({ success: false, error: errorMessage });
      toast({ title: "Launch Failed", description: errorMessage.slice(0, 100), variant: "destructive" });
    } finally {
      setIsLaunching(false);
      debugLog('info', 'Launch flow completed');
    }
  }, [walletAddress, toast, clearBanner, onLaunchSuccess, onShowResult]);

  const handleLaunch = useCallback(async () => {
    if (!meme) {
      toast({ title: "No meme to launch", description: "Click Randomize first", variant: "destructive" });
      return;
    }
    await performLaunch(meme);
  }, [meme, performLaunch, toast]);

  const handleCustomImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }
    setCustomImageFile(file);
    setCustomImagePreview(URL.createObjectURL(file));
  }, [toast]);

  const handleCustomLaunch = useCallback(async () => {
    if (!customToken.name.trim() || !customToken.ticker.trim()) {
      toast({ title: "Missing token info", description: "Name and ticker required", variant: "destructive" });
      return;
    }
    if (!customImageFile && !customToken.imageUrl.trim()) {
      toast({ title: "Image required", description: "Please upload an image", variant: "destructive" });
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
      toast({ title: 'Custom launch failed', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    }
  }, [customToken, performLaunch, toast, uploadCustomImageIfNeeded]);

  const handleDescribeGenerate = useCallback(async () => {
    if (!describePrompt.trim()) {
      toast({ title: "Enter a description", description: "Describe the meme character you want", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    setDescribedToken(null);
    clearBanner();

    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: { description: describePrompt } });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");
      if (data?.meme) {
        setDescribedToken(data.meme);
        setBannerTextName(data.meme.name);
        setBannerTextTicker(data.meme.ticker);
        setBannerImageUrl(data.meme.imageUrl);
        if (data.meme.imageUrl) {
          await generateBanner({ imageUrl: data.meme.imageUrl, tokenName: data.meme.name, ticker: data.meme.ticker });
        }
        toast({ title: "Meme Generated! 🎨", description: `${data.meme.name} ($${data.meme.ticker}) created!` });
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [describePrompt, toast, clearBanner, generateBanner]);

  const handleDescribeLaunch = useCallback(async () => {
    if (!describedToken) {
      toast({ title: "No token generated", description: "Generate first", variant: "destructive" });
      return;
    }
    await performLaunch(describedToken);
  }, [describedToken, performLaunch, toast]);

  // Phantom handlers
  const handlePhantomRandomize = useCallback(async () => {
    setIsPhantomGenerating(true);
    setPhantomMeme(null);

    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: {} });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");
      if (data?.meme) {
        setPhantomMeme(data.meme);
        setPhantomToken({
          name: data.meme.name,
          ticker: data.meme.ticker,
          description: data.meme.description || "",
          imageUrl: data.meme.imageUrl,
          websiteUrl: data.meme.websiteUrl || "",
          twitterUrl: data.meme.twitterUrl || "",
          telegramUrl: "",
          discordUrl: "",
        });
        toast({ title: "AI Token Generated! 🤖", description: `${data.meme.name} ready for Phantom launch!` });
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsPhantomGenerating(false);
    }
  }, [toast]);

  const handlePhantomDescribeGenerate = useCallback(async () => {
    if (!phantomDescribePrompt.trim()) {
      toast({ title: "Enter a description", description: "Describe the meme character you want", variant: "destructive" });
      return;
    }
    setIsPhantomGenerating(true);
    setPhantomMeme(null);

    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: { description: phantomDescribePrompt } });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");
      if (data?.meme) {
        setPhantomMeme(data.meme);
        setPhantomToken({
          name: data.meme.name,
          ticker: data.meme.ticker,
          description: data.meme.description || "",
          imageUrl: data.meme.imageUrl,
          websiteUrl: data.meme.websiteUrl || "",
          twitterUrl: data.meme.twitterUrl || "",
          telegramUrl: "",
          discordUrl: "",
        });
        toast({ title: "Meme Generated! 🎨", description: `${data.meme.name} created from your description!` });
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsPhantomGenerating(false);
    }
  }, [phantomDescribePrompt, toast]);

  const uploadPhantomImageIfNeeded = useCallback(async (): Promise<string> => {
    if (!phantomImageFile) return phantomMeme?.imageUrl || phantomToken.imageUrl;
    const fileExt = phantomImageFile.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `token-images/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, phantomImageFile);
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
    return urlData.publicUrl;
  }, [phantomImageFile, phantomMeme?.imageUrl, phantomToken.imageUrl]);

  const handlePhantomImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }
    setPhantomImageFile(file);
    setPhantomImagePreview(URL.createObjectURL(file));
  }, [toast]);

  const handlePhantomLaunch = useCallback(async () => {
    if (!phantomWallet.isConnected || !phantomWallet.address) {
      toast({ title: "Wallet not connected", description: "Connect Phantom first", variant: "destructive" });
      return;
    }
    if (!phantomToken.name.trim() || !phantomToken.ticker.trim()) {
      toast({ title: "Missing token info", description: "Name and ticker required", variant: "destructive" });
      return;
    }
    if (!phantomImagePreview && !phantomMeme?.imageUrl && !phantomToken.imageUrl) {
      toast({ title: "Image required", description: "Click AI Randomize or upload an image", variant: "destructive" });
      return;
    }

    setIsPhantomLaunching(true);

    try {
      const imageUrl = await uploadPhantomImageIfNeeded();
      const { data, error } = await supabase.functions.invoke("fun-phantom-create", {
        body: {
          name: phantomToken.name.slice(0, 32),
          ticker: phantomToken.ticker.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
          description: phantomToken.description || "",
          imageUrl,
          websiteUrl: phantomToken.websiteUrl || "",
          twitterUrl: phantomToken.twitterUrl || "",
          telegramUrl: phantomToken.telegramUrl || "",
          discordUrl: phantomToken.discordUrl || "",
          phantomWallet: phantomWallet.address,
          tradingFeeBps: phantomTradingFee,
          // Server will use pre-generated vanity addresses from pool
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to prepare Phantom transactions");

      // fun-phantom-create returns `unsignedTransactions` (preferred) but keep compatibility
      const txBase64s: string[] =
        Array.isArray(data?.unsignedTransactions) && data.unsignedTransactions.length > 0
          ? data.unsignedTransactions
          : data?.serializedTransaction
            ? [data.serializedTransaction]
            : [];

      if (txBase64s.length === 0) throw new Error(data?.error || "Failed to create transaction");

      const { url: rpcUrl } = getRpcUrl();
      const connection = new Connection(rpcUrl, "confirmed");

      const deserializeAnyTx = (base64: string): Transaction | VersionedTransaction => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        try {
          return VersionedTransaction.deserialize(bytes);
        } catch {
          return Transaction.from(bytes);
        }
      };

      const signatures: string[] = [];
      for (const txBase64 of txBase64s) {
        const tx = deserializeAnyTx(txBase64);
        const signResult: unknown = await phantomWallet.signAndSendTransaction(tx as any);
        if (!signResult) throw new Error("Transaction signing failed");

        let signature: string;
        if (typeof signResult === "object" && signResult !== null && "signature" in signResult) {
          signature = (signResult as { signature: string }).signature;
        } else {
          signature = String(signResult);
        }

        signatures.push(signature);
        await connection.confirmTransaction(signature, "confirmed");
      }

      // Phase 2: record token in DB after on-chain confirmation
      let recordedTokenId: string | undefined;
      try {
        const { data: recordData } = await supabase.functions.invoke("fun-phantom-create", {
          body: {
            name: phantomToken.name.slice(0, 32),
            ticker: phantomToken.ticker.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
            description: phantomToken.description || "",
            imageUrl,
            websiteUrl: phantomToken.websiteUrl || "",
            twitterUrl: phantomToken.twitterUrl || "",
            telegramUrl: phantomToken.telegramUrl || "",
            discordUrl: phantomToken.discordUrl || "",
            phantomWallet: phantomWallet.address,
            tradingFeeBps: phantomTradingFee,
            confirmed: true,
            mintAddress: data.mintAddress,
            dbcPoolAddress: data.dbcPoolAddress,
          },
        });
        recordedTokenId = recordData?.tokenId;
      } catch (recordErr) {
        // Non-fatal: token is already live on-chain.
        debugLog("warn", "[Phantom Launch] Token confirmed but failed to record in DB", {
          message: recordErr instanceof Error ? recordErr.message : String(recordErr),
        });
      }

      const lastSig = signatures[signatures.length - 1];

      onShowResult({
        success: true,
        name: phantomToken.name,
        ticker: phantomToken.ticker,
        mintAddress: data.mintAddress,
        tokenId: recordedTokenId,
        imageUrl,
        onChainSuccess: true,
        solscanUrl: lastSig ? `https://solscan.io/tx/${lastSig}` : undefined,
        tradeUrl: data.dbcPoolAddress 
          ? `https://axiom.trade/meme/${data.dbcPoolAddress}` 
          : (data.mintAddress ? `https://jup.ag/swap/SOL-${data.mintAddress}` : undefined),
        message: "Token launched successfully via Phantom!",
      });

      toast({ title: "🚀 Token Launched via Phantom!", description: `${phantomToken.name} is live!` });

      // Clear form
      setPhantomToken({ name: "", ticker: "", description: "", imageUrl: "", websiteUrl: "", twitterUrl: "", telegramUrl: "", discordUrl: "" });
      setPhantomMeme(null);
      setPhantomImageFile(null);
      setPhantomImagePreview(null);
      onLaunchSuccess();
    } catch (error: any) {
      onShowResult({ success: false, error: error.message || "Phantom launch failed" });
      toast({ title: "Phantom Launch Failed", description: error.message || "Transaction failed", variant: "destructive" });
    } finally {
      setIsPhantomLaunching(false);
    }
  }, [phantomWallet, phantomToken, phantomMeme, phantomImagePreview, phantomTradingFee, toast, uploadPhantomImageIfNeeded, onLaunchSuccess, onShowResult]);

  const modes = [
    { id: "random" as const, label: "Random", icon: Shuffle },
    { id: "describe" as const, label: "Describe", icon: Sparkles },
    { id: "custom" as const, label: "Custom", icon: Pencil },
    { id: "phantom" as const, label: "Phantom", icon: Wallet },
  ];

  return (
    <Card className="gate-card">
      <div className="gate-card-header">
        <h3 className="gate-card-title">
          <Rocket className="h-5 w-5 text-primary" />
          Launch Meme Coin
        </h3>
      </div>
      <div className="gate-card-body space-y-4">
        {/* Mode Selector */}
        <div className="gate-launch-modes">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setGeneratorMode(mode.id)}
              className={`gate-launch-mode ${generatorMode === mode.id ? "active" : ""}`}
            >
              <mode.icon className="h-4 w-4" />
              {mode.label}
            </button>
          ))}
        </div>

        {/* Random Mode */}
        {generatorMode === "random" && (
          <div className="space-y-4">
            <div className="gate-token-preview">
              <div className="gate-token-preview-avatar">
                {isGenerating ? (
                  <MemeLoadingAnimation />
                ) : meme?.imageUrl ? (
                  <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover" />
                ) : (
                  <Shuffle className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="gate-token-preview-info space-y-2">
                {isGenerating ? (
                  <MemeLoadingText />
                ) : meme ? (
                  <>
                    <Input
                      value={meme.name}
                      onChange={(e) => setMeme({ ...meme, name: e.target.value.slice(0, 20) })}
                      className="gate-input h-8"
                      placeholder="Token name"
                      maxLength={20}
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-primary text-sm">$</span>
                      <Input
                        value={meme.ticker}
                        onChange={(e) => setMeme({ ...meme, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) })}
                        className="gate-input h-7 w-24 font-mono"
                        placeholder="TICKER"
                        maxLength={6}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Click Randomize to generate</p>
                )}
              </div>
            </div>

            {meme && (
              <Textarea
                value={meme.description}
                onChange={(e) => setMeme({ ...meme, description: e.target.value.slice(0, 280) })}
                className="gate-input gate-textarea text-sm"
                placeholder="Description"
                maxLength={280}
              />
            )}

            <Button onClick={handleRandomize} disabled={isGenerating || isLaunching} className="gate-btn gate-btn-secondary w-full">
              {isGenerating ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Shuffle className="h-4 w-4 mr-2" /> Randomize</>}
            </Button>

            {meme && (
              <>
                {/* Editable social links - all optional */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      placeholder="Website URL (optional)"
                      value={meme.websiteUrl || ""}
                      onChange={(e) => setMeme({ ...meme, websiteUrl: e.target.value || undefined })}
                      className="gate-input text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Twitter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      placeholder="X/Twitter URL (optional)"
                      value={meme.twitterUrl || ""}
                      onChange={(e) => setMeme({ ...meme, twitterUrl: e.target.value || undefined })}
                      className="gate-input text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      placeholder="Telegram URL (optional)"
                      value={meme.telegramUrl || ""}
                      onChange={(e) => setMeme({ ...meme, telegramUrl: e.target.value || undefined })}
                      className="gate-input text-sm"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setBannerTextName(meme.name);
                    setBannerTextTicker(meme.ticker);
                    setBannerImageUrl(meme.imageUrl);
                    generateBanner({ imageUrl: meme.imageUrl, tokenName: meme.name, ticker: meme.ticker });
                  }}
                  disabled={isBannerGenerating || !meme.imageUrl}
                  variant="outline"
                  className="gate-btn gate-btn-ghost w-full"
                >
                  {isBannerGenerating ? <><Image className="h-4 w-4 mr-2 animate-pulse" /> Generating...</> : <><Image className="h-4 w-4 mr-2" /> Generate Banner</>}
                </Button>

                {bannerUrl && (
                  <div className="p-3 rounded-lg border border-border space-y-2">
                    <img src={bannerUrl} alt="Banner" className="w-full rounded" />
                    <Button onClick={() => downloadBanner(bannerUrl, meme.name)} className="gate-btn gate-btn-primary w-full">
                      <Download className="h-4 w-4 mr-2" /> Download Banner
                    </Button>
                  </div>
                )}

                <div className="space-y-3 pt-3 border-t border-border">
                  <Input
                    placeholder="Your SOL wallet address..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="gate-input font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Receive 50% of trading fees</p>
                  <Button onClick={handleLaunch} disabled={isLaunching || !walletAddress} className="gate-btn gate-btn-primary w-full">
                    {isLaunching ? <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-4 w-4 mr-2" /> Launch Token</>}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Describe Mode */}
        {generatorMode === "describe" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Describe the meme character you want. AI will generate everything.</p>
            <Textarea
              value={describePrompt}
              onChange={(e) => setDescribePrompt(e.target.value)}
              placeholder="e.g., A smug frog wearing sunglasses..."
              className="gate-input gate-textarea"
              maxLength={500}
            />
            <Button onClick={handleDescribeGenerate} disabled={isGenerating || !describePrompt.trim()} className="gate-btn gate-btn-primary w-full">
              {isGenerating ? <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate from Description</>}
            </Button>

            {describedToken && (
              <>
                <div className="gate-token-preview">
                  <div className="gate-token-preview-avatar">
                    <img src={describedToken.imageUrl} alt={describedToken.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="gate-token-preview-info space-y-2">
                    <Input
                      value={describedToken.name}
                      onChange={(e) => setDescribedToken({ ...describedToken, name: e.target.value.slice(0, 20) })}
                      className="gate-input h-8"
                      placeholder="Token name"
                      maxLength={20}
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-primary text-sm">$</span>
                      <Input
                        value={describedToken.ticker}
                        onChange={(e) => setDescribedToken({ ...describedToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) })}
                        className="gate-input h-7 w-24 font-mono"
                        placeholder="TICKER"
                        maxLength={6}
                      />
                    </div>
                  </div>
                </div>

                {/* Editable Description */}
                <Textarea
                  value={describedToken.description || ""}
                  onChange={(e) => setDescribedToken({ ...describedToken, description: e.target.value.slice(0, 200) })}
                  placeholder="Token description..."
                  className="gate-input gate-textarea text-sm"
                  maxLength={200}
                  rows={2}
                />

                {/* Social links - collapsible */}
                <details className="group">
                  <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    <Globe className="h-3 w-3" />
                    <span>Add Social Links (optional)</span>
                  </summary>
                  <div className="mt-2 space-y-2 pl-5">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder="Website URL"
                        value={describedToken.websiteUrl || ""}
                        onChange={(e) => setDescribedToken({ ...describedToken, websiteUrl: e.target.value })}
                        className="gate-input text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Twitter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder="X/Twitter URL"
                        value={describedToken.twitterUrl || ""}
                        onChange={(e) => setDescribedToken({ ...describedToken, twitterUrl: e.target.value })}
                        className="gate-input text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder="Telegram URL"
                        value={describedToken.telegramUrl || ""}
                        onChange={(e) => setDescribedToken({ ...describedToken, telegramUrl: e.target.value })}
                        className="gate-input text-sm"
                      />
                    </div>
                  </div>
                </details>

                {bannerUrl && (
                  <div className="p-3 rounded-lg border border-border space-y-2">
                    <img src={bannerUrl} alt="Banner" className="w-full rounded" />
                    <Button onClick={() => downloadBanner(bannerUrl, describedToken.name)} className="gate-btn gate-btn-primary w-full">
                      <Download className="h-4 w-4 mr-2" /> Download Banner
                    </Button>
                  </div>
                )}

                <div className="space-y-3 pt-3 border-t border-border">
                  <Input
                    placeholder="Your SOL wallet address..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="gate-input font-mono text-sm"
                  />
                  <Button onClick={handleDescribeLaunch} disabled={isLaunching || !walletAddress} className="gate-btn gate-btn-primary w-full">
                    {isLaunching ? <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-4 w-4 mr-2" /> Launch Token</>}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Custom Mode */}
        {generatorMode === "custom" && (
          <div className="space-y-4">
            <div className="gate-token-preview">
              <div className="gate-token-preview-avatar">
                {customImagePreview ? (
                  <img src={customImagePreview} alt="Token" className="w-full h-full object-cover" />
                ) : (
                  <Pencil className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="gate-token-preview-info space-y-2">
                <Input
                  value={customToken.name}
                  onChange={(e) => setCustomToken({ ...customToken, name: e.target.value })}
                  className="gate-input h-8"
                  placeholder="Token name"
                  maxLength={20}
                />
                <Input
                  value={customToken.ticker}
                  onChange={(e) => setCustomToken({ ...customToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                  className="gate-input h-8 font-mono"
                  placeholder="TICKER"
                  maxLength={6}
                />
              </div>
            </div>

            <Textarea
              value={customToken.description}
              onChange={(e) => setCustomToken({ ...customToken, description: e.target.value })}
              placeholder="Description"
              className="gate-input gate-textarea"
              maxLength={280}
            />

            <Input type="file" accept="image/*" onChange={handleCustomImageChange} className="gate-input" />

            {/* Social links - collapsible */}
            <details className="group">
              <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                <Globe className="h-3 w-3" />
                <span>Add Social Links (optional)</span>
              </summary>
              <div className="mt-2 space-y-2 pl-5">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="Website URL"
                    value={customToken.websiteUrl || ""}
                    onChange={(e) => setCustomToken({ ...customToken, websiteUrl: e.target.value })}
                    className="gate-input text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Twitter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="X/Twitter URL"
                    value={customToken.twitterUrl || ""}
                    onChange={(e) => setCustomToken({ ...customToken, twitterUrl: e.target.value })}
                    className="gate-input text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="Telegram URL"
                    value={customToken.telegramUrl || ""}
                    onChange={(e) => setCustomToken({ ...customToken, telegramUrl: e.target.value })}
                    className="gate-input text-sm"
                  />
                </div>
              </div>
            </details>

            <div className="space-y-3 pt-3 border-t border-border">
              <Input
                placeholder="Your SOL wallet address..."
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="gate-input font-mono text-sm"
              />
              <Button onClick={handleCustomLaunch} disabled={isLaunching || !walletAddress || !customToken.name || !customToken.ticker} className="gate-btn gate-btn-primary w-full">
                {isLaunching ? <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-4 w-4 mr-2" /> Launch Custom Token</>}
              </Button>
            </div>
          </div>
        )}

        {/* Phantom Mode */}
        {generatorMode === "phantom" && (
          <div className="space-y-4">
            {!phantomWallet.isConnected ? (
              <Button onClick={phantomWallet.connect} disabled={phantomWallet.isConnecting} className="gate-btn gate-btn-primary w-full">
                {phantomWallet.isConnecting ? "Connecting..." : <><Wallet className="h-4 w-4 mr-2" /> Connect Phantom</>}
              </Button>
            ) : (
              <>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span className="text-sm font-mono text-foreground">{phantomWallet.address?.slice(0, 4)}...{phantomWallet.address?.slice(-4)}</span>
                    {phantomWallet.balance !== null && <span className="text-xs text-muted-foreground">{phantomWallet.balance.toFixed(3)} SOL</span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={phantomWallet.disconnect} className="text-muted-foreground hover:text-foreground">
                    Disconnect
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Trading Fee</span>
                    <span className="font-semibold text-primary">{(phantomTradingFee / 100).toFixed(1)}%</span>
                  </div>
                  <Slider value={[phantomTradingFee]} onValueChange={(v) => setPhantomTradingFee(v[0])} min={10} max={1000} step={10} />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0.1%</span>
                    <span>10%</span>
                  </div>
                </div>

                {/* Sub-mode selector for Phantom */}
                <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
                  {[
                    { id: "random" as const, label: "Random", icon: Shuffle },
                    { id: "describe" as const, label: "Describe", icon: Sparkles },
                    { id: "custom" as const, label: "Custom", icon: Pencil },
                  ].map((subMode) => (
                    <button
                      key={subMode.id}
                      onClick={() => setPhantomSubMode(subMode.id)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-xs rounded-md transition-all ${
                        phantomSubMode === subMode.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      <subMode.icon className="h-3 w-3" />
                      {subMode.label}
                    </button>
                  ))}
                </div>

                {/* Random Sub-Mode */}
                {phantomSubMode === "random" && (
                  <>
                    <Button onClick={handlePhantomRandomize} disabled={isPhantomGenerating} className="gate-btn gate-btn-secondary w-full">
                      {isPhantomGenerating ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Shuffle className="h-4 w-4 mr-2" /> AI Randomize</>}
                    </Button>

                    {isPhantomGenerating && (
                      <div className="gate-token-preview">
                        <div className="gate-token-preview-avatar">
                          <MemeLoadingAnimation />
                        </div>
                        <div className="gate-token-preview-info">
                          <MemeLoadingText />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Describe Sub-Mode */}
                {phantomSubMode === "describe" && (
                  <>
                    <Textarea
                      value={phantomDescribePrompt}
                      onChange={(e) => setPhantomDescribePrompt(e.target.value)}
                      placeholder="e.g., A smug frog wearing sunglasses..."
                      className="gate-input gate-textarea"
                      maxLength={500}
                    />
                    <Button onClick={handlePhantomDescribeGenerate} disabled={isPhantomGenerating || !phantomDescribePrompt.trim()} className="gate-btn gate-btn-secondary w-full">
                      {isPhantomGenerating ? <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate from Description</>}
                    </Button>

                    {isPhantomGenerating && (
                      <div className="gate-token-preview">
                        <div className="gate-token-preview-avatar">
                          <MemeLoadingAnimation />
                        </div>
                        <div className="gate-token-preview-info">
                          <MemeLoadingText />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Token Preview & Form (shown for all sub-modes after generation or for custom) */}
                {!isPhantomGenerating && (phantomSubMode === "custom" || phantomMeme || phantomToken.name) && (
                  <>
                    <div className="gate-token-preview">
                      <div className="gate-token-preview-avatar">
                        {phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl ? (
                          <img src={phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl} alt="Token" className="w-full h-full object-cover" />
                        ) : (
                          <Bot className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="gate-token-preview-info space-y-2">
                        <Input
                          value={phantomToken.name}
                          onChange={(e) => setPhantomToken({ ...phantomToken, name: e.target.value.slice(0, 32) })}
                          className="gate-input h-8"
                          placeholder="Token name"
                          maxLength={32}
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-primary text-sm">$</span>
                          <Input
                            value={phantomToken.ticker}
                            onChange={(e) => setPhantomToken({ ...phantomToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })}
                            className="gate-input h-7 w-28 font-mono"
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
                      className="gate-input gate-textarea"
                      maxLength={500}
                    />

                    {/* Social links - collapsible */}
                    <details className="group">
                      <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        <Globe className="h-3 w-3" />
                        <span>Add Social Links (optional)</span>
                      </summary>
                      <div className="mt-2 space-y-2 pl-5">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Input
                            placeholder="Website URL"
                            value={phantomToken.websiteUrl || ""}
                            onChange={(e) => setPhantomToken({ ...phantomToken, websiteUrl: e.target.value })}
                            className="gate-input text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Twitter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Input
                            placeholder="X/Twitter URL"
                            value={phantomToken.twitterUrl || ""}
                            onChange={(e) => setPhantomToken({ ...phantomToken, twitterUrl: e.target.value })}
                            className="gate-input text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Input
                            placeholder="Telegram URL"
                            value={phantomToken.telegramUrl || ""}
                            onChange={(e) => setPhantomToken({ ...phantomToken, telegramUrl: e.target.value })}
                            className="gate-input text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Input
                            placeholder="Discord URL"
                            value={phantomToken.discordUrl || ""}
                            onChange={(e) => setPhantomToken({ ...phantomToken, discordUrl: e.target.value })}
                            className="gate-input text-sm"
                          />
                        </div>
                      </div>
                    </details>

                    <Input type="file" accept="image/*" onChange={handlePhantomImageChange} className="gate-input text-xs" />


                    <Button
                      onClick={handlePhantomLaunch}
                      disabled={isPhantomLaunching || !phantomToken.name.trim() || !phantomToken.ticker.trim() || (!phantomImagePreview && !phantomMeme?.imageUrl && !phantomToken.imageUrl) || (phantomWallet.balance !== null && phantomWallet.balance < 0.02)}
                      className="gate-btn gate-btn-primary w-full"
                    >
                      {isPhantomLaunching ? <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-4 w-4 mr-2" /> Launch (~0.02 SOL)</>}
                    </Button>

                    {phantomWallet.balance !== null && phantomWallet.balance < 0.02 && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Insufficient balance. Need at least 0.02 SOL.
                      </p>
                    )}
                  </>
                )}
              </>
            )}

            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold">Fee Structure</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Launch Fee</span>
                  <span className="text-primary font-semibold">~0.02 SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your Fee Share</span>
                  <span className="text-primary font-bold">50%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trading Fee</span>
                  <span className="text-primary font-semibold">{(phantomTradingFee / 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
