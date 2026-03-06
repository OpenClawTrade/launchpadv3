import { useCallback, useMemo } from "react";
import { Connection } from "@solana/web3.js";
import { useAuth } from "@/hooks/useAuth";

// Get Solana RPC URL
// Priority: runtime config > localStorage cache > VITE env > safe fallback
export const getRpcUrl = (): { url: string; source: string } => {
  const isValidHttpsUrl = (value?: string | null) =>
    !!value && value.startsWith("https://") && !value.includes("${");

  const isBrowser = typeof window !== "undefined";

  // Option 1: Runtime config (freshest, server-driven)
  if (isBrowser) {
    const fromWindow = (window as any)?.__PUBLIC_CONFIG__?.heliusRpcUrl as string | undefined;
    if (isValidHttpsUrl(fromWindow)) {
      return { url: fromWindow!.trim(), source: "runtime_public_config" };
    }

    // While runtime config is still loading, avoid stale baked env keys.
    const runtimeLoaded = !!(window as any)?.__PUBLIC_CONFIG_LOADED__;
    if (!runtimeLoaded) {
      const fromStorage = localStorage.getItem("heliusRpcUrl");
      if (isValidHttpsUrl(fromStorage)) {
        return { url: fromStorage!.trim(), source: "localStorage_heliusRpcUrl_preload" };
      }
      return { url: "https://mainnet.helius-rpc.com", source: "waiting_runtime_config" };
    }

    // Runtime loaded but no window config: use latest persisted URL.
    const fromStorage = localStorage.getItem("heliusRpcUrl");
    if (isValidHttpsUrl(fromStorage)) {
      return { url: fromStorage!.trim(), source: "localStorage_heliusRpcUrl" };
    }
  }

  // Option 2: Direct RPC URL from Vite env (last resort)
  const explicitUrl = import.meta.env.VITE_HELIUS_RPC_URL;
  if (isValidHttpsUrl(explicitUrl)) {
    return { url: explicitUrl!.trim(), source: "VITE_HELIUS_RPC_URL" };
  }

  // Option 3: Build URL from API key (last resort)
  const apiKey = import.meta.env.VITE_HELIUS_API_KEY;
  if (apiKey && typeof apiKey === "string" && apiKey.length > 10 && !apiKey.includes("$")) {
    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey.trim()}`;
    return { url, source: "VITE_HELIUS_API_KEY" };
  }

  return { url: "https://mainnet.helius-rpc.com", source: "helius_no_key_fallback" };
};

// Simple wallet hook that gets wallet from AuthContext (works without direct Privy hooks)
// NOTE: Wallet *address* must be a string; AuthContext may store a richer wallet object.
export function useSolanaWallet() {
  const { user } = useAuth();
  const { url: rpcUrl, source: rpcSource } = getRpcUrl();

  const walletAddress =
    (user as any)?.wallet?.address ??
    (typeof (user as any)?.wallet === "string" ? (user as any)?.wallet : null) ??
    null;

  const isWalletReady = !!walletAddress;

  const getConnection = useCallback(() => new Connection(rpcUrl, { commitment: "confirmed", disableRetryOnRateLimit: true }), [rpcUrl]);

  const getBalance = useCallback(async (): Promise<number> => {
    if (!walletAddress) return 0;
    try {
      const connection = getConnection();
      const { PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const pubkey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(pubkey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("[useSolanaWallet] Balance error:", error);
      return 0;
    }
  }, [walletAddress, getConnection]);

  const getBalanceStrict = useCallback(async (): Promise<number> => {
    if (!walletAddress) throw new Error("No wallet address");
    const connection = getConnection();
    const { PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
    const pubkey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  }, [walletAddress, getConnection]);

  const getTokenBalance = useCallback(async (_mintAddress: string): Promise<number> => {
    // Token balances tracked in database for bonding curve tokens
    return 0;
  }, []);

  const debug = useMemo(
    () => ({
      rpcUrl,
      rpcSource,
      privyReady: true,
      authenticated: !!user,
      walletAddress,
      walletSource: walletAddress ? "AuthContext" : "none",
      wallets: [],
      privyUserWallet: walletAddress,
      linkedAccountsCount: 0,
      linkedSolanaWallet: walletAddress,
    }),
    [rpcUrl, rpcSource, user, walletAddress]
  );

  return {
    walletAddress,
    isWalletReady,
    isConnecting: false,
    rpcUrl,
    debug,
    getConnection,
    getBalance,
    getBalanceStrict,
    getTokenBalance,
    signAndSendTransaction: async () => {
      throw new Error("Use Privy wallet for signing");
    },
    getSolanaWallet: () => null,
    getEmbeddedWallet: () => null,
  };
}

export { useSolanaWalletWithPrivy } from "./useSolanaWalletPrivy";
