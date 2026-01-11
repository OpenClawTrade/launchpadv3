import { useCallback, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { useToast } from '@/hooks/use-toast';

// Get a working Solana RPC URL (browser-friendly CORS)
const getRpcUrl = (): { url: string; source: string } => {
  const explicit = import.meta.env.VITE_HELIUS_RPC_URL;
  if (explicit && !explicit.includes('${')) {
    return { url: explicit, source: 'VITE_HELIUS_RPC_URL' };
  }

  const apiKey = import.meta.env.VITE_HELIUS_API_KEY;
  const hasKey = !!apiKey && apiKey.length > 10 && !apiKey.includes('${');
  console.log('[RPC] VITE_HELIUS_API_KEY present:', hasKey);
  if (hasKey) {
    return {
      url: `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
      source: 'VITE_HELIUS_API_KEY',
    };
  }

  // Public fallbacks (many providers block browser CORS or rate-limit aggressively).
  // Prefer endpoints known to work in the browser.
  return { url: 'https://rpc.ankr.com/solana', source: 'public_ankr' };
};

export function useSolanaWallet() {
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
    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
    return embeddedWallet;
  }, [wallets]);

  // Get any Solana wallet from useWallets
  const getSolanaWallet = useCallback(() => {
    // Prefer embedded wallet
    const embedded = getEmbeddedWallet();
    if (embedded) return embedded;

    // Fallback to any connected wallet
    return wallets[0] || null;
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

  const debug = {
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
  };

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
