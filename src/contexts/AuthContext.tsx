import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";

interface User {
  id: string;
  email?: string;
  wallet?: {
    address: string;
    chainType: string;
  };
  twitter?: {
    username: string;
  };
  displayName?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  solanaAddress: string | null;
  ready: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

// Fallback provider when Privy is not configured
function FallbackAuthProvider({ children }: AuthProviderProps) {
  const value: AuthContextType = {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: () => {
      window.location.href = "/auth";
    },
    logout: async () => {},
    solanaAddress: null,
    ready: true,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Real provider using Privy hooks
function PrivyAuthProvider({ children }: AuthProviderProps) {
  // Dynamic imports to avoid errors when Privy context is missing
  const { usePrivy, useLogout } = require("@privy-io/react-auth");
  const { useWallets } = require("@privy-io/react-auth/solana");

  const { 
    ready, 
    authenticated, 
    user: privyUser, 
    login: privyLogin,
  } = usePrivy();
  
  const { logout: privyLogout } = useLogout();
  const { wallets } = useWallets();
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get the primary Solana wallet address
  const solanaWallet = wallets?.find((w: any) => w.address);
  const solanaAddress = solanaWallet?.address ?? null;

  // Sync Privy user to our user state
  useEffect(() => {
    if (!ready) {
      setIsLoading(true);
      return;
    }

    if (authenticated && privyUser) {
      // Extract user data from Privy
      const email = privyUser.email?.address;
      const twitter = privyUser.twitter;
      const linkedWallet = privyUser.wallet;
      
      // Find Solana embedded wallet
      const embeddedSolanaWallet = privyUser.linkedAccounts?.find(
        (account: any) => account.type === "wallet" && account.chainType === "solana"
      );

      const userData: User = {
        id: privyUser.id,
        email,
        wallet: embeddedSolanaWallet 
          ? { address: embeddedSolanaWallet.address, chainType: "solana" }
          : linkedWallet 
            ? { address: linkedWallet.address, chainType: linkedWallet.chainType }
            : undefined,
        twitter: twitter 
          ? { username: twitter.username ?? "" }
          : undefined,
        displayName: twitter?.name ?? email?.split("@")[0] ?? solanaAddress?.slice(0, 8),
        avatarUrl: twitter?.profilePictureUrl,
      };

      setUser(userData);
    } else {
      setUser(null);
    }

    setIsLoading(false);
  }, [ready, authenticated, privyUser, solanaAddress]);

  const login = () => {
    privyLogin();
  };

  const logout = async () => {
    await privyLogout();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isLoading: !ready || isLoading,
    isAuthenticated: authenticated,
    login,
    logout,
    solanaAddress,
    ready,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  const privyAvailable = usePrivyAvailable();

  if (!privyAvailable) {
    return <FallbackAuthProvider>{children}</FallbackAuthProvider>;
  }

  return <PrivyAuthProvider>{children}</PrivyAuthProvider>;
}
