import { useAccount, useBalance, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { formatEther } from 'viem';
import { useConnectModal } from '@rainbow-me/rainbowkit';

export interface EvmWalletState {
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | undefined;
  balance: string;
  balanceRaw: bigint | undefined;
  isOnBase: boolean;
}

export function useEvmWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();

  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
    address,
    chainId: base.id,
  });

  const isOnBase = chainId === base.id;

  const balance = balanceData 
    ? parseFloat(formatEther(balanceData.value)).toFixed(4) 
    : '0.0000';

  const switchToBase = async () => {
    if (switchChain) {
      await switchChain({ chainId: base.id });
    }
  };

  const connect = () => {
    if (openConnectModal) {
      openConnectModal();
    }
  };

  const shortAddress = address 
    ? `${address.slice(0, 6)}...${address.slice(-4)}` 
    : '';

  return {
    address,
    shortAddress,
    isConnected,
    isConnecting,
    chainId,
    balance,
    balanceRaw: balanceData?.value,
    isBalanceLoading,
    isOnBase,
    connect,
    disconnect,
    switchToBase,
  };
}
