import { useCallback, useEffect, useMemo } from "react";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import type { Transaction, VersionedTransaction } from "@solana/web3.js";

interface PrivyWalletProviderProps {
  preferredAddress?: string | null;
  onWalletsChange: (wallets: any[]) => void;
  onSignTransactionChange: (
    fn: ((tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>) | null
  ) => void;
}

export default function PrivyWalletProvider({
  preferredAddress,
  onWalletsChange,
  onSignTransactionChange,
}: PrivyWalletProviderProps) {
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();

  const pickWallet = useCallback(
    (list: any[]) =>
      list.find((w: any) => (preferredAddress ? w?.address === preferredAddress : false)) ??
      list.find((w: any) => w?.standardWallet?.name === "Privy") ??
      list.find((w: any) => w?.walletClientType === "privy") ??
      list.find((w: any) => w?.chainType === "solana") ??
      list[0] ??
      null,
    [preferredAddress]
  );

  const signer = useMemo(() => {
    const list = wallets || [];
    const wallet = pickWallet(list);
    if (!wallet) return null;

    return async (tx: Transaction | VersionedTransaction) => {
      // Privy expects a request object shape: { transaction, wallet, chain }
      return await signTransaction({ transaction: tx, wallet, chain: "solana:mainnet" });
    };
  }, [wallets, pickWallet, signTransaction]);

  useEffect(() => {
    const list = wallets || [];

    // Debug: helps confirm if Privy Solana wallets are hydrated
    console.log(
      "[PrivyWalletProvider] wallets:",
      list.map((w: any) => ({
        address: w?.address,
        standardWallet: w?.standardWallet?.name,
        walletClientType: w?.walletClientType,
        chainType: w?.chainType,
      }))
    );

    onWalletsChange(list);
    onSignTransactionChange(signer);
  }, [wallets, signer, onWalletsChange, onSignTransactionChange]);

  return null;
}

