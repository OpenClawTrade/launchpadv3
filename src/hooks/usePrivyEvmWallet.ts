import { useMemo } from "react";
import { usePrivyAvailable, usePrivyBridge } from "@/providers/PrivyProviderWrapper";

const FALLBACK = { address: undefined, isReady: true, wallet: null } as const;

export function usePrivyEvmWallet() {
  const privyAvailable = usePrivyAvailable();
  const bridge = usePrivyBridge();

  const { privy, evmWallets } = bridge;

  // Prefer the Privy-managed embedded wallet, but fall back to ANY connected
  // EVM wallet (MetaMask, Rainbow, Coinbase, WalletConnect, ...) so users who
  // log in with an external wallet aren't blocked waiting on embedded creation.
  const evmWallet = useMemo(() => {
    if (!privyAvailable || !evmWallets || evmWallets.length === 0) return null;
    return (
      evmWallets.find(
        (w: any) => w.walletClientType === "privy" && w.address?.startsWith("0x")
      ) ||
      evmWallets.find((w: any) => w.address?.startsWith("0x")) ||
      null
    );
  }, [evmWallets, privyAvailable]);

  const address = evmWallet?.address || undefined;

  if (!privyAvailable) return FALLBACK;

  // Embedded EVM wallet auto-creation is handled by Privy via
  // `embeddedWallets.ethereum.createOnLogin: "all-users"` in PrivyProviderWrapper.
  // We intentionally do NOT call createWallet() here — doing so races with
  // Privy's own auto-creation and triggers the "Creating your wallet" modal
  // to get stuck (especially when the user already connected an external EVM
  // wallet like MetaMask on /launchnow).
  return {
    address,
    isReady: privy.ready,
    wallet: evmWallet,
  };
}
