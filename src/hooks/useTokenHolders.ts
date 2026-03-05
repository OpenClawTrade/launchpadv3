import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HolderInfo {
  address: string;
  tokenAmount: number;
  percentage: number;
  solBalance: number;
}

export interface TokenHoldersResult {
  holders: HolderInfo[];
  count: number;
  totalSupply: number;
  decimals: number;
  pages: number;
}

export function useTokenHolders(mintAddress: string, enabled: boolean) {
  return useQuery<TokenHoldersResult>({
    queryKey: ["token-holders", mintAddress],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-token-holders", {
        body: { mintAddress },
      });
      if (error) throw error;
      return data as TokenHoldersResult;
    },
    enabled: !!mintAddress && enabled,
    refetchInterval: enabled ? 30000 : false,
    staleTime: 15000,
  });
}
