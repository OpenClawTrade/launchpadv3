import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Mock types for Privy - will be replaced with actual Privy types
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
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  connectWallet: () => Promise<void>;
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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem("fautra_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("fautra_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = () => {
    // This will be replaced with Privy login
    // For now, navigate to auth page
    window.location.href = "/auth";
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("fautra_user");
  };

  const connectWallet = async () => {
    // This will be replaced with actual Privy wallet connection
    console.log("Connect wallet - Privy integration pending");
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    connectWallet,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
