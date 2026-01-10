import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Token {
  id: string;
  mint_address: string;
  name: string;
  ticker: string;
  description: string | null;
  image_url: string | null;
  website_url: string | null;
  twitter_url: string | null;
  telegram_url: string | null;
  discord_url: string | null;
  creator_wallet: string;
  creator_id: string | null;
  dbc_pool_address: string | null;
  damm_pool_address: string | null;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  real_sol_reserves: number;
  real_token_reserves: number;
  total_supply: number;
  bonding_curve_progress: number;
  graduation_threshold_sol: number;
  price_sol: number;
  market_cap_sol: number;
  volume_24h_sol: number;
  status: 'bonding' | 'graduated' | 'failed';
  migration_status: string;
  holder_count: number;
  created_at: string;
  updated_at: string;
  graduated_at: string | null;
  profiles?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
    verified_type: string | null;
  } | null;
}

export interface LaunchpadTransaction {
  id: string;
  token_id: string;
  user_wallet: string;
  transaction_type: 'buy' | 'sell';
  sol_amount: number;
  token_amount: number;
  price_per_token: number;
  signature: string;
  created_at: string;
  profiles?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

export interface TokenHolding {
  id: string;
  token_id: string;
  wallet_address: string;
  balance: number;
  profiles?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

export function useLaunchpad() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all tokens
  const { data: tokens = [], isLoading: isLoadingTokens, refetch: refetchTokens } = useQuery({
    queryKey: ['launchpad-tokens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tokens')
        .select(`
          *,
          profiles:creator_id (
            display_name,
            username,
            avatar_url,
            verified_type
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Token[];
    },
  });

  // Fetch single token by mint address
  const useToken = (mintAddress: string) => {
    return useQuery({
      queryKey: ['launchpad-token', mintAddress],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('tokens')
          .select(`
            *,
            profiles:creator_id (
              display_name,
              username,
              avatar_url,
              verified_type
            )
          `)
          .eq('mint_address', mintAddress)
          .single();

        if (error) throw error;
        return data as Token;
      },
      enabled: !!mintAddress,
    });
  };

  // Fetch token transactions
  const useTokenTransactions = (tokenId: string) => {
    return useQuery({
      queryKey: ['launchpad-transactions', tokenId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('launchpad_transactions')
          .select(`
            *,
            profiles:user_profile_id (
              display_name,
              username,
              avatar_url
            )
          `)
          .eq('token_id', tokenId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return data as LaunchpadTransaction[];
      },
      enabled: !!tokenId,
    });
  };

  // Fetch token holders
  const useTokenHolders = (tokenId: string) => {
    return useQuery({
      queryKey: ['launchpad-holders', tokenId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('token_holdings')
          .select(`
            *,
            profiles:profile_id (
              display_name,
              username,
              avatar_url
            )
          `)
          .eq('token_id', tokenId)
          .gt('balance', 0)
          .order('balance', { ascending: false })
          .limit(100);

        if (error) throw error;
        return data as TokenHolding[];
      },
      enabled: !!tokenId,
    });
  };

  // Fetch user's tokens (created by them)
  const useUserTokens = (walletAddress: string | undefined) => {
    return useQuery({
      queryKey: ['user-tokens', walletAddress],
      queryFn: async () => {
        if (!walletAddress) return [];
        
        const { data, error } = await supabase
          .from('tokens')
          .select('*')
          .eq('creator_wallet', walletAddress)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Token[];
      },
      enabled: !!walletAddress,
    });
  };

  // Fetch user's holdings
  const useUserHoldings = (walletAddress: string | undefined) => {
    return useQuery({
      queryKey: ['user-holdings', walletAddress],
      queryFn: async () => {
        if (!walletAddress) return [];
        
        const { data, error } = await supabase
          .from('token_holdings')
          .select(`
            *,
            tokens (
              id,
              mint_address,
              name,
              ticker,
              image_url,
              price_sol,
              status
            )
          `)
          .eq('wallet_address', walletAddress)
          .gt('balance', 0)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        return data;
      },
      enabled: !!walletAddress,
    });
  };

  return {
    tokens,
    isLoadingTokens,
    refetchTokens,
    useToken,
    useTokenTransactions,
    useTokenHolders,
    useUserTokens,
    useUserHoldings,
  };
}

// Bonding curve calculations
export function calculateBuyQuote(
  solIn: number,
  virtualSol: number,
  virtualToken: number
): { tokensOut: number; newPrice: number; priceImpact: number } {
  const k = virtualSol * virtualToken;
  const newVirtualSol = virtualSol + solIn;
  const newVirtualToken = k / newVirtualSol;
  const tokensOut = virtualToken - newVirtualToken;
  
  const oldPrice = virtualSol / virtualToken;
  const newPrice = newVirtualSol / newVirtualToken;
  const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100;

  return { tokensOut, newPrice, priceImpact };
}

export function calculateSellQuote(
  tokensIn: number,
  virtualSol: number,
  virtualToken: number
): { solOut: number; newPrice: number; priceImpact: number } {
  const k = virtualSol * virtualToken;
  const newVirtualToken = virtualToken + tokensIn;
  const newVirtualSol = k / newVirtualToken;
  const solOut = virtualSol - newVirtualSol;
  
  const oldPrice = virtualSol / virtualToken;
  const newPrice = newVirtualSol / newVirtualToken;
  const priceImpact = ((oldPrice - newPrice) / oldPrice) * 100;

  return { solOut, newPrice, priceImpact };
}

export function formatTokenAmount(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  return amount.toFixed(2);
}

export function formatSolAmount(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
  if (amount >= 1) return amount.toFixed(4);
  return amount.toFixed(6);
}
