import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Rocket, Image as ImageIcon, Globe, Twitter, AlertCircle, Loader2, Coins, Shield, Droplets } from 'lucide-react';
import { EvmWalletCard } from './EvmWalletCard';
import { useEvmWallet } from '@/hooks/useEvmWallet';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface BnbLaunchFormData {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  seedLiquidity: string;
}

export function BnbLauncher() {
  const { isConnected, address, balance, connect } = useEvmWallet();
  const [isLaunching, setIsLaunching] = useState(false);
  const [formData, setFormData] = useState<BnbLaunchFormData>({
    name: '',
    ticker: '',
    description: '',
    imageUrl: '',
    websiteUrl: '',
    twitterUrl: '',
    seedLiquidity: '0.1',
  });

  const handleInputChange = (field: keyof BnbLaunchFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canLaunch = isConnected && formData.name && formData.ticker;

  const handleLaunch = useCallback(async () => {
    if (!canLaunch || !address) return;

    setIsLaunching(true);
    toast.info('🚀 Deploying token on BNB Chain...', {
      description: 'Compiling contract, deploying, and adding PancakeSwap liquidity. This may take 30-90 seconds.',
    });

    try {
      const { data, error } = await supabase.functions.invoke('bnb-create-token', {
        body: {
          name: formData.name,
          ticker: formData.ticker.toUpperCase(),
          creatorWallet: address,
          seedLiquidityBnb: formData.seedLiquidity,
          description: formData.description || null,
          imageUrl: formData.imageUrl || null,
          websiteUrl: formData.websiteUrl || null,
          twitterUrl: formData.twitterUrl || null,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to deploy token');

      toast.success('🎉 Token deployed on BNB Chain!', {
        description: `${formData.name} ($${formData.ticker}) is live on PancakeSwap!`,
        action: data.pancakeswapUrl ? {
          label: 'Trade on PancakeSwap',
          onClick: () => window.open(data.pancakeswapUrl, '_blank'),
        } : undefined,
      });

      setFormData({
        name: '', ticker: '', description: '', imageUrl: '',
        websiteUrl: '', twitterUrl: '', seedLiquidity: '0.1',
      });
    } catch (error) {
      console.error('BNB launch error:', error);
      toast.error('Deployment failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLaunching(false);
    }
  }, [canLaunch, address, formData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Form */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary" />
                  Launch on BNB Chain
                </CardTitle>
                <CardDescription className="mt-1">
                  Deploy a token with instant PancakeSwap liquidity. Tradable immediately on any DEX.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                BNB Chain
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Info Banner */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                <Droplets className="h-4 w-4 text-yellow-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Instant Liquidity</p>
                  <p className="text-sm font-semibold text-yellow-400">PancakeSwap V2</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg">
                <Coins className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Supply Split</p>
                  <p className="text-sm font-semibold">50% LP + 50% Creator</p>
                </div>
              </div>
            </div>

            {/* Token Basics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bnb-name">Token Name *</Label>
                <Input
                  id="bnb-name"
                  placeholder="e.g., Moon Coin"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  maxLength={32}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bnb-ticker">Symbol *</Label>
                <Input
                  id="bnb-ticker"
                  placeholder="e.g., MOON"
                  value={formData.ticker}
                  onChange={(e) => handleInputChange('ticker', e.target.value.toUpperCase())}
                  maxLength={10}
                  className="bg-background/50"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="bnb-description">Description</Label>
              <Textarea
                id="bnb-description"
                placeholder="Tell the world about your token..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                maxLength={500}
                rows={3}
                className="bg-background/50"
              />
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="bnb-imageUrl" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Image URL
              </Label>
              <Input
                id="bnb-imageUrl"
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                className="bg-background/50"
              />
              {formData.imageUrl && (
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-secondary/30">
                  <img
                    src={formData.imageUrl}
                    alt="Token preview"
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
            </div>

            {/* Social Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bnb-websiteUrl" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website
                </Label>
                <Input
                  id="bnb-websiteUrl"
                  placeholder="https://..."
                  value={formData.websiteUrl}
                  onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bnb-twitterUrl" className="flex items-center gap-2">
                  <Twitter className="h-4 w-4" />
                  Twitter/X
                </Label>
                <Input
                  id="bnb-twitterUrl"
                  placeholder="https://x.com/..."
                  value={formData.twitterUrl}
                  onChange={(e) => handleInputChange('twitterUrl', e.target.value)}
                  className="bg-background/50"
                />
              </div>
            </div>

            {/* Seed Liquidity */}
            <div className="space-y-2">
              <Label>Initial BNB Liquidity</Label>
              <Select
                value={formData.seedLiquidity}
                onValueChange={(v) => handleInputChange('seedLiquidity', v)}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.05">0.05 BNB (~$30)</SelectItem>
                  <SelectItem value="0.1">0.1 BNB (~$60)</SelectItem>
                  <SelectItem value="0.25">0.25 BNB (~$150)</SelectItem>
                  <SelectItem value="0.5">0.5 BNB (~$300)</SelectItem>
                  <SelectItem value="1">1 BNB (~$600)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gas Notice */}
            <div className="flex items-start gap-2 p-3 bg-secondary/30 rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Launching requires seed BNB for liquidity + ~0.005 BNB for gas.
                <strong className="text-foreground"> Token is immediately tradable on PancakeSwap and all BSC DEX aggregators.</strong>
              </p>
            </div>

            {/* Launch Button */}
            {!isConnected ? (
              <Button
                onClick={connect}
                className="w-full h-12 text-lg font-semibold"
                variant="outline"
              >
                Connect Wallet to Launch
              </Button>
            ) : (
              <Button
                onClick={handleLaunch}
                disabled={!canLaunch || isLaunching}
                className="w-full h-12 text-lg font-semibold bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                {isLaunching ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Launching on BNB Chain...
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-5 w-5" />
                    Launch Token
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <EvmWalletCard />

        {/* How It Works */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold shrink-0">1.</span>
              <p>ERC20 token deploys on BNB Chain (1B supply)</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold shrink-0">2.</span>
              <p>50% of tokens + your seed BNB added to PancakeSwap V2</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold shrink-0">3.</span>
              <p>Remaining 50% tokens sent to your wallet</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold shrink-0">4.</span>
              <p>Token is instantly tradable on PancakeSwap, Axiom, or any BSC DEX</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
