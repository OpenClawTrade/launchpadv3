import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Generate or retrieve session ID from sessionStorage
function getSessionId(): string {
  const key = 'visitor_session_id';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

export function useVisitorTracking() {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Heartbeat to keep session alive
  const updateSession = useCallback(async () => {
    const sessionId = getSessionId();
    try {
      await supabase
        .from('visitor_sessions')
        .upsert(
          { session_id: sessionId, last_seen_at: new Date().toISOString() },
          { onConflict: 'session_id' }
        );
    } catch (err) {
      console.warn('[Visitor Tracking] Failed to update session:', err);
    }
  }, []);

  // Fetch online count
  const fetchOnlineCount = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_active_visitors_count');
      if (!error && typeof data === 'number') {
        setOnlineCount(data);
      }
    } catch (err) {
      console.warn('[Visitor Tracking] Failed to fetch count:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial update and fetch
    updateSession();
    fetchOnlineCount();

    // Heartbeat every 60 seconds to keep session alive
    const heartbeatInterval = setInterval(updateSession, 60_000);

    // Refresh count every 30 seconds
    const countInterval = setInterval(fetchOnlineCount, 30_000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(countInterval);
    };
  }, [updateSession, fetchOnlineCount]);

  return { onlineCount, isLoading };
}
