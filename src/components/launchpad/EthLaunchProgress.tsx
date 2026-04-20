import { useEffect, useState } from 'react';
import { Check, Loader2, Circle, ExternalLink, Copy, Rocket } from 'lucide-react';
import { toast } from 'sonner';

export interface EthLaunchStep {
  key: string;
  label: string;
  detail: string;
  /** Approximate seconds this step typically takes — drives auto-advance while deploying */
  etaSeconds: number;
}

interface Props {
  /** Whether the deployment pipeline is currently running */
  isLaunching: boolean;
  /** Whether dev buy step should be included */
  hasDevBuy: boolean;
  /** Set when token contract is on-chain — completes the deploy step */
  tokenAddress: string | null;
  /** Set when deploy tx is mined */
  deployTxHash: string | null;
  /** Final state */
  isLive: boolean;
  /** Error message if failed */
  errorMessage: string | null;
}

export function EthLaunchProgress({
  isLaunching,
  hasDevBuy,
  tokenAddress,
  deployTxHash,
  isLive,
  errorMessage,
}: Props) {
  const steps: EthLaunchStep[] = [
    { key: 'submit',    label: 'Submitting launch request',     detail: 'Validating metadata & creator wallet', etaSeconds: 2 },
    { key: 'deploy',    label: 'Deploying ERC-20 contract',     detail: 'Broadcasting deployment tx to Ethereum', etaSeconds: 25 },
    { key: 'pool',      label: 'Creating Uniswap V3 1% pool',   detail: 'Initializing pool at launch price', etaSeconds: 18 },
    { key: 'seed',      label: 'Seeding single-sided liquidity', detail: 'Minting LP NFT to platform vault', etaSeconds: 15 },
    ...(hasDevBuy ? [{ key: 'devbuy', label: 'Executing dev buy', detail: 'Swapping ETH → tokens via V3 router', etaSeconds: 12 }] : []),
    { key: 'verify',    label: 'Verifying contract on Etherscan', detail: 'Submitting source code for public verification', etaSeconds: 20 },
    { key: 'live',      label: 'Token is live',                 detail: 'Address ready — share & trade', etaSeconds: 0 },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Reset when a new launch begins
  useEffect(() => {
    if (isLaunching && startedAt === null) {
      setActiveIndex(0);
      setStartedAt(Date.now());
    }
    if (!isLaunching && !isLive && !errorMessage) {
      setStartedAt(null);
      setActiveIndex(0);
    }
  }, [isLaunching, isLive, errorMessage, startedAt]);

  // Auto-advance through steps based on elapsed time, but never advance past the
  // verify step until we have on-chain confirmation (tokenAddress).
  useEffect(() => {
    if (!isLaunching || startedAt === null) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      let cumulative = 0;
      let target = 0;
      for (let i = 0; i < steps.length - 1; i++) {
        cumulative += steps[i].etaSeconds;
        if (elapsed >= cumulative) target = i + 1;
      }
      // Cap at the verify step (last in-progress step) until token is confirmed
      const verifyIndex = steps.findIndex((s) => s.key === 'verify');
      if (!tokenAddress && target > verifyIndex) target = verifyIndex;
      setActiveIndex((prev) => (target > prev ? target : prev));
    }, 500);
    return () => clearInterval(interval);
  }, [isLaunching, startedAt, tokenAddress, steps]);

  // When the deploy tx lands, jump active index past 'deploy' if still behind
  useEffect(() => {
    if (deployTxHash) {
      const idx = steps.findIndex((s) => s.key === 'pool');
      setActiveIndex((prev) => (prev < idx ? idx : prev));
    }
  }, [deployTxHash, steps]);

  // When token address arrives, mark everything except final 'live' done
  useEffect(() => {
    if (tokenAddress && !isLive) {
      const verifyIndex = steps.findIndex((s) => s.key === 'verify');
      setActiveIndex((prev) => (prev < verifyIndex ? verifyIndex : prev));
    }
  }, [tokenAddress, isLive, steps]);

  // Final state
  useEffect(() => {
    if (isLive) setActiveIndex(steps.length - 1);
  }, [isLive, steps.length]);

  if (!isLaunching && !isLive && !errorMessage) return null;

  const copyAddress = () => {
    if (!tokenAddress) return;
    navigator.clipboard.writeText(tokenAddress);
    toast.success('Address copied');
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 backdrop-blur p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">
          {errorMessage ? 'Launch failed' : isLive ? '🎉 Token launched' : 'Launching token…'}
        </h3>
      </div>

      <ol className="space-y-2.5">
        {steps.map((step, i) => {
          const done = i < activeIndex || isLive && i < steps.length - 1 || (isLive && i === steps.length - 1);
          const active = !errorMessage && i === activeIndex && !isLive;
          const failed = errorMessage && i === activeIndex;

          return (
            <li key={step.key} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {failed ? (
                  <div className="h-5 w-5 rounded-full bg-destructive/20 border border-destructive flex items-center justify-center">
                    <span className="text-destructive text-[10px] font-bold">!</span>
                  </div>
                ) : done ? (
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                ) : active ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium leading-tight ${
                    done ? 'text-emerald-300' : active ? 'text-foreground' : failed ? 'text-destructive' : 'text-muted-foreground/60'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5">
                  {failed && i === activeIndex ? errorMessage : step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* CA reveal — prominent once token is on-chain */}
      {tokenAddress && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-semibold">
            Contract Address
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-emerald-100 break-all">
              {tokenAddress}
            </code>
            <button
              onClick={copyAddress}
              className="shrink-0 h-8 w-8 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center transition-colors"
              title="Copy address"
            >
              <Copy className="h-3.5 w-3.5 text-emerald-300" />
            </button>
            <a
              href={`https://etherscan.io/token/${tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 h-8 px-2.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 flex items-center gap-1 text-[11px] font-semibold text-emerald-200 transition-colors"
            >
              Etherscan
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
