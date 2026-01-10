import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMeteoraApi } from "@/hooks/useMeteoraApi";
import { Loader2, Upload, Rocket, Twitter, Globe, MessageCircle, Image as ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LaunchTokenFormProps {
  onSuccess?: (mintAddress: string) => void;
}

export function LaunchTokenForm({ onSuccess }: LaunchTokenFormProps) {
  const { solanaAddress, isAuthenticated, login, user } = useAuth();
  const { toast } = useToast();
  const { createPool, isLoading: isApiLoading } = useMeteoraApi();
  const navigate = useNavigate();

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

    setIsLoading(true);

    try {
      // 1. Upload image to storage if provided
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

      // 2. Call the Vercel API to create the token (real Solana transactions)
      const data = await createPool({
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
      });

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

  if (!isAuthenticated) {
    return (
      <Card className="p-8 text-center">
        <div className="space-y-4">
          <Rocket className="h-16 w-16 mx-auto text-primary" />
          <h2 className="text-2xl font-bold">Launch Your Token</h2>
          <p className="text-muted-foreground">
            Connect your wallet to create and launch your own token on Solana.
          </p>
          <Button onClick={() => login()} size="lg">
            Connect Wallet
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">Launch Your Token</h2>
          <p className="text-muted-foreground">Create and launch your token in minutes</p>
        </div>

        {/* Token Image */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Avatar className="h-24 w-24 rounded-xl border-2 border-dashed border-border">
              {imagePreview ? (
                <AvatarImage src={imagePreview} />
              ) : (
                <AvatarFallback className="bg-secondary rounded-xl">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </AvatarFallback>
              )}
            </Avatar>
            <label className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
              <Upload className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>
          </div>
          <span className="text-sm text-muted-foreground">Upload token image (optional)</span>
        </div>

        {/* Basic Info */}
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Token Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Trenches Coin"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker *</Label>
              <Input
                id="ticker"
                placeholder="e.g., TRENCH"
                value={formData.ticker}
                onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                maxLength={10}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Tell the world about your token..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        {/* Social Links */}
        <div className="space-y-4">
          <h3 className="font-semibold">Social Links (optional)</h3>
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Website URL"
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Twitter className="h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Twitter URL"
                value={formData.twitterUrl}
                onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Telegram URL"
                value={formData.telegramUrl}
                onChange={(e) => setFormData({ ...formData, telegramUrl: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Initial Buy */}
        <div className="space-y-2">
          <Label htmlFor="initialBuy">Initial Buy (SOL)</Label>
          <Input
            id="initialBuy"
            type="number"
            min="0"
            step="0.1"
            placeholder="0"
            value={formData.initialBuySol || ''}
            onChange={(e) => setFormData({ ...formData, initialBuySol: parseFloat(e.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground">
            Optional: Buy tokens immediately after creation (protects against snipers)
          </p>
        </div>

        {/* Launch Info */}
        <div className="bg-secondary/50 rounded-lg p-4 space-y-2 text-sm">
          <h4 className="font-semibold">Token Details</h4>
          <div className="grid gap-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Total Supply:</span>
              <span className="font-medium text-foreground">1,000,000,000</span>
            </div>
            <div className="flex justify-between">
              <span>Initial Virtual Liquidity:</span>
              <span className="font-medium text-foreground">30 SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Graduation Threshold:</span>
              <span className="font-medium text-foreground">85 SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Trading Fee:</span>
              <span className="font-medium text-foreground">2% (1% to you)</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-12 text-lg font-bold"
          disabled={isLoading || !formData.name || !formData.ticker}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Creating Token...
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5 mr-2" />
              Launch Token
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
