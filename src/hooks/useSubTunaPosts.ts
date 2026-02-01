import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SortOption = "hot" | "new" | "top" | "rising";

interface UseSubTunaPostsOptions {
  subtunaId?: string;
  ticker?: string;
  sort?: SortOption;
  limit?: number;
}

export function useSubTunaPosts({
  subtunaId,
  ticker,
  sort = "hot",
  limit = 25,
}: UseSubTunaPostsOptions = {}) {
  const queryClient = useQueryClient();

  const postsQuery = useQuery({
    queryKey: ["subtuna-posts", subtunaId, ticker, sort, limit],
    queryFn: async () => {
      let query = supabase
        .from("subtuna_posts")
        .select(`
          *,
          subtuna:subtuna_id (
            id,
            name,
            fun_token_id,
            icon_url,
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
          query = query.order("score", { ascending: false });
          break;
        case "rising":
          // Rising = high score relative to age
          query = query
            .order("score", { ascending: false })
            .gte("created_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
          break;
        case "hot":
        default:
          // Hot = combination of score and recency
          query = query
            .order("is_pinned", { ascending: false })
            .order("score", { ascending: false })
            .order("created_at", { ascending: false });
          break;
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data to match expected shape
      return (data || []).map((post: any) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        imageUrl: post.image_url,
        postType: post.post_type,
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        commentCount: post.comment_count,
        isPinned: post.is_pinned,
        isAgentPost: post.is_agent_post,
        createdAt: post.created_at,
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
          ticker: post.subtuna?.fun_tokens?.ticker || ticker || "",
          iconUrl: post.subtuna?.icon_url || post.subtuna?.fun_tokens?.image_url,
        },
      }));
    },
    enabled: true,
  });

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
          
          // Update post vote counts directly
          const upvoteDelta = voteType === 1 ? -1 : 0;
          const downvoteDelta = voteType === -1 ? -1 : 0;
          await supabase
            .from("subtuna_posts")
            .update({
              upvotes: supabase.rpc ? undefined : undefined, // Will be handled by trigger
            })
            .eq("id", postId);
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

  return {
    posts: postsQuery.data || [],
    isLoading: postsQuery.isLoading,
    error: postsQuery.error,
    vote: voteMutation.mutate,
    isVoting: voteMutation.isPending,
  };
}
