import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SuggestedUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified_type: string | null;
  bio: string | null;
  followers_count: number;
  suggestion_score: number;
}

export function useSuggestedUsers(limit: number = 5) {
  const { user, isAuthenticated } = useAuth();
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestedUsers = async () => {
    try {
      setIsLoading(true);
      
      // Call the database function
      const { data, error: rpcError } = await supabase.rpc("get_suggested_users", {
        current_user_id: user?.id || null,
        limit_count: limit,
      });

      if (rpcError) throw rpcError;

      setSuggestedUsers(data || []);
    } catch (err: any) {
      console.error("Error fetching suggested users:", err);
      setError(err.message);
      
      // Fallback: get popular users
      try {
        const { data: fallbackData } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, verified_type, bio, followers_count")
          .neq("id", user?.id || "")
          .order("followers_count", { ascending: false, nullsFirst: false })
          .limit(limit);
        
        if (fallbackData) {
          setSuggestedUsers(
            fallbackData.map((u) => ({
              ...u,
              suggestion_score: u.followers_count || 0,
            }))
          );
        }
      } catch (e) {
        console.error("Fallback also failed:", e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Follow a user via edge function (bypasses RLS for Privy users)
  const followUser = async (userId: string) => {
    if (!user?.id) {
      toast.error("Please sign in to follow users");
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke("social-write", {
        body: {
          type: "follow_user",
          userId: user.id,
          targetUserId: userId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Remove from suggestions
      setSuggestedUsers((prev) => prev.filter((u) => u.id !== userId));

      toast.success("Followed successfully!");
      return true;
    } catch (err: any) {
      console.error("Error following user:", err);
      toast.error("Failed to follow user");
      return false;
    }
  };

  useEffect(() => {
    fetchSuggestedUsers();
  }, [user?.id, limit]);

  return {
    suggestedUsers,
    isLoading,
    error,
    followUser,
    refetch: fetchSuggestedUsers,
  };
}
