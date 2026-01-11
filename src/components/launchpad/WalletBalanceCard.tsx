import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSolanaWallet } from "@/hooks/useSolanaWallet";
import { Button } from "@/components/ui/button";
import { Wallet, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WalletBalanceCardProps {
  minRequired?: number;
  className?: string;
}

export function WalletBalanceCard({ minRequired, className = "" }: WalletBalanceCardProps) {
  const { user } = useAuth();
  const { walletAddress, isWalletReady, getBalance } = useSolanaWallet();
  const { toast } = useToast();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchBalance = async () => {
    if (!isWalletReady) return;
    setIsLoading(true);
    try {
      const bal = await getBalance();
      setBalance(bal);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    } finally {
      setIsLoading(false);
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

  if (!user) {
    return (
      <div className={`bg-secondary/50 rounded-xl p-4 border border-border ${className}`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-muted rounded-lg">
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Connect wallet to view balance</p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while wallet is connecting
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
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <div className="h-8 bg-muted/50 rounded animate-pulse" />
          <div className="h-9 bg-muted/50 rounded animate-pulse" />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Loading your embedded Solana wallet...
        </p>
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
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={fetchBalance}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Address & Actions */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 bg-background/50 rounded-lg px-3 py-2 font-mono text-sm text-muted-foreground truncate">
          {truncateAddress(walletAddress)}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => window.open(`https://solscan.io/account/${walletAddress}`, '_blank')}
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
        {minRequired !== undefined && (
          <p className={`text-xs mt-1 ${hasEnough ? 'text-muted-foreground' : 'text-destructive'}`}>
            {hasEnough 
              ? `✓ Sufficient for launch (min ${minRequired} SOL)`
              : `⚠ Need at least ${minRequired} SOL to launch`
            }
          </p>
        )}
      </div>

      {/* Top-up hint */}
      <p className="text-xs text-muted-foreground">
        Copy your address above to send SOL from an exchange or another wallet
      </p>
    </div>
  );
}
