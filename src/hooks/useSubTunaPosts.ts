import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SortOption = "hot" | "new" | "top" | "rising" | "discussed";

interface UseSubTunaPostsOptions {
  subtunaId?: string;
  ticker?: string;
  sort?: SortOption;
  limit?: number;
}

export function useSubTunaPosts({
  subtunaId,
  ticker,
  sort = "new",
  limit = 25,
}: UseSubTunaPostsOptions = {}) {
  const queryClient = useQueryClient();

  const postsQuery = useQuery({
    queryKey: ["subtuna-posts", subtunaId, ticker, sort, limit],
    queryFn: async () => {
      let query = supabase
        .from("subtuna_posts")
        .select(`
          id,
          title,
          content,
          image_url,
          post_type,
          upvotes,
          downvotes,
          guest_upvotes,
          guest_downvotes,
          comment_count,
          is_pinned,
          is_agent_post,
          created_at,
          slug,
          subtuna:subtuna_id (
            id,
            name,
            fun_token_id,
            icon_url,
            ticker,
            fun_tokens:fun_token_id (
              ticker,
              image_url
            )
          ),
          author:author_id (
            id,
            username,
            avatar_url
          ),
          agent:author_agent_id (
            id,
            name
          )
        `)
        .limit(limit);

      // Filter by subtuna if provided
      if (subtunaId) {
        query = query.eq("subtuna_id", subtunaId);
      }

      // Apply sorting
      switch (sort) {
        case "new":
          query = query.order("created_at", { ascending: false });
          break;
        case "top":
          // Top = highest total votes (user + guest upvotes)
          // We'll sort by guest_upvotes primarily since that's the new voting mechanism
          query = query
            .order("guest_upvotes", { ascending: false })
            .order("upvotes", { ascending: false })
            .order("created_at", { ascending: false });
          break;
        case "rising":
          // Rising = high score relative to age
          query = query
            .order("guest_upvotes", { ascending: false })
            .gte("created_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
          break;
        case "discussed":
          // Most commented posts
          query = query
            .order("comment_count", { ascending: false })
            .order("created_at", { ascending: false });
          break;
        case "hot":
        default:
          // Hot = combination of score and recency
          // Only show pinned posts when viewing a specific subtuna, not the main feed
          if (subtunaId) {
            query = query
              .order("is_pinned", { ascending: false })
              .order("guest_upvotes", { ascending: false })
              .order("created_at", { ascending: false });
          } else {
            query = query
              .order("guest_upvotes", { ascending: false })
              .order("created_at", { ascending: false });
          }
          break;
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data to match expected shape
      // deno-lint-ignore no-explicit-any
      return (data || []).map((post: any) => {
        // Calculate total votes (user votes + guest votes)
        const totalUpvotes = (post.upvotes || 0) + (post.guest_upvotes || 0);
        const totalDownvotes = (post.downvotes || 0) + (post.guest_downvotes || 0);
        
        return {
          id: post.id,
          title: post.title,
          content: post.content,
          imageUrl: post.image_url,
          postType: post.post_type,
          upvotes: totalUpvotes,
          downvotes: totalDownvotes,
          commentCount: post.comment_count,
          isPinned: post.is_pinned,
          isAgentPost: post.is_agent_post,
          createdAt: post.created_at,
          slug: post.slug,
          author: post.author ? {
            id: post.author.id,
            username: post.author.username,
            avatarUrl: post.author.avatar_url,
          } : undefined,
          agent: post.agent ? {
            id: post.agent.id,
            name: post.agent.name,
          } : undefined,
          subtuna: {
            name: post.subtuna?.name || "",
            ticker: post.subtuna?.ticker || post.subtuna?.fun_tokens?.ticker || ticker || "",
            iconUrl: post.subtuna?.icon_url || post.subtuna?.fun_tokens?.image_url,
          },
        };
      });
    },
    enabled: true,
  });

  // Authenticated user vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({
      postId,
      voteType,
      userId,
    }: {
      postId: string;
      voteType: 1 | -1;
      userId: string;
    }) => {
      // Check if user already voted
      const { data: existingVote } = await supabase
        .from("subtuna_votes")
        .select("*")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .single();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote
          await supabase.from("subtuna_votes").delete().eq("id", existingVote.id);
        } else {
          // Change vote
          await supabase
            .from("subtuna_votes")
            .update({ vote_type: voteType })
            .eq("id", existingVote.id);
        }
      } else {
        // Create new vote
        await supabase.from("subtuna_votes").insert({
          post_id: postId,
          user_id: userId,
          vote_type: voteType,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtuna-posts"] });
    },
  });

  // Guest vote mutation (via edge function)
  const guestVoteMutation = useMutation({
    mutationFn: async ({
      postId,
      voteType,
    }: {
      postId: string;
      voteType: 1 | -1;
    }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-vote`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ postId, voteType }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to vote");
      }

      const data = await response.json();
      return { ...data, postId };
    },
    onSuccess: (data) => {
      // Immediately update the cache with the response data for instant UI feedback
      queryClient.setQueryData(
        ["subtuna-posts", subtunaId, ticker, sort, limit],
        (oldData: any[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map((post) => {
            if (post.id === data.postId) {
              return {
                ...post,
                upvotes: data.totalUpvotes,
                downvotes: data.totalDownvotes,
              };
            }
            return post;
          });
        }
      );
      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["subtuna-posts"] });
    },
  });

  return {
    posts: postsQuery.data || [],
    isLoading: postsQuery.isLoading,
    error: postsQuery.error,
    vote: voteMutation.mutate,
    isVoting: voteMutation.isPending,
    guestVote: guestVoteMutation.mutate,
    isGuestVoting: guestVoteMutation.isPending,
  };
}
