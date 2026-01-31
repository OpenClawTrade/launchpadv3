import { usePhantomWallet } from "@/hooks/usePhantomWallet";

export interface AuthUser {
  id: string;
  privyId: string;
  displayName: string | null;
  avatarUrl: string | null;
  twitter?: {
    username?: string;
  };
  wallet?: {
    address?: string;
  };
}

export interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  solanaAddress: string | null;
  profileId: string | null;
  login: () => void;
  logout: () => Promise<void>;
}

/**
 * Authentication hook using Phantom wallet directly.
 * Privy is currently disabled.
 */
export function useAuth(): UseAuthReturn {
  const {
    isConnected,
    isConnecting,
    address,
    connect,
    disconnect,
  } = usePhantomWallet();

  const user: AuthUser | null = isConnected && address
    ? {
        id: address,
        privyId: address,
        displayName: `${address.slice(0, 4)}...${address.slice(-4)}`,
        avatarUrl: null,
        wallet: { address },
      }
    : null;

  return {
    user,
    isAuthenticated: isConnected,
    isLoading: isConnecting,
    solanaAddress: address,
    profileId: address,
    login: connect,
    logout: disconnect,
  };
}
