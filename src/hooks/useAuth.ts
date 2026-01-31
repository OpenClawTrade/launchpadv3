import { useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";

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

// Real auth using Privy
function useAuthPrivy(): UseAuthReturn {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const solanaAddress = useMemo(() => {
    // Check linked wallet on user object
    if (user?.wallet?.address) return user.wallet.address;

    // Check connected wallets
    const solanaWallet = wallets.find((w) => w.address?.length > 30);
    if (solanaWallet?.address) return solanaWallet.address;

    return null;
  }, [wallets, user?.wallet?.address]);

  const authUser = useMemo<AuthUser | null>(() => {
    if (!user) return null;

    return {
      id: user.id,
      privyId: user.id,
      displayName:
        user.twitter?.username ||
        user.email?.address?.split("@")[0] ||
        solanaAddress?.slice(0, 8) ||
        "Anonymous",
      avatarUrl: user.twitter?.profilePictureUrl || null,
      twitter: user.twitter
        ? {
            username: user.twitter.username,
          }
        : undefined,
      wallet: solanaAddress
        ? {
            address: solanaAddress,
          }
        : undefined,
    };
  }, [user, solanaAddress]);

  return {
    user: authUser,
    isAuthenticated: authenticated,
    isLoading: !ready,
    solanaAddress,
    profileId: user?.id || null,
    login,
    logout,
  };
}

// Main hook that switches between implementations
export function useAuth(): UseAuthReturn {
  const privyAvailable = usePrivyAvailable();

  // When Privy is not available, return fallback immediately
  if (!privyAvailable) {
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      solanaAddress: null,
      profileId: null,
      login: () => console.warn("Privy not available - check PRIVY_APP_ID secret"),
      logout: async () => {},
    };
  }

  // When Privy IS available, use the real hooks
  return useAuthPrivy();
}
