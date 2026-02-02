import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AgentStats {
  totalMarketCap: number;
  totalAgentFeesEarned: number;
  totalTokensLaunched: number;
  totalVolume: number;
  totalAgents: number;
  totalAgentPosts: number;
}

export function useAgentStats() {
  return useQuery({
    queryKey: ["agent-stats"],
    queryFn: async (): Promise<AgentStats> => {
      const { data, error } = await supabase.functions.invoke("agent-stats");

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch agent stats");
      }

      return data.stats;
    },
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 2, // Refetch every 2 minutes
  });
}
