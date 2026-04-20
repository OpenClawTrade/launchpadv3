import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Rocket, Image as ImageIcon, Globe, Twitter, Loader2, Coins, Shield, Info, ExternalLink, Upload, X } from 'lucide-react';
import { EthCreatorControls } from './EthCreatorControls';
import { EthLaunchProgress } from './EthLaunchProgress';
import { EvmWalletCard } from './EvmWalletCard';
import { useEvmWallet } from '@/hooks/useEvmWallet';
import { useEthPrice } from '@/hooks/useBaseTokens';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Launch parameters — must mirror eth-create-token edge function
const TOTAL_SUPPLY = 1_000_000_000; // 1B tokens
const START_MC_USD = 5_000; // $5K starting market cap (single-sided V3)
const MANDATORY_DEV_BUY_USD = 50; // Required initial dev buy

interface EthLaunchFormData {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  devBuyEth: number;
}

const MAX_DEV_BUY = 5;

export function EthLauncher() {
  const { isConnected, address, connect } = useEvmWallet();
  const { data: ethPrice = 0 } = useEthPrice();
  const [isLaunching, setIsLaunching] = useState(false);
  const [devBuyInput, setDevBuyInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5 MB');
      return;
    }
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('token-images')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('token-images').getPublicUrl(path);
      setFormData(prev => ({ ...prev, imageUrl: data.publicUrl }));
      toast.success('Image uploaded');
    } catch (e) {
      console.error('Image upload error:', e);
      toast.error('Upload failed', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setIsUploading(false);
    }
  };
  const [deployedTokenAddress, setDeployedTokenAddress] = useState<string | null>(null);
  const [deployTxHash, setDeployTxHash] = useState<string | null>(null);
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [formData, setFormData] = useState<EthLaunchFormData>({
    name: '',
    ticker: '',
    description: '',
    imageUrl: '',
    websiteUrl: '',
    twitterUrl: '',
    telegramUrl: '',
    devBuyEth: 0,
  });

  const handleInputChange = <K extends keyof EthLaunchFormData>(field: K, value: EthLaunchFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Auto-set mandatory dev buy = $50 worth of ETH whenever ETH price loads/updates
  useEffect(() => {
    if (ethPrice > 0) {
      const ethAmount = MANDATORY_DEV_BUY_USD / ethPrice;
      const rounded = Math.ceil(ethAmount * 1e6) / 1e6; // 6 decimals, round up so we always cover $50
      setFormData(prev => (prev.devBuyEth === rounded ? prev : { ...prev, devBuyEth: rounded }));
      setDevBuyInput(rounded.toString());
    }
  }, [ethPrice]);

  const canLaunch =
    isConnected &&
    formData.name.trim().length > 0 &&
    formData.ticker.trim().length > 0 &&
    ethPrice > 0 &&
    formData.devBuyEth > 0;

  const handleLaunch = useCallback(async () => {
    if (!canLaunch || !address) return;
    setIsLaunching(true);
    setDeployedTokenAddress(null);
    setDeployTxHash(null);
    setPoolAddress(null);
    setLaunchError(null);
    setIsLive(false);

    try {
      toast.info('🛠 Deploying on Ethereum mainnet…', {
        description: 'Compiling ERC-20, creating Uniswap V3 1% pool, minting LP NFT to vault.',
      });

      const { data, error } = await supabase.functions.invoke('eth-create-token', {
        body: {
          name: formData.name,
          ticker: formData.ticker.toUpperCase(),
          creatorWallet: address,
          devBuyEth: formData.devBuyEth || 0,
          description: formData.description || null,
          imageUrl: formData.imageUrl || null,
          websiteUrl: formData.websiteUrl || null,
          twitterUrl: formData.twitterUrl || null,
          telegramUrl: formData.telegramUrl || null,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success || !data?.launchId) throw new Error(data?.error || 'Failed to start deploy');

      const launchId = data.launchId as string;

      // Poll eth_launch_requests — surface deploy_tx_hash & token_address as soon as they appear
      let row: any = null;
      const started = Date.now();
      while (Date.now() - started < 180_000) {
        await new Promise((r) => setTimeout(r, 3000));
        const { data: r } = await supabase
          .from('eth_launch_requests')
          .select('status, token_address, deploy_tx_hash, error_message')
          .eq('id', launchId)
          .maybeSingle();
        if (r?.deploy_tx_hash && !deployTxHash) setDeployTxHash(r.deploy_tx_hash);
        if (r?.token_address) setDeployedTokenAddress(r.token_address);
        if (r?.status === 'live' || r?.status === 'failed') { row = r; break; }
      }

      if (!row) throw new Error('Deployment timed out (still processing on-chain — check Etherscan in a minute)');
      if (row.status === 'failed') throw new Error(row.error_message || 'Deployment failed');

      setDeployedTokenAddress(row.token_address);
      setDeployTxHash(row.deploy_tx_hash);
      setIsLive(true);

      toast.success('🎉 Token live on Uniswap V3', {
        description: `Pool seeded at 1% fee tier. ${formData.devBuyEth > 0 ? `Dev buy of ${formData.devBuyEth} ETH delivered.` : 'No dev buy.'}`,
        action: {
          label: 'View on Etherscan',
          onClick: () => window.open(`https://etherscan.io/address/${row.token_address}`, '_blank'),
        },
      });
    } catch (e) {
      console.error('ETH V3 launch error:', e);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setLaunchError(msg);
      toast.error('Launch failed', { description: msg });
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
                  Launch on Ethereum (Uniswap V3)
                </CardTitle>
                <CardDescription className="mt-1">
                  Single-sided V3 pool · 1% trading fee · You earn 50% of every swap.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                Ethereum
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Token Basics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eth-name">Token Name *</Label>
                <Input
                  id="eth-name"
                  placeholder="e.g., Moon Coin"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  maxLength={32}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eth-ticker">Symbol *</Label>
                <Input
                  id="eth-ticker"
                  placeholder="e.g., MOON"
                  value={formData.ticker}
                  onChange={(e) => handleInputChange('ticker', e.target.value.toUpperCase())}
                  maxLength={10}
                  className="bg-background/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eth-description">Description</Label>
              <Textarea
                id="eth-description"
                placeholder="Tell the world about your token..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                maxLength={500}
                rows={3}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Token Image
              </Label>
              {formData.imageUrl ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                  <img
                    src={formData.imageUrl}
                    alt="Token preview"
                    className="w-16 h-16 rounded-lg object-cover ring-1 ring-border"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">Uploaded</p>
                    <p className="text-[10px] font-mono text-muted-foreground/60 truncate">{formData.imageUrl}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleInputChange('imageUrl', '')}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="eth-image-file"
                  className={`flex flex-col items-center justify-center gap-2 h-28 rounded-lg border-2 border-dashed border-border/60 bg-background/30 cursor-pointer transition-colors hover:border-primary/60 hover:bg-background/50 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Click to upload <span className="text-foreground font-medium">PNG, JPG, GIF</span> · max 5 MB
                      </span>
                    </>
                  )}
                  <input
                    id="eth-image-file"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eth-website" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website
                </Label>
                <Input
                  id="eth-website"
                  placeholder="https://..."
                  value={formData.websiteUrl}
                  onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eth-twitter" className="flex items-center gap-2">
                  <Twitter className="h-4 w-4" />
                  Twitter/X
                </Label>
                <Input
                  id="eth-twitter"
                  placeholder="https://x.com/..."
                  value={formData.twitterUrl}
                  onChange={(e) => handleInputChange('twitterUrl', e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eth-telegram">Telegram</Label>
                <Input
                  id="eth-telegram"
                  placeholder="https://t.me/..."
                  value={formData.telegramUrl}
                  onChange={(e) => handleInputChange('telegramUrl', e.target.value)}
                  className="bg-background/50"
                />
              </div>
            </div>

            {/* Mandatory Dev Buy — locked at $50 worth of ETH */}
            <div className="space-y-3 p-4 bg-secondary/30 rounded-lg border border-border/50">
              <div className="flex items-center justify-between">
                <Label htmlFor="eth-devbuy" className="flex items-center gap-2 text-base">
                  <Coins className="h-4 w-4 text-primary" />
                  Initial Dev Buy
                  <Badge variant="outline" className="ml-1 text-[10px] uppercase tracking-wide border-primary/40 text-primary">
                    Required · ${MANDATORY_DEV_BUY_USD}
                  </Badge>
                </Label>
                {ethPrice > 0 && (
                  <span className="text-xs font-mono text-muted-foreground">
                    ≈ ${(formData.devBuyEth * ethPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              <div className="relative">
                <Input
                  id="eth-devbuy"
                  type="text"
                  value={ethPrice > 0 ? devBuyInput : 'Loading ETH price…'}
                  readOnly
                  disabled
                  className="bg-background/30 pr-14 h-11 text-base font-mono cursor-not-allowed opacity-90"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none">
                  ETH
                </span>
              </div>

              {/* Live preview: USD cost + supply share */}
              {formData.devBuyEth > 0 && (() => {
                const usdCost = ethPrice > 0 ? formData.devBuyEth * ethPrice : 0;
                const pricePerToken = START_MC_USD / TOTAL_SUPPLY;
                const tokensReceived = usdCost > 0 ? usdCost / pricePerToken : 0;
                const pctSupply = (tokensReceived / TOTAL_SUPPLY) * 100;
                return (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded-md bg-background/40 border border-border/40 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cost</div>
                      <div className="text-sm font-mono font-semibold text-foreground">
                        {ethPrice > 0
                          ? `$${usdCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                          : '—'}
                      </div>
                    </div>
                    <div className="rounded-md bg-background/40 border border-border/40 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Supply share</div>
                      <div className="text-sm font-mono font-semibold text-primary">
                        {pctSupply >= 0.01 ? `~${pctSupply.toFixed(2)}%` : '<0.01%'}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Every launch requires a <span className="text-primary font-semibold">${MANDATORY_DEV_BUY_USD} dev buy</span> to seed
                price discovery and prevent zero-liquidity snipes. Amount auto-converted to ETH at the current spot price.
              </p>
            </div>

            {/* Model explainer */}
            <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <Info className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-200/90 leading-relaxed">
                <strong>Zero capital launch.</strong> You don't pay for LP. Token mints to a Uniswap V3 1% pool — single-sided above spot.
                The LP NFT is held in the platform vault so it can't be rugged. You earn{' '}
                <strong>50% of all 1% swap fees</strong>, claimable any time on this page.
              </p>
            </div>

            {/* Launch */}
            {!isConnected ? (
              <Button onClick={connect} className="w-full h-12 text-lg font-semibold" variant="outline">
                Connect Wallet to Launch
              </Button>
            ) : (
              <Button
                onClick={handleLaunch}
                disabled={!canLaunch || isLaunching}
                className="w-full h-12 text-lg font-semibold"
              >
                {isLaunching ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Deploying on Ethereum…</>
                ) : (
                  <><Rocket className="mr-2 h-5 w-5" />Launch Token</>
                )}
              </Button>
            )}

            {/* Step-by-step launch progress (with CA reveal at the end) */}
            <EthLaunchProgress
              isLaunching={isLaunching}
              hasDevBuy={formData.devBuyEth > 0}
              tokenAddress={deployedTokenAddress}
              deployTxHash={deployTxHash}
              isLive={isLive}
              errorMessage={launchError}
            />

            {/* Pool link (kept as a small extra once we have it) */}
            {poolAddress && (
              <div className="text-xs flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/50">
                <span className="text-muted-foreground">V3 Pool (1%)</span>
                <a
                  href={`https://app.uniswap.org/explore/pools/ethereum/${poolAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-primary hover:underline inline-flex items-center gap-1"
                >
                  {poolAddress.slice(0, 8)}…{poolAddress.slice(-6)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Creator earnings panel — appears once contract is on-chain */}
            {deployedTokenAddress && (
              <div className="mt-4">
                <EthCreatorControls tokenAddress={deployedTokenAddress} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <EvmWalletCard />

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">1.</span><p>Fill in your token details. No LP capital required.</p></div>
            <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">2.</span><p>ERC-20 deploys, Uniswap V3 1% pool is created and seeded single-sided above spot.</p></div>
            <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">3.</span><p>LP NFT is held in the <strong className="text-foreground">platform vault</strong> — it cannot be rugged, transferred, or burned.</p></div>
            <div className="flex items-start gap-2"><span className="text-emerald-400 font-bold shrink-0">★</span><p>Every ~6h fees are collected and your <strong className="text-emerald-300">50% share</strong> becomes claimable as ETH.</p></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
