import { useAccount, useBalance, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { base, bsc, mainnet } from 'wagmi/chains';
import { formatEther } from 'viem';
import { usePrivy, useConnectWallet } from '@privy-io/react-auth';
import { useChain } from '@/contexts/ChainContext';

export interface EvmWalletState {
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | undefined;
  balance: string;
  balanceRaw: bigint | undefined;
  isOnBase: boolean;
  isOnEthereum: boolean;
}

export function useEvmWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { login, logout, authenticated, ready } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { chain } = useChain();

  const balanceChainId = chain === 'bnb' ? bsc.id : chain === 'ethereum' ? mainnet.id : base.id;

  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
    address,
    chainId: balanceChainId,
  });

  const isOnBase = chainId === base.id;
  const isOnBnb = chainId === bsc.id;
  const isOnEthereum = chainId === mainnet.id;

  const balance = balanceData
    ? parseFloat(formatEther(balanceData.value)).toFixed(4)
    : '0.0000';

  const switchToBase = async () => {
    if (switchChain) await switchChain({ chainId: base.id });
  };
  const switchToEthereum = async () => {
    if (switchChain) await switchChain({ chainId: mainnet.id });
  };
  const switchToBnb = async () => {
    if (switchChain) await switchChain({ chainId: bsc.id });
  };

  // Force MetaMask to show its account picker so the user can choose
  // which account to connect (instead of MetaMask silently returning
  // the first already-permitted account).
  const promptMetaMaskAccountPicker = async () => {
    try {
      const eth: any = (window as any).ethereum;
      const mmProvider =
        eth?.providers?.find((p: any) => p?.isMetaMask && !p?.isPhantom) ||
        (eth?.isMetaMask && !eth?.isPhantom ? eth : null);
      if (!mmProvider?.request) return;
      // Step 1: revoke existing permissions (forces fresh consent).
      try {
        await mmProvider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch { /* not all MM versions support revoke; ignore */ }
      // Step 2: request permissions — this ALWAYS opens MM account picker.
      try {
        await mmProvider.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch { /* user rejected or other error; let Privy flow continue */ }
    } catch { /* ignore */ }
  };

  const connect = async () => {
    if (!ready || isConnecting) return;
    if (authenticated) {
      // Already logged into Privy → opening wallet connector.
      // Force MM account picker BEFORE Privy reads selected account.
      await promptMetaMaskAccountPicker();
      if (!isConnected) connectWallet();
      return;
    }
    // First-time login: trigger MM picker first, then Privy login.
    await promptMetaMaskAccountPicker();
    login();
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
    isOnBnb,
    isOnEthereum,
    connect,
    disconnect,
    logout,
    switchToBase,
    switchToBnb,
    switchToEthereum,
  };
}
