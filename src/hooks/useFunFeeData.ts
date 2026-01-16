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

export function useFunFeeClaims(params?: { page?: number; pageSize?: number }) {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: ["fun-fee-claims", page, pageSize],
    queryFn: async (): Promise<{ items: FunFeeClaim[]; count: number }> => {
      const { data, error, count } = await supabase
        .from("fun_fee_claims")
        .select(
          `
          *,
          fun_token:fun_tokens(name, ticker, image_url, creator_wallet)
        `,
          { count: "exact" }
        )
        .order("claimed_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        items: (data || []).map((item: any) => ({
          ...item,
          fun_token: item.fun_token,
        })),
        count: count ?? 0,
      };
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

// Fetch global totals (not affected by pagination)
export function useFunFeeClaimsSummary() {
  return useQuery({
    queryKey: ["fun-fee-claims-summary"],
    queryFn: async (): Promise<{ totalClaimedSol: number; claimCount: number }> => {
      const { data, error } = await supabase.rpc("get_fun_fee_claims_summary");

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      return {
        totalClaimedSol: Number(row?.total_claimed_sol ?? 0),
        claimCount: Number(row?.claim_count ?? 0),
      };
    },
    refetchInterval: 60000,
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
