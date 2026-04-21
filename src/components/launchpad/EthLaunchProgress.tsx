import { useEffect, useState } from 'react';
import { Check, Loader2, ExternalLink, Copy, Rocket, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isLaunching: boolean;
  tokenAddress: string | null;
  launchTxHash: string | null;
  isLive: boolean;
  errorMessage: string | null;
}

export function EthLaunchProgress({
  isLaunching,
  tokenAddress,
  launchTxHash,
  isLive,
  errorMessage,
}: Props) {
  const [stage, setStage] = useState<'idle' | 'submitting' | 'signing' | 'mining' | 'live' | 'failed'>('idle');

  useEffect(() => {
    if (errorMessage) setStage('failed');
    else if (isLive) setStage('live');
    else if (launchTxHash) setStage('mining');
    else if (isLaunching) setStage((s) => (s === 'idle' ? 'submitting' : s === 'submitting' ? 'signing' : s));
    else setStage('idle');
  }, [isLaunching, launchTxHash, isLive, errorMessage]);

  // Auto-advance idle → submitting → signing while waiting
  useEffect(() => {
    if (!isLaunching) return;
    const t = setTimeout(() => {
      setStage((s) => (s === 'submitting' ? 'signing' : s));
    }, 1500);
    return () => clearTimeout(t);
  }, [isLaunching]);

  if (!isLaunching && !isLive && !errorMessage) return null;

  const copyAddress = () => {
    if (!tokenAddress) return;
    navigator.clipboard.writeText(tokenAddress);
    toast.success('Address copied');
  };

  const headline =
    stage === 'failed' ? 'Launch failed' :
    stage === 'live'   ? '🎉 Token is live' :
    stage === 'mining' ? 'Confirming on-chain…' :
    stage === 'signing'? 'Approve in your wallet…' :
                         'Preparing launch…';

  const subline =
    stage === 'failed' ? errorMessage :
    stage === 'live'   ? 'Pool seeded · LP locked in vault · Tradeable now' :
    stage === 'mining' ? 'Cloning token, creating Uniswap V3 pool, seeding LP, executing dev buy…' :
    stage === 'signing'? 'Confirm the single transaction in your wallet to launch.' :
                         'Fetching launcher parameters from the platform.';

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 backdrop-blur p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {stage === 'failed' ? (
            <div className="h-8 w-8 rounded-full bg-destructive/20 border border-destructive flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
          ) : stage === 'live' ? (
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center">
              <Check className="h-4 w-4 text-emerald-400" />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/60 flex items-center justify-center">
              {stage === 'mining' ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Rocket className="h-4 w-4 text-primary" />
              )}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-tight">{headline}</h3>
          <p className="text-xs text-muted-foreground/80 leading-relaxed mt-1">{subline}</p>
          {launchTxHash && stage !== 'live' && (
            <a
              href={`https://etherscan.io/tx/${launchTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-[11px] font-mono text-primary hover:underline"
            >
              View tx on Etherscan <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* CA reveal — once token is on-chain */}
      {tokenAddress && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
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
