import { useCallback, useMemo } from 'react';
import { Connection } from '@solana/web3.js';
import { useAuth } from '@/contexts/AuthContext';

// Get a working Solana RPC URL
// Priority: VITE_HELIUS_RPC_URL > VITE_HELIUS_API_KEY > runtime config > PublicNode fallback
let lastRpcSourceLogged: string | null = null;

const logRpcSource = (source: string) => {
  if (lastRpcSourceLogged === source) return;
  lastRpcSourceLogged = source;

  if (source === 'publicnode_fallback') {
    console.warn('[RPC] No Helius config found, using PublicNode fallback');
    return;
  }

  console.log(`[RPC] Using ${source}`);
};

export const getRpcUrl = (): { url: string; source: string } => {
  // Debug: Log env presence at startup (only in dev)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log('[RPC Config]', {
      VITE_HELIUS_RPC_URL: import.meta.env.VITE_HELIUS_RPC_URL ? 'SET' : 'NOT SET',
      VITE_HELIUS_API_KEY: import.meta.env.VITE_HELIUS_API_KEY ? 'SET' : 'NOT SET',
    });
  }

  // Option 1: Direct RPC URL
  const explicitUrl = import.meta.env.VITE_HELIUS_RPC_URL;
  if (explicitUrl && typeof explicitUrl === 'string' && explicitUrl.startsWith('https://')) {
    logRpcSource('VITE_HELIUS_RPC_URL');
    return { url: explicitUrl, source: 'VITE_HELIUS_RPC_URL' };
  }

  // Option 2: Build URL from API key
  const apiKey = import.meta.env.VITE_HELIUS_API_KEY;
  if (apiKey && typeof apiKey === 'string' && apiKey.length > 10 && !apiKey.includes('$')) {
    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    logRpcSource('VITE_HELIUS_API_KEY');
    return { url, source: 'VITE_HELIUS_API_KEY' };
  }

  // Option 3: Runtime config (set by RuntimeConfigBootstrap)
  if (typeof window !== 'undefined') {
    const runtimeUrl =
      ((window as any)?.__PUBLIC_CONFIG__?.heliusRpcUrl as string | undefined) ||
      localStorage.getItem('heliusRpcUrl') ||
      '';

    if (runtimeUrl && runtimeUrl.startsWith('https://') && !runtimeUrl.includes('${')) {
      logRpcSource('runtime_public_config');
      return { url: runtimeUrl, source: 'runtime_public_config' };
    }
  }

  // Fallback: PublicNode (CORS-friendly, no auth)
  logRpcSource('publicnode_fallback');
  return { url: 'https://solana.publicnode.com', source: 'publicnode_fallback' };
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
