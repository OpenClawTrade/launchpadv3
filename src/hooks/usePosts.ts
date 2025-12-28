import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PostWithProfile {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user_id: string;
  likes_count: number;
  reposts_count: number;
  replies_count: number;
  views_count: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  is_reposted?: boolean;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    verified_type: string | null;
  };
}

export function usePosts() {
  const { user, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch posts with profile info
  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      
      const { data: postsData, error: postsError } = await supabase
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

      if (postsError) throw postsError;

      // If user is authenticated, fetch their likes and bookmarks
      let userLikes: string[] = [];
      let userBookmarks: string[] = [];
      
      if (user?.id) {
        const [likesRes, bookmarksRes] = await Promise.all([
          supabase
            .from("likes")
            .select("post_id")
            .eq("user_id", user.id),
          supabase
            .from("bookmarks")
            .select("post_id")
            .eq("user_id", user.id)
        ]);

        userLikes = likesRes.data?.map(l => l.post_id) || [];
        userBookmarks = bookmarksRes.data?.map(b => b.post_id) || [];
      }

      const enrichedPosts = (postsData || []).map(post => ({
        ...post,
        is_liked: userLikes.includes(post.id),
        is_bookmarked: userBookmarks.includes(post.id),
        is_reposted: false, // TODO: implement reposts
      }));

      setPosts(enrichedPosts);
    } catch (err: any) {
      console.error("Error fetching posts:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new post
  const createPost = async (content: string, imageUrl?: string) => {
    if (!user?.id) {
      toast.error("Please sign in to post");
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("posts")
        .insert({
          content,
          user_id: user.id,
          image_url: imageUrl || null,
        })
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
        .single();

      if (error) throw error;

      const newPost = {
        ...data,
        is_liked: false,
        is_bookmarked: false,
        is_reposted: false,
      };

      setPosts(prev => [newPost, ...prev]);
      toast.success("Post created!");
      return newPost;
    } catch (err: any) {
      console.error("Error creating post:", err);
      toast.error("Failed to create post");
      return null;
    }
  };

  // Like/unlike a post
  const toggleLike = async (postId: string) => {
    if (!user?.id) {
      toast.error("Please sign in to like posts");
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const wasLiked = post.is_liked;

    // Optimistic update
    setPosts(prev => prev.map(p => 
      p.id === postId 
        ? { 
            ...p, 
            is_liked: !wasLiked, 
            likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1 
          } 
        : p
    ));

    try {
      if (wasLiked) {
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("likes")
          .insert({ post_id: postId, user_id: user.id });
      }

      // Update the post's like count in the database
      await supabase
        .from("posts")
        .update({ likes_count: wasLiked ? post.likes_count - 1 : post.likes_count + 1 })
        .eq("id", postId);
    } catch (err: any) {
      // Revert on error
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, is_liked: wasLiked, likes_count: post.likes_count } 
          : p
      ));
      console.error("Error toggling like:", err);
      toast.error("Failed to update like");
    }
  };

  // Bookmark/unbookmark a post
  const toggleBookmark = async (postId: string) => {
    if (!user?.id) {
      toast.error("Please sign in to bookmark posts");
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const wasBookmarked = post.is_bookmarked;

    // Optimistic update
    setPosts(prev => prev.map(p => 
      p.id === postId ? { ...p, is_bookmarked: !wasBookmarked } : p
    ));

    try {
      if (wasBookmarked) {
        await supabase
          .from("bookmarks")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
        toast.success("Removed from bookmarks");
      } else {
        await supabase
          .from("bookmarks")
          .insert({ post_id: postId, user_id: user.id });
        toast.success("Added to bookmarks");
      }
    } catch (err: any) {
      // Revert on error
      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, is_bookmarked: wasBookmarked } : p
      ));
      console.error("Error toggling bookmark:", err);
      toast.error("Failed to update bookmark");
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [user?.id]);

  return {
    posts,
    isLoading,
    error,
    createPost,
    toggleLike,
    toggleBookmark,
    refetch: fetchPosts,
  };
}
