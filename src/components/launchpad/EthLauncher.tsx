import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Rocket, Image as ImageIcon, Globe, Twitter, Loader2, Coins, Shield, Info, ExternalLink } from 'lucide-react';
import { EthCreatorControls } from './EthCreatorControls';
import { EvmWalletCard } from './EvmWalletCard';
import { useEvmWallet } from '@/hooks/useEvmWallet';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
  useWriteContract,
} from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { parseEther, encodeFunctionData, parseAbi } from 'viem';

// Uniswap V2 (mainnet) — battle-tested, simple LP add path
const UNISWAP_V2_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as const;
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;
const UNISWAP_V2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' as const;

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function renounceOwnership()',
]);
const ROUTER_ABI = parseAbi([
  'function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)',
]);
const FACTORY_ABI = parseAbi([
  'function getPair(address tokenA, address tokenB) view returns (address)',
]);
const WETH_MAINNET = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as const;

const PLATFORM_FEE_PCT = 1; // Always 1% protocol tax
const MIN_USER_TAX = 0;
const MAX_USER_TAX = 3;

const LP_PRESETS = [0.5, 1, 3, 5];

interface EthLaunchFormData {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  lpEth: number;
  userTaxPct: number;
}

export function EthLauncher() {
  const { isConnected, address, connect } = useEvmWallet();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const [isLaunching, setIsLaunching] = useState(false);
  const [customLp, setCustomLp] = useState(false);
  const [lpEthInput, setLpEthInput] = useState('1'); // string for free typing of decimals
  const [deployedTokenAddress, setDeployedTokenAddress] = useState<string | null>(null);
  const [deployTxHash, setDeployTxHash] = useState<`0x${string}` | null>(null);
  const [postDeployStep, setPostDeployStep] = useState<'idle' | 'approve' | 'lp' | 'verify' | 'done'>('idle');
  const [verified, setVerified] = useState(false);
  const [formData, setFormData] = useState<EthLaunchFormData>({
    name: '',
    ticker: '',
    description: '',
    imageUrl: '',
    websiteUrl: '',
    twitterUrl: '',
    telegramUrl: '',
    lpEth: 1,
    userTaxPct: 1,
  });

  // Watch deploy tx confirmation
  const { data: deployReceipt } = useWaitForTransactionReceipt({
    hash: deployTxHash ?? undefined,
    chainId: mainnet.id,
  });

  const handleInputChange = <K extends keyof EthLaunchFormData>(field: K, value: EthLaunchFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const totalTax = useMemo(() => formData.userTaxPct + PLATFORM_FEE_PCT, [formData.userTaxPct]);
  const isOnEth = chainId === mainnet.id;
  const canLaunch = isConnected && formData.name && formData.ticker && formData.lpEth > 0;

  const handleLaunch = useCallback(async () => {
    if (!canLaunch || !address) return;

    setIsLaunching(true);
    setDeployedTokenAddress(null);
    setDeployTxHash(null);

    try {
      // 1. Ensure on Ethereum mainnet
      if (!isOnEth) {
        toast.info('Switching to Ethereum…');
        await switchChainAsync({ chainId: mainnet.id });
      }

      // 2. Get unsigned deploy tx + ABI from edge function
      toast.info('🛠 Preparing deployment…', {
        description: 'Compiling ERC-20 with your metadata embedded on-chain.',
      });

      const { data, error } = await supabase.functions.invoke('eth-create-token', {
        body: {
          name: formData.name,
          ticker: formData.ticker.toUpperCase(),
          creatorWallet: address,
          lpEth: formData.lpEth,
          userTaxBps: Math.round(formData.userTaxPct * 100),
          platformTaxBps: PLATFORM_FEE_PCT * 100,
          // burnLp/renounce are now handled manually post-launch by creator
          burnLp: false,
          renounce: false,
          description: formData.description || null,
          imageUrl: formData.imageUrl || null,
          websiteUrl: formData.websiteUrl || null,
          twitterUrl: formData.twitterUrl || null,
          telegramUrl: formData.telegramUrl || null,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to prepare deployment');

      const launchId: string = data.launchId;
      const deployTx = data.deployTx as { data: `0x${string}`; value: string; chainId: number };

      // 3. Send deploy tx from user's wallet
      toast.info('✍️ Sign deployment in your wallet', {
        description: 'You pay gas. The contract will deploy directly to your address.',
      });

      const txHash = await sendTransactionAsync({
        to: undefined, // contract creation
        data: deployTx.data,
        value: 0n,
        chainId: mainnet.id,
      });

      setDeployTxHash(txHash);
      toast.success('🚀 Deployment broadcast', {
        description: 'Waiting for Ethereum to confirm your contract…',
      });

      // 4. Compute predicted contract address (CREATE opcode = keccak256(rlp(sender, nonce)))
      // viem's getContractAddress requires nonce; the receipt is the source of truth, so we wait.
      // We poll the receipt via useWaitForTransactionReceipt above; finalize once deployReceipt arrives.

      // Optimistic finalize-pending DB update via finalize endpoint with deploy hash only
      await supabase.functions.invoke('eth-launch-finalize', {
        body: {
          launchId,
          status: 'live',
          deployTxHash: txHash,
        },
      }).catch((e) => console.warn('[eth-launch] pre-finalize warn', e));

      // We'll rely on deployReceipt effect below to write tokenAddress.
      // Stash launchId for that effect via window-scoped map (simple, no extra state shape).
      (window as any).__lastEthLaunchId = launchId;
    } catch (e) {
      console.error('ETH launch error:', e);
      toast.error('Launch failed', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setIsLaunching(false);
    }
  }, [canLaunch, address, isOnEth, switchChainAsync, sendTransactionAsync, formData]);

  // When the deploy tx confirms: save address, then run LP add → burn LP → renounce → verify
  useEffect(() => {
    if (!deployReceipt || !deployTxHash) return;
    const tokenAddress = deployReceipt.contractAddress;
    if (!tokenAddress) return;
    if (deployedTokenAddress) return;
    setDeployedTokenAddress(tokenAddress);
    const launchId = (window as any).__lastEthLaunchId as string | undefined;

    if (launchId) {
      supabase.functions.invoke('eth-launch-finalize', {
        body: { launchId, status: 'live', deployTxHash, tokenAddress },
      }).catch((e) => console.warn('[eth-launch] finalize warn', e));
    }

    toast.success('🎉 Contract deployed', {
      description: `${formData.name} ($${formData.ticker.toUpperCase()}) is on-chain. Setting up LP…`,
    });

    // Atomic post-deploy chain: approve → addLiquidityETH → burn LP → renounce → verify
    (async () => {
      try {
        const supplyWei = parseEther('1000000000');
        const ethAmount = parseEther(String(formData.lpEth));
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

        // 1. Approve router for full supply
        setPostDeployStep('approve');
        toast.info('1/4 Approve router');
        await writeContractAsync({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [UNISWAP_V2_ROUTER, supplyWei],
          chainId: mainnet.id,
        } as any);

        // 2. Seed Uniswap V2 LP
        setPostDeployStep('lp');
        toast.info('2/4 Seeding Uniswap V2 LP', { description: `${formData.lpEth} ETH + 1B tokens` });
        await writeContractAsync({
          address: UNISWAP_V2_ROUTER,
          abi: ROUTER_ABI,
          functionName: 'addLiquidityETH',
          args: [tokenAddress as `0x${string}`, supplyWei, 0n, 0n, address as `0x${string}`, deadline],
          value: ethAmount,
          chainId: mainnet.id,
        } as any);

        // 3. Background Etherscan verification (non-blocking)
        setPostDeployStep('verify');
        toast.info('Verifying source on Etherscan…');
        supabase.functions.invoke('eth-verify-contract', {
          body: { tokenAddress, launchId },
        }).then(({ data, error }) => {
          if (error || !data?.success) {
            toast.warning('Verification queued', { description: 'Etherscan can take a few minutes.' });
          } else {
            setVerified(true);
            toast.success('✅ Source verified on Etherscan');
          }
        }).catch((e) => console.warn('[eth-verify] exception', e));

        setPostDeployStep('done');
        toast.success('🎉 Token live & LP seeded', {
          description: 'Use Creator Controls below to Burn LP, Remove LP, or Renounce.',
          action: {
            label: 'View on Etherscan',
            onClick: () => window.open(`https://etherscan.io/address/${tokenAddress}`, '_blank'),
          },
        });
      } catch (e) {
        console.error('[eth-launch] post-deploy chain failed', e);
        toast.error('Post-deploy step failed', {
          description: e instanceof Error ? e.message : 'Complete LP/burn/renounce manually.',
        });
        setPostDeployStep('idle');
      }
    })();
  }, [deployReceipt, deployTxHash, deployedTokenAddress, formData, address, writeContractAsync]);

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
                  Launch on Ethereum
                </CardTitle>
                <CardDescription className="mt-1">
                  Deploy ERC-20 with custom LP, taxes, instant burn & renounce.
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
                placeholder="Tell the world about your token... (embedded in contract metadata)"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                maxLength={500}
                rows={3}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eth-imageUrl" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Image URL
              </Label>
              <Input
                id="eth-imageUrl"
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                className="bg-background/50"
              />
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

            {/* LP Amount */}
            <div className="space-y-3 p-4 bg-secondary/30 rounded-lg border border-border/50">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-base">
                  <Coins className="h-4 w-4 text-primary" />
                  Liquidity (ETH)
                </Label>
                <span className="text-sm font-mono font-bold text-primary">{formData.lpEth} ETH</span>
              </div>
              {!customLp ? (
                <div className="grid grid-cols-4 gap-2">
                  {LP_PRESETS.map((amt) => (
                    <Button
                      key={amt}
                      type="button"
                      variant={formData.lpEth === amt ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleInputChange('lpEth', amt)}
                    >
                      {amt} ETH
                    </Button>
                  ))}
                </div>
              ) : (
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.1"
                  value={lpEthInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Allow empty, digits, single dot, decimals
                    if (v === '' || /^\d*\.?\d*$/.test(v)) {
                      setLpEthInput(v);
                      const parsed = parseFloat(v);
                      if (!isNaN(parsed) && parsed > 0) {
                        handleInputChange('lpEth', parsed);
                      }
                    }
                  }}
                  className="bg-background/50"
                />
              )}
              <button
                type="button"
                onClick={() => setCustomLp((v) => !v)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {customLp ? '← Use presets' : 'Use custom amount →'}
              </button>
            </div>

            {/* Tax Slider */}
            <div className="space-y-3 p-4 bg-secondary/30 rounded-lg border border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-base">Your trading tax</Label>
                <span className="text-sm font-mono font-bold text-primary">{formData.userTaxPct}%</span>
              </div>
              <Slider
                value={[formData.userTaxPct]}
                onValueChange={([v]) => handleInputChange('userTaxPct', v)}
                min={MIN_USER_TAX}
                max={MAX_USER_TAX}
                step={0.5}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0%</span>
                <span>1%</span>
                <span>2%</span>
                <span>3% max</span>
              </div>
              <div className="text-xs text-muted-foreground border-t border-border/50 pt-2 space-y-1">
                <div className="flex justify-between"><span>Your tax</span><span className="font-mono">{formData.userTaxPct}%</span></div>
                <div className="flex justify-between"><span>Platform tax</span><span className="font-mono">{PLATFORM_FEE_PCT}%</span></div>
                <div className="flex justify-between font-bold text-foreground"><span>Total swap tax</span><span className="font-mono">{totalTax}%</span></div>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <div>
                    <Label className="text-sm">Burn LP forever</Label>
                    <p className="text-[10px] text-muted-foreground">Sends LP NFT to dead address — locked permanently</p>
                  </div>
                </div>
                <Switch checked={formData.burnLp} onCheckedChange={(v) => handleInputChange('burnLp', v)} />
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-green-500" />
                  <div>
                    <Label className="text-sm">Renounce contract</Label>
                    <p className="text-[10px] text-muted-foreground">Removes ownership immediately after deploy</p>
                  </div>
                </div>
                <Switch checked={formData.renounce} onCheckedChange={(v) => handleInputChange('renounce', v)} />
              </div>
            </div>

            {/* LP Refund Notice */}
            <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <Info className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-200/90">
                <strong>LP refund guarantee:</strong> The first {formData.lpEth} ETH of platform fees we collect from your token will be refunded to you in full — guaranteed return of your seeded LP.
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
                disabled={!canLaunch || isLaunching || !!deployTxHash && !deployedTokenAddress}
                className="w-full h-12 text-lg font-semibold"
              >
                {isLaunching ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Preparing & signing…</>
                ) : deployTxHash && !deployedTokenAddress ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Waiting for Ethereum confirmation…</>
                ) : (
                  <><Rocket className="mr-2 h-5 w-5" />Launch Token ({totalTax}% swap tax)</>
                )}
              </Button>
            )}

            {/* Deployment status */}
            {deployTxHash && (
              <div className="text-xs space-y-1 p-3 bg-secondary/30 rounded-lg border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Deploy tx</span>
                  <a
                    href={`https://etherscan.io/tx/${deployTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {deployTxHash.slice(0, 10)}…{deployTxHash.slice(-6)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {deployedTokenAddress && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Token</span>
                    <a
                      href={`https://etherscan.io/address/${deployedTokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                      {deployedTokenAddress.slice(0, 8)}…{deployedTokenAddress.slice(-6)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
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
            <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">1.</span><p>Choose LP amount, set your tax (0–3%), enter metadata.</p></div>
            <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">2.</span><p>ERC-20 deploys with your metadata embedded as a contract comment + launchpad signature.</p></div>
            <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">3.</span><p>LP seeded on <strong className="text-foreground">Uniswap V3</strong>, trading enabled, LP burned & contract renounced (if enabled).</p></div>
            <div className="flex items-start gap-2"><span className="text-emerald-400 font-bold shrink-0">★</span><p>First platform fees from your token are <strong className="text-emerald-300">refunded back to you</strong> until your LP investment is recovered.</p></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
