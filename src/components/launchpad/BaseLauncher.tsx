import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Rocket, Image as ImageIcon, Globe, Twitter, AlertCircle, Loader2 } from 'lucide-react';
import { FeeSlider } from './FeeSlider';
import { EvmWalletCard } from './EvmWalletCard';
import { useEvmWallet } from '@/hooks/useEvmWallet';
import { toast } from 'sonner';

interface BaseLaunchFormData {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  creatorFeePct: number;
  fairLaunchDuration: string;
  startingMcap: string;
}

export function BaseLauncher() {
  const { isConnected, isOnBase, address, balance } = useEvmWallet();
  const [isLaunching, setIsLaunching] = useState(false);
  const [formData, setFormData] = useState<BaseLaunchFormData>({
    name: '',
    ticker: '',
    description: '',
    imageUrl: '',
    websiteUrl: '',
    twitterUrl: '',
    creatorFeePct: 80,
    fairLaunchDuration: '5',
    startingMcap: '5000',
  });

  const handleInputChange = (field: keyof BaseLaunchFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canLaunch = isConnected && isOnBase && formData.name && formData.ticker;

  const handleLaunch = async () => {
    if (!canLaunch) return;

    setIsLaunching(true);
    try {
      // TODO: Implement actual Base token launch via edge function
      toast.info('Base token launching is coming soon!');
      console.log('Launch data:', {
        ...formData,
        creatorAddress: address,
        creatorFeeBps: formData.creatorFeePct * 100, // Convert to basis points
      });
    } catch (error) {
      console.error('Launch error:', error);
      toast.error('Failed to launch token');
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Form */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Launch on Base
            </CardTitle>
            <CardDescription>
              Create a token with built-in creator royalties and community buybacks.
              100% of trading fees go to you and your holders.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              />
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
                />
              </div>
            </div>

            {/* Fee Distribution Slider */}
            <FeeSlider
              creatorFeePct={formData.creatorFeePct}
              onChange={(value) => handleInputChange('creatorFeePct', value)}
            />

            {/* Launch Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fair Launch Duration</Label>
                <Select
                  value={formData.fairLaunchDuration}
                  onValueChange={(v) => handleInputChange('fairLaunchDuration', v)}
                >
                  <SelectTrigger>
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
                  <SelectTrigger>
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
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Launching requires ~0.002 ETH for gas. Your fee split is locked forever after launch.
              </p>
            </div>

            {/* Launch Button */}
            <Button
              onClick={handleLaunch}
              disabled={!canLaunch || isLaunching}
              className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-5 w-5" />
                  Launch Token
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <EvmWalletCard />

        {/* Info Card */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              <p>Set your creator fee % (paid on every trade)</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              <p>Remaining fees buy back your token automatically</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              <p>Fair launch prevents snipers with fixed price period</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">4.</span>
              <p>Liquidity is locked forever - no rugs possible</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
