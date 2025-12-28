import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { usePrivy, useLogout } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { supabase } from "@/integrations/supabase/client";

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

export function AuthProvider({ children }: AuthProviderProps) {
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
  const solanaWallet = wallets.find(w => w.address);
  const solanaAddress = solanaWallet?.address ?? null;

  // Sync Privy user to our user state and optionally to Supabase profile
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
        (account) => account.type === "wallet" && account.chainType === "solana"
      );

      const userData: User = {
        id: privyUser.id,
        email,
        wallet: embeddedSolanaWallet 
          ? { address: (embeddedSolanaWallet as any).address, chainType: "solana" }
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

      // Optionally sync to Supabase profiles table
      syncUserToSupabase(userData).catch(console.error);
    } else {
      setUser(null);
    }

    setIsLoading(false);
  }, [ready, authenticated, privyUser, solanaAddress]);

  // Sync user data to Supabase profiles table
  async function syncUserToSupabase(userData: User) {
    if (!userData.wallet?.address) return;

    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userData.id)
        .single();

      if (!existingProfile) {
        // Create new profile
        await supabase.from("profiles").insert({
          id: userData.id,
          username: userData.wallet.address.slice(0, 12),
          display_name: userData.displayName ?? userData.wallet.address.slice(0, 8),
          avatar_url: userData.avatarUrl,
          bio: null,
        });
      }
    } catch (error) {
      // Profile sync is optional, don't block auth
      console.warn("Failed to sync profile to Supabase:", error);
    }
  }

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
