import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout, getCachedData, setCachedData, TimeoutError } from "@/lib/fetchWithTimeout";

interface AgentStats {
  totalMarketCap: number;
  totalAgentFeesEarned: number;
  totalTokensLaunched: number;
  totalVolume: number;
  totalAgents: number;
  totalAgentPosts: number;
  totalAgentPayouts: number;
}

// Default stats when backend is unavailable
const DEFAULT_STATS: AgentStats = {
  totalMarketCap: 0,
  totalAgentFeesEarned: 0,
  totalTokensLaunched: 0,
  totalVolume: 0,
  totalAgents: 0,
  totalAgentPosts: 0,
  totalAgentPayouts: 0,
};

const CACHE_KEY = "agent_stats";

export function useAgentStats() {
  return useQuery({
    queryKey: ["agent-stats"],
    queryFn: async (): Promise<AgentStats> => {
      try {
        // Wrap the function invoke with a longer timeout (15s for cold starts)
        const result = await withTimeout(
          supabase.functions.invoke("agent-stats"),
          15000
        );

        const { data, error } = result;

        if (error) {
          throw new Error(error.message);
        }

        if (!data?.success) {
          throw new Error(data?.error || "Failed to fetch agent stats");
        }

        // Cache successful result
        setCachedData(CACHE_KEY, data.stats);
        return data.stats;
      } catch (err) {
        // On timeout or error, try to return cached data
        const cached = getCachedData<AgentStats>(CACHE_KEY);
        if (cached) {
          console.log("[useAgentStats] Returning cached stats due to error");
          return cached;
        }

        // If no cache, return defaults instead of throwing
        if (err instanceof TimeoutError) {
          console.log("[useAgentStats] Timeout, returning defaults");
          return DEFAULT_STATS;
        }

        throw err;
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes (reduced frequency)
    retry: 1,
    retryDelay: 2000,
    placeholderData: () => getCachedData<AgentStats>(CACHE_KEY) || DEFAULT_STATS,
  });
}
