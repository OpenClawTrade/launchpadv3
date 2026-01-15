import { useState, useCallback } from 'react';
import { useMeteoraApi } from './useMeteoraApi';
import { useSolanaWallet } from './useSolanaWallet';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SwapParams {
  mintAddress: string;
  amount: number;
  isBuy: boolean;
  slippageBps?: number;
}

interface SwapResult {
  success: boolean;
  signature?: string;
  tokensOut: number;
  solOut: number;
  newPrice: number;
  graduated: boolean;
}

export function useSwap() {
  const { executeSwap } = useMeteoraApi();
  const { walletAddress, isWalletReady, getBalance, getTokenBalance, signAndSendTransaction } = useSolanaWallet();
  const { profileId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSwapping, setIsSwapping] = useState(false);

  const swap = useCallback(async (params: SwapParams): Promise<SwapResult> => {
    if (!isWalletReady || !walletAddress) {
      throw new Error('Wallet not connected');
    }

    if (params.amount <= 0) {
      throw new Error('Invalid amount');
    }

    setIsSwapping(true);

    try {
      console.log('[useSwap] Executing swap:', params);

      // For sells, verify balance
      if (!params.isBuy) {
        const tokenBalance = await getTokenBalance(params.mintAddress);
        if (tokenBalance < params.amount) {
          throw new Error(`Insufficient token balance. You have ${tokenBalance.toFixed(2)} tokens.`);
        }
      }

      // For buys, verify SOL balance
      if (params.isBuy) {
        const solBalance = await getBalance();
        if (solBalance < params.amount + 0.01) { // Add buffer for fees
          throw new Error(`Insufficient SOL balance. You have ${solBalance.toFixed(4)} SOL.`);
        }
      }

      // Execute swap via API (returns transaction to sign)
      const result = await executeSwap({
        mintAddress: params.mintAddress,
        userWallet: walletAddress,
        amount: params.amount,
        isBuy: params.isBuy,
        slippageBps: params.slippageBps || 500,
        profileId: profileId || undefined,
      });

      if (!result.success) {
        throw new Error('Swap failed');
      }

      console.log('[useSwap] Swap completed:', result);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['launchpad-token', params.mintAddress] });
      queryClient.invalidateQueries({ queryKey: ['launchpad-tokens'] });
      queryClient.invalidateQueries({ queryKey: ['user-holdings', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['launchpad-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['launchpad-holders'] });

      const action = params.isBuy ? 'bought' : 'sold';
      const amount = params.isBuy ? result.tokensOut : result.solOut;
      const unit = params.isBuy ? 'tokens' : 'SOL';

      toast({
        title: `Swap successful!`,
        description: `You ${action} ${amount.toFixed(params.isBuy ? 2 : 6)} ${unit}`,
      });

      if (result.graduated) {
        toast({
          title: '🎓 Token Graduated!',
          description: 'This token has reached the graduation threshold!',
        });
      }

      return {
        success: true,
        signature: result.signature,
        tokensOut: result.tokensOut,
        solOut: result.solOut,
        newPrice: result.newPrice,
        graduated: result.graduated,
      };

    } catch (error) {
      console.error('[useSwap] Error:', error);
      
      toast({
        title: 'Swap failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });

      throw error;
    } finally {
      setIsSwapping(false);
    }
  }, [isWalletReady, walletAddress, profileId, executeSwap, getBalance, getTokenBalance, queryClient, toast]);

  return {
    swap,
    isSwapping,
    isReady: isWalletReady,
  };
}
