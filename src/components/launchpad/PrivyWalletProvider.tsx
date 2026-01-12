import { useCallback, useEffect, useMemo } from "react";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

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
  const { signTransaction: privySignTransaction } = useSignTransaction();

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

    return async (tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> => {
      // Serialize transaction to Uint8Array (Privy's signTransaction expects bytes)
      let txBytes: Uint8Array;
      if (tx instanceof VersionedTransaction) {
        txBytes = tx.serialize();
      } else {
        txBytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      }

      // Call Privy's signTransaction with { transaction: Uint8Array, wallet, chain }
      const result = await privySignTransaction({
        transaction: txBytes,
        wallet,
        chain: "solana:mainnet",
      });

      // Privy returns { signedTransaction: Uint8Array }
      const signedBytes = result.signedTransaction;

      // Deserialize back to Transaction/VersionedTransaction
      if (tx instanceof VersionedTransaction) {
        return VersionedTransaction.deserialize(signedBytes);
      } else {
        return Transaction.from(signedBytes);
      }
    };
  }, [wallets, pickWallet, privySignTransaction]);

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

