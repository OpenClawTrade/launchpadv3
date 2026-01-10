import { useCallback, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { useToast } from '@/hooks/use-toast';

// Get Helius RPC URL
const getHeliusRpcUrl = () => {
  const apiKey = import.meta.env.VITE_HELIUS_API_KEY;
  if (apiKey && !apiKey.includes('${')) {
    return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  }
  // Fallback to public RPC
  return 'https://api.mainnet-beta.solana.com';
};

export function useSolanaWallet() {
  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Get connection
  const getConnection = useCallback(() => {
    return new Connection(getHeliusRpcUrl(), 'confirmed');
  }, []);
  
  // Get the Privy embedded wallet (primary)
  const getEmbeddedWallet = useCallback(() => {
    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
    return embeddedWallet;
  }, [wallets]);
  
  // Get any Solana wallet
  const getSolanaWallet = useCallback(() => {
    // Prefer embedded wallet
    const embedded = getEmbeddedWallet();
    if (embedded) return embedded;
    
    // Fallback to any connected wallet
    return wallets[0] || null;
  }, [wallets, getEmbeddedWallet]);
  
  // Get wallet address
  const walletAddress = getSolanaWallet()?.address || null;
  
  // Check if wallet is ready
  const isWalletReady = ready && authenticated && !!walletAddress;
  
  // Sign and send transaction
  const signAndSendTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction,
    options?: { skipPreflight?: boolean }
  ): Promise<{ signature: string; confirmed: boolean }> => {
    const wallet = getSolanaWallet();
    if (!wallet) {
      throw new Error('No wallet connected');
    }
    
    const connection = getConnection();
    
    try {
      setIsConnecting(true);
      
      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      
      // Update transaction blockhash
      if (!('version' in transaction)) {
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.address ? 
          new (await import('@solana/web3.js')).PublicKey(wallet.address) : 
          undefined;
      }
      
      // Get provider from wallet
      const provider = await (wallet as any).getEthereumProvider?.() || wallet;
      
      if (!provider) {
        throw new Error('Could not get wallet provider');
      }
      
      // Sign transaction
      const signedTx = provider.signTransaction 
        ? await provider.signTransaction(transaction)
        : transaction;
      
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(
        signedTx.serialize(),
        {
          skipPreflight: options?.skipPreflight ?? true,
          preflightCommitment: 'confirmed',
        }
      );
      
      console.log('[useSolanaWallet] Transaction sent:', signature);
      
      // Confirm transaction
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
      
      console.log('[useSolanaWallet] Transaction confirmed:', signature);
      
      return { signature, confirmed: true };
      
    } catch (error) {
      console.error('[useSolanaWallet] Transaction error:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [getSolanaWallet, getConnection]);
  
  // Get SOL balance
  const getBalance = useCallback(async (): Promise<number> => {
    if (!walletAddress) return 0;
    
    try {
      const connection = getConnection();
      const { PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
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
    getSolanaWallet,
    getEmbeddedWallet,
  };
}
