import { useCallback, useMemo } from "react";
import { Connection } from "@solana/web3.js";
import { useAuth } from "@/hooks/useAuth";

// Get a working Solana RPC URL
// Priority: VITE_HELIUS_RPC_URL > VITE_HELIUS_API_KEY > runtime config > PublicNode fallback

export const getRpcUrl = (): { url: string; source: string } => {
  // Option 1: Direct RPC URL from Vite env
  const explicitUrl = import.meta.env.VITE_HELIUS_RPC_URL;
  if (explicitUrl && typeof explicitUrl === "string" && explicitUrl.startsWith("https://")) {
    return { url: explicitUrl, source: "VITE_HELIUS_RPC_URL" };
  }

  // Option 2: Build URL from API key
  const apiKey = import.meta.env.VITE_HELIUS_API_KEY;
  if (apiKey && typeof apiKey === "string" && apiKey.length > 10 && !apiKey.includes("$")) {
    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    return { url, source: "VITE_HELIUS_API_KEY" };
  }

  // Option 3: localStorage first (persists across sessions)
  if (typeof window !== "undefined") {
    const fromStorage = localStorage.getItem("heliusRpcUrl");
    if (fromStorage && fromStorage.startsWith("https://") && !fromStorage.includes("${")) {
      return { url: fromStorage, source: "localStorage_heliusRpcUrl" };
    }
  }

  // Option 4: Window runtime config
  if (typeof window !== "undefined") {
    const fromWindow = (window as any)?.__PUBLIC_CONFIG__?.heliusRpcUrl as string | undefined;
    if (fromWindow && fromWindow.startsWith("https://") && !fromWindow.includes("${")) {
      return { url: fromWindow, source: "runtime_public_config" };
    }
  }

  // Fallback: PublicNode (CORS-friendly, no auth)
  return { url: "https://solana.publicnode.com", source: "publicnode_fallback" };
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

  const getConnection = useCallback(() => new Connection(rpcUrl, "confirmed"), [rpcUrl]);

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
