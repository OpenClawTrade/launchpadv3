import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FunFeeClaim {
  id: string;
  fun_token_id: string;
  pool_address: string;
  claimed_sol: number;
  signature: string | null;
  claimed_at: string;
  fun_token?: {
    name: string;
    ticker: string;
    image_url: string | null;
    creator_wallet: string;
  };
}

export interface FunDistribution {
  id: string;
  fun_token_id: string;
  creator_wallet: string;
  amount_sol: number;
  signature: string | null;
  status: string;
  distribution_type: string;
  created_at: string;
  fun_token?: {
    name: string;
    ticker: string;
    image_url: string | null;
  };
}

export interface FunBuyback {
  id: string;
  fun_token_id: string;
  amount_sol: number;
  tokens_bought: number | null;
  signature: string | null;
  status: string;
  created_at: string;
  fun_token?: {
    name: string;
    ticker: string;
    image_url: string | null;
  };
}

export function useFunFeeClaims() {
  return useQuery({
    queryKey: ["fun-fee-claims"],
    queryFn: async (): Promise<FunFeeClaim[]> => {
      const { data, error } = await supabase
        .from("fun_fee_claims")
        .select(`
          *,
          fun_token:fun_tokens(name, ticker, image_url, creator_wallet)
        `)
        .order("claimed_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        fun_token: item.fun_token,
      }));
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useFunDistributions() {
  return useQuery({
    queryKey: ["fun-distributions"],
    queryFn: async (): Promise<FunDistribution[]> => {
      const { data, error } = await supabase
        .from("fun_distributions")
        .select(`
          *,
          fun_token:fun_tokens(name, ticker, image_url)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        fun_token: item.fun_token,
      }));
    },
    refetchInterval: 60000,
  });
}

export function useFunBuybacks() {
  return useQuery({
    queryKey: ["fun-buybacks"],
    queryFn: async (): Promise<FunBuyback[]> => {
      const { data, error } = await supabase
        .from("fun_buybacks")
        .select(`
          *,
          fun_token:fun_tokens(name, ticker, image_url)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        fun_token: item.fun_token,
      }));
    },
    refetchInterval: 60000,
  });
}
