import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TopPerformer {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  creator_wallet: string;
  dbc_pool_address: string | null;
  mint_address: string | null;
  total_fees_24h: number;
  claim_count: number;
}

export function useFunTopPerformers(limit: number = 10) {
  return useQuery({
    queryKey: ["fun-top-performers", limit],
    queryFn: async (): Promise<TopPerformer[]> => {
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      // Get fee claims from last 24 hours, grouped by token
      const { data: claims, error } = await supabase
        .from("fun_fee_claims")
        .select(
          `
          fun_token_id,
          claimed_sol,
          fun_token:fun_tokens(id, name, ticker, image_url, creator_wallet, dbc_pool_address, mint_address)
        `
        )
        .gte("claimed_at", twentyFourHoursAgo)
        .not("fun_token_id", "is", null);

      if (error) throw error;

      // Aggregate fees by token
      const tokenFees: Record<
        string,
        { token: TopPerformer["id"]; totalFees: number; claimCount: number; tokenData: any }
      > = {};

      for (const claim of claims || []) {
        const tokenId = claim.fun_token_id;
        if (!tokenId || !claim.fun_token) continue;

        if (!tokenFees[tokenId]) {
          tokenFees[tokenId] = {
            token: tokenId,
            totalFees: 0,
            claimCount: 0,
            tokenData: claim.fun_token,
          };
        }
        tokenFees[tokenId].totalFees += claim.claimed_sol || 0;
        tokenFees[tokenId].claimCount += 1;
      }

      // Sort by total fees and take top N
      const sorted = Object.values(tokenFees)
        .sort((a, b) => b.totalFees - a.totalFees)
        .slice(0, limit);

      return sorted.map((item) => ({
        id: item.tokenData.id,
        name: item.tokenData.name,
        ticker: item.tokenData.ticker,
        image_url: item.tokenData.image_url,
        creator_wallet: item.tokenData.creator_wallet,
        dbc_pool_address: item.tokenData.dbc_pool_address,
        mint_address: item.tokenData.mint_address,
        total_fees_24h: item.totalFees,
        claim_count: item.claimCount,
      }));
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 4 * 60 * 1000, // Consider fresh for 4 minutes
  });
}
