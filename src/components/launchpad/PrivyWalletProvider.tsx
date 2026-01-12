import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWallets } from "@privy-io/react-auth/solana";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

interface PrivyWalletProviderProps {
  preferredAddress?: string | null;
  onWalletsChange: (wallets: any[]) => void;
  onSignTransactionChange: (
    fn: ((tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>) | null
  ) => void;
  onSigningWalletChange?: (address: string | null) => void;
}

export default function PrivyWalletProvider({
  preferredAddress,
  onWalletsChange,
  onSignTransactionChange,
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

  // Create signer using Wallet Standard interface directly (NOT Privy hooks!)
  const signer = useMemo(() => {
    const list = wallets || [];
    if (list.length === 0) return null;

    // Pick the wallet we'll use for signing
    const wallet = pickWallet(list);
    if (!wallet) return null;

    return async (tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> => {
      console.log('[PrivyWalletProvider] Signing with wallet:', wallet.address);
      console.log('[PrivyWalletProvider] Wallet type:', (wallet as any).walletClientType);
      
      // Get the standard wallet interface
      const standardWallet = (wallet as any).standardWallet;
      if (!standardWallet) {
        console.error('[PrivyWalletProvider] No standardWallet interface found');
        throw new Error('Wallet does not support standard interface');
      }
      
      console.log('[PrivyWalletProvider] Standard wallet name:', standardWallet.name);
      console.log('[PrivyWalletProvider] Standard wallet features:', Object.keys(standardWallet.features || {}));
      
      // Get the signTransaction feature
      const signFeature = standardWallet.features['solana:signTransaction'];
      if (!signFeature) {
        console.error('[PrivyWalletProvider] Wallet does not have solana:signTransaction feature');
        throw new Error('Wallet does not support signTransaction');
      }
      
      // Find the account for this wallet
      const account = standardWallet.accounts?.find(
        (a: any) => a.address === wallet.address
      );
      if (!account) {
        console.error('[PrivyWalletProvider] Could not find account for address:', wallet.address);
        console.error('[PrivyWalletProvider] Available accounts:', standardWallet.accounts?.map((a: any) => a.address));
        throw new Error(`Could not find wallet account for ${wallet.address}`);
      }
      
      console.log('[PrivyWalletProvider] Using account:', account.address);
      
      // Serialize transaction to bytes
      const txBytes: Uint8Array =
        tx instanceof VersionedTransaction
          ? tx.serialize()
          : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      
      console.log('[PrivyWalletProvider] TX bytes length:', txBytes.length);
      
      // Sign using Wallet Standard - NO RPC CALLS, returns actually signed bytes
      const results = await signFeature.signTransaction({
        transaction: txBytes,
        chain: 'solana:mainnet',
        account,
      });
      
      // Get the signed transaction bytes
      const signedBytes = results[0]?.signedTransaction || results?.signedTransaction;
      if (!signedBytes) {
        console.error('[PrivyWalletProvider] No signed transaction in result:', results);
        throw new Error('Wallet did not return signed transaction');
      }
      
      console.log('[PrivyWalletProvider] Signed TX bytes length:', signedBytes.length);
      
      // Log first signature to verify it's not all zeros
      const sig = signedBytes.slice(0, 64);
      const isAllZeros = sig.every((b: number) => b === 0);
      console.log('[PrivyWalletProvider] Signature is all zeros:', isAllZeros);
      if (isAllZeros) {
        console.error('[PrivyWalletProvider] WARNING: Signature is all zeros!');
      }
      
      // Deserialize back to Transaction/VersionedTransaction
      return tx instanceof VersionedTransaction
        ? VersionedTransaction.deserialize(signedBytes)
        : Transaction.from(signedBytes);
    };
  }, [wallets, pickWallet]);

  const prevWalletSigRef = useRef<string>("");
  const prevSignerRef = useRef<typeof signer>(null);
  const prevSigningWalletRef = useRef<string | null>(null);

  // Get the current signing wallet address
  const signingWalletAddress = useMemo(() => {
    const list = wallets || [];
    const wallet = pickWallet(list);
    return wallet?.address || null;
  }, [wallets, pickWallet]);

  useEffect(() => {
    const list = wallets || [];

    // Create a stable "signature" for the wallet list to prevent re-render loops
    const walletSig = list
      .map((w: any) => `${w?.chainType ?? ""}:${w?.walletClientType ?? ""}:${w?.address ?? ""}`)
      .join("|");

    if (walletSig !== prevWalletSigRef.current) {
      prevWalletSigRef.current = walletSig;

      if (import.meta.env.DEV) {
        console.log(
          "[PrivyWalletProvider] wallets:",
          list.map((w: any) => ({
            address: w?.address,
            standardWallet: w?.standardWallet?.name,
            walletClientType: w?.walletClientType,
            chainType: w?.chainType,
            hasSignFeature: !!(w?.standardWallet?.features?.['solana:signTransaction']),
          }))
        );
      }

      onWalletsChange(list);
    }

    if (prevSignerRef.current !== signer) {
      prevSignerRef.current = signer;
      onSignTransactionChange(signer);
    }

    if (prevSigningWalletRef.current !== signingWalletAddress) {
      prevSigningWalletRef.current = signingWalletAddress;
      onSigningWalletChange?.(signingWalletAddress);
      console.log('[PrivyWalletProvider] Signing wallet changed to:', signingWalletAddress);
    }
  }, [wallets, signer, signingWalletAddress, onWalletsChange, onSignTransactionChange, onSigningWalletChange]);

  return null;
}


