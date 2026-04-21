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
import { createPublicClient, http, parseEther, type Address, type PublicClient } from 'viem';
import { mainnet } from 'viem/chains';
import { useWalletClient, useSwitchChain, useChainId } from 'wagmi';
import { POPSHIBA_LAUNCHER_ABI, waitForLaunchResult } from '@/lib/ethereum/popshibaLaunch';

// Launch parameters — must mirror eth-create-token edge function
const TOTAL_SUPPLY = 1_000_000_000; // 1B tokens
const MIN_LP_USD = 5;        // $5 test minimum LP seed (server floor: 0.001 ETH ≈ $3)
const MAX_DEV_BUY_USD = 5000; // soft UX cap on dev buy

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
  const { data: walletClient } = useWalletClient({ chainId: mainnet.id });
  const { switchChainAsync } = useSwitchChain();
  const currentChainId = useChainId();
  const [isLaunching, setIsLaunching] = useState(false);
  const [devBuyInput, setDevBuyInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [lockLP, setLockLP] = useState(false); // V3: opt-in Team Finance LP lock
  const [diagLogs, setDiagLogs] = useState<string[]>([]);
  const pushLog = useCallback((line: string) => {
    const stamp = new Date().toISOString().split('T')[1].replace('Z', '');
    // eslint-disable-next-line no-console
    console.log(`[ETH-LAUNCH ${stamp}] ${line}`);
    setDiagLogs(prev => [...prev, `${stamp}  ${line}`].slice(-200));
  }, []);

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
  const [launchTxHash, setLaunchTxHash] = useState<string | null>(null);
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [uncxLockId, setUncxLockId] = useState<string | null>(null);
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

  // Compute $50 LP seed in ETH (rounded up to 6 decimals so we always clear $50)
  const lpEthAmount = useMemo(() => {
    if (ethPrice <= 0) return 0;
    return Math.ceil((MIN_LP_USD / ethPrice) * 1e6) / 1e6;
  }, [ethPrice]);

  const canLaunch =
    isConnected &&
    formData.name.trim().length > 0 &&
    formData.ticker.trim().length > 0 &&
    ethPrice > 0 &&
    lpEthAmount > 0 &&
    formData.devBuyEth >= 0;

  const handleLaunch = useCallback(async () => {
    if (!canLaunch || !address) return;
    setIsLaunching(true);
    setDeployedTokenAddress(null);
    setLaunchTxHash(null);
    setPoolAddress(null);
    setUncxLockId(null);
    setLaunchError(null);
    setIsLive(false);
    setDiagLogs([]);

    let launchId: string | null = null;
    try {
      pushLog(`address=${address}  chainId(wagmi)=${currentChainId}  walletClient=${walletClient ? 'ready' : 'null'}`);

      // 1. Get launch parameters from server
      const ethForLPWeiStr = parseEther(lpEthAmount.toFixed(6)).toString();
      pushLog(`Requesting launch params: lpEth=${lpEthAmount}  devBuyEth=${formData.devBuyEth || 0}`);
      const { data, error } = await supabase.functions.invoke('eth-create-token', {
        body: {
          name: formData.name,
          ticker: formData.ticker.toUpperCase(),
          creatorWallet: address,
          ethForLPWei: ethForLPWeiStr,
          devBuyEth: formData.devBuyEth || 0,
          lockLP,
          description: formData.description || null,
          imageUrl: formData.imageUrl || null,
          websiteUrl: formData.websiteUrl || null,
          twitterUrl: formData.twitterUrl || null,
          telegramUrl: formData.telegramUrl || null,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success || !data?.launcher) throw new Error(data?.error || 'Failed to fetch launcher params');

      launchId = data.launchId as string;
      const launcher = data.launcher as Address;
      const ethForLPWei = BigInt(data.ethForLPWei);
      const ethForDevBuyWei = BigInt(data.ethForDevBuyWei);
      const lockerFeeWei = data.lockerFeeWei ? BigInt(data.lockerFeeWei) : (data.uncxLockFeeWei ? BigInt(data.uncxLockFeeWei) : 0n);
      const totalValue = ethForLPWei + ethForDevBuyWei + lockerFeeWei;
      pushLog(`launcher=${launcher}  ethForLPWei=${ethForLPWei}  ethForDevBuyWei=${ethForDevBuyWei}  lockerFeeWei=${lockerFeeWei}  lockLP=${lockLP}  total=${totalValue}`);
      pushLog(`launchId=${launchId}  metadataURI.len=${(data.metadataURI || '').length}`);

      // 2. Wallet checks
      if (!walletClient) throw new Error('Wallet not ready. Reconnect your wallet and try again.');
      if (currentChainId !== mainnet.id) {
        pushLog(`Wrong chain (${currentChainId}); switching to mainnet…`);
        toast.info('Switching wallet to Ethereum mainnet…');
        await switchChainAsync({ chainId: mainnet.id });
        pushLog('Switched to mainnet.');
      }

      const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno';
      const ethRpcUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/eth-rpc`;
      const publicClient = createPublicClient({ chain: mainnet, transport: http(ethRpcUrl) });

      // 2b. Verify launcher contract has bytecode (catches wrong-network / wrong-address)
      const code = await publicClient.getBytecode({ address: launcher });
      pushLog(`launcher bytecode size=${code ? (code.length - 2) / 2 : 0} bytes`);
      if (!code || code === '0x') throw new Error(`Launcher contract not deployed at ${launcher} on mainnet`);

      // 2c. Check user balance
      const bal = await publicClient.getBalance({ address: address as Address });
      pushLog(`user balance=${bal} wei  needed=${totalValue} wei (excl. gas)`);
      if (bal < totalValue) throw new Error(`Insufficient ETH: have ${Number(bal) / 1e18}, need ${Number(totalValue) / 1e18} + gas`);

      // 2d. Pre-flight simulation — this catches reverts BEFORE the wallet prompt
      pushLog('Simulating launch() call…');
      try {
        const sim = await publicClient.simulateContract({
          account: address as Address,
          address: launcher,
          abi: POPSHIBA_LAUNCHER_ABI,
          functionName: 'launch',
          args: [
            formData.name.trim(),
            formData.ticker.trim().toUpperCase(),
            data.metadataURI as string,
            ethForLPWei,
            ethForDevBuyWei,
            lockLP,
          ],
          value: totalValue,
        });
        const safeStringify = (v: any) =>
          JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val));
        pushLog(`Simulation OK. result=${safeStringify(sim.result)}`);
      } catch (simErr: any) {
        const reason = simErr?.shortMessage || simErr?.message || String(simErr);
        // Ignore BigInt serialization errors from logging — simulation actually succeeded
        if (reason.includes('serialize a BigInt')) {
          pushLog('Simulation OK (result contained BigInt — skipped logging).');
        } else {
          pushLog(`SIMULATION REVERT: ${reason}`);
          if (simErr?.metaMessages?.length) pushLog(`meta: ${simErr.metaMessages.join(' | ')}`);
          throw new Error(`Pre-flight simulation reverted: ${reason}`);
        }
      }

      // 2e. Estimate gas + EIP-1559 fees and pass the exact values to the wallet
      let gasLimit: bigint | undefined;
      let maxFeePerGas: bigint | undefined;
      let maxPriorityFeePerGas: bigint | undefined;
      let gasPrice: bigint | undefined;
      try {
        const gas = await publicClient.estimateContractGas({
          account: address as Address,
          address: launcher,
          abi: POPSHIBA_LAUNCHER_ABI,
          functionName: 'launch',
          args: [
            formData.name.trim(),
            formData.ticker.trim().toUpperCase(),
            data.metadataURI as string,
            ethForLPWei,
            ethForDevBuyWei,
          ],
          value: totalValue,
        });
        gasLimit = (gas * 105n) / 100n; // keep the wallet quote close to the real requirement

        const feeEstimate = await publicClient.estimateFeesPerGas();
        maxFeePerGas = feeEstimate.maxFeePerGas;
        maxPriorityFeePerGas = feeEstimate.maxPriorityFeePerGas;
        gasPrice = feeEstimate.gasPrice;

        const effectivePrice = maxFeePerGas ?? gasPrice;
        if (effectivePrice) {
          const gasCostWei = gasLimit * effectivePrice;
          pushLog(
            `gas estimate=${gas}  gasLimit=${gasLimit}  ${maxFeePerGas ? `maxFeePerGas=${maxFeePerGas} wei  maxPriorityFeePerGas=${maxPriorityFeePerGas ?? 0n} wei` : `gasPrice=${gasPrice} wei`}  maxGasCost≈${Number(gasCostWei) / 1e18} ETH`
          );
        } else {
          pushLog(`gas estimate=${gas}  gasLimit=${gasLimit}`);
        }
      } catch (gErr: any) {
        pushLog(`gas estimate failed: ${gErr?.shortMessage || gErr?.message || gErr}`);
      }

      // 3. Send the tx
      toast.info('Approve in your wallet', {
        description: 'One signature deploys the token, creates the pool, seeds LP, and runs your dev buy.',
      });
      pushLog(
        `Sending writeContract → wallet should prompt now${gasLimit ? ` (gasLimit=${gasLimit})` : ''}${maxFeePerGas ? ` (maxFeePerGas=${maxFeePerGas}, maxPriorityFeePerGas=${maxPriorityFeePerGas ?? 0n})` : gasPrice ? ` (gasPrice=${gasPrice})` : ''}.`
      );

      const txHash = await (maxFeePerGas
        ? walletClient.writeContract({
            account: address as Address,
            chain: mainnet,
            address: launcher,
            abi: POPSHIBA_LAUNCHER_ABI,
            functionName: 'launch',
            args: [
              formData.name.trim(),
              formData.ticker.trim().toUpperCase(),
              data.metadataURI as string,
              ethForLPWei,
              ethForDevBuyWei,
            ],
            value: totalValue,
            type: 'eip1559',
            ...(gasLimit ? { gas: gasLimit } : {}),
            maxFeePerGas,
            ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
          })
        : walletClient.writeContract({
            account: address as Address,
            chain: mainnet,
            address: launcher,
            abi: POPSHIBA_LAUNCHER_ABI,
            functionName: 'launch',
            args: [
              formData.name.trim(),
              formData.ticker.trim().toUpperCase(),
              data.metadataURI as string,
              ethForLPWei,
              ethForDevBuyWei,
            ],
            value: totalValue,
            ...(gasLimit ? { gas: gasLimit } : {}),
            ...(gasPrice ? { gasPrice } : {}),
          }));
      pushLog(`tx submitted: ${txHash}`);
      setLaunchTxHash(txHash);

      // 4. Wait for receipt
      const result = await waitForLaunchResult(publicClient as unknown as PublicClient, launcher, txHash);
      pushLog(`token=${result.token}  pool=${result.pool}  lpTokenId=${result.lpTokenId}  uncxLockId=${result.uncxLockId ?? 'n/a'}`);
      setDeployedTokenAddress(result.token);
      setPoolAddress(result.pool);
      if (result.uncxLockId !== undefined) setUncxLockId(result.uncxLockId.toString());
      setIsLive(true);

      // 5. Persist
      await supabase.functions.invoke('eth-launch-finalize', {
        body: {
          launchId,
          status: 'live',
          launchTxHash: txHash,
          tokenAddress: result.token,
          poolAddress: result.pool,
          lpTokenId: result.lpTokenId.toString(),
          uncxLockId: result.uncxLockId?.toString(),
        },
      });

      toast.success('🎉 Token live · LP locked via UNCX', {
        description: 'Liquidity locked for 100 years. You earn 50% of every 1% swap fee.',
        action: {
          label: 'Etherscan',
          onClick: () => window.open(`https://etherscan.io/address/${result.token}`, '_blank'),
        },
      });
    } catch (e) {
      console.error('ETH atomic launch error:', e);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      pushLog(`ERROR: ${msg}`);
      setLaunchError(msg);
      toast.error('Launch failed', { description: msg });
      if (launchId) {
        await supabase.functions.invoke('eth-launch-finalize', {
          body: { launchId, status: 'failed', errorMessage: msg },
        }).catch(() => {});
      }
    } finally {
      setIsLaunching(false);
    }
  }, [canLaunch, address, formData, walletClient, currentChainId, switchChainAsync, lpEthAmount, pushLog]);

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

            {/* LP seed + Optional Dev Buy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-1">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                  <span>Initial LP seed</span>
                  <span>required</span>
                </div>
                <div className="text-base font-mono text-foreground">
                  {lpEthAmount.toFixed(6)} ETH <span className="text-muted-foreground text-xs">(~${MIN_LP_USD})</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Seeds the Uniswap V3 1% pool. Paired against single-sided supply above spot.
                </p>
              </div>
              <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-2">
                <Label htmlFor="eth-dev-buy" className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                  Optional dev buy (ETH)
                </Label>
                <Input
                  id="eth-dev-buy"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={MAX_DEV_BUY}
                  step="0.001"
                  placeholder="0"
                  value={devBuyInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDevBuyInput(val);
                    const n = parseFloat(val);
                    handleInputChange('devBuyEth', !isNaN(n) && n >= 0 ? n : 0);
                  }}
                  className="bg-background/50 h-9 font-mono"
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Buys your token in the same tx — anti-snipe. Max {MAX_DEV_BUY} ETH.
                </p>
              </div>
            </div>

            {/* Total cost summary */}
            <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/30 rounded-lg">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="text-xs text-foreground/80 leading-relaxed space-y-0.5 font-mono">
                <div>LP seed: <strong>{lpEthAmount.toFixed(6)} ETH</strong></div>
                <div>Dev buy: <strong>{(formData.devBuyEth || 0).toFixed(6)} ETH</strong></div>
                <div>UNCX lock fee: <strong>~0.0001 ETH</strong></div>
                <div>+ network gas (variable, depends on mainnet conditions)</div>
                <div className="pt-1 border-t border-primary/20 mt-1">
                  Total wallet send: <strong>~{(lpEthAmount + (formData.devBuyEth || 0) + 0.0001).toFixed(6)} ETH</strong>
                </div>
                <div className="text-muted-foreground pt-1 normal-case">
                  LP is locked in <strong>UNCX V3 Locker</strong> for 100 years — token launches with the recognized 🔒 LP Locked badge on DEXTools / GMGN. You earn <strong>50% of all 1% swap fees</strong>.
                </div>
              </div>
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
              tokenAddress={deployedTokenAddress}
              launchTxHash={launchTxHash}
              isLive={isLive}
              errorMessage={launchError}
            />

            {/* Diagnostic logs panel */}
            {diagLogs.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  <span>Launch diagnostics</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(diagLogs.join('\n'))}
                    className="text-primary hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <pre className="text-[10px] font-mono leading-relaxed text-foreground/80 max-h-72 overflow-auto whitespace-pre-wrap break-all">
                  {diagLogs.join('\n')}
                </pre>
              </div>
            )}

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

            {uncxLockId && (
              <div className="text-xs flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/30">
                <span className="text-emerald-300 inline-flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  LP Locked via UNCX
                </span>
                <a
                  href={`https://app.uncx.network/services/lock-liquidity/uniswap-v3/lock/${uncxLockId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-emerald-300 hover:underline inline-flex items-center gap-1"
                >
                  Lock #{uncxLockId}
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
            <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">3.</span><p>LP NFT is locked in <strong className="text-foreground">UNCX V3 Locker</strong> for 100 years — recognized by DEXTools, GMGN &amp; DEXScreener as <strong className="text-emerald-300">🔒 LP Locked</strong>.</p></div>
            <div className="flex items-start gap-2"><span className="text-emerald-400 font-bold shrink-0">★</span><p>Fees stream from UNCX → platform vault. Your <strong className="text-emerald-300">50% share</strong> is claimable as ETH on this page.</p></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
