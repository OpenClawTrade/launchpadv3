import { useCallback, useState, useMemo } from 'react';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { useToast } from '@/hooks/use-toast';
import { usePrivyAvailable } from '@/providers/PrivyProviderWrapper';

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

  // Public fallbacks (many providers block browser CORS or rate-limit aggressively).
  // Use Ankr which is known to work with browser CORS
  return { url: 'https://rpc.ankr.com/solana', source: 'public_ankr' };
};

// Inner hook that uses Privy - MUST only be called inside PrivyProvider
export function useSolanaWalletWithPrivy() {
  // Import Privy hooks at runtime to avoid issues when called outside provider
  const { usePrivy, useWallets } = require('@privy-io/react-auth');
  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  const { url: rpcUrl, source: rpcSource } = getRpcUrl();

  // Get connection
  const getConnection = useCallback(() => {
    return new Connection(rpcUrl, 'confirmed');
  }, [rpcUrl]);

  // Get the Privy embedded wallet (primary) from useWallets
  const getEmbeddedWallet = useCallback(() => {
    const embeddedWallet = wallets?.find((w: any) => w.walletClientType === 'privy');
    return embeddedWallet;
  }, [wallets]);

  // Get any Solana wallet from useWallets
  const getSolanaWallet = useCallback(() => {
    // Prefer embedded wallet
    const embedded = getEmbeddedWallet();
    if (embedded) return embedded;

    // Fallback to any connected wallet
    return wallets?.[0] || null;
  }, [wallets, getEmbeddedWallet]);

  // IMPORTANT: Also check Privy user's linkedAccounts for wallet address
  // This is more reliable than useWallets() which can be empty initially
  const getWalletAddressFromPrivyUser = useCallback(() => {
    if (!user) return null;
    
    // Check linkedAccounts for Solana wallet
    const solanaWallet = (user as any).linkedAccounts?.find(
      (account: any) => account.type === 'wallet' && account.chainType === 'solana'
    );
    if (solanaWallet?.address) return solanaWallet.address;
    
    // Check embedded wallet on user object
    const embeddedWallet = (user as any).wallet;
    if (embeddedWallet?.address) return embeddedWallet.address;
    
    return null;
  }, [user]);

  // Get wallet address - prefer useWallets, fallback to linkedAccounts
  const walletAddress = getSolanaWallet()?.address || getWalletAddressFromPrivyUser() || null;

  // Check if wallet is ready
  const isWalletReady = ready && authenticated && !!walletAddress;

  // Sign and send transaction
  const signAndSendTransaction = useCallback(
    async (
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
          transaction.feePayer = wallet.address
            ? new (await import('@solana/web3.js')).PublicKey(wallet.address)
            : undefined;
        }

        // Get provider from wallet
        const provider = (wallet as any).getEthereumProvider?.() || wallet;

        if (!provider) {
          throw new Error('Could not get wallet provider');
        }

        // Sign transaction
        const signedTx = provider.signTransaction
          ? await provider.signTransaction(transaction)
          : transaction;

        // Send the signed transaction
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: options?.skipPreflight ?? true,
          preflightCommitment: 'confirmed',
        });

        console.log('[useSolanaWallet] Transaction sent:', signature);

        // Confirm transaction
        const confirmation = await connection.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          'confirmed'
        );

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
    },
    [getSolanaWallet, getConnection]
  );

  // Get SOL balance (legacy - returns 0 on error)
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

  // Get SOL balance (strict - surfaces errors to UI)
  const getBalanceStrict = useCallback(async (): Promise<number> => {
    if (!walletAddress) {
      throw new Error('No wallet address');
    }

    const connection = getConnection();
    const { PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
    const pubkey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  }, [walletAddress, getConnection]);

  // RPC connectivity test (helps debug RPC issues)
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
    privyReady: ready,
    authenticated,
    walletAddress,
    walletSource: getSolanaWallet()?.address
      ? 'useWallets'
      : getWalletAddressFromPrivyUser()
        ? 'linkedAccounts'
        : 'none',
    wallets: (wallets ?? []).map((w: any) => ({
      walletClientType: w.walletClientType,
      address: w.address,
    })),
    privyUserWallet: (user as any)?.wallet?.address ?? null,
    linkedAccountsCount: (user as any)?.linkedAccounts?.length ?? 0,
    linkedSolanaWallet: getWalletAddressFromPrivyUser(),
  }), [rpcUrl, rpcSource, ready, authenticated, walletAddress, wallets, user, getSolanaWallet, getWalletAddressFromPrivyUser]);

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
    rpcUrl,
    debug,
    testRpc,
    getConnection,
    getBalance,
    getBalanceStrict,
    getTokenBalance,
    signAndSendTransaction,
    getSolanaWallet,
    getEmbeddedWallet,
  };
}

// Fallback hook when Privy is not available - safe to call anywhere
export function useSolanaWalletFallback() {
  const { url: rpcUrl, source: rpcSource } = getRpcUrl();

  const getConnection = useCallback(() => {
    return new Connection(rpcUrl, 'confirmed');
  }, [rpcUrl]);

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
    privyReady: false,
    authenticated: false,
    walletAddress: null,
    walletSource: 'none',
    wallets: [],
    privyUserWallet: null,
    linkedAccountsCount: 0,
    linkedSolanaWallet: null,
  }), [rpcUrl, rpcSource]);

  return {
    walletAddress: null as string | null,
    isWalletReady: false,
    isConnecting: false,
    rpcUrl,
    debug,
    testRpc,
    getConnection,
    getBalance: async (): Promise<number> => 0,
    getBalanceStrict: async (): Promise<number> => { throw new Error('Wallet not connected'); },
    getTokenBalance: async (_mintAddress: string): Promise<number> => 0,
    signAndSendTransaction: async (): Promise<{ signature: string; confirmed: boolean }> => { 
      throw new Error('Wallet not connected'); 
    },
    getSolanaWallet: () => null,
    getEmbeddedWallet: () => null,
  };
}

// Main hook - uses the privyAvailable context to decide which implementation to use
// IMPORTANT: Components that call this must be inside PrivyProviderWrapper
export function useSolanaWallet() {
  const privyAvailable = usePrivyAvailable();
  
  if (!privyAvailable) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSolanaWalletFallback();
  }
  
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSolanaWalletWithPrivy();
}
