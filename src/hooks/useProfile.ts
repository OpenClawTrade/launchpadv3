import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PostWithProfile } from "./usePosts";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  website: string | null;
  location: string | null;
  verified_type: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  created_at: string;
}

export interface ProfileUpdateData {
  display_name?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatar_url?: string;
  cover_url?: string;
}

export function useProfile(username?: string) {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [replies, setReplies] = useState<PostWithProfile[]>([]);
  const [mediaPosts, setMediaPosts] = useState<PostWithProfile[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase.from("profiles").select("*");

      if (username) {
        query = query.eq("username", username);
      } else if (user?.id) {
        query = query.eq("id", user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await query.maybeSingle();

      if (profileError) throw profileError;

      if (!profileData) {
        setError("Profile not found");
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setProfile(profileData);
      setIsOwnProfile(user?.id === profileData.id);

      // Check if following (only if viewing someone else's profile)
      if (user?.id && user.id !== profileData.id) {
        const { data: followData } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", profileData.id)
          .maybeSingle();

        setIsFollowing(!!followData);
      }

      // Fetch user's posts (including reposts)
      // First get original posts, then get reposts with original post data
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
        .eq("user_id", profileData.id)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsError) throw postsError;

      // Fetch replies (posts with parent_id)
      const { data: repliesData } = await supabase
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
        .eq("user_id", profileData.id)
        .not("parent_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      // Fetch media posts (posts with images)
      const { data: mediaData } = await supabase
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
        .eq("user_id", profileData.id)
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      // Fetch liked posts
      const { data: likesData } = await supabase
        .from("likes")
        .select(`
          post_id,
          posts!likes_post_id_fkey (
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
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false })
        .limit(50);

      // Fetch user interactions for current user
      let userLikes: string[] = [];
      let userBookmarks: string[] = [];

      const allPostIds = [
        ...(postsData || []).map((p) => p.id),
        ...(repliesData || []).map((p) => p.id),
        ...(mediaData || []).map((p) => p.id),
        ...(likesData || []).map((l) => (l.posts as any)?.id).filter(Boolean),
      ];

      if (user?.id && allPostIds.length > 0) {
        const [likesRes, bookmarksRes] = await Promise.all([
          supabase
            .from("likes")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", allPostIds),
          supabase
            .from("bookmarks")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", allPostIds),
        ]);

        userLikes = likesRes.data?.map((l) => l.post_id) || [];
        userBookmarks = bookmarksRes.data?.map((b) => b.post_id) || [];
      }

      const enrichPost = (post: any) => ({
        ...post,
        is_liked: userLikes.includes(post.id),
        is_bookmarked: userBookmarks.includes(post.id),
        is_reposted: false,
      });

      setPosts((postsData || []).map(enrichPost));
      setReplies((repliesData || []).map(enrichPost));
      setMediaPosts((mediaData || []).map(enrichPost));
      
      // Extract posts from likes join
      const likedPostsExtracted = (likesData || [])
        .map((l) => l.posts)
        .filter(Boolean)
        .map((post: any) => enrichPost(post));
      setLikedPosts(likedPostsExtracted);
    } catch (err: any) {
      console.error("Error fetching profile:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: ProfileUpdateData) => {
    if (!user?.id) {
      toast.error("Please sign in to update profile");
      return false;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      setProfile((prev) => (prev ? { ...prev, ...updates } : null));
      toast.success("Profile updated!");
      return true;
    } catch (err: any) {
      console.error("Error updating profile:", err);
      toast.error("Failed to update profile");
      return false;
    }
  };

  const toggleFollow = async () => {
    if (!user?.id || !profile || isOwnProfile) {
      toast.error("Please sign in to follow users");
      return;
    }

    const wasFollowing = isFollowing;

    // Optimistic update
    setIsFollowing(!wasFollowing);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            followers_count: wasFollowing
              ? prev.followers_count - 1
              : prev.followers_count + 1,
          }
        : null
    );

    try {
      if (wasFollowing) {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.id);
      } else {
        await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: profile.id });
      }

      // Update counts in profiles table
      await supabase
        .from("profiles")
        .update({
          followers_count: wasFollowing
            ? profile.followers_count - 1
            : profile.followers_count + 1,
        })
        .eq("id", profile.id);

      await supabase
        .from("profiles")
        .update({
          following_count: wasFollowing
            ? (await supabase
                .from("profiles")
                .select("following_count")
                .eq("id", user.id)
                .single()
                .then(
                  (res) => Math.max((res.data?.following_count || 1) - 1, 0)
                ))
            : (await supabase
                .from("profiles")
                .select("following_count")
                .eq("id", user.id)
                .single()
                .then((res) => (res.data?.following_count || 0) + 1)),
        })
        .eq("id", user.id);
    } catch (err: any) {
      // Revert on error
      setIsFollowing(wasFollowing);
      setProfile((prev) =>
        prev ? { ...prev, followers_count: profile.followers_count } : null
      );
      console.error("Error toggling follow:", err);
      toast.error("Failed to update follow");
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [username, user?.id]);

  return {
    profile,
    posts,
    replies,
    mediaPosts,
    likedPosts,
    isLoading,
    isOwnProfile,
    isFollowing,
    error,
    updateProfile,
    toggleFollow,
    refetch: fetchProfile,
  };
}
