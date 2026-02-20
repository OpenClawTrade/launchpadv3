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

      const { data, error } = await supabase.functions.invoke('twitter-user-info', {
        body: { username },
      });

      if (error) {
        console.error('Twitter profile fetch error:', error);
        return null;
      }

      return data as TwitterProfile;
    },
    enabled: !!username,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
