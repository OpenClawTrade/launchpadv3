import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getRpcUrl } from "@/hooks/useSolanaWallet";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { Button } from "@/components/ui/button";
import { Wallet, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Connection } from "@solana/web3.js";

interface WalletBalanceCardProps {
  minRequired?: number;
  className?: string;
}

// Fallback component when Privy is not available
function WalletBalanceCardFallback({ minRequired, className = "" }: WalletBalanceCardProps) {
  const { user } = useAuth();
  const { url: rpcUrl, source: rpcSource } = getRpcUrl();
  const [rpcStatus, setRpcStatus] = useState<
    | { state: 'idle' }
    | { state: 'running' }
    | { state: 'ok'; data: any }
    | { state: 'error'; error: string }
  >({ state: 'idle' });
  const [showDebug, setShowDebug] = useState(false);

  const runRpcTest = async () => {
    setRpcStatus({ state: 'running' });
    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const started = performance.now();
      const version = await connection.getVersion();
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      setRpcStatus({
        state: 'ok',
        data: {
          rpcUrl,
          rpcSource,
          version: version['solana-core'],
          blockhash,
          latencyMs: Math.round(performance.now() - started),
        },
      });
      setShowDebug(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'RPC test failed';
      setRpcStatus({ state: 'error', error: msg });
      setShowDebug(true);
    }
  };

  return (
    <div className={`bg-secondary/50 rounded-xl p-4 border border-border ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-muted rounded-lg">
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {user ? 'Loading wallet system...' : 'Connect wallet to view balance'}
            </p>
            <p className="text-xs text-muted-foreground">If this keeps spinning, refresh and disable ad blockers.</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={runRpcTest}
          disabled={rpcStatus.state === 'running'}
        >
          Test
        </Button>
      </div>
      {showDebug && (
        <div className="mt-2 rounded-lg border border-border bg-background/40 p-2 text-xs text-muted-foreground space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">Diagnostics</span>
            <button className="text-primary hover:underline" onClick={() => setShowDebug(false)}>
              Hide
            </button>
          </div>
          <div className="break-all">RPC: {rpcUrl} ({rpcSource})</div>
          <div>Privy available: false</div>
          {rpcStatus.state === 'ok' && (
            <div className="text-green-500">
              ✓ RPC OK ({rpcStatus.data.latencyMs}ms) • v{rpcStatus.data.version}
            </div>
          )}
          {rpcStatus.state === 'error' && (
            <div className="text-destructive break-all">✗ RPC error: {rpcStatus.error}</div>
          )}
          {rpcStatus.state === 'running' && <div>Testing RPC…</div>}
        </div>
      )}
    </div>
  );
}

// Lazy load the Privy-enabled component to avoid importing Privy hooks at module level
const WalletBalanceCardWithPrivy = lazy(() => import('./WalletBalanceCardPrivy'));

export function WalletBalanceCard({ minRequired, className = "" }: WalletBalanceCardProps) {
  const privyAvailable = usePrivyAvailable();

  // If Privy is not available (App ID not loaded yet), show fallback that doesn't call Privy hooks
  if (!privyAvailable) {
    return <WalletBalanceCardFallback minRequired={minRequired} className={className} />;
  }

  // Privy is available, safe to use wallet hooks inside the Privy-enabled component
  return (
    <Suspense fallback={<WalletBalanceCardFallback minRequired={minRequired} className={className} />}>
      <WalletBalanceCardWithPrivy minRequired={minRequired} className={className} />
    </Suspense>
  );
}
