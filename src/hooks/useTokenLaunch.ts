import { useState, useCallback } from 'react';
import { useMeteoraApi } from './useMeteoraApi';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Transaction, VersionedTransaction } from '@solana/web3.js';

interface LaunchTokenParams {
  name: string;
  ticker: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
  initialBuySol?: number;
}

interface LaunchResult {
  success: boolean;
  tokenId: string;
  mintAddress: string;
  dbcPoolAddress: string | null;
}

type SignTransactionFn = (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;

export function useTokenLaunch() {
  const { createPool } = useMeteoraApi();
  const { walletAddress, isWalletReady } = useSolanaWallet();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLaunching, setIsLaunching] = useState(false);

  // Launch token - accepts signTransaction from caller (component level)
  const launchToken = useCallback(async (
    params: LaunchTokenParams,
    signTransaction?: SignTransactionFn
  ): Promise<LaunchResult> => {
    if (!isWalletReady || !walletAddress) {
      throw new Error('Wallet not connected');
    }

    if (!signTransaction) {
      throw new Error('No wallet signer provided');
    }

    setIsLaunching(true);

    try {

      // Call the Meteora API to create the pool with signing function
      const result = await createPool(
        {
          creatorWallet: walletAddress,
          privyUserId: user?.privyId,
          name: params.name,
          ticker: params.ticker.toUpperCase(),
          description: params.description,
          imageUrl: params.imageUrl,
          websiteUrl: params.websiteUrl,
          twitterUrl: params.twitterUrl,
          telegramUrl: params.telegramUrl,
          discordUrl: params.discordUrl,
          initialBuySol: params.initialBuySol,
        },
        signTransaction
      );

      if (!result.success) {
        throw new Error('Failed to create token');
      }

      toast({
        title: 'Token Created! 🚀',
        description: `${params.name} ($${params.ticker.toUpperCase()}) is now live!`,
      });

      return {
        success: true,
        tokenId: result.tokenId,
        mintAddress: result.mintAddress,
        dbcPoolAddress: result.dbcPoolAddress,
      };

    } catch (error) {
      console.error('[useTokenLaunch] Error:', error);
      
      toast({
        title: 'Failed to launch token',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });

      throw error;
    } finally {
      setIsLaunching(false);
    }
  }, [isWalletReady, walletAddress, user, createPool, toast]);

  return {
    launchToken,
    isLaunching,
    isReady: isWalletReady,
  };
}
