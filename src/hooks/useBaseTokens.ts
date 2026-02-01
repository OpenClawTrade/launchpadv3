import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BaseToken {
  id: string;
  name: string;
  ticker: string;
  chain: string;
  chain_id: number;
  evm_token_address: string;
  evm_pool_address: string;
  evm_factory_tx_hash: string;
  creator_wallet: string;
  creator_fee_bps: number;
  fair_launch_ends_at: string | null;
  fair_launch_duration_mins: number;
  starting_mcap_usd: number;
  description: string | null;
  image_url: string | null;
  website_url: string | null;
  twitter_url: string | null;
  status: string;
  created_at: string;
}

export function useBaseTokens() {
  return useQuery({
    queryKey: ['base-tokens'],
    queryFn: async (): Promise<BaseToken[]> => {
      const { data, error } = await supabase
        .from('fun_tokens')
        .select('*')
        .eq('chain', 'base')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching Base tokens:', error);
        throw error;
      }

      return (data ?? []) as BaseToken[];
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute
  });
}

export function useBaseToken(tokenId: string | undefined) {
  return useQuery({
    queryKey: ['base-token', tokenId],
    queryFn: async (): Promise<BaseToken | null> => {
      if (!tokenId) return null;

      const { data, error } = await supabase
        .from('fun_tokens')
        .select('*')
        .eq('id', tokenId)
        .eq('chain', 'base')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error('Error fetching Base token:', error);
        throw error;
      }

      return data as BaseToken;
    },
    enabled: !!tokenId,
    staleTime: 1000 * 30,
  });
}

export function useEthPrice() {
  return useQuery({
    queryKey: ['eth-price'],
    queryFn: async (): Promise<number> => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/base-eth-price`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch ETH price');
        }

        const data = await response.json();
        return data.price ?? 2500;
      } catch (error) {
        console.error('Error fetching ETH price:', error);
        return 2500; // Default fallback
      }
    },
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 2, // 2 minutes
  });
}
