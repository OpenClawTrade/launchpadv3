import { useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/integrations/supabase/client";

interface BnbSwapResult {
  success: boolean;
  txHash?: string;
  error?: string;
  explorerUrl?: string;
  route?: string;
}

export function useBnbSwap() {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = usePrivy();

  const executeBnbSwap = useCallback(async (
    tokenAddress: string,
    action: "buy" | "sell",
    amount: number,
    userWallet: string,
    slippage = 3,
  ): Promise<BnbSwapResult> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("bnb-swap", {
        body: {
          tokenAddress,
          action,
          amount: amount.toString(),
          userWallet,
          privyUserId: user?.id || undefined,
          slippage,
        },
      });

      if (error) throw new Error(error.message || "Swap failed");
      if (!data?.success) throw new Error(data?.error || "Swap failed");

      return {
        success: true,
        txHash: data.txHash,
        explorerUrl: data.explorerUrl,
        route: data.route,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Unknown error",
      };
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  return { executeBnbSwap, isLoading };
}
