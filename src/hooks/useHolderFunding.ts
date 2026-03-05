import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HolderFundingResult {
  fundingSource: string | null;
  fundingAmount: number;
  fundingTimestamp: number | null;
  age: string | null;
  totalTxChecked: number;
}

export function useHolderFunding(walletAddress: string | null, enabled: boolean) {
  return useQuery<HolderFundingResult>({
    queryKey: ["holder-funding", walletAddress],
    queryFn: async () => {
      const fallback: HolderFundingResult = {
        fundingSource: null,
        fundingAmount: 0,
        fundingTimestamp: null,
        age: null,
        totalTxChecked: 0,
      };

      const { data, error } = await supabase.functions.invoke("holder-funding", {
        body: { walletAddress },
      });

      if (error) {
        console.error("[useHolderFunding] invoke error:", error);
        return fallback;
      }

      if (!data || typeof data !== "object") return fallback;
      return { ...fallback, ...(data as Partial<HolderFundingResult>) };
    },
    enabled: !!walletAddress && enabled,
    staleTime: 300_000, // 5 min cache
    retry: 0,
  });
}
