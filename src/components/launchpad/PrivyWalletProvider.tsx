import { useCallback, useEffect, useMemo, useRef } from "react";
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
      const txBytes: Uint8Array =
        tx instanceof VersionedTransaction
          ? tx.serialize()
          : tx.serialize({ requireAllSignatures: false, verifySignatures: false });

      // Call Privy's signTransaction with { transaction: Uint8Array, wallet, chain }
      const result = await privySignTransaction({
        transaction: txBytes,
        wallet,
        chain: "solana:mainnet",
      });

      // Privy returns { signedTransaction: Uint8Array }
      const signedBytes = result.signedTransaction;

      // Deserialize back to Transaction/VersionedTransaction
      return tx instanceof VersionedTransaction
        ? VersionedTransaction.deserialize(signedBytes)
        : Transaction.from(signedBytes);
    };
  }, [wallets, pickWallet, privySignTransaction]);

  const prevWalletSigRef = useRef<string>("");
  const prevSignerRef = useRef<typeof signer>(null);

  useEffect(() => {
    const list = wallets || [];

    // Create a stable "signature" for the wallet list to prevent re-render loops
    const walletSig = list
      .map((w: any) => `${w?.chainType ?? ""}:${w?.walletClientType ?? ""}:${w?.address ?? ""}`)
      .join("|");

    if (walletSig !== prevWalletSigRef.current) {
      prevWalletSigRef.current = walletSig;

      // Keep this debug log from spamming the console
      if (import.meta.env.DEV) {
        console.log(
          "[PrivyWalletProvider] wallets:",
          list.map((w: any) => ({
            address: w?.address,
            standardWallet: w?.standardWallet?.name,
            walletClientType: w?.walletClientType,
            chainType: w?.chainType,
          }))
        );
      }

      onWalletsChange(list);
    }

    if (prevSignerRef.current !== signer) {
      prevSignerRef.current = signer;
      onSignTransactionChange(signer);
    }
  }, [wallets, signer, onWalletsChange, onSignTransactionChange]);

  return null;
}


