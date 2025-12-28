import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Community {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  created_by: string;
  members_count: number;
  created_at: string;
  is_member?: boolean;
}

export function useCommunities() {
  const { user, isAuthenticated } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [userCommunities, setUserCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunities = async () => {
    try {
      setIsLoading(true);

      // Fetch all communities
      const { data: communitiesData, error: communitiesError } = await supabase
        .from("communities")
        .select("*")
        .order("members_count", { ascending: false });

      if (communitiesError) throw communitiesError;

      // If user is logged in, check which communities they're a member of
      let memberCommunityIds: string[] = [];
      if (user?.id) {
        const { data: memberships } = await supabase
          .from("community_members")
          .select("community_id")
          .eq("user_id", user.id);

        memberCommunityIds = memberships?.map((m) => m.community_id) || [];
      }

      const enrichedCommunities = (communitiesData || []).map((community) => ({
        ...community,
        is_member: memberCommunityIds.includes(community.id),
      }));

      setCommunities(enrichedCommunities);
      setUserCommunities(
        enrichedCommunities.filter((c) => c.is_member)
      );
    } catch (err: any) {
      console.error("Error fetching communities:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const createCommunity = async (
    name: string,
    description: string
  ): Promise<Community | null> => {
    if (!user?.id) {
      toast.error("Please sign in to create a community");
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("communities")
        .insert({
          name,
          description,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newCommunity = { ...data, is_member: true };
      setCommunities((prev) => [newCommunity, ...prev]);
      setUserCommunities((prev) => [newCommunity, ...prev]);

      toast.success("Community created!");
      return newCommunity;
    } catch (err: any) {
      console.error("Error creating community:", err);
      toast.error("Failed to create community");
      return null;
    }
  };

  const joinCommunity = async (communityId: string) => {
    if (!user?.id) {
      toast.error("Please sign in to join communities");
      return;
    }

    // Optimistic update
    setCommunities((prev) =>
      prev.map((c) =>
        c.id === communityId
          ? { ...c, is_member: true, members_count: c.members_count + 1 }
          : c
      )
    );

    try {
      const { error } = await supabase
        .from("community_members")
        .insert({ community_id: communityId, user_id: user.id });

      if (error) throw error;

      // Update userCommunities
      const community = communities.find((c) => c.id === communityId);
      if (community) {
        setUserCommunities((prev) => [
          ...prev,
          { ...community, is_member: true },
        ]);
      }

      toast.success("Joined community!");
    } catch (err: any) {
      // Revert on error
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === communityId
            ? { ...c, is_member: false, members_count: c.members_count - 1 }
            : c
        )
      );
      console.error("Error joining community:", err);
      toast.error("Failed to join community");
    }
  };

  const leaveCommunity = async (communityId: string) => {
    if (!user?.id) return;

    // Optimistic update
    setCommunities((prev) =>
      prev.map((c) =>
        c.id === communityId
          ? { ...c, is_member: false, members_count: Math.max(c.members_count - 1, 0) }
          : c
      )
    );
    setUserCommunities((prev) => prev.filter((c) => c.id !== communityId));

    try {
      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Left community");
    } catch (err: any) {
      // Revert on error
      fetchCommunities();
      console.error("Error leaving community:", err);
      toast.error("Failed to leave community");
    }
  };

  const searchCommunities = async (query: string): Promise<Community[]> => {
    if (!query.trim()) {
      return communities;
    }

    try {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .ilike("name", `%${query}%`)
        .order("members_count", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Enrich with membership info
      let memberCommunityIds: string[] = [];
      if (user?.id) {
        const { data: memberships } = await supabase
          .from("community_members")
          .select("community_id")
          .eq("user_id", user.id);

        memberCommunityIds = memberships?.map((m) => m.community_id) || [];
      }

      return (data || []).map((community) => ({
        ...community,
        is_member: memberCommunityIds.includes(community.id),
      }));
    } catch (err: any) {
      console.error("Error searching communities:", err);
      return [];
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [user?.id]);

  return {
    communities,
    userCommunities,
    isLoading,
    error,
    createCommunity,
    joinCommunity,
    leaveCommunity,
    searchCommunities,
    refetch: fetchCommunities,
  };
}
