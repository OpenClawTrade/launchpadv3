import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TokenPromotion {
  id: string;
  fun_token_id: string;
  promoter_wallet: string;
  payment_address: string;
  amount_sol: number;
  status: "pending" | "paid" | "posted" | "expired" | "failed";
  signature: string | null;
  twitter_post_id: string | null;
  created_at: string;
  paid_at: string | null;
  posted_at: string | null;
  expires_at: string | null;
}

interface GeneratePromotionResponse {
  success: boolean;
  promotionId?: string;
  paymentAddress?: string;
  amountSol?: number;
  expiresIn?: string;
  error?: string;
}

interface CheckPromotionResponse {
  success: boolean;
  status: string;
  paid: boolean;
  currentBalance?: number;
  requiredBalance?: number;
  twitterPosted?: boolean;
  tweetId?: string;
  message?: string;
}

export function useTokenPromotions() {
  const queryClient = useQueryClient();

  // Fetch all active promotions (posted and not expired)
  const {
    data: activePromotions,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["token-promotions-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_promotions")
        .select("*")
        .eq("status", "posted")
        .gt("expires_at", new Date().toISOString())
        .order("posted_at", { ascending: false });

      if (error) throw error;
      return data as TokenPromotion[];
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  // Get promoted token IDs for quick lookup
  const promotedTokenIds = new Set(
    activePromotions?.map((p) => p.fun_token_id) || []
  );

  // Check if a specific token is promoted
  const isTokenPromoted = (tokenId: string): boolean => {
    return promotedTokenIds.has(tokenId);
  };

  // Get promotion details for a token
  const getTokenPromotion = (tokenId: string): TokenPromotion | undefined => {
    return activePromotions?.find((p) => p.fun_token_id === tokenId);
  };

  // Generate promotion payment address (no wallet required - user pays externally)
  const generatePromotion = useMutation({
    mutationFn: async ({
      funTokenId,
      promoterWallet,
    }: {
      funTokenId: string;
      promoterWallet?: string;
    }): Promise<GeneratePromotionResponse> => {
      if (!funTokenId) {
        throw new Error("Token ID is required");
      }

      const response = await supabase.functions.invoke("promote-generate", {
        body: { funTokenId, promoterWallet: promoterWallet || "" },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data as GeneratePromotionResponse;
    },
  });

  // Check promotion payment status
  const checkPromotion = useMutation({
    mutationFn: async (promotionId: string): Promise<CheckPromotionResponse> => {
      const response = await supabase.functions.invoke("promote-check", {
        body: { promotionId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data as CheckPromotionResponse;
    },
    onSuccess: (data) => {
      if (data.paid) {
        // Invalidate promotions cache to refresh the list
        queryClient.invalidateQueries({ queryKey: ["token-promotions-active"] });
      }
    },
  });

  return {
    activePromotions,
    isLoading,
    error,
    refetch,
    promotedTokenIds,
    isTokenPromoted,
    getTokenPromotion,
    generatePromotion,
    checkPromotion,
  };
}

// Hook to get promotion for a specific token
export function useTokenPromotion(tokenId: string | undefined) {
  return useQuery({
    queryKey: ["token-promotion", tokenId],
    queryFn: async () => {
      if (!tokenId) return null;

      const { data, error } = await supabase
        .from("token_promotions")
        .select("*")
        .eq("fun_token_id", tokenId)
        .eq("status", "posted")
        .gt("expires_at", new Date().toISOString())
        .order("posted_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as TokenPromotion | null;
    },
    enabled: !!tokenId,
    staleTime: 30000,
  });
}
