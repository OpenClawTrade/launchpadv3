import { useState, useCallback } from 'react';
import { useMeteoraApi } from './useMeteoraApi';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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

export function useTokenLaunch() {
  const { createPool } = useMeteoraApi();
  const { walletAddress, isWalletReady } = useSolanaWallet();
  const { user, profileId } = useAuth();
  const { toast } = useToast();
  const [isLaunching, setIsLaunching] = useState(false);

  const launchToken = useCallback(async (params: LaunchTokenParams): Promise<LaunchResult> => {
    if (!isWalletReady || !walletAddress) {
      throw new Error('Wallet not connected');
    }

    setIsLaunching(true);

    try {
      console.log('[useTokenLaunch] Launching token:', params);

      // Upload image if it's a File/Blob
      let imageUrl = params.imageUrl;
      
      // Call the Meteora API to create the pool
      const result = await createPool({
        creatorWallet: walletAddress,
        privyUserId: user?.privyId,
        name: params.name,
        ticker: params.ticker.toUpperCase(),
        description: params.description,
        imageUrl,
        websiteUrl: params.websiteUrl,
        twitterUrl: params.twitterUrl,
        telegramUrl: params.telegramUrl,
        discordUrl: params.discordUrl,
        initialBuySol: params.initialBuySol,
      });

      if (!result.success) {
        throw new Error('Failed to create token');
      }

      console.log('[useTokenLaunch] Token created:', result);

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
