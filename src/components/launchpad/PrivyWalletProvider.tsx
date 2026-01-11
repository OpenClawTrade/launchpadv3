import { useEffect } from "react";
import { useWallets } from "@privy-io/react-auth";

interface PrivyWalletProviderProps {
  onWalletsChange: (wallets: any[]) => void;
}

export default function PrivyWalletProvider({ onWalletsChange }: PrivyWalletProviderProps) {
  const { wallets } = useWallets();

  useEffect(() => {
    onWalletsChange(wallets || []);
  }, [wallets, onWalletsChange]);

  return null;
}

