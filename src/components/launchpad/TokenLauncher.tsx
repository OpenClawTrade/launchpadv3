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
import { Transaction, Connection, VersionedTransaction } from "@solana/web3.js";
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

  const performLaunch = useCallback(async (tokenToLaunch: MemeToken) => {
    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      toast({ title: "Invalid wallet address", description: "Please enter a valid Solana wallet address", variant: "destructive" });
      return;
    }

    setIsLaunching(true);
    try {
      // Step 1: Create job (returns immediately)
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

      if (error) throw new Error(`Server error: ${error.message}`);
      if (!data?.success) throw new Error(data?.error || "Launch failed");

      // Step 2: If async, poll for completion
      if (data.async && data.jobId) {
        toast({ title: "🔄 Creating Token...", description: "On-chain transaction in progress..." });
        
        // Poll for job completion
        const pollForCompletion = async (): Promise<typeof data> => {
          const maxAttempts = 90; // 3 minutes with 2s intervals
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, 2000));
            
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fun-create-status?jobId=${data.jobId}`,
              { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } }
            );
            
            if (!response.ok) continue;
            const status = await response.json();
            
            if (status.status === 'completed') {
              return { ...data, ...status, success: true };
            }
            if (status.status === 'failed') {
              throw new Error(status.error || 'Token creation failed on-chain');
            }
          }
          throw new Error('Token creation timed out. Check your wallet for the token.');
        };

        const finalData = await pollForCompletion();
        
        onShowResult({
          success: true,
          name: tokenToLaunch.name,
          ticker: tokenToLaunch.ticker,
          mintAddress: finalData.mintAddress,
          imageUrl: tokenToLaunch.imageUrl,
          onChainSuccess: true,
          solscanUrl: finalData.solscanUrl,
          tradeUrl: finalData.tradeUrl,
          message: finalData.message || "🚀 Token launched successfully!",
        });
      } else {
        // Synchronous response (backwards compatible)
        onShowResult({
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
      }

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
      const errorMessage = error instanceof Error ? error.message : "Failed to launch token";
      onShowResult({ success: false, error: errorMessage });
      toast({ title: "Launch Failed", description: errorMessage.slice(0, 100), variant: "destructive" });
    } finally {
      setIsLaunching(false);
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
          creatorWallet: phantomWallet.address,
          tradingFeeBps: phantomTradingFee,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success || !data?.serializedTransaction) throw new Error(data?.error || "Failed to create transaction");

      // Sign and send
      const txBytes = Uint8Array.from(atob(data.serializedTransaction), (c) => c.charCodeAt(0));
      const transaction = VersionedTransaction.deserialize(txBytes);

      const rpcUrl = localStorage.getItem("heliusRpcUrl") || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");

      const signResult: unknown = await phantomWallet.signAndSendTransaction(transaction as any);
      if (!signResult) throw new Error("Transaction signing failed");
      let signature: string;
      if (typeof signResult === 'object' && signResult !== null && 'signature' in signResult) {
        signature = (signResult as { signature: string }).signature;
      } else {
        signature = String(signResult);
      }
      await connection.confirmTransaction(signature, "confirmed");

      onShowResult({
        success: true,
        name: phantomToken.name,
        ticker: phantomToken.ticker,
        mintAddress: data.mintAddress,
        imageUrl,
        onChainSuccess: true,
        solscanUrl: `https://solscan.io/tx/${signature}`,
        tradeUrl: data.mintAddress ? `https://jup.ag/swap/SOL-${data.mintAddress}` : undefined,
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
                  <div className="gate-token-preview-info">
                    <p className="font-semibold text-foreground">{describedToken.name}</p>
                    <p className="text-sm text-primary font-mono">${describedToken.ticker}</p>
                  </div>
                </div>

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

                <Button onClick={handlePhantomRandomize} disabled={isPhantomGenerating} className="gate-btn gate-btn-secondary w-full">
                  {isPhantomGenerating ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Shuffle className="h-4 w-4 mr-2" /> AI Randomize</>}
                </Button>

                {isPhantomGenerating && (
                  <div className="flex flex-col items-center py-6">
                    <MemeLoadingAnimation />
                    <MemeLoadingText />
                  </div>
                )}

                {!isPhantomGenerating && (
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
