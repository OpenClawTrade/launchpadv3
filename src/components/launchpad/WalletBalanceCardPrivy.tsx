import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { Button } from "@/components/ui/button";
import { Wallet, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WalletBalanceCardPrivyProps {
  minRequired?: number;
  className?: string;
}

// Component that uses Privy wallet hooks - ONLY rendered when privyAvailable is true
export default function WalletBalanceCardPrivy({ minRequired, className = "" }: WalletBalanceCardPrivyProps) {
  const { user } = useAuth();
  const {
    walletAddress,
    isWalletReady,
    getBalance,
    getBalanceStrict,
    testRpc,
    debug,
  } = useSolanaWalletWithPrivy();

  const { toast } = useToast();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [rpcStatus, setRpcStatus] = useState<
    | { state: 'idle' }
    | { state: 'running' }
    | { state: 'ok'; data: any }
    | { state: 'error'; error: string }
  >({ state: 'idle' });
  const [showDebug, setShowDebug] = useState(false);

  const fetchBalance = async () => {
    if (!isWalletReady) return;
    setIsLoading(true);
    setBalanceError(null);
    try {
      const bal = getBalanceStrict ? await getBalanceStrict() : await getBalance();
      setBalance(bal);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch balance';
      setBalanceError(msg);
      console.error('Failed to fetch balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runRpcTest = async () => {
    if (!testRpc) {
      setRpcStatus({ state: 'error', error: 'RPC test unavailable' });
      return;
    }

    setRpcStatus({ state: 'running' });
    try {
      const data = await testRpc();
      setRpcStatus({ state: 'ok', data });
      setShowDebug(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'RPC test failed';
      setRpcStatus({ state: 'error', error: msg });
      setShowDebug(true);
    }
  };

  // Fetch balance on mount and every 10 seconds
  useEffect(() => {
    if (isWalletReady) {
      fetchBalance();

      const interval = setInterval(() => {
        fetchBalance();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [isWalletReady]);

  const handleCopy = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const hasEnough = minRequired === undefined || (balance !== null && balance >= minRequired);

  // Show loading / missing-wallet state
  const noWalletDetected = Boolean(debug?.privyReady && debug?.authenticated && !walletAddress);

  if (!isWalletReady || !walletAddress) {
    return (
      <div className={`bg-secondary/50 rounded-xl p-4 border border-border ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-sm">Your Wallet</span>
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
        <div className="space-y-2">
          <div className="h-8 bg-muted/50 rounded animate-pulse" />
          <div className="h-9 bg-muted/50 rounded animate-pulse" />
        </div>
        <p className={`text-xs mt-3 ${noWalletDetected ? 'text-destructive' : 'text-muted-foreground'}`}>
          {noWalletDetected
            ? 'No Solana wallet detected for this account (check Diagnostics → LinkedSolanaWallet).'
            : 'Loading your embedded Solana wallet…'}
        </p>
        {showDebug && (
          <div className="mt-2 rounded-lg border border-border bg-background/40 p-2 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Diagnostics</span>
              <button className="text-primary hover:underline" onClick={() => setShowDebug(false)}>
                Hide
              </button>
            </div>
            <div className="break-all">RPC: {debug?.rpcUrl ?? '—'} ({debug?.rpcSource ?? 'unknown'})</div>
            <div>Wallet: {walletAddress ?? '—'} ({debug?.walletSource ?? 'none'})</div>
            <div>Privy ready/auth: {String(debug?.privyReady)} / {String(debug?.authenticated)}</div>
            <div>Wallets (useWallets): {debug?.wallets?.length ?? 0}</div>
            <div>LinkedAccounts: {debug?.linkedAccountsCount ?? 0}</div>
            <div>LinkedSolanaWallet: {debug?.linkedSolanaWallet ?? '—'}</div>
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

  return (
    <div className={`bg-secondary/50 rounded-xl p-4 border border-border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-sm">Your Wallet</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={runRpcTest}
            disabled={rpcStatus.state === 'running'}
          >
            Test
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fetchBalance}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Address & Actions */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 bg-background/50 rounded-lg px-3 py-2 font-mono text-sm text-muted-foreground truncate">
          {truncateAddress(walletAddress)}
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => window.open(`https://solscan.io/account/${walletAddress}`, "_blank")}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {/* Balance */}
      <div className="mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            {isLoading ? (
              <span className="inline-block h-8 w-20 bg-muted/50 rounded animate-pulse" />
            ) : balance !== null ? (
              balance.toFixed(4)
            ) : (
              "0.0000"
            )}
          </span>
          <span className="text-muted-foreground font-medium">SOL</span>
        </div>

        {balanceError && (
          <p className="text-xs mt-1 text-destructive">{balanceError}</p>
        )}

        {minRequired !== undefined && (
          <p className={`text-xs mt-1 ${hasEnough ? "text-muted-foreground" : "text-destructive"}`}>
            {hasEnough ? `✓ Sufficient for launch (min ${minRequired} SOL)` : `⚠ Need at least ${minRequired} SOL to launch`}
          </p>
        )}

        {showDebug && (
          <div className="mt-2 rounded-lg border border-border bg-background/40 p-2 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Diagnostics</span>
              <button className="text-primary hover:underline" onClick={() => setShowDebug(false)}>
                Hide
              </button>
            </div>
            <div className="break-all">RPC: {debug?.rpcUrl ?? '—'} ({debug?.rpcSource ?? 'unknown'})</div>
            <div>Wallet: {walletAddress ?? '—'} ({debug?.walletSource ?? 'none'})</div>
            <div>Privy ready/auth: {String(debug?.privyReady)} / {String(debug?.authenticated)}</div>
            <div>Wallets (useWallets): {debug?.wallets?.length ?? 0}</div>
            <div>LinkedAccounts: {debug?.linkedAccountsCount ?? 0}</div>
            <div>LinkedSolanaWallet: {debug?.linkedSolanaWallet ?? '—'}</div>
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

      {/* Top-up hint */}
      <p className="text-xs text-muted-foreground">Copy your address above to send SOL from an exchange or another wallet</p>
    </div>
  );
}
