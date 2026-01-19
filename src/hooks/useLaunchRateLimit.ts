import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RateLimitState {
  allowed: boolean;
  launchCount: number;
  maxLaunches: number;
  remaining: number;
  waitSeconds: number;
  message?: string;
  isLoading: boolean;
  error: string | null;
}

export function useLaunchRateLimit() {
  const [state, setState] = useState<RateLimitState>({
    allowed: true,
    launchCount: 0,
    maxLaunches: 2,
    remaining: 2,
    waitSeconds: 0,
    isLoading: true,
    error: null,
  });

  const [countdown, setCountdown] = useState(0);

  const checkRateLimit = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { data, error } = await supabase.functions.invoke('check-launch-rate');
      
      if (error) throw error;

      setState({
        allowed: data.allowed ?? true,
        launchCount: data.launchCount ?? 0,
        maxLaunches: data.maxLaunches ?? 2,
        remaining: data.remaining ?? 2,
        waitSeconds: data.waitSeconds ?? 0,
        message: data.message,
        isLoading: false,
        error: null,
      });

      // Set countdown if rate limited
      if (!data.allowed && data.waitSeconds > 0) {
        setCountdown(data.waitSeconds);
      }
    } catch (err) {
      console.error('[useLaunchRateLimit] Error:', err);
      // On error, allow the launch (fail open)
      setState(prev => ({
        ...prev,
        allowed: true,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  // Initial check
  useEffect(() => {
    checkRateLimit();
  }, [checkRateLimit]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Recheck when countdown ends
          checkRateLimit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, checkRateLimit]);

  // Format countdown as mm:ss
  const formatCountdown = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    ...state,
    countdown,
    formattedCountdown: formatCountdown(countdown),
    refresh: checkRateLimit,
  };
}
