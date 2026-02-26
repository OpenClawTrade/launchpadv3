import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TwitterProfile {
  username: string;
  profileImageUrl: string | null;
  verified: boolean;
  verifiedType: string | null;
}

export function useTwitterProfile(username: string | null | undefined) {
  return useQuery({
    queryKey: ['twitter-profile', username],
    queryFn: async (): Promise<TwitterProfile | null> => {
      if (!username) return null;

      try {
        const { data, error } = await supabase.functions.invoke('twitter-user-info', {
          body: { username },
        });

        if (error) {
          console.error('Twitter profile fetch error:', error);
          return null;
        }

        // Handle API-level errors (e.g. user not found / 404)
        if (data?.error) {
          console.warn('Twitter profile not found:', username, data.error);
          return null;
        }

        return data as TwitterProfile;
      } catch (e) {
        console.warn('Twitter profile fetch failed:', username, e);
        return null;
      }
    },
    enabled: !!username,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
