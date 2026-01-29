import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWallets } from "@privy-io/react-auth/solana";
import { Transaction, VersionedTransaction, PublicKey } from "@solana/web3.js";

// Type for signing that returns raw bytes
export type SignTransactionBytes = (txBytes: Uint8Array) => Promise<Uint8Array>;

interface PrivyWalletProviderProps {
  preferredAddress?: string | null;
  onWalletsChange: (wallets: any[]) => void;
  onSignTransactionChange: (
    fn: ((tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>) | null
  ) => void;
  onSignTransactionBytesChange?: (fn: SignTransactionBytes | null) => void;
  onSigningWalletChange?: (address: string | null) => void;
}

export default function PrivyWalletProvider({
  preferredAddress,
  onWalletsChange,
  onSignTransactionChange,
  onSignTransactionBytesChange,
  onSigningWalletChange,
}: PrivyWalletProviderProps) {
  const { wallets } = useWallets();

  const pickWallet = useCallback(
    (list: any[]) =>
      list.find((w: any) => (preferredAddress ? w?.address === preferredAddress : false)) ??
      // Prefer Privy embedded wallet
      list.find((w: any) => w?.walletClientType === "privy") ??
      list.find((w: any) => w?.standardWallet?.name === "Privy") ??
      list.find((w: any) => {
        const name = (w as any).name?.toLowerCase() || '';
        return name.includes('privy') || name.includes('embedded');
      }) ??
      list.find((w: any) => w?.chainType === "solana") ??
      list[0] ??
      null,
    [preferredAddress]
  );

  // Get the current signing wallet
  const currentWallet = useMemo(() => {
    const list = wallets || [];
    return pickWallet(list);
  }, [wallets, pickWallet]);

  // Direct bytes signing function - THIS IS THE CRITICAL ONE
  // Returns raw signed bytes for direct use with sendRawTransaction
  const signTransactionBytes = useMemo((): SignTransactionBytes | null => {
    if (!currentWallet) return null;

    return async (txBytes: Uint8Array): Promise<Uint8Array> => {
      // Get the standard wallet interface
      const standardWallet = (currentWallet as any).standardWallet;
      if (!standardWallet) {
        throw new Error('Wallet does not support standard interface');
      }
      
      // Get the signTransaction feature
      const signFeature = standardWallet.features['solana:signTransaction'];
      if (!signFeature) {
        throw new Error('Wallet does not support signTransaction');
      }
      
      // Find the account for this wallet
      const account = standardWallet.accounts?.find(
        (a: any) => a.address === currentWallet.address
      );
      if (!account) {
        throw new Error(`Could not find wallet account for ${currentWallet.address}`);
      }
      
      // Sign using Wallet Standard - returns actually signed bytes
      const results = await signFeature.signTransaction({
        transaction: txBytes,
        chain: 'solana:mainnet',
        account,
      });
      
      // Get the signed transaction bytes
      const signedBytes = results[0]?.signedTransaction || results?.signedTransaction;
      if (!signedBytes) {
        throw new Error('Wallet did not return signed transaction');
      }
      
      // Verify signature is not all zeros
      const sig = signedBytes.slice(0, 64);
      const isAllZeros = sig.every((b: number) => b === 0);
      if (isAllZeros) {
        throw new Error('Wallet returned invalid (zero) signature');
      }
      
      return signedBytes;
    };
  }, [currentWallet]);

  // Legacy Transaction/VersionedTransaction signer for backwards compatibility
  const signer = useMemo(() => {
    if (!signTransactionBytes) return null;

    return async (tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> => {
      // Serialize transaction to bytes
      const txBytes: Uint8Array =
        tx instanceof VersionedTransaction
          ? tx.serialize()
          : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      
      // Sign the bytes
      const signedBytes = await signTransactionBytes(txBytes);
      
      // Deserialize back to Transaction/VersionedTransaction
      return tx instanceof VersionedTransaction
        ? VersionedTransaction.deserialize(signedBytes)
        : Transaction.from(signedBytes);
    };
  }, [signTransactionBytes]);

  const prevWalletSigRef = useRef<string>("");
  const prevSignerRef = useRef<typeof signer>(null);
  const prevSignerBytesRef = useRef<typeof signTransactionBytes>(null);
  const prevSigningWalletRef = useRef<string | null>(null);

  // Get the current signing wallet address
  const signingWalletAddress = currentWallet?.address || null;

  useEffect(() => {
    const list = wallets || [];

    // Create a stable "signature" for the wallet list to prevent re-render loops
    const walletSig = list
      .map((w: any) => `${w?.chainType ?? ""}:${w?.walletClientType ?? ""}:${w?.address ?? ""}`)
      .join("|");

    if (walletSig !== prevWalletSigRef.current) {
      prevWalletSigRef.current = walletSig;
      onWalletsChange(list);
    }

    if (prevSignerRef.current !== signer) {
      prevSignerRef.current = signer;
      onSignTransactionChange(signer);
    }

    if (prevSignerBytesRef.current !== signTransactionBytes) {
      prevSignerBytesRef.current = signTransactionBytes;
      onSignTransactionBytesChange?.(signTransactionBytes);
    }

    if (prevSigningWalletRef.current !== signingWalletAddress) {
      prevSigningWalletRef.current = signingWalletAddress;
      onSigningWalletChange?.(signingWalletAddress);
    }
  }, [wallets, signer, signTransactionBytes, signingWalletAddress, onWalletsChange, onSignTransactionChange, onSignTransactionBytesChange, onSigningWalletChange]);

  return null;
}
