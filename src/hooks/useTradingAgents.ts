import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CreateAgentInput {
  name?: string;
  ticker?: string;
  description?: string;
  strategy: "conservative" | "balanced" | "aggressive";
  personalityPrompt?: string;
  creatorWallet?: string;
   avatarUrl?: string;
   twitterUrl?: string;
}

export interface TradingAgent {
  id: string;
  name: string;
  ticker: string;
  description: string | null;
  avatar_url: string | null;
  wallet_address: string;
  trading_capital_sol: number;
  total_invested_sol: number;
  total_profit_sol: number;
  unrealized_pnl_sol: number;
  win_rate: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  strategy_type: string;
  stop_loss_pct: number;
  take_profit_pct: number;
  max_concurrent_positions: number;
  consecutive_wins: number;
  consecutive_losses: number;
  best_trade_sol: number;
  worst_trade_sol: number;
  avg_hold_time_minutes: number;
  preferred_narratives: string[] | null;
  status: string;
  created_at: string;
  openPositions?: number;
  roi?: string;
  funding_progress?: number;
  is_funded?: boolean;
  last_deposit_at?: string | null;
  agent?: {
    id: string;
    name: string;
    avatar_url: string | null;
    karma: number;
  };
   mint_address?: string | null;
   twitter_url?: string | null;
}

export interface TradingPosition {
  id: string;
  trading_agent_id: string;
  token_address: string;
  token_name: string | null;
  token_symbol: string | null;
  token_image_url: string | null;
  entry_price_sol: number;
  current_price_sol: number | null;
  amount_tokens: number;
  investment_sol: number;
  current_value_sol: number | null;
  unrealized_pnl_sol: number;
  unrealized_pnl_pct: number;
  realized_pnl_sol: number | null;
  entry_reason: string | null;
  entry_narrative: string | null;
  exit_reason: string | null;
  target_price_sol: number | null;
  stop_loss_price_sol: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

export interface TradingTrade {
  id: string;
  trading_agent_id: string;
  position_id: string | null;
  token_address: string;
  token_name: string | null;
  trade_type: string;
  amount_sol: number;
  amount_tokens: number;
  price_per_token: number;
  signature: string | null;
  buy_signature: string | null;
  verified_pnl_sol: number | null;
  verified_at: string | null;
  strategy_used: string | null;
  narrative_match: string | null;
  token_score: number | null;
  entry_analysis: string | null;
  exit_analysis: string | null;
  ai_reasoning: string | null;
  market_context: string | null;
  lessons_learned: string | null;
  confidence_score: number;
  status: string;
  created_at: string;
  subtuna_post_id: string | null;
}

export function useTradingAgents(options?: {
  sortBy?: string;
  status?: string;
  strategy?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["trading-agents", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.sortBy) params.set("sortBy", options.sortBy);
      if (options?.status) params.set("status", options.status);
      if (options?.strategy) params.set("strategy", options.strategy);
      if (options?.limit) params.set("limit", String(options.limit));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trading-agent-list?${params}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch trading agents");
      }

      const data = await response.json();
      return data.data as TradingAgent[];
    },
    staleTime: 30 * 1000,
  });
}

export function useTradingAgent(id: string) {
  return useQuery({
    queryKey: ["trading-agent", id],
    queryFn: async () => {
      console.log("[useTradingAgent] Fetching agent:", id);
      
      const { data, error } = await supabase
        .from("trading_agents")
        .select(`
          *,
          agent:agents!trading_agents_agent_id_fkey(id, name, avatar_url, karma)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("[useTradingAgent] Error:", error);
        throw error;
      }
      
      console.log("[useTradingAgent] Result:", data);
      return data as TradingAgent;
    },
    enabled: !!id && id.length === 36, // Only run for valid UUIDs
    staleTime: 30_000,
    retry: 2,
  });
}

export function useTradingAgentPositions(agentId: string, status?: "open" | "closed" | "all") {
  return useQuery({
    queryKey: ["trading-agent-positions", agentId, status],
    queryFn: async () => {
      let query = supabase
        .from("trading_agent_positions")
        .select("*")
        .eq("trading_agent_id", agentId)
        .order("opened_at", { ascending: false });

      if (status && status !== "all") {
        if (status === "open") {
          query = query.eq("status", "open");
        } else {
          query = query.neq("status", "open");
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TradingPosition[];
    },
    enabled: !!agentId,
  });
}

export function useTradingAgentTrades(agentId: string, limit = 50) {
  return useQuery({
    queryKey: ["trading-agent-trades", agentId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trading_agent_trades")
        .select("*")
        .eq("trading_agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as TradingTrade[];
    },
    enabled: !!agentId,
  });
}

export function useTradingAgentLeaderboard(limit = 20) {
  return useQuery({
    queryKey: ["trading-agent-leaderboard", limit],
    queryFn: async () => {
      // Query both tables and merge
      const [oldResult, newResult] = await Promise.all([
        supabase
          .from("trading_agents")
          .select(`id, name, ticker, avatar_url, trading_capital_sol, total_profit_sol, win_rate, total_trades, strategy_type, status, agent:agents(id, name, avatar_url)`)
          .eq("status", "active")
          .order("total_profit_sol", { ascending: false, nullsFirst: false })
          .limit(limit),
        supabase
          .from("claw_trading_agents")
          .select(`id, name, ticker, avatar_url, trading_capital_sol, total_profit_sol, win_rate, total_trades, strategy_type, status, agent:claw_agents(id, name, avatar_url)`)
          .eq("status", "active")
          .order("total_profit_sol", { ascending: false, nullsFirst: false })
          .limit(limit),
      ]);

      const data = [...(oldResult.data || []), ...(newResult.data || [])]
        .sort((a, b) => (b.total_profit_sol || 0) - (a.total_profit_sol || 0))
        .slice(0, limit);
      const error = oldResult.error || newResult.error;

      if (error) throw error;
      
      return data.map((agent, index) => ({
        ...agent,
        rank: index + 1,
        roi: agent.trading_capital_sol > 0
          ? ((agent.total_profit_sol || 0) / agent.trading_capital_sol * 100).toFixed(2)
          : "0.00",
      }));
    },
    staleTime: 60 * 1000,
  });
}

export function useStrategyReviews(agentId: string) {
  return useQuery({
    queryKey: ["trading-agent-reviews", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trading_agent_strategy_reviews")
        .select("*")
        .eq("trading_agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });
}

export function useCreateTradingAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAgentInput) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trading-agent-create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(data),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create trading agent");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trading-agents"] });
      queryClient.invalidateQueries({ queryKey: ["trading-agent-leaderboard"] });
    },
  });
}
