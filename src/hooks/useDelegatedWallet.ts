import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { useHeadlessDelegatedActions } from "@privy-io/react-auth";

const DELEGATION_KEY = "claw_wallet_delegated";

export function useDelegatedWallet() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { delegateWallet } = useHeadlessDelegatedActions();

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

  // Check if the wallet is already delegated via Privy's wallet object
  useEffect(() => {
    if (embeddedWallet && (embeddedWallet as any).delegated) {
      setIsDelegated(true);
      try {
        localStorage.setItem(DELEGATION_KEY, "true");
      } catch {}
    }
  }, [embeddedWallet]);

  const needsDelegation =
    ready && authenticated && !!embeddedWallet && !isDelegated && !dismissed;

  const requestDelegation = useCallback(async () => {
    if (!embeddedWallet) throw new Error("No embedded wallet found");
    setIsDelegating(true);
    try {
      await delegateWallet({
        address: embeddedWallet.address,
        chainType: "solana",
      });
      setIsDelegated(true);
      try {
        localStorage.setItem(DELEGATION_KEY, "true");
      } catch {}
    } finally {
      setIsDelegating(false);
    }
  }, [embeddedWallet, delegateWallet]);

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
