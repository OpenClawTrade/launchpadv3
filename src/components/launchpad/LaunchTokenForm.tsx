import { useState, lazy, Suspense, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMeteoraApi } from "@/hooks/useMeteoraApi";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { Loader2, ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

interface LaunchTokenFormProps {
  onSuccess?: (mintAddress: string) => void;
}

// Lazy load a wrapper that uses Privy hooks
const PrivyWalletProvider = lazy(() => import("./PrivyWalletProvider"));

export function LaunchTokenForm({ onSuccess }: LaunchTokenFormProps) {
  const { solanaAddress, isAuthenticated, login, user } = useAuth();
  const { toast } = useToast();
  const { createPool, isLoading: isApiLoading } = useMeteoraApi();
  const privyAvailable = usePrivyAvailable();
  const navigate = useNavigate();
  
  // Wallet state from Privy (will be set by PrivyWalletProvider)
  const [wallets, setWallets] = useState<any[]>([]);
  const walletsRef = useRef<any[]>([]);

  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  const getWalletForSigning = useCallback(async () => {
    const pick = (list: any[]) =>
      list.find((w: any) => w.walletClientType === "privy") ??
      list.find((w: any) => w.chainType === "solana") ??
      list[0] ??
      null;

    let wallet = pick(walletsRef.current);
    if (wallet) return wallet;

    const started = Date.now();
    while (Date.now() - started < 8000) {
      await new Promise((r) => setTimeout(r, 200));
      wallet = pick(walletsRef.current);
      if (wallet) return wallet;
    }

    return null;
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    ticker: '',
    description: '',
    websiteUrl: '',
    twitterUrl: '',
    telegramUrl: '',
    discordUrl: '',
    initialBuySol: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSocialLinks, setShowSocialLinks] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Image too large", description: "Max 5MB allowed", variant: "destructive" });
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Sign transaction using Privy wallet
  const signTransaction = useCallback(
    async (tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> => {
      const wallet = await getWalletForSigning();

      if (!wallet) {
        throw new Error("Wallet is still initializing. Please wait a few seconds and try again.");
      }

      const provider =
        (wallet as any).getProvider ? await (wallet as any).getProvider() :
        (wallet as any).getSolanaProvider ? await (wallet as any).getSolanaProvider() :
        null;

      if (provider?.signTransaction) {
        return await provider.signTransaction(tx);
      }

      if ((wallet as any).signTransaction) {
        return await (wallet as any).signTransaction(tx);
      }

      throw new Error("Wallet does not support transaction signing");
    },
    [getWalletForSigning]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated || !solanaAddress) {
      toast({ title: "Please connect your wallet first", variant: "destructive" });
      return;
    }

    if (!formData.name || !formData.ticker) {
      toast({ title: "Name and ticker are required", variant: "destructive" });
      return;
    }

    if (formData.ticker.length > 10) {
      toast({ title: "Ticker must be 10 characters or less", variant: "destructive" });
      return;
    }

    if (!privyAvailable) {
      toast({
        title: "Wallet not ready",
        description: "Wallet system is still initializing. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    const signerWallet = await getWalletForSigning();
    if (!signerWallet) {
      toast({
        title: "No wallet connected",
        description: "Wait a few seconds for the embedded wallet to load, then try again.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `token-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      // Create pool with optional transaction signing
      const data = await createPool(
        {
          creatorWallet: solanaAddress,
          privyUserId: user?.privyId,
          name: formData.name,
          ticker: formData.ticker.toUpperCase(),
          description: formData.description,
          imageUrl,
          websiteUrl: formData.websiteUrl || undefined,
          twitterUrl: formData.twitterUrl || undefined,
          telegramUrl: formData.telegramUrl || undefined,
          discordUrl: formData.discordUrl || undefined,
          initialBuySol: formData.initialBuySol,
        },
        signTransaction // Pass signing function for on-chain creation
      );

      if (!data.success) throw new Error('Failed to create token');

      toast({
        title: "Token created successfully! 🚀",
        description: `${formData.name} ($${formData.ticker}) is now live!`,
      });

      if (onSuccess) {
        onSuccess(data.mintAddress);
      } else {
        navigate(`/launchpad/${data.mintAddress}`);
      }
    } catch (error) {
      console.error('Token launch error:', error);
      toast({
        title: "Failed to create token",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate USD value (mock SOL price ~$150)
  const solPrice = 150;
  const usdValue = (formData.initialBuySol * solPrice).toFixed(2);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Lazy load Privy wallet provider only when available */}
      {privyAvailable && (
        <Suspense fallback={null}>
          <PrivyWalletProvider onWalletsChange={setWallets} />
        </Suspense>
      )}
      {/* Token Info Section */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Token Info
        </h3>
        
        <div className="flex gap-4">
          {/* Image Upload */}
          <label className="flex-shrink-0 cursor-pointer group">
            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border bg-secondary/30 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-secondary/50 transition-all">
              {imagePreview ? (
                <img src={imagePreview} alt="Token" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <>
                  <ImageIcon className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Upload Image
                  </span>
                </>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </label>

          {/* Name & Ticker */}
          <div className="flex-1 space-y-3">
            <Input
              placeholder="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-11 bg-secondary/50 border-0 rounded-xl placeholder:text-muted-foreground/60"
              required
            />
            <Input
              placeholder="Ticker"
              value={formData.ticker}
              onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
              maxLength={10}
              className="h-11 bg-secondary/50 border-0 rounded-xl placeholder:text-muted-foreground/60"
              required
            />
          </div>
        </div>

        {/* Description */}
        <Textarea
          placeholder="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="mt-3 bg-secondary/50 border-0 rounded-xl placeholder:text-muted-foreground/60 min-h-[80px] resize-none"
        />

        {/* Social Links Collapsible */}
        <Collapsible open={showSocialLinks} onOpenChange={setShowSocialLinks}>
          <CollapsibleTrigger className="flex items-center gap-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
            Social Links (optional)
            {showSocialLinks ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3">
            <Input
              placeholder="Website URL"
              value={formData.websiteUrl}
              onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              className="h-11 bg-secondary/50 border-0 rounded-xl placeholder:text-muted-foreground/60"
            />
            <Input
              placeholder="Twitter URL"
              value={formData.twitterUrl}
              onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
              className="h-11 bg-secondary/50 border-0 rounded-xl placeholder:text-muted-foreground/60"
            />
            <Input
              placeholder="Telegram URL"
              value={formData.telegramUrl}
              onChange={(e) => setFormData({ ...formData, telegramUrl: e.target.value })}
              className="h-11 bg-secondary/50 border-0 rounded-xl placeholder:text-muted-foreground/60"
            />
            <Input
              placeholder="Discord URL"
              value={formData.discordUrl}
              onChange={(e) => setFormData({ ...formData, discordUrl: e.target.value })}
              className="h-11 bg-secondary/50 border-0 rounded-xl placeholder:text-muted-foreground/60"
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Initial Buy Section */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Initial Buy (optional)
        </h3>
        
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">◎</span>
            </div>
          </div>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00 SOL"
            value={formData.initialBuySol || ''}
            onChange={(e) => setFormData({ ...formData, initialBuySol: parseFloat(e.target.value) || 0 })}
            className="h-12 bg-secondary/50 border-0 rounded-xl pl-10 text-lg font-medium placeholder:text-muted-foreground/60"
          />
        </div>
        
        <p className="text-xs text-muted-foreground mt-3">
          We recommend a minimum 0.5 SOL initial buy to avoid snipers.
        </p>
        
        <div className="flex items-center justify-between mt-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="6" width="18" height="14" rx="2" />
              <path d="M3 10h18" />
            </svg>
            <span>{formData.initialBuySol || 0} SOL</span>
          </div>
          <span className="text-muted-foreground">${usdValue}</span>
        </div>
      </div>

      {/* Launch Button */}
      {isAuthenticated ? (
        <Button
          type="submit"
          className="w-full h-14 text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90"
          disabled={
            isLoading ||
            isApiLoading ||
            !formData.name ||
            !formData.ticker ||
            (privyAvailable && wallets.length === 0)
          }
        >
          {isLoading || isApiLoading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Creating Token...
            </>
          ) : privyAvailable && wallets.length === 0 ? (
            "Initializing wallet..."
          ) : (
            "Launch Token"
          )}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={() => login()}
          className="w-full h-14 text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90"
        >
          Log in to launch
        </Button>
      )}
    </form>
  );
}
