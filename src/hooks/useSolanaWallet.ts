import { useCallback, useState, useMemo } from 'react';
import { Connection, Transaction, VersionedTransaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useToast } from '@/hooks/use-toast';
import { usePrivyAvailable } from '@/providers/PrivyProviderWrapper';
import { useAuth } from '@/contexts/AuthContext';

// Get Helius RPC URL
const getHeliusRpcUrl = () => {
  const apiKey = import.meta.env.VITE_HELIUS_API_KEY;
  if (apiKey && !apiKey.includes('${')) {
    return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  }
  // Fallback to public RPC
  return 'https://api.mainnet-beta.solana.com';
};

// Wrapper hook that safely uses Privy hooks only when available
function usePrivyWallets() {
  const privyAvailable = usePrivyAvailable();
  
  // These will be dynamically imported and used only when Privy is available
  const [privyHooks, setPrivyHooks] = useState<{
    usePrivy: any;
    useWallets: any;
  } | null>(null);
  
  // Load Privy hooks dynamically when available
  useMemo(() => {
    if (privyAvailable && !privyHooks) {
      import('@privy-io/react-auth').then((mod) => {
        setPrivyHooks({
          usePrivy: mod.usePrivy,
          useWallets: mod.useWallets,
        });
      });
    }
  }, [privyAvailable, privyHooks]);
  
  return { privyAvailable, privyHooks };
}

export function useSolanaWallet() {
  const { toast } = useToast();
  const { solanaAddress, ready: authReady, isAuthenticated } = useAuth();
  const privyAvailable = usePrivyAvailable();
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Use the wallet address from AuthContext (which already extracts it from Privy)
  // This avoids the need to call useWallets directly
  const walletAddress = solanaAddress;
  
  // Get connection
  const getConnection = useCallback(() => {
    return new Connection(getHeliusRpcUrl(), 'confirmed');
  }, []);
  
  // Check if wallet is ready - use AuthContext state
  const isWalletReady = authReady && isAuthenticated && !!walletAddress;
  
  // Sign and send transaction - requires dynamic import of Privy
  const signAndSendTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction,
    options?: { skipPreflight?: boolean }
  ): Promise<{ signature: string; confirmed: boolean }> => {
    if (!walletAddress) {
      throw new Error('No wallet connected');
    }
    
    if (!privyAvailable) {
      throw new Error('Privy is not available');
    }
    
    const connection = getConnection();
    
    try {
      setIsConnecting(true);
      
      // Dynamically get wallet from Privy
      const { useWallets } = await import('@privy-io/react-auth');
      // Note: We can't call hooks here, so we need a different approach
      // For now, we'll use a workaround - the transaction should be prepared externally
      
      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      
      // Update transaction blockhash if legacy transaction
      if (!('version' in transaction)) {
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = new PublicKey(walletAddress);
      }
      
      // For signing, we need the wallet provider - this would typically be handled
      // by the component that calls this function
      throw new Error('Transaction signing should be handled by the calling component with access to wallet provider');
      
    } catch (error) {
      console.error('[useSolanaWallet] Transaction error:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [walletAddress, getConnection, privyAvailable]);
  
  // Get SOL balance
  const getBalance = useCallback(async (): Promise<number> => {
    if (!walletAddress) return 0;
    
    try {
      const connection = getConnection();
      const pubkey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(pubkey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('[useSolanaWallet] Balance error:', error);
      return 0;
    }
  }, [walletAddress, getConnection]);
  
  // Get token balance (simplified - fetch from database)
  const getTokenBalance = useCallback(async (mintAddress: string): Promise<number> => {
    // Token balances are tracked in the database for bonding curve tokens
    // For graduated tokens, would need to query on-chain
    return 0;
  }, []);
  
  return {
    walletAddress,
    isWalletReady,
    isConnecting,
    getConnection,
    getBalance,
    getTokenBalance,
    signAndSendTransaction,
    // These are no longer available without Privy hooks
    getSolanaWallet: useCallback(() => null, []),
    getEmbeddedWallet: useCallback(() => null, []),
  };
}
