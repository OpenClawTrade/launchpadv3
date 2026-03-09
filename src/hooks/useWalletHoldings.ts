import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TokenHolding {
  mint: string;
  balance: number;
  decimals: number;
}

export function useWalletHoldings(walletAddress: string | null | undefined) {
  return useQuery<TokenHolding[]>({
    queryKey: ["wallet-holdings", walletAddress],
    enabled: !!walletAddress,
    refetchInterval: 30_000,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "fetch-wallet-holdings",
        { body: { walletAddress } }
      );
      if (error) throw error;
      return (data?.holdings ?? []) as TokenHolding[];
    },
  });
}
