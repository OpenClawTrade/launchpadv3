import { useEffect, useState } from 'react';
import { Loader2, Check, ExternalLink, Copy, Rocket, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isLaunching: boolean;
  tokenAddress: string | null;
  launchTxHash: string | null;
  isLive: boolean;
  errorMessage: string | null;
  name?: string;
  ticker?: string;
  /** Called when user dismisses the overlay (only allowed once finished). */
  onClose?: () => void;
}

/**
 * Full-screen launch status overlay. Always visible while a launch is in flight,
 * even when the parent (popshiba landing) hides the inline launcher UI. Gives
 * the user a clear "your coin is launching" signal between wallet approval and
 * the on-chain confirmation, then reveals the CA when the token goes live.
 */
export function EthLaunchOverlay({
  isLaunching,
  tokenAddress,
  launchTxHash,
  isLive,
  errorMessage,
  name,
  ticker,
  onClose,
}: Props) {
  const [stage, setStage] = useState<'preparing' | 'signing' | 'mining' | 'live' | 'failed'>('preparing');

  useEffect(() => {
    if (errorMessage) setStage('failed');
    else if (isLive) setStage('live');
    else if (launchTxHash) setStage('mining');
    else if (isLaunching) setStage((s) => (s === 'preparing' || s === 'signing' ? s : 'preparing'));
  }, [isLaunching, launchTxHash, isLive, errorMessage]);

  // Soft auto-advance preparing → signing after a beat so the copy reads right
  // for the user staring at their wallet popup.
  useEffect(() => {
    if (!isLaunching || stage !== 'preparing') return;
    const t = setTimeout(() => setStage((s) => (s === 'preparing' ? 'signing' : s)), 1800);
    return () => clearTimeout(t);
  }, [isLaunching, stage]);

  // Render only while something interesting is happening
  const visible = isLaunching || isLive || !!errorMessage;
  if (!visible) return null;

  const headline =
    stage === 'failed' ? 'Launch failed' :
    stage === 'live'   ? '🎉 Your coin is live!' :
    stage === 'mining' ? 'Your coin is launching…' :
    stage === 'signing'? 'Approve in your wallet' :
                         'Preparing your launch';

  const subline =
    stage === 'failed' ? errorMessage :
    stage === 'live'   ? 'Pool seeded · LP secured · Tradeable now' :
    stage === 'mining' ? 'Cloning the token, creating the Uniswap pool, and seeding LP. This usually confirms in 15–45s.' :
    stage === 'signing'? "MetaMask / Rabby should be open. If you don't see it, click your wallet icon in the browser toolbar." :
                         'Fetching launcher parameters and simulating the transaction.';

  const finished = stage === 'live' || stage === 'failed';

  const copyAddress = () => {
    if (!tokenAddress) return;
    navigator.clipboard.writeText(tokenAddress);
    toast.success('Contract address copied');
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-live="polite"
      aria-labelledby="eth-launch-overlay-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Status icon */}
        <div className="flex flex-col items-center text-center gap-3">
          {stage === 'failed' ? (
            <div className="h-14 w-14 rounded-full bg-destructive/15 border border-destructive/60 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
          ) : stage === 'live' ? (
            <div className="h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-500/60 flex items-center justify-center">
              <Check className="h-7 w-7 text-emerald-400" />
            </div>
          ) : (
            <div className="h-14 w-14 rounded-full bg-primary/15 border border-primary/60 flex items-center justify-center">
              {stage === 'mining' || stage === 'signing' ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <Rocket className="h-7 w-7 text-primary" />
              )}
            </div>
          )}

          <div className="space-y-1">
            <h2 id="eth-launch-overlay-title" className="text-xl font-bold tracking-tight">
              {headline}
            </h2>
            {(name || ticker) && stage !== 'failed' && (
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {name}{ticker ? ` · $${ticker}` : ''}
              </div>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed pt-1">
              {subline}
            </p>
          </div>
        </div>

        {/* Stepper */}
        {stage !== 'failed' && (
          <div className="space-y-2">
            {[
              { id: 'signing',   label: 'Wallet approval' },
              { id: 'mining',    label: 'Confirming on Ethereum' },
              { id: 'live',      label: 'Token live · CA revealed' },
            ].map((step) => {
              const order = ['preparing', 'signing', 'mining', 'live'];
              const stepIdx = order.indexOf(step.id);
              const curIdx = order.indexOf(stage);
              const done = curIdx > stepIdx;
              const active = curIdx === stepIdx;
              return (
                <div key={step.id} className="flex items-center gap-3 text-sm">
                  <div
                    className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border ${
                      done
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400'
                        : active
                        ? 'bg-primary/20 border-primary/60 text-primary'
                        : 'bg-muted/40 border-border text-muted-foreground'
                    }`}
                  >
                    {done ? (
                      <Check className="h-3 w-3" />
                    ) : active ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </div>
                  <span className={done || active ? 'text-foreground' : 'text-muted-foreground'}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Etherscan link as soon as we have a tx hash */}
        {launchTxHash && stage !== 'live' && (
          <a
            href={`https://etherscan.io/tx/${launchTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[11px] font-mono text-primary hover:underline"
          >
            View transaction on Etherscan ↗
          </a>
        )}

        {/* CA reveal */}
        {tokenAddress && stage === 'live' && (
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

        {/* Footer / dismiss */}
        {finished && onClose && (
          <button
            onClick={onClose}
            className="w-full mt-2 h-10 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            {stage === 'live' ? 'View my token' : 'Close'}
          </button>
        )}
        {!finished && (
          <p className="text-[10px] text-center text-muted-foreground/60 font-mono uppercase tracking-wider">
            Don't close this window
          </p>
        )}
      </div>
    </div>
  );
}