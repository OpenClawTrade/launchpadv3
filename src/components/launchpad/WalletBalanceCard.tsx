import { useState, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { Wallet } from "lucide-react";

interface WalletBalanceCardProps {
  minRequired?: number;
  className?: string;
}

// Fallback component when Privy is not available yet (no RPC tests / no external wallets)
function WalletBalanceCardFallback({ className = "" }: WalletBalanceCardProps) {
  const { user } = useAuth();

  return (
    <div className={`bg-secondary/50 rounded-xl p-4 border border-border ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-sm">Embedded Wallet</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-8 bg-muted/50 rounded animate-pulse" />
        <div className="h-9 bg-muted/50 rounded animate-pulse" />
      </div>

      <p className="text-xs mt-3 text-muted-foreground">
        {user ? "Loading your embedded Solana wallet…" : "Log in to access your embedded wallet."}
      </p>
    </div>
  );
}

// Lazy load the Privy-enabled component to avoid importing Privy hooks at module level
const WalletBalanceCardWithPrivy = lazy(() => import("./WalletBalanceCardPrivy"));

export function WalletBalanceCard({ minRequired, className = "" }: WalletBalanceCardProps) {
  const privyAvailable = usePrivyAvailable();

  if (!privyAvailable) {
    return <WalletBalanceCardFallback minRequired={minRequired} className={className} />;
  }

  return (
    <Suspense fallback={<WalletBalanceCardFallback minRequired={minRequired} className={className} />}>
      <WalletBalanceCardWithPrivy minRequired={minRequired} className={className} />
    </Suspense>
  );
}
