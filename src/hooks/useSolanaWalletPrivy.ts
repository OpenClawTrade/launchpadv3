import { useCallback, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getRpcUrl } from "./useSolanaWallet";

// Hook that uses Privy - MUST only be called inside PrivyProvider when privyAvailable is true
// IMPORTANT: This project uses EMBEDDED wallets only. External wallets are intentionally ignored.
export function useSolanaWalletWithPrivy() {
  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const [isConnecting, setIsConnecting] = useState(false);

  const rpcData = getRpcUrl();
  const rpcUrl = rpcData.url;
  const rpcSource = rpcData.source;

  const getConnection = useCallback(() => new Connection(rpcUrl, "confirmed"), [rpcUrl]);

  const isPrivyEmbeddedWallet = useCallback((w: any) => {
    const walletClientType = w?.walletClientType;
    const standardName = w?.standardWallet?.name;
    const name = String(w?.name ?? "").toLowerCase();

    return (
      walletClientType === "privy" ||
      standardName === "Privy" ||
      name.includes("privy") ||
      name.includes("embedded")
    );
  }, []);

  // Embedded wallet ONLY
  const getEmbeddedWallet = useCallback(() => {
    const embedded = wallets?.find((w: any) => isPrivyEmbeddedWallet(w));
    return embedded || null;
  }, [wallets, isPrivyEmbeddedWallet]);

  // Alias kept for compatibility with existing callers
  const getSolanaWallet = useCallback(() => getEmbeddedWallet(), [getEmbeddedWallet]);

  // Wallet address is embedded wallet only (no linkedAccounts fallback)
  const walletAddress = getEmbeddedWallet()?.address || null;

  const isWalletReady = ready && authenticated && !!walletAddress;

  const signAndSendTransaction = useCallback(
    async (
      transaction: Transaction | VersionedTransaction,
      options?: { skipPreflight?: boolean }
    ): Promise<{ signature: string; confirmed: boolean }> => {
      const wallet = getSolanaWallet();
      if (!wallet) throw new Error("No embedded wallet connected");

      const connection = getConnection();

      try {
        setIsConnecting(true);

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

        // Update legacy transaction blockhash + fee payer
        if (!(transaction as any)?.version) {
          (transaction as Transaction).recentBlockhash = blockhash;
          const { PublicKey } = await import("@solana/web3.js");
          (transaction as Transaction).feePayer = wallet.address ? new PublicKey(wallet.address) : undefined;
        }

        const provider = (wallet as any).getEthereumProvider?.() || wallet;
        if (!provider) throw new Error("Could not get wallet provider");

        const signedTx = provider.signTransaction ? await provider.signTransaction(transaction) : transaction;

        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: options?.skipPreflight ?? true,
          preflightCommitment: "confirmed",
        });

        const confirmation = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        if (confirmation.value.err) throw new Error(`Transaction failed: ${confirmation.value.err}`);

        return { signature, confirmed: true };
      } finally {
        setIsConnecting(false);
      }
    },
    [getSolanaWallet, getConnection]
  );

  const getBalance = useCallback(async (): Promise<number> => {
    if (!walletAddress) return 0;

    try {
      const connection = getConnection();
      const { PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const pubkey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(pubkey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("[useSolanaWalletWithPrivy] Balance error:", error);
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

  const debug = useMemo(
    () => ({
      rpcUrl,
      rpcSource,
      privyReady: ready,
      authenticated,
      walletAddress,
      walletSource: walletAddress ? "useWallets_embedded" : "none",
      wallets: (wallets ?? []).map((w: any) => ({
        walletClientType: w?.walletClientType,
        standardName: w?.standardWallet?.name,
        address: w?.address,
      })),
      privyUserWallet: (user as any)?.wallet?.address ?? null,
      linkedAccountsCount: (user as any)?.linkedAccounts?.length ?? 0,
    }),
    [rpcUrl, rpcSource, ready, authenticated, walletAddress, wallets, user]
  );

  const getTokenBalance = useCallback(async (_mintAddress: string): Promise<number> => {
    // Token balances are tracked in the database for bonding curve tokens
    return 0;
  }, []);

  return {
    walletAddress,
    isWalletReady,
    isConnecting,
    rpcUrl,
    debug,
    getConnection,
    getBalance,
    getBalanceStrict,
    getTokenBalance,
    signAndSendTransaction,
    getSolanaWallet,
    getEmbeddedWallet,
  };
}
