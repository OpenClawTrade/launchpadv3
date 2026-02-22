import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

const DELEGATION_KEY = "claw_wallet_delegated";

export function useDelegatedWallet() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const [isDelegated, setIsDelegated] = useState(() => {
    try {
      return localStorage.getItem(DELEGATION_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [isDelegating, setIsDelegating] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("claw_delegation_dismissed") === "true";
    } catch {
      return false;
    }
  });

  // Find embedded wallet
  const embeddedWallet = wallets?.find(
    (w: any) =>
      w.walletClientType === "privy" ||
      w.standardWallet?.name === "Privy" ||
      String(w?.name ?? "").toLowerCase().includes("privy")
  );

  // With TEE execution, delegation is not needed — wallets already support
  // server-side access. Auto-mark as delegated when an embedded wallet exists.
  useEffect(() => {
    if (embeddedWallet) {
      setIsDelegated(true);
      try {
        localStorage.setItem(DELEGATION_KEY, "true");
      } catch {}
    }
  }, [embeddedWallet]);

  const needsDelegation = false; // TEE wallets don't need delegation

  const requestDelegation = useCallback(async () => {
    // No-op for TEE wallets — already delegated
    setIsDelegated(true);
    try {
      localStorage.setItem(DELEGATION_KEY, "true");
    } catch {}
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem("claw_delegation_dismissed", "true");
    } catch {}
  }, []);

  return {
    isDelegated,
    isDelegating,
    needsDelegation,
    requestDelegation,
    dismiss,
    embeddedWallet,
  };
}
