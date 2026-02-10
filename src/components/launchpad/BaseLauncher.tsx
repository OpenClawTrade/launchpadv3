import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Rocket, Image as ImageIcon, Globe, Twitter, AlertCircle, Loader2, Coins, Shield, TrendingUp } from 'lucide-react';
import { EvmWalletCard } from './EvmWalletCard';
import { useEvmWallet } from '@/hooks/useEvmWallet';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface BaseLaunchFormData {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  fairLaunchDuration: string;
  startingMcap: string;
}

export function BaseLauncher() {
  const { isConnected, isOnBase, address, balance, switchToBase, connect } = useEvmWallet();
  const [isLaunching, setIsLaunching] = useState(false);
  const [formData, setFormData] = useState<BaseLaunchFormData>({
    name: '',
    ticker: '',
    description: '',
    imageUrl: '',
    websiteUrl: '',
    twitterUrl: '',
    fairLaunchDuration: '5',
    startingMcap: '5000',
  });

  const handleInputChange = (field: keyof BaseLaunchFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canLaunch = isConnected && isOnBase && formData.name && formData.ticker;

  const handleLaunch = useCallback(async () => {
    if (!canLaunch || !address) return;

    setIsLaunching(true);
    toast.info('🚀 Deploying token on Base...', { description: 'Compiling & deploying contract on-chain. This may take 30-60 seconds.' });

    try {
      const { data, error } = await supabase.functions.invoke('base-create-token', {
        body: {
          name: formData.name,
          ticker: formData.ticker.toUpperCase(),
          creatorWallet: address,
          fairLaunchDurationMins: parseInt(formData.fairLaunchDuration),
          startingMcapUsd: parseInt(formData.startingMcap),
          description: formData.description || null,
          imageUrl: formData.imageUrl || null,
          websiteUrl: formData.websiteUrl || null,
          twitterUrl: formData.twitterUrl || null,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to deploy token');
      }

      toast.success('🎉 Token deployed on Base!', {
        description: `${formData.name} ($${formData.ticker}) deployed at ${data.tokenAddress?.slice(0, 10)}...`,
        action: data.explorerUrl ? {
          label: 'View on Basescan',
          onClick: () => window.open(data.explorerUrl, '_blank'),
        } : undefined,
      });

      // Reset form
      setFormData({
        name: '',
        ticker: '',
        description: '',
        imageUrl: '',
        websiteUrl: '',
        twitterUrl: '',
        fairLaunchDuration: '5',
        startingMcap: '5000',
      });

    } catch (error) {
      console.error('Base launch error:', error);
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
                  Launch on Base
                </CardTitle>
                <CardDescription className="mt-1">
                  Create a token with built-in trading fees and buyback support.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                Base Network
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Fee Structure Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <Coins className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Trading Fee</p>
                  <p className="text-sm font-semibold text-primary">2% Total</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Fee Split</p>
                  <p className="text-sm font-semibold">1% Platform + 1% Buyback</p>
                </div>
              </div>
            </div>

            {/* Token Basics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Token Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Moon Coin"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  maxLength={32}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticker">Symbol *</Label>
                <Input
                  id="ticker"
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
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
              <Label htmlFor="imageUrl" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Image URL
              </Label>
              <Input
                id="imageUrl"
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
                <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website
                </Label>
                <Input
                  id="websiteUrl"
                  placeholder="https://..."
                  value={formData.websiteUrl}
                  onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitterUrl" className="flex items-center gap-2">
                  <Twitter className="h-4 w-4" />
                  Twitter/X
                </Label>
                <Input
                  id="twitterUrl"
                  placeholder="https://x.com/..."
                  value={formData.twitterUrl}
                  onChange={(e) => handleInputChange('twitterUrl', e.target.value)}
                  className="bg-background/50"
                />
              </div>
            </div>

            {/* Launch Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fair Launch Duration</Label>
                <Select
                  value={formData.fairLaunchDuration}
                  onValueChange={(v) => handleInputChange('fairLaunchDuration', v)}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Starting Market Cap</Label>
                <Select
                  value={formData.startingMcap}
                  onValueChange={(v) => handleInputChange('startingMcap', v)}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5000">$5,000</SelectItem>
                    <SelectItem value="10000">$10,000</SelectItem>
                    <SelectItem value="25000">$25,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Gas Notice */}
            <div className="flex items-start gap-2 p-3 bg-secondary/30 rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Launching requires ~0.002 ETH for gas. 
                <strong className="text-foreground"> Fee structure is fixed: 2% total trading fee (1% platform + 1% to BidWall for automatic buybacks).</strong>
              </p>
            </div>

            {/* Wallet Connection / Launch Button */}
            {!isConnected ? (
              <Button
                onClick={connect}
                className="w-full h-12 text-lg font-semibold"
                variant="outline"
              >
                Connect Wallet to Launch
              </Button>
            ) : !isOnBase ? (
              <Button
                onClick={switchToBase}
                className="w-full h-12 text-lg font-semibold bg-orange-500 hover:bg-orange-600"
              >
                <AlertCircle className="mr-2 h-5 w-5" />
                Switch to Base Network
              </Button>
            ) : (
              <Button
                onClick={handleLaunch}
                disabled={!canLaunch || isLaunching}
                className="w-full h-12 text-lg font-semibold bg-blue-500 hover:bg-blue-600"
              >
                {isLaunching ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Launching on Base...
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

        {/* Fee Breakdown Card */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              Fee Structure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-secondary/20 rounded">
                <span className="text-sm text-muted-foreground">Total Trading Fee</span>
                <Badge className="bg-primary/20 text-primary border-0">2%</Badge>
              </div>
              <div className="flex justify-between items-center p-2 bg-blue-500/10 rounded">
                <span className="text-sm text-muted-foreground">Platform Share</span>
                <span className="text-sm font-medium text-blue-400">1%</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-500/10 rounded">
                <span className="text-sm text-muted-foreground">BidWall (Buybacks)</span>
                <span className="text-sm font-medium text-green-400">1%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The BidWall automatically buys back your token using accumulated fees, providing price support.
            </p>
          </CardContent>
        </Card>

        {/* How It Works Card */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold shrink-0">1.</span>
              <p>Token deploys via Uniswap V4 hooks on Base</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold shrink-0">2.</span>
              <p>Fair launch period prevents sniping (fixed price)</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold shrink-0">3.</span>
              <p>2% trading fee split: 1% platform, 1% BidWall</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold shrink-0">4.</span>
              <p>BidWall auto-buys your token when price drops</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold shrink-0">5.</span>
              <p>Liquidity locked forever - no rugs possible</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
