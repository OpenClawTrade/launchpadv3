import { useQuery } from '@tanstack/react-query';

interface PoolState {
  realSolReserves: number;
  realTokenReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  bondingProgress: number;
  graduationThreshold: number;
  priceSol: number;
  marketCapSol: number;
  isGraduated: boolean;
  poolAddress: string;
  tokenBAmount?: number;
  tvl?: number;
}

interface UsePoolStateOptions {
  mintAddress?: string;
  poolAddress?: string;
  enabled?: boolean;
  refetchInterval?: number;
}

export function usePoolState({
  mintAddress,
  poolAddress,
  enabled = true,
  refetchInterval = 15000, // Default 15 second refresh
}: UsePoolStateOptions) {
  return useQuery<PoolState>({
    queryKey: ['pool-state', mintAddress || poolAddress],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mintAddress) params.set('mint', mintAddress);
      if (poolAddress) params.set('pool', poolAddress);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pool-state?${params.toString()}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch pool state');
      }

      return response.json();
    },
    enabled: enabled && !!(mintAddress || poolAddress),
    refetchInterval,
    staleTime: 10000, // Consider stale after 10 seconds
    gcTime: 60000, // Keep in cache for 1 minute
  });
}

// Hook for batch fetching multiple pool states
export function useMultiPoolStates(mintAddresses: string[], enabled = true) {
  return useQuery<Record<string, PoolState>>({
    queryKey: ['pool-states-batch', mintAddresses.join(',')],
    queryFn: async () => {
      // Fetch all pool states in parallel
      const results = await Promise.all(
        mintAddresses.map(async (mint) => {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pool-state?mint=${mint}`,
              {
                headers: {
                  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  'Content-Type': 'application/json',
                },
              }
            );
            
            if (!response.ok) return null;
            const data = await response.json();
            return { mint, data };
          } catch {
            return null;
          }
        })
      );

      // Build record from results
      const record: Record<string, PoolState> = {};
      for (const result of results) {
        if (result) {
          record[result.mint] = result.data;
        }
      }
      return record;
    },
    enabled: enabled && mintAddresses.length > 0,
    refetchInterval: 30000, // Batch refresh every 30 seconds
    staleTime: 15000,
  });
}
