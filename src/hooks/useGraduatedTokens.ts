import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FunToken } from "@/hooks/useFunTokensPaginated";

const DEFAULT_LIVE = {
  holder_count: 0,
  market_cap_sol: 30,
  bonding_progress: 0,
  price_sol: 0.00000003,
};

export function useGraduatedTokens() {
  const { data, isLoading } = useQuery({
    queryKey: ["graduated-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fun_tokens")
        .select(`
          id, name, ticker, description, image_url, creator_wallet, twitter_url, website_url,
          twitter_avatar_url, twitter_verified, twitter_verified_type,
          mint_address, dbc_pool_address, status, price_sol, price_change_24h, volume_24h_sol,
          total_fees_earned, holder_count, market_cap_sol, bonding_progress,
          trading_fee_bps, fee_mode, agent_id, launchpad_type, last_distribution_at, created_at, updated_at
        `)
        .eq("status", "graduated")
        .order("market_cap_sol", { ascending: false });

      if (error) throw error;

      return (data || []).map((t) => ({
        ...t,
        holder_count: t.holder_count ?? DEFAULT_LIVE.holder_count,
        market_cap_sol: t.market_cap_sol ?? DEFAULT_LIVE.market_cap_sol,
        bonding_progress: t.bonding_progress ?? DEFAULT_LIVE.bonding_progress,
        price_sol: t.price_sol ?? DEFAULT_LIVE.price_sol,
      })) as FunToken[];
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });

  return { tokens: data ?? [], isLoading };
}
