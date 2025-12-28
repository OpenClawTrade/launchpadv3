import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PostWithProfile } from "./usePosts";

export function useExplore() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrichPosts = async (postsData: any[]): Promise<PostWithProfile[]> => {
    if (!postsData || postsData.length === 0) return [];

    let userLikes: string[] = [];
    let userBookmarks: string[] = [];

    if (user?.id) {
      const postIds = postsData.map((p) => p.id);

      const [likesRes, bookmarksRes] = await Promise.all([
        supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", postIds),
        supabase
          .from("bookmarks")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", postIds),
      ]);

      userLikes = likesRes.data?.map((l) => l.post_id) || [];
      userBookmarks = bookmarksRes.data?.map((b) => b.post_id) || [];
    }

    return postsData.map((post) => ({
      ...post,
      is_liked: userLikes.includes(post.id),
      is_bookmarked: userBookmarks.includes(post.id),
      is_reposted: false,
    }));
  };

  const fetchTrendingPosts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch posts ordered by engagement (likes + reposts) in last 24 hours
      const { data, error: fetchError } = await supabase
        .from("posts")
        .select(`
          *,
          profiles!posts_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            verified_type
          )
        `)
        .is("parent_id", null)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("likes_count", { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      const enrichedPosts = await enrichPosts(data || []);
      setPosts(enrichedPosts);
    } catch (err: any) {
      console.error("Error fetching trending posts:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const fetchForYouPosts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch recent posts with good engagement
      const { data, error: fetchError } = await supabase
        .from("posts")
        .select(`
          *,
          profiles!posts_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            verified_type
          )
        `)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      const enrichedPosts = await enrichPosts(data || []);
      setPosts(enrichedPosts);
    } catch (err: any) {
      console.error("Error fetching for you posts:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const searchPosts = useCallback(async (query: string) => {
    if (!query.trim()) {
      return fetchForYouPosts();
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("posts")
        .select(`
          *,
          profiles!posts_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            verified_type
          )
        `)
        .is("parent_id", null)
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      const enrichedPosts = await enrichPosts(data || []);
      setPosts(enrichedPosts);
    } catch (err: any) {
      console.error("Error searching posts:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  return {
    posts,
    isLoading,
    error,
    fetchTrendingPosts,
    fetchForYouPosts,
    searchPosts,
  };
}
