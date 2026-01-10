import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

// Get API URL from environment
const getApiUrl = () => {
  // Check for configured Meteora API URL
  const meteoraUrl = import.meta.env.VITE_METEORA_API_URL;
  if (meteoraUrl && !meteoraUrl.includes('${')) {
    return meteoraUrl;
  }
  
  // Fallback to current origin for Vercel deployment
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  return '';
};

// API request helper
async function apiRequest<T>(
  endpoint: string, 
  body: Record<string, unknown>
): Promise<T> {
  const apiUrl = getApiUrl();
  const url = `${apiUrl}/api${endpoint}`;
  
  console.log('[useMeteoraApi] Request:', { url, body });
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data;
}

// Pool creation response
interface CreatePoolResponse {
  success: boolean;
  tokenId: string;
  mintAddress: string;
  dbcPoolAddress: string | null;
  transactions?: string[];
  signers?: {
    config: string;
    baseMint: string;
  };
}

// Swap execution response
interface SwapResponse {
  success: boolean;
  signature: string;
  tokensOut: number;
  solOut: number;
  newPrice: number;
  bondingProgress: number;
  graduated: boolean;
  marketCap: number;
}

// Fee claim response
interface ClaimFeesResponse {
  success: boolean;
  claimedAmount: number;
  signature: string;
  isPending: boolean;
}

// Sync response
interface SyncResponse {
  success: boolean;
  synced: number;
  results: Array<{
    tokenId: string;
    updated: boolean;
  }>;
}

export function useMeteoraApi() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Create a new token pool
  const createPool = useCallback(async (params: {
    creatorWallet: string;
    privyUserId?: string;
    name: string;
    ticker: string;
    description?: string;
    imageUrl?: string;
    websiteUrl?: string;
    twitterUrl?: string;
    telegramUrl?: string;
    discordUrl?: string;
    initialBuySol?: number;
  }): Promise<CreatePoolResponse> => {
    setIsLoading(true);
    try {
      const result = await apiRequest<CreatePoolResponse>('/pool/create', params);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Execute a swap
  const executeSwap = useCallback(async (params: {
    mintAddress: string;
    userWallet: string;
    amount: number;
    isBuy: boolean;
    slippageBps?: number;
    profileId?: string;
  }): Promise<SwapResponse> => {
    setIsLoading(true);
    try {
      const result = await apiRequest<SwapResponse>('/swap/execute', params);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Claim fees
  const claimFees = useCallback(async (params: {
    tokenId: string;
    walletAddress: string;
    profileId?: string;
  }): Promise<ClaimFeesResponse> => {
    setIsLoading(true);
    try {
      const result = await apiRequest<ClaimFeesResponse>('/fees/claim', params);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync token data from DexScreener
  const syncTokenData = useCallback(async (): Promise<SyncResponse> => {
    setIsLoading(true);
    try {
      const result = await apiRequest<SyncResponse>('/data/sync', {});
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    createPool,
    executeSwap,
    claimFees,
    syncTokenData,
  };
}
