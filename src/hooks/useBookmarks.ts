import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PostWithProfile } from "./usePosts";

export function useBookmarks() {
  const { user, isAuthenticated } = useAuth();
  const [bookmarkedPosts, setBookmarkedPosts] = useState<PostWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookmarks = async () => {
    if (!user?.id) {
      setBookmarkedPosts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Fetch bookmarks with post and profile data
      const { data, error: fetchError } = await supabase
        .from("bookmarks")
        .select(`
          post_id,
          posts (
            *,
            profiles!posts_user_id_fkey (
              id,
              username,
              display_name,
              avatar_url,
              verified_type
            )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data to PostWithProfile format
      const posts = (data || [])
        .filter((item: any) => item.posts)
        .map((item: any) => ({
          ...item.posts,
          is_liked: false, // Will be enriched below
          is_bookmarked: true,
          is_reposted: false,
        }));

      // Fetch user likes for these posts
      if (posts.length > 0) {
        const postIds = posts.map((p: any) => p.id);
        const { data: likesData } = await supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", postIds);

        const likedPostIds = new Set(likesData?.map((l) => l.post_id) || []);
        posts.forEach((post: any) => {
          post.is_liked = likedPostIds.has(post.id);
        });
      }

      setBookmarkedPosts(posts);
    } catch (err: any) {
      console.error("Error fetching bookmarks:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const removeBookmark = async (postId: string) => {
    if (!user?.id) return;

    // Optimistic update
    setBookmarkedPosts((prev) => prev.filter((p) => p.id !== postId));

    try {
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Removed from bookmarks");
    } catch (err: any) {
      // Revert on error
      fetchBookmarks();
      toast.error("Failed to remove bookmark");
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchBookmarks();
    } else {
      setBookmarkedPosts([]);
      setIsLoading(false);
    }
  }, [user?.id, isAuthenticated]);

  return {
    bookmarkedPosts,
    isLoading,
    error,
    removeBookmark,
    refetch: fetchBookmarks,
  };
}
