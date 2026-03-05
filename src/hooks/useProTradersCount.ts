import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a map of mint_address -> count of distinct platform users who traded this token.
 * Uses launchpad_transactions table.
 */
export function useProTradersCount(mintAddresses: string[]) {
  return useQuery({
    queryKey: ["pro-traders-count", mintAddresses.slice(0, 10).join(",")],
    queryFn: async () => {
      if (mintAddresses.length === 0) return {} as Record<string, number>;
      
      // Query launchpad_transactions for tokens that have user_profile_id (platform users)
      const { data, error } = await supabase
        .from("launchpad_transactions")
        .select("token_id, user_profile_id")
        .not("user_profile_id", "is", null)
        .limit(1000);

      if (error) throw error;

      // Count distinct users per token
      const counts: Record<string, Set<string>> = {};
      for (const row of data ?? []) {
        if (!row.token_id || !row.user_profile_id) continue;
        if (!counts[row.token_id]) counts[row.token_id] = new Set();
        counts[row.token_id].add(row.user_profile_id);
      }

      const result: Record<string, number> = {};
      for (const [tokenId, users] of Object.entries(counts)) {
        result[tokenId] = users.size;
      }
      return result;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: mintAddresses.length > 0,
  });
}
