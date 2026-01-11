import { useEffect } from "react";
import { useWallets } from "@privy-io/react-auth/solana";

interface PrivyWalletProviderProps {
  onWalletsChange: (wallets: any[]) => void;
}

export default function PrivyWalletProvider({ onWalletsChange }: PrivyWalletProviderProps) {
  const { wallets } = useWallets();

  useEffect(() => {
    const list = wallets || [];
    // Debug: helps confirm if Privy Solana wallets are hydrated
    console.log("[PrivyWalletProvider] wallets:", list.map((w: any) => ({
      address: w?.address,
      standardWallet: w?.standardWallet?.name,
      walletClientType: w?.walletClientType,
      chainType: w?.chainType,
    })));
    onWalletsChange(list);
  }, [wallets, onWalletsChange]);

  return null;
}

