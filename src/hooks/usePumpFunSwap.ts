import { useCallback } from 'react';
import { VersionedTransaction } from '@solana/web3.js';
import { supabase } from '@/integrations/supabase/client';
import { useSolanaWalletWithPrivy } from '@/hooks/useSolanaWalletPrivy';

interface PumpFunSwapResult {
  success: boolean;
  signature: string;
  outputAmount?: number;
}

export function usePumpFunSwap() {
  const { walletAddress, signAndSendTransaction } = useSolanaWalletWithPrivy();

  const swap = useCallback(async (
    mint: string,
    amount: number,
    isBuy: boolean,
    slippage: number = 10, // PumpPortal uses whole-number slippage (10 = 10%)
  ): Promise<PumpFunSwapResult> => {
    if (!walletAddress) throw new Error('Wallet not connected');

    console.log('[usePumpFunSwap] Requesting PumpPortal tx:', { mint, amount, isBuy, slippage });

    // Call edge function to get serialized transaction from PumpPortal
    const { data, error } = await supabase.functions.invoke('pumpfun-swap', {
      body: {
        publicKey: walletAddress,
        action: isBuy ? 'buy' : 'sell',
        mint,
        amount,
        denominatedInSol: isBuy ? 'true' : 'false',
        slippage,
        priorityFee: 0.0005,
      },
    });

    if (error) throw new Error(`PumpPortal swap failed: ${error.message}`);
    if (!data?.transaction) throw new Error('No transaction returned from PumpPortal');

    // Deserialize the base64 transaction
    const txBytes = Uint8Array.from(atob(data.transaction), c => c.charCodeAt(0));
    const transaction = VersionedTransaction.deserialize(txBytes);

    // Sign and send via Privy embedded wallet
    const { signature } = await signAndSendTransaction(transaction);

    console.log('[usePumpFunSwap] Swap confirmed:', signature);

    return {
      success: true,
      signature,
    };
  }, [walletAddress, signAndSendTransaction]);

  return { swap, walletAddress };
}
