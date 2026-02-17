import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TrustWalletAdapter,
  LedgerWalletAdapter,
  Coin98WalletAdapter,
  SafePalWalletAdapter,
  TokenPocketWalletAdapter,
  NightlyWalletAdapter,
  KeystoneWalletAdapter,
  NufiWalletAdapter,
  SpotWalletAdapter,
  TrezorWalletAdapter,
} from "@solana/wallet-adapter-wallets";

import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Lightweight Solana Wallet Adapter provider scoped to the migrate page.
 * Uses the Helius RPC URL from runtime config / localStorage.
 */
export function SolanaWalletAdapterProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => {
    // Try runtime config first, then localStorage, then fallback
    const rpc =
      window.__PUBLIC_CONFIG__?.heliusRpcUrl ||
      localStorage.getItem("heliusRpcUrl") ||
      "https://api.mainnet-beta.solana.com";
    return rpc;
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new TrustWalletAdapter(),
      new LedgerWalletAdapter(),
      new Coin98WalletAdapter(),
      new SafePalWalletAdapter(),
      new TokenPocketWalletAdapter(),
      new NightlyWalletAdapter(),
      new KeystoneWalletAdapter(),
      new NufiWalletAdapter(),
      new SpotWalletAdapter(),
      new TrezorWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
