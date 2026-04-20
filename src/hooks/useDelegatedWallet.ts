import { useCallback, useEffect, useState } from "react";
import { usePrivyAvailable, usePrivyBridge } from "@/providers/PrivyProviderWrapper";

const DELEGATION_KEY = "claw_wallet_delegated";

const FALLBACK = {
  isDelegated: false,
  isDelegating: false,
  needsDelegation: false,
  requestDelegation: async () => {},
  dismiss: () => {},
  embeddedWallet: undefined,
} as const;

export function useDelegatedWallet() {
  const privyAvailable = usePrivyAvailable();
  const bridge = usePrivyBridge();

  // ETH-only platform: pick the Privy embedded EVM wallet
  const { evmWallets } = bridge;

  const [delegatedAddresses, setDelegatedAddresses] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(DELEGATION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
      return new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const [isDelegating, setIsDelegating] = useState(false);

  const embeddedWallet = privyAvailable
    ? evmWallets?.find(
        (w: any) =>
          w.walletClientType === "privy" && w.address?.startsWith("0x")
      ) || evmWallets?.find((w: any) => w.address?.startsWith("0x"))
    : undefined;

  const walletAddress = embeddedWallet?.address;
  const isDelegated = !!(walletAddress && delegatedAddresses.has(walletAddress));
  // Auto-trading is on by default in TEE mode — never block UI with a prompt
  const needsDelegation = false;

  const saveDelegated = useCallback((addr: string) => {
    setDelegatedAddresses((prev) => {
      if (prev.has(addr)) return prev;
      const next = new Set(prev);
      next.add(addr);
      try { localStorage.setItem(DELEGATION_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // TEE mode + ETH-only: as soon as the embedded EVM wallet exists,
  // auto-mark it as trading-ready so background sniper / copy-trade can run.
  useEffect(() => {
    if (privyAvailable && walletAddress && !delegatedAddresses.has(walletAddress)) {
      saveDelegated(walletAddress);
    }
  }, [privyAvailable, walletAddress, delegatedAddresses, saveDelegated]);

  const requestDelegation = useCallback(async () => {
    if (!walletAddress) throw new Error("No embedded wallet found");
    setIsDelegating(true);
    try {
      saveDelegated(walletAddress);
    } finally {
      setIsDelegating(false);
    }
  }, [walletAddress, saveDelegated]);

  const dismiss = useCallback(() => {}, []);

  if (!privyAvailable) return FALLBACK;

  return {
    isDelegated,
    isDelegating,
    needsDelegation,
    requestDelegation,
    dismiss,
    embeddedWallet,
  };
}
