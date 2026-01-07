import { useState, useEffect, useCallback } from "react";
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
  parent_id: string | null;
  is_repost: boolean;
  original_post_id: string | null;
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

export interface UsePostsOptions {
  /**
   * When false, skips the initial feed fetch (useful for places that only need createPost).
   * Defaults to true.
   */
  fetch?: boolean;
}

export function usePosts(options: UsePostsOptions = {}) {
  const fetchEnabled = options.fetch !== false;

  const { user, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(fetchEnabled);
  const [error, setError] = useState<string | null>(null);

  // Fetch posts with profile info
  const fetchPosts = async () => {
    if (!fetchEnabled) return;

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

      // If user is authenticated, fetch their likes, bookmarks, and reposts
      let userLikes: string[] = [];
      let userBookmarks: string[] = [];
      let userReposts: string[] = [];

      if (user?.id) {
        const postIds = (postsData || []).map((p) => p.id);

        const [likesRes, bookmarksRes, repostsRes] = await Promise.all([
          supabase.from("likes").select("post_id").eq("user_id", user.id),
          supabase.from("bookmarks").select("post_id").eq("user_id", user.id),
          supabase
            .from("posts")
            .select("original_post_id")
            .eq("user_id", user.id)
            .eq("is_repost", true)
            .in("original_post_id", postIds),
        ]);

        userLikes = likesRes.data?.map((l) => l.post_id) || [];
        userBookmarks = bookmarksRes.data?.map((b) => b.post_id) || [];
        userReposts =
          (repostsRes.data
            ?.map((r) => r.original_post_id)
            .filter(Boolean) as string[]) || [];
      }

      const enrichedPosts = (postsData || []).map((post) => ({
        ...post,
        is_liked: userLikes.includes(post.id),
        is_bookmarked: userBookmarks.includes(post.id),
        is_reposted: userReposts.includes(post.id),
      }));

      setPosts(enrichedPosts);
    } catch (err: any) {
      console.error("Error fetching posts:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload image to storage
  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user?.id) return null;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        toast.error("Failed to upload image");
        return null;
      }

      const { data } = supabase.storage.from("post-images").getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      console.error("Error in uploadImage:", error);
      toast.error("Failed to upload image");
      return null;
    }
  };

  // Create a new post
  const createPost = async (content: string, imageFile?: File, parentId?: string) => {
    if (!user?.id) {
      toast.error("Please sign in to post");
      return null;
    }

    try {
      let imageUrl: string | null = null;

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const { data, error } = await supabase
        .from("posts")
        .insert({
          content,
          user_id: user.id,
          image_url: imageUrl,
          parent_id: parentId || null,
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

      // Only add to feed if it's not a reply
      if (!parentId) {
        setPosts((prev) => [newPost, ...prev]);
      }

      toast.success(parentId ? "Reply posted!" : "Post created!");
      return newPost;
    } catch (err: any) {
      console.error("Error creating post:", err);
      toast.error("Failed to create post");
      return null;
    }
  };

  // Repost a post
  const toggleRepost = async (postId: string) => {
    if (!user?.id) {
      toast.error("Please sign in to repost");
      return;
    }

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const wasReposted = post.is_reposted;

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              is_reposted: !wasReposted,
              reposts_count: wasReposted ? p.reposts_count - 1 : p.reposts_count + 1,
            }
          : p
      )
    );

    try {
      if (wasReposted) {
        // Delete the repost
        await supabase
          .from("posts")
          .delete()
          .eq("original_post_id", postId)
          .eq("user_id", user.id)
          .eq("is_repost", true);
      } else {
        // Create a repost
        await supabase.from("posts").insert({
          content: post.content,
          user_id: user.id,
          is_repost: true,
          original_post_id: postId,
          image_url: post.image_url,
        });
      }

      // Update the original post's repost count
      await supabase
        .from("posts")
        .update({ reposts_count: wasReposted ? post.reposts_count - 1 : post.reposts_count + 1 })
        .eq("id", postId);

      toast.success(wasReposted ? "Removed repost" : "Reposted!");
    } catch (err: any) {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_reposted: wasReposted, reposts_count: post.reposts_count }
            : p
        )
      );
      console.error("Error toggling repost:", err);
      toast.error("Failed to update repost");
    }
  };

  // Like/unlike a post
  const toggleLike = async (postId: string) => {
    if (!user?.id) {
      toast.error("Please sign in to like posts");
      return;
    }

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const wasLiked = post.is_liked;

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              is_liked: !wasLiked,
              likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1,
            }
          : p
      )
    );

    try {
      if (wasLiked) {
        await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
      } else {
        await supabase.from("likes").insert({ post_id: postId, user_id: user.id });
      }

      // Update the post's like count in the database
      await supabase
        .from("posts")
        .update({ likes_count: wasLiked ? post.likes_count - 1 : post.likes_count + 1 })
        .eq("id", postId);
    } catch (err: any) {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_liked: wasLiked, likes_count: post.likes_count } : p))
      );
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

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const wasBookmarked = post.is_bookmarked;

    // Optimistic update
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, is_bookmarked: !wasBookmarked } : p)));

    try {
      if (wasBookmarked) {
        await supabase.from("bookmarks").delete().eq("post_id", postId).eq("user_id", user.id);
        toast.success("Removed from bookmarks");
      } else {
        await supabase.from("bookmarks").insert({ post_id: postId, user_id: user.id });
        toast.success("Added to bookmarks");
      }
    } catch (err: any) {
      // Revert on error
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, is_bookmarked: wasBookmarked } : p)));
      console.error("Error toggling bookmark:", err);
      toast.error("Failed to update bookmark");
    }
  };

  useEffect(() => {
    if (!fetchEnabled) return;
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, fetchEnabled]);

  return {
    posts,
    isLoading,
    error,
    createPost,
    toggleLike,
    toggleBookmark,
    toggleRepost,
    uploadImage,
    refetch: fetchPosts,
  };
}

// Hook for fetching a single post with its replies
export function usePost(postId: string | null) {
  const { user } = useAuth();
  const [post, setPost] = useState<PostWithProfile | null>(null);
  const [replies, setReplies] = useState<PostWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPost = useCallback(async () => {
    if (!postId) return;

    try {
      setIsLoading(true);

      // Fetch the main post
      const { data: postData, error: postError } = await supabase
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
        .eq("id", postId)
        .maybeSingle();

      if (postError) throw postError;
      if (!postData) {
        setPost(null);
        setIsLoading(false);
        return;
      }

      // Fetch replies
      const { data: repliesData, error: repliesError } = await supabase
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
        .eq("parent_id", postId)
        .order("created_at", { ascending: true });

      if (repliesError) throw repliesError;

      // Check user interactions
      let isLiked = false;
      let isBookmarked = false;
      let isReposted = false;

      if (user?.id) {
        const [likeRes, bookmarkRes, repostRes] = await Promise.all([
          supabase
            .from("likes")
            .select("id")
            .eq("post_id", postId)
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("bookmarks")
            .select("id")
            .eq("post_id", postId)
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("posts")
            .select("id")
            .eq("original_post_id", postId)
            .eq("user_id", user.id)
            .eq("is_repost", true)
            .maybeSingle()
        ]);

        isLiked = !!likeRes.data;
        isBookmarked = !!bookmarkRes.data;
        isReposted = !!repostRes.data;
      }

      setPost({
        ...postData,
        is_liked: isLiked,
        is_bookmarked: isBookmarked,
        is_reposted: isReposted,
      });

      setReplies(repliesData || []);
    } catch (error) {
      console.error("Error fetching post:", error);
    } finally {
      setIsLoading(false);
    }
  }, [postId, user?.id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  return { post, replies, isLoading, refetch: fetchPost };
}
