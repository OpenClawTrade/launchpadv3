import { useState, useCallback, useRef } from 'react';

interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  mintAddress?: string;
  dbcPoolAddress?: string;
  tokenId?: string;
  error?: string;
  solscanUrl?: string;
  tradeUrl?: string;
  message?: string;
}

interface PollOptions {
  maxAttempts?: number;
  intervalMs?: number;
  onProgress?: (status: JobStatus) => void;
}

export function useTokenJobPolling() {
  const [isPolling, setIsPolling] = useState(false);
  const abortRef = useRef<boolean>(false);

  const pollJobStatus = useCallback(async (
    jobId: string,
    options: PollOptions = {}
  ): Promise<JobStatus> => {
    const { maxAttempts = 60, intervalMs = 2000, onProgress } = options;
    
    setIsPolling(true);
    abortRef.current = false;
    
    let attempts = 0;

    try {
      while (attempts < maxAttempts && !abortRef.current) {
        attempts++;
        
        console.log(`[useTokenJobPolling] Polling attempt ${attempts}/${maxAttempts} for job ${jobId}`);
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fun-create-status?jobId=${jobId}`,
          {
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          }
        );

        if (!response.ok) {
          console.error('[useTokenJobPolling] Status check failed:', response.status);
          await new Promise(r => setTimeout(r, intervalMs));
          continue;
        }

        const status = await response.json() as JobStatus;
        
        if (onProgress) {
          onProgress(status);
        }

        if (status.status === 'completed') {
          console.log('[useTokenJobPolling] Job completed:', status);
          return status;
        }

        if (status.status === 'failed') {
          console.error('[useTokenJobPolling] Job failed:', status.error);
          throw new Error(status.error || 'Token creation failed');
        }

        // Still processing - wait and try again
        await new Promise(r => setTimeout(r, intervalMs));
      }

      if (abortRef.current) {
        throw new Error('Polling cancelled');
      }

      throw new Error('Token creation timed out. Please check your wallet for the token.');
    } finally {
      setIsPolling(false);
    }
  }, []);

  const cancelPolling = useCallback(() => {
    abortRef.current = true;
  }, []);

  return {
    pollJobStatus,
    cancelPolling,
    isPolling,
  };
}
