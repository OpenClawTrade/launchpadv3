import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AgentTokenSort = "new" | "hot" | "mcap" | "volume";

interface AgentToken {
  id: string;
  agentId: string;
  agentName: string;
  agentWallet: string;
  funTokenId: string;
  sourcePlatform: string;
  sourcePostUrl: string | null;
  createdAt: string;
  token: {
    id: string;
    name: string;
    ticker: string;
    mintAddress: string;
    description: string | null;
    imageUrl: string | null;
    marketCapSol: number;
    volume24hSol: number;
    priceChange24h: number;
    priceSol: number;
    holderCount: number;
    bondingProgress: number;
    createdAt: string;
  } | null;
}

interface UseAgentTokensOptions {
  sort?: AgentTokenSort;
  limit?: number;
}

export function useAgentTokens(options: UseAgentTokensOptions = {}) {
  const { sort = "new", limit = 50 } = options;

  return useQuery({
    queryKey: ["agent-tokens", sort, limit],
    queryFn: async (): Promise<AgentToken[]> => {
      const { data, error } = await supabase.functions.invoke("agent-tokens", {
        body: null,
        headers: {},
      });

      // The function expects query params, so we need to call it differently
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-tokens?sort=${sort}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch agent tokens");
      }

      return result.tokens;
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}
