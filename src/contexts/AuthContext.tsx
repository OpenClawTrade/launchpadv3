import { createContext, useContext, useEffect, useState, ReactNode, useRef, useMemo } from "react";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { usePrivy, useLogout } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { supabase } from "@/integrations/supabase/client";
import { privyUserIdToUuid } from "@/lib/privyUuid";

interface User {
  id: string;
  privyId: string;
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
  profileId: string | null;
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
      // Avoid /auth redirect loops when Privy is not available.
      console.warn("Auth is not configured (Privy unavailable). Please set VITE_PRIVY_APP_ID.");
    },
    logout: async () => {},
    solanaAddress: null,
    profileId: null,
    ready: true,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Real provider using Privy hooks - only rendered when Privy is available
function PrivyAuthProvider({ children }: AuthProviderProps) {
  const { 
    ready, 
    authenticated, 
    user: privyUser, 
    login: privyLogin,
  } = usePrivy();
  
  const { wallets } = useWallets();
  const { logout: privyLogout } = useLogout();
  
  const [user, setUser] = useState<User | null>(null);
  const [dbUserId, setDbUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const walletSavedRef = useRef<string | null>(null);

  // Get the Privy EMBEDDED Solana wallet from useWallets (NOT external/linked wallets)
  const embeddedWallet = useMemo(() => {
    if (!wallets || wallets.length === 0) return null;
    
    // Find Privy embedded wallet
    const embedded = wallets.find((w: any) => {
      const walletClientType = w?.walletClientType;
      const standardName = w?.standardWallet?.name;
      const name = (w?.name || '').toLowerCase();
      return walletClientType === 'privy' || standardName === 'Privy' || name.includes('privy') || name.includes('embedded');
    });
    
    return embedded || wallets[0] || null;
  }, [wallets]);

  // Use ONLY the embedded wallet address
  const solanaAddress = embeddedWallet?.address || null;

  // Privy user IDs are not UUIDs. Convert deterministically to a UUID so we can
  // use them with the backend schema (which uses UUID primary keys).
  // PERFORMANCE: Do this synchronously inline to avoid extra render cycles
  useEffect(() => {
    if (!privyUser?.id) {
      setDbUserId(null);
      return;
    }

    // Convert immediately - don't wait for next tick
    privyUserIdToUuid(privyUser.id)
      .then(setDbUserId)
      .catch(() => setDbUserId(null));
  }, [privyUser?.id]);

  // Sync user profile to database via edge function
  useEffect(() => {
    if (!authenticated || !privyUser?.id || !dbUserId) return;
    if (walletSavedRef.current === `${dbUserId}-${solanaAddress}`) return;
    
    const syncProfileToDb = async () => {
      try {
        const email = privyUser.email?.address;
        const twitter = privyUser.twitter;
        
        const { error } = await supabase.functions.invoke("sync-privy-user", {
          body: {
            privyUserId: privyUser.id,
            solanaWalletAddress: solanaAddress,
            email,
            twitterUsername: twitter?.username,
            displayName: twitter?.name ?? email?.split("@")[0] ?? solanaAddress?.slice(0, 8),
            avatarUrl: twitter?.profilePictureUrl,
          },
        });
        
        if (error) {
          console.warn("Failed to sync profile:", error);
        } else {
          walletSavedRef.current = `${dbUserId}-${solanaAddress}`;
          console.log("Profile synced successfully with wallet:", solanaAddress);
        }
      } catch (e) {
        console.warn("Failed to sync profile to database", e);
      }
    };
    
    syncProfileToDb();
  }, [authenticated, privyUser?.id, privyUser?.email, privyUser?.twitter, solanaAddress, dbUserId]);

  // Sync Privy user to our user state
  useEffect(() => {
    if (!ready) {
      setIsLoading(true);
      return;
    }

    if (authenticated && privyUser) {
      if (!dbUserId) {
        setUser(null);
        setIsLoading(true);
        return;
      }

      // Extract user data from Privy
      const email = privyUser.email?.address;
      const twitter = privyUser.twitter;

      // Use ONLY the embedded wallet (from useWallets, already computed above)
      const userData: User = {
        id: dbUserId,
        privyId: privyUser.id,
        email,
        wallet: solanaAddress 
          ? { address: solanaAddress, chainType: "solana" }
          : undefined,
        twitter: twitter 
          ? { username: twitter.username ?? "" }
          : undefined,
        displayName: twitter?.name ?? email?.split("@")[0] ?? solanaAddress?.slice(0, 8),
        avatarUrl: twitter?.profilePictureUrl,
      };

      setUser(userData);
      setIsLoading(false);
      return;
    }

    setUser(null);
    setIsLoading(false);
  }, [ready, authenticated, privyUser, solanaAddress, dbUserId]);

  const login = () => {
    console.log("Opening Privy login modal");
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
    profileId: dbUserId,
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

  // If Privy is not available, use the fallback (no Privy hooks)
  if (!privyAvailable) {
    return <FallbackAuthProvider>{children}</FallbackAuthProvider>;
  }

  // When Privy is available, use the real provider with Privy hooks
  return <PrivyAuthProvider>{children}</PrivyAuthProvider>;
}
