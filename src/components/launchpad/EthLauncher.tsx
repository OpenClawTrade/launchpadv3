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
import { EthLaunchSuccessModal } from './EthLaunchSuccessModal';
import { EthLaunchOverlay } from './EthLaunchOverlay';

// Launch parameters — must mirror eth-create-token edge function
const TOTAL_SUPPLY = 1_000_000_000; // 1B tokens
const MIN_LP_USD = 5;        // $5 demo-tier minimum LP seed (server floor: 0.001 ETH ≈ $3)
const MAX_DEV_BUY_USD = 5000; // soft UX cap on dev buy

// LP seed presets — user picks one (or types custom). Values are in ETH except $5 which is USD-denominated.
type LpPresetId = 'demo' | 'suggested' | 'recommended' | 'custom';
interface LpPreset {
  id: LpPresetId;
  label: string;
  badge?: string;
  /** Fixed ETH amount; null = USD-denominated ($5) */
  eth: number | null;
  /** USD floor (used only for the $5 demo tier) */
  usd?: number;
  desc: string;
}
const LP_PRESETS: LpPreset[] = [
  { id: 'demo',        label: 'Demo tier',       badge: 'cheapest', eth: null, usd: MIN_LP_USD, desc: 'Cheapest path to ship a real launch. Note: aggregators like GMGN/Banana may refuse to simulate trades on pools this small (slippage too high).' },
  { id: 'suggested',   label: 'Suggested',       badge: 'good',     eth: 0.5,                   desc: 'Healthy starting depth. Tighter spreads, fewer reverts on small buys.' },
  { id: 'recommended', label: 'Highly suggested',badge: 'best',     eth: 1,                     desc: 'Pro tier. Holders see real liquidity from block 1 — projects that start here last longer.' },
];

interface EthLaunchFormData {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  devBuyEth: number;
  /** Optional: override LP seed (ETH). When set, used instead of the preset chooser. */
  lpEthAmount?: number;
}

const MAX_DEV_BUY = 5;

export function EthLauncher({ initialValues, initialLockLP, initialVersion, autoLaunch, hideUI }: { initialValues?: Partial<EthLaunchFormData>; initialLockLP?: boolean; initialVersion?: 'v3' | 'v2burn' | 'v2fees'; autoLaunch?: boolean; hideUI?: boolean } = {}) {
  const { isConnected, address, connect } = useEvmWallet();
  const { data: ethPrice = 0 } = useEthPrice();
  const { data: walletClient } = useWalletClient({ chainId: mainnet.id });
  const { switchChainAsync } = useSwitchChain();
  const currentChainId = useChainId();
  const [isLaunching, setIsLaunching] = useState(false);
  const [devBuyInput, setDevBuyInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  // Launcher version: 'v3' (Team Finance, optional lock, $200 lock fee),
  // 'v2burn' (pure fair-launch on Uniswap V2, auto-burn LP, NO fees), or
  // 'v2fees' (Uniswap V2, auto-burn LP, fixed 1% swap fee → platform wallet).
  const [launcherVersion, setLauncherVersion] = useState<'v3' | 'v2burn' | 'v2fees'>(initialVersion ?? 'v3');
  // V3: Team Finance LP lock — default ON so aggregators (GMGN, DEXTools, Banana) show
  // the "LP Locked" trust checkmark and route trades immediately. User can still uncheck.
  // (Ignored when launcherVersion !== 'v3'.)
  const [lockLP, setLockLP] = useState(initialLockLP ?? true);
  // If host (Popshiba landing iframe) sent an explicit lpEthAmount, switch to
  // 'custom' and pre-fill the input so the autoLaunch flow uses exactly that.
  const initialLpOverride = typeof initialValues?.lpEthAmount === 'number' && initialValues.lpEthAmount > 0
    ? initialValues.lpEthAmount
    : null;
  const [lpPresetId, setLpPresetId] = useState<LpPresetId>(initialLpOverride != null ? 'custom' : 'suggested');
  const [lpCustomInput, setLpCustomInput] = useState(initialLpOverride != null ? String(initialLpOverride) : '');
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [formData, setFormData] = useState<EthLaunchFormData>({
    name: initialValues?.name ?? '',
    ticker: initialValues?.ticker ?? '',
    description: initialValues?.description ?? '',
    imageUrl: initialValues?.imageUrl ?? '',
    websiteUrl: initialValues?.websiteUrl ?? '',
    twitterUrl: initialValues?.twitterUrl ?? '',
    telegramUrl: initialValues?.telegramUrl ?? '',
    devBuyEth: initialValues?.devBuyEth ?? 0,
  });

  const handleInputChange = <K extends keyof EthLaunchFormData>(field: K, value: EthLaunchFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Active LP preset object
  const activeLpPreset = useMemo(
    () => LP_PRESETS.find(p => p.id === lpPresetId),
    [lpPresetId],
  );

  // LP seed in ETH — derived from preset (or custom input).
  // Demo tier is USD-pinned ($5 → ETH at live price); presets are fixed ETH; custom is user input.
  const lpEthAmount = useMemo(() => {
    if (lpPresetId === 'custom') {
      const n = parseFloat(lpCustomInput);
      return !isNaN(n) && n > 0 ? n : 0;
    }
    if (activeLpPreset?.eth != null) return activeLpPreset.eth;
    // Demo tier — USD-denominated, recompute from live ETH price (rounded up)
    if (ethPrice <= 0) return 0;
    const usd = activeLpPreset?.usd ?? MIN_LP_USD;
    return Math.ceil((usd / ethPrice) * 1e6) / 1e6;
  }, [lpPresetId, lpCustomInput, activeLpPreset, ethPrice]);

  const lpUsdValue = useMemo(
    () => (ethPrice > 0 ? lpEthAmount * ethPrice : 0),
    [ethPrice, lpEthAmount],
  );

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
    let approveToastId: string | number | undefined;
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
          lockLP: launcherVersion === 'v3' ? lockLP : false,
          version: launcherVersion,
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
            lockLP,
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

      // 3. Send the tx — surface a persistent, very visible toast because some
      // wallets (MetaMask extension when the editor iframe doesn't have focus,
      // or hardware wallets behind another window) open their popup off-screen
      // or behind the browser. The toast stays until txHash resolves.
      approveToastId = toast.loading('👉 Open your wallet and approve the launch', {
        description:
          "MetaMask / Rabby usually pops up. If you don't see it, click the wallet icon in your browser toolbar — the request is waiting there.",
        duration: Infinity,
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
              lockLP,
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
              lockLP,
            ],
            value: totalValue,
            ...(gasLimit ? { gas: gasLimit } : {}),
            ...(gasPrice ? { gasPrice } : {}),
          }));
      pushLog(`tx submitted: ${txHash}`);
      setLaunchTxHash(txHash);
      toast.dismiss(approveToastId);

      // 4. Wait for receipt
      const result = await waitForLaunchResult(publicClient as unknown as PublicClient, launcher, txHash);
      pushLog(`token=${result.token}  pool=${result.pool}  lpTokenId=${result.lpTokenId}  uncxLockId=${result.uncxLockId ?? 'n/a'}`);
      setDeployedTokenAddress(result.token);
      setPoolAddress(result.pool);
      if (result.uncxLockId !== undefined) setUncxLockId(result.uncxLockId.toString());
      setIsLive(true);
      setShowSuccessModal(true);

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
      const rawMsg = e instanceof Error ? e.message : 'Unknown error';

      // Detect MetaMask / wallet user-rejection and short-circuit to a clean message
      const code = (e as any)?.code;
      const isUserReject =
        code === 4001 ||
        code === 'ACTION_REJECTED' ||
        /user rejected|user denied|rejected the request|request rejected/i.test(rawMsg);

      const friendly = isUserReject
        ? 'Transaction cancelled in wallet'
        : rawMsg.length > 140 ? rawMsg.slice(0, 140) + '…' : rawMsg;

      pushLog(`ERROR: ${friendly}`);
      setLaunchError(friendly);
      toast.error(isUserReject ? 'Launch cancelled' : 'Launch failed', {
        description: friendly,
      });
      const msg = friendly;
      if (launchId) {
        await supabase.functions.invoke('eth-launch-finalize', {
          body: { launchId, status: 'failed', errorMessage: msg },
        }).catch(() => {});
      }
      // Reset the iframe landing button if we're inside the autoLaunch host flow.
      try {
        window.parent?.postMessage(
          { source: 'popshiba-host', type: 'launch-aborted', payload: { reason: msg } },
          '*'
        );
      } catch {}
    } finally {
      if (approveToastId !== undefined) toast.dismiss(approveToastId);
      setIsLaunching(false);
    }
  }, [canLaunch, address, formData, walletClient, currentChainId, switchChainAsync, lpEthAmount, pushLog, lockLP, launcherVersion]);

  // Auto-fire launch (used by the Popshiba "1-click" landing flow). Waits until
  // wallet client + ETH price are loaded so canLaunch can flip true.
  const autoFiredRef = useState({ fired: false })[0];
  useEffect(() => {
    if (!autoLaunch) return;
    if (autoFiredRef.fired) return;
    if (!canLaunch || !walletClient) return;
    autoFiredRef.fired = true;
    handleLaunch();
  }, [autoLaunch, canLaunch, walletClient, handleLaunch, autoFiredRef]);

  // Safety net: if autoLaunch is requested but can't fire within 8s, tell the
  // user *why* instead of leaving the host page stuck on "INITIALIZING LAUNCH…".
  useEffect(() => {
    if (!autoLaunch) return;
    if (autoFiredRef.fired) return;
    const timer = window.setTimeout(() => {
      if (autoFiredRef.fired) return;
      const reasons: string[] = [];
      if (!isConnected || !address) reasons.push('wallet not connected');
      if (!walletClient) reasons.push('wallet client not ready');
      if (!(ethPrice > 0)) reasons.push('ETH price still loading');
      if (!formData.name.trim()) reasons.push('missing name');
      if (!formData.ticker.trim()) reasons.push('missing ticker');
      if (!(lpEthAmount > 0)) reasons.push('missing LP amount');
      const msg = reasons.length ? reasons.join(', ') : 'unknown reason';
      autoFiredRef.fired = true; // prevent repeated toasts
      setLaunchError(msg);
      toast.error('Could not start launch', { description: msg });
      try {
        window.parent?.postMessage(
          { source: 'popshiba-host', type: 'launch-aborted', payload: { reason: msg } },
          '*'
        );
      } catch {}
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [autoLaunch, autoFiredRef, isConnected, address, walletClient, ethPrice, formData.name, formData.ticker, lpEthAmount]);

  return (
    <>
    <div className={hideUI ? 'sr-only pointer-events-none' : 'grid grid-cols-1 lg:grid-cols-3 gap-6'}>
      {/* Main Form */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary" />
                  Launch on Ethereum {launcherVersion === 'v3' ? '(Uniswap V3)' : launcherVersion === 'v2fees' ? '(Uniswap V2 · 1% Fee)' : '(Uniswap V2 · Fair Launch)'}
                </CardTitle>
                <CardDescription className="mt-1">
                  {launcherVersion === 'v3'
                    ? 'Single-sided V3 pool · 1% trading fee · You earn 50% of every swap.'
                    : launcherVersion === 'v2fees'
                    ? 'Standard V2 pool · LP auto-burned · 1% of every swap auto-sent (in ETH) to the platform wallet.'
                    : 'Standard V2 pool · LP auto-burned to dead address · Zero protocol fees · All scanner green checkmarks.'}
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                Ethereum
              </Badge>
            </div>

            {/* V3 vs V2-burn vs V2-fees launcher version tabs */}
            <div className="mt-4 grid grid-cols-3 gap-2 p-1 rounded-lg bg-background/40 border border-border/40">
              <button
                type="button"
                onClick={() => setLauncherVersion('v3')}
                className={`px-2 py-2 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  launcherVersion === 'v3'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                V3 · Earn Fees
                <span className="block text-[9px] font-normal normal-case tracking-normal mt-0.5 opacity-80">
                  Lock LP · earn 50% of trading fees
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLauncherVersion('v2burn')}
                className={`px-2 py-2 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  launcherVersion === 'v2burn'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                V2 · Burn LP 🔥
                <span className="block text-[9px] font-normal normal-case tracking-normal mt-0.5 opacity-80">
                  Pure fair launch · no fees
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLauncherVersion('v2fees')}
                className={`px-2 py-2 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  launcherVersion === 'v2fees'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                V2 · Fees 1%
                <span className="block text-[9px] font-normal normal-case tracking-normal mt-0.5 opacity-80">
                  Burn LP · 1% swap fee → platform
                </span>
              </button>
            </div>

            {launcherVersion === 'v2burn' && (
              <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-1">
                <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> V2 Burn Launch — what you get
                </div>
                <ul className="text-muted-foreground space-y-0.5 ml-5 list-disc">
                  <li>Standard Uniswap V2 pool · all 1B supply paired with your ETH</li>
                  <li>LP tokens auto-burned to <code className="text-foreground">0x…dEaD</code> on launch</li>
                  <li>DEXTools, GMGN, DEXScreener, GoPlus all show ✅ <strong>LP Burned</strong></li>
                  <li><strong>No platform fee, no locker fee</strong> — you only pay gas (~$15–25)</li>
                  <li className="text-amber-400">⚠ Trading fees stay locked in the LP forever (nobody collects)</li>
                </ul>
              </div>
            )}

            {launcherVersion === 'v2fees' && (
              <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs space-y-1">
                <div className="font-semibold text-blue-400 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> V2 Fees Launch — what you get
                </div>
                <ul className="text-muted-foreground space-y-0.5 ml-5 list-disc">
                  <li>Standard Uniswap V2 pool · all 1B supply paired with your ETH</li>
                  <li>LP tokens auto-burned on launch (✅ LP Burned)</li>
                  <li><strong>1% fee on every swap</strong> auto-swapped to ETH and sent to the platform wallet</li>
                  <li>No creator fees · no locker fee · you only pay gas</li>
                  <li className="text-muted-foreground">Fee recipient: <code className="text-foreground">0x9FD5…10B0</code></li>
                </ul>
              </div>
            )}
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

            {/* LP seed selector — 3 presets + custom */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                <span>Initial LP seed</span>
                <span>{lpEthAmount > 0 ? `${lpEthAmount.toFixed(6)} ETH ≈ $${lpUsdValue.toFixed(2)}` : 'required'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {LP_PRESETS.map((p) => {
                  const eth = p.eth ?? (ethPrice > 0 ? Math.ceil((p.usd! / ethPrice) * 1e6) / 1e6 : 0);
                  const usd = p.eth != null ? p.eth * ethPrice : (p.usd ?? 0);
                  const active = lpPresetId === p.id;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setLpPresetId(p.id)}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        active ? 'border-primary bg-primary/10' : 'border-border bg-background/40 hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider">{p.label}</span>
                        {p.badge && (
                          <span className={`text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded ${
                            p.id === 'recommended' ? 'bg-primary/20 text-primary' :
                            p.id === 'suggested' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-muted text-muted-foreground'
                          }`}>{p.badge}</span>
                        )}
                      </div>
                      <div className="mt-1 text-base font-mono text-foreground">
                        {eth > 0 ? `${eth.toFixed(p.eth != null ? 2 : 6)} ETH` : '—'}
                        <span className="text-muted-foreground text-xs ml-1">
                          {ethPrice > 0 ? `≈ $${usd.toFixed(2)}` : ''}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">{p.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Custom amount */}
              <button
                type="button"
                onClick={() => setLpPresetId('custom')}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  lpPresetId === 'custom' ? 'border-primary bg-primary/10' : 'border-border bg-background/40 hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Custom amount</span>
                  <span className="text-[9px] uppercase tracking-wider font-mono text-muted-foreground">power user</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 2.5"
                    value={lpCustomInput}
                    onClick={(e) => { e.stopPropagation(); setLpPresetId('custom'); }}
                    onChange={(e) => { setLpCustomInput(e.target.value); setLpPresetId('custom'); }}
                    className="bg-background/50 h-9 font-mono max-w-[160px]"
                  />
                  <span className="text-xs font-mono text-muted-foreground">
                    ETH {lpPresetId === 'custom' && lpEthAmount > 0 && ethPrice > 0 ? `≈ $${(lpEthAmount * ethPrice).toFixed(2)}` : ''}
                  </span>
                </div>
              </button>

              {/* Honest disclaimer + ETH ≠ Solana joke */}
              <div className="text-[11px] text-muted-foreground leading-relaxed p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-1.5">
                <div>
                  💡 <strong className="text-foreground">$5 minimum exists to showcase the platform.</strong>{' '}
                  It will <em>not</em> guarantee your token succeeds — thin LP means brutal slippage and zero scanner credibility.
                </div>
                <div>
                  🐕 <strong className="text-foreground">ETH is not Solana.</strong>{' '}
                  Here, holders and devs who seed real liquidity build products that actually <em>last</em>.
                  A higher initial LP isn't a tax — it's the receipt that says you're not here to rug.
                </div>
              </div>
            </div>

            {/* Optional dev buy */}
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

            {/* LP lock toggle (V3) */}
            <button
              type="button"
              onClick={() => setLockLP((v) => !v)}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                lockLP
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-border bg-background/40 hover:border-primary/40'
              }`}
            >
              <div
                className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                  lockLP ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                }`}
              >
                {lockLP && <span className="text-[10px] text-primary-foreground leading-none">✓</span>}
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-semibold">
                  🔒 Lock LP in Team Finance (10 years) — adds ~$150 in ETH
                </div>
                <div className="text-muted-foreground leading-relaxed">
                  {lockLP
                    ? 'LP NFT will be locked in Team Finance for 10 years. Token gets the recognized 🔒 LP Locked badge on DEXTools / GMGN, and you earn 50% of all 1% swap fees forever (claim anytime).'
                    : 'No lock — cheapest path. The LP NFT stays in the launcher contract; no scanner badge, no fee claim flow. You can opt in here per-launch.'}
                </div>
              </div>
            </button>

            {/* Total cost summary */}
            <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/30 rounded-lg">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="text-xs text-foreground/80 leading-relaxed space-y-0.5 font-mono">
                <div>LP seed: <strong>{lpEthAmount.toFixed(6)} ETH</strong></div>
                <div>Dev buy: <strong>{(formData.devBuyEth || 0).toFixed(6)} ETH</strong></div>
                {lockLP ? (
                  <div>Team Finance lock fee: <strong>~0.045 ETH</strong> (~$150, live oracle)</div>
                ) : (
                  <div>Lock fee: <strong>none</strong> (no-lock launch)</div>
                )}
                <div>+ network gas (variable, depends on mainnet conditions)</div>
                <div className="pt-1 border-t border-primary/20 mt-1">
                  Total wallet send: <strong>~{(lpEthAmount + (formData.devBuyEth || 0) + (lockLP ? 0.045 : 0)).toFixed(6)} ETH</strong>
                </div>
                <div className="text-muted-foreground pt-1 normal-case">
                  {lockLP
                    ? 'LP locked in Team Finance for 10 years — recognized 🔒 LP Locked badge. You earn 50% of all 1% swap fees.'
                    : 'No LP lock. Faster + cheaper, but no scanner lock badge and no creator fee claim. Toggle the lock on above to enable both.'}
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

    {/* Success modal MUST render outside the hideUI wrapper so the popshiba
        landing flow (autoLaunch + hideUI) still shows the confirmation UI. */}
    {deployedTokenAddress && (
      <EthLaunchSuccessModal
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        tokenAddress={deployedTokenAddress}
        txHash={launchTxHash}
        imageUrl={formData.imageUrl}
        name={formData.name}
        ticker={formData.ticker}
      />
    )}

    {/* EthLaunchOverlay removed — EthLaunchSuccessModal handles success UI. */}
    </>
  );
}
