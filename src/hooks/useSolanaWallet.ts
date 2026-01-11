import { useCallback, useMemo } from 'react';
import { Connection } from '@solana/web3.js';
import { useAuth } from '@/contexts/AuthContext';

// Get a working Solana RPC URL (browser-friendly CORS)
export const getRpcUrl = (): { url: string; source: string } => {
  const explicit = import.meta.env.VITE_HELIUS_RPC_URL;
  if (explicit && !explicit.includes('${')) {
    return { url: explicit, source: 'VITE_HELIUS_RPC_URL' };
  }

  const apiKey = import.meta.env.VITE_HELIUS_API_KEY;
  const hasKey = !!apiKey && apiKey.length > 10 && !apiKey.includes('${');
  if (hasKey) {
    return {
      url: `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
      source: 'VITE_HELIUS_API_KEY',
    };
  }

  return { url: 'https://rpc.ankr.com/solana', source: 'public_ankr' };
};

// Simple wallet hook that gets wallet from AuthContext (works without direct Privy hooks)
export function useSolanaWallet() {
  const { user } = useAuth();
  const { url: rpcUrl, source: rpcSource } = getRpcUrl();
  
  // Get wallet address from AuthContext user (synced from Privy via wallet property)
  const walletAddress = (user as any)?.wallet || null;
  const isWalletReady = !!walletAddress;

  const getConnection = useCallback(() => {
    return new Connection(rpcUrl, 'confirmed');
  }, [rpcUrl]);

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

  const getBalanceStrict = useCallback(async (): Promise<number> => {
    if (!walletAddress) throw new Error('No wallet address');
    const connection = getConnection();
    const { PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
    const pubkey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  }, [walletAddress, getConnection]);

  const getTokenBalance = useCallback(async (_mintAddress: string): Promise<number> => {
    // Token balances tracked in database for bonding curve tokens
    return 0;
  }, []);

  const testRpc = useCallback(async () => {
    const connection = getConnection();
    const started = performance.now();
    const version = await connection.getVersion();
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    return {
      rpcUrl,
      rpcSource,
      version: version['solana-core'],
      blockhash,
      latencyMs: Math.round(performance.now() - started),
    };
  }, [getConnection, rpcUrl, rpcSource]);

  const debug = useMemo(() => ({
    rpcUrl,
    rpcSource,
    privyReady: true,
    authenticated: !!user,
    walletAddress,
    walletSource: walletAddress ? 'AuthContext' : 'none',
    wallets: [],
    privyUserWallet: walletAddress,
    linkedAccountsCount: 0,
    linkedSolanaWallet: walletAddress,
  }), [rpcUrl, rpcSource, user, walletAddress]);

  return {
    walletAddress,
    isWalletReady,
    isConnecting: false,
    rpcUrl,
    debug,
    testRpc,
    getConnection,
    getBalance,
    getBalanceStrict,
    getTokenBalance,
    signAndSendTransaction: async () => { throw new Error('Use Privy wallet for signing'); },
    getSolanaWallet: () => null,
    getEmbeddedWallet: () => null,
  };
}

export { useSolanaWalletWithPrivy } from './useSolanaWalletPrivy';
