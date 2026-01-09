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
    if (!user?.id) {
      console.error("uploadImage: No user ID");
      return null;
    }

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      console.log("Uploading image:", { fileName, fileSize: file.size, fileType: file.type });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        toast.error("Failed to upload image");
        return null;
      }
      
      console.log("Upload successful:", uploadData);

      const { data } = supabase.storage.from("post-images").getPublicUrl(fileName);
      console.log("Public URL:", data.publicUrl);
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

      const { data: fnData, error: fnError } = await supabase.functions.invoke("social-write", {
        body: {
          type: "create_post",
          userId: user.id,
          content,
          imageUrl,
          parentId: parentId || null,
        },
      });

      if (fnError) throw fnError;

      const data = (fnData as any)?.post as PostWithProfile | undefined;
      if (!data) throw new Error("Failed to create post");

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
      const { data: fnData, error: fnError } = await supabase.functions.invoke("social-write", {
        body: {
          type: "toggle_repost",
          userId: user.id,
          postId,
        },
      });

      if (fnError) throw fnError;

      const reposted = !!(fnData as any)?.reposted;
      const reposts_count = (fnData as any)?.reposts_count as number | undefined;

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                is_reposted: reposted,
                reposts_count: typeof reposts_count === "number" ? reposts_count : p.reposts_count,
              }
            : p
        )
      );

      toast.success(wasReposted ? "Removed repost" : "Reposted!");
    } catch (err: any) {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, is_reposted: wasReposted, reposts_count: post.reposts_count } : p
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
      const { data: fnData, error: fnError } = await supabase.functions.invoke("social-write", {
        body: {
          type: "toggle_like",
          userId: user.id,
          postId,
        },
      });

      if (fnError) throw fnError;

      const liked = !!(fnData as any)?.liked;
      const likes_count = (fnData as any)?.likes_count as number | undefined;

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                is_liked: liked,
                likes_count: typeof likes_count === "number" ? likes_count : p.likes_count,
              }
            : p
        )
      );
    } catch (err: any) {
      // Revert on error
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, is_liked: wasLiked, likes_count: post.likes_count } : p)));
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
      const { data: fnData, error: fnError } = await supabase.functions.invoke("social-write", {
        body: {
          type: "toggle_bookmark",
          userId: user.id,
          postId,
        },
      });

      if (fnError) throw fnError;

      const bookmarked = !!(fnData as any)?.bookmarked;
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, is_bookmarked: bookmarked } : p)));

      toast.success(bookmarked ? "Added to bookmarks" : "Removed from bookmarks");
    } catch (err: any) {
      // Revert on error
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, is_bookmarked: wasBookmarked } : p)));
      console.error("Error toggling bookmark:", err);
      toast.error("Failed to update bookmark");
    }
  };

  // Delete a post
  const deletePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  // Quote a post
  const quotePost = async (postId: string, content: string, imageFile?: File) => {
    if (!user?.id) {
      toast.error("Please sign in to quote posts");
      return;
    }

    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      // Create a post with quote reference in content
      const quotedPost = posts.find(p => p.id === postId);
      const quoteContent = content;

      const { data: fnData, error: fnError } = await supabase.functions.invoke("social-write", {
        body: {
          type: "create_post",
          userId: user.id,
          content: quoteContent,
          imageUrl,
          quotedPostId: postId,
        },
      });

      if (fnError) throw fnError;

      const data = (fnData as any)?.post as PostWithProfile | undefined;
      if (!data) throw new Error("Failed to quote post");

      const newPost = {
        ...data,
        is_liked: false,
        is_bookmarked: false,
        is_reposted: false,
      };

      setPosts((prev) => [newPost, ...prev]);
      toast.success("Quote posted!");
    } catch (err: any) {
      console.error("Error quoting post:", err);
      toast.error("Failed to quote post");
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
    deletePost,
    quotePost,
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
