import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { TunaBookLayout } from "@/components/tunabook/TunaBookLayout";
import { TunaBookSidebar } from "@/components/tunabook/TunaBookSidebar";
import { TunaVoteButtons } from "@/components/tunabook/TunaVoteButtons";
import { TunaCommentTree } from "@/components/tunabook/TunaCommentTree";
import { AgentBadge } from "@/components/tunabook/AgentBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { useSubTunaComments } from "@/hooks/useSubTunaComments";
import { useRecentSubTunas } from "@/hooks/useSubTuna";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChatCircle, Share, Bookmark, DotsThree } from "@phosphor-icons/react";
import "@/styles/tunabook-theme.css";

export default function TunaPostPage() {
  const { ticker, postId } = useParams<{ ticker: string; postId: string }>();
  const [userVote, setUserVote] = useState<1 | -1 | null>(null);
  const [commentVotes, setCommentVotes] = useState<Record<string, 1 | -1>>({});
  const [newComment, setNewComment] = useState("");

  const { data: recentSubtunas } = useRecentSubTunas();

  // Fetch the post
  const { data: post, isLoading: isLoadingPost } = useQuery({
    queryKey: ["subtuna-post", postId],
    queryFn: async () => {
      const { data, error } = await supabase
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
              image_url,
              mint_address
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
        .eq("id", postId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!postId,
  });

  // Fetch comments
  const {
    comments,
    isLoading: isLoadingComments,
    addComment,
    voteComment,
  } = useSubTunaComments({ postId: postId || "", enabled: !!postId });

  const handleVote = useCallback((voteType: 1 | -1) => {
    setUserVote((prev) => (prev === voteType ? null : voteType));
    // TODO: Persist vote when authenticated
  }, []);

  const handleCommentVote = useCallback((commentId: string, voteType: 1 | -1) => {
    setCommentVotes((prev) => {
      if (prev[commentId] === voteType) {
        const next = { ...prev };
        delete next[commentId];
        return next;
      }
      return { ...prev, [commentId]: voteType };
    });
  }, []);

  const handleSubmitComment = useCallback(() => {
    if (!newComment.trim()) return;
    // TODO: Add actual user ID when authenticated
    setNewComment("");
  }, [newComment]);

  const handleReply = useCallback((parentCommentId: string, content: string) => {
    // TODO: Implement when authenticated
    console.log("Reply to:", parentCommentId, content);
  }, []);

  if (isLoadingPost) {
    return (
      <div className="tunabook-theme">
        <LaunchpadLayout showKingOfTheHill={false}>
          <TunaBookLayout leftSidebar={<TunaBookSidebar />}>
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </TunaBookLayout>
        </LaunchpadLayout>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="tunabook-theme">
        <LaunchpadLayout showKingOfTheHill={false}>
          <TunaBookLayout leftSidebar={<TunaBookSidebar />}>
            <div className="tunabook-card p-8 text-center">
              <h2 className="text-xl font-bold text-[hsl(var(--tunabook-text-primary))] mb-2">
                Post Not Found
              </h2>
              <p className="text-[hsl(var(--tunabook-text-secondary))] mb-4">
                This post doesn't exist or has been removed.
              </p>
              <Link to="/agents">
                <Button variant="outline">Back to TunaBook</Button>
              </Link>
            </div>
          </TunaBookLayout>
        </LaunchpadLayout>
      </div>
    );
  }

  const subtunaData = post.subtuna as any;
  const authorData = post.author as any;
  const agentData = post.agent as any;
  const funTokenData = subtunaData?.fun_tokens as any;

  const displayName = agentData?.name || authorData?.username || "Anonymous";
  const avatarUrl = authorData?.avatar_url;
  const subtunaName = subtunaData?.name || `t/${ticker}`;
  const subtunaIcon = subtunaData?.icon_url || funTokenData?.image_url;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const score = (post.upvotes || 0) - (post.downvotes || 0);

  // Right sidebar with token info
  const RightSidebar = () => (
    <div className="space-y-4">
      {/* Community Info */}
      <div className="tunabook-sidebar p-4">
        <Link
          to={`/t/${ticker}`}
          className="flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity"
        >
          {subtunaIcon ? (
            <img src={subtunaIcon} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--tunabook-primary))] flex items-center justify-center text-white font-bold">
              {ticker?.charAt(0)}
            </div>
          )}
          <div>
            <h3 className="font-medium text-[hsl(var(--tunabook-text-primary))]">{subtunaName}</h3>
            <p className="text-xs text-[hsl(var(--tunabook-text-muted))]">View community</p>
          </div>
        </Link>

        {funTokenData?.mint_address && (
          <Link to={`/launchpad/${funTokenData.mint_address}`}>
            <Button className="w-full bg-[hsl(var(--tunabook-primary))] hover:bg-[hsl(var(--tunabook-primary-hover))]">
              Trade ${ticker}
            </Button>
          </Link>
        )}
      </div>

      {/* Post Stats */}
      <div className="tunabook-sidebar p-4">
        <h4 className="text-sm font-medium text-[hsl(var(--tunabook-text-primary))] mb-3">
          Post Stats
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[hsl(var(--tunabook-text-muted))]">Score</span>
            <span className="text-[hsl(var(--tunabook-text-primary))]">{score}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[hsl(var(--tunabook-text-muted))]">Comments</span>
            <span className="text-[hsl(var(--tunabook-text-primary))]">{post.comment_count || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[hsl(var(--tunabook-text-muted))]">Posted</span>
            <span className="text-[hsl(var(--tunabook-text-primary))]">{timeAgo}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="tunabook-theme">
      <LaunchpadLayout showKingOfTheHill={false}>
        <TunaBookLayout
          leftSidebar={<TunaBookSidebar recentSubtunas={recentSubtunas} />}
          rightSidebar={<RightSidebar />}
        >
          {/* Back link */}
          <Link
            to={`/t/${ticker}`}
            className="inline-flex items-center gap-2 text-sm text-[hsl(var(--tunabook-text-muted))] hover:text-[hsl(var(--tunabook-text-primary))] mb-4 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to {subtunaName}
          </Link>

          {/* Post Card */}
          <div className="tunabook-card">
            <div className="flex">
              {/* Vote column */}
              <div className="p-3 flex flex-col items-center">
                <TunaVoteButtons
                  upvotes={post.upvotes || 0}
                  downvotes={post.downvotes || 0}
                  userVote={userVote}
                  onVote={handleVote}
                />
              </div>

              {/* Content */}
              <div className="flex-1 py-3 pr-4">
                {/* Post header */}
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--tunabook-text-muted))] mb-2">
                  <Link
                    to={`/t/${ticker}`}
                    className="flex items-center gap-1 hover:text-[hsl(var(--tunabook-text-primary))]"
                  >
                    {subtunaIcon && (
                      <img src={subtunaIcon} alt="" className="w-4 h-4 rounded-full" />
                    )}
                    <span className="font-medium">{subtunaName}</span>
                  </Link>
                  <span>•</span>
                  <span>Posted by</span>
                  <div className="flex items-center gap-1">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="text-[8px]">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hover:underline cursor-pointer">{displayName}</span>
                    {post.is_agent_post && <AgentBadge />}
                  </div>
                  <span>•</span>
                  <span>{timeAgo}</span>
                  {post.is_pinned && (
                    <>
                      <span>•</span>
                      <span className="text-[hsl(var(--tunabook-primary))] font-medium">📌 Pinned</span>
                    </>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-xl font-semibold text-[hsl(var(--tunabook-text-primary))] mb-3">
                  {post.title}
                </h1>

                {/* Content */}
                {post.content && (
                  <div className="text-[hsl(var(--tunabook-text-primary))] whitespace-pre-wrap mb-4">
                    {post.content}
                  </div>
                )}

                {/* Image */}
                {post.image_url && (
                  <div className="mb-4">
                    <img
                      src={post.image_url}
                      alt=""
                      className="max-w-full max-h-[600px] rounded-lg object-contain"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 text-[hsl(var(--tunabook-text-muted))]">
                  <span className="flex items-center gap-1 text-sm">
                    <ChatCircle size={18} />
                    {post.comment_count || 0} Comments
                  </span>
                  <button className="flex items-center gap-1 text-sm hover:text-[hsl(var(--tunabook-text-primary))] transition-colors">
                    <Share size={18} />
                    Share
                  </button>
                  <button className="flex items-center gap-1 text-sm hover:text-[hsl(var(--tunabook-text-primary))] transition-colors">
                    <Bookmark size={18} />
                    Save
                  </button>
                  <button className="hover:text-[hsl(var(--tunabook-text-primary))] transition-colors">
                    <DotsThree size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Comment input */}
          <div className="tunabook-card p-4 mt-4">
            <p className="text-sm text-[hsl(var(--tunabook-text-muted))] mb-2">
              Comment as <span className="text-[hsl(var(--tunabook-primary))]">Guest</span>
            </p>
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="What are your thoughts?"
              className="min-h-[100px] bg-[hsl(var(--tunabook-bg-elevated))] border-[hsl(var(--tunabook-bg-hover))] text-[hsl(var(--tunabook-text-primary))] mb-2"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim()}
                className="bg-[hsl(var(--tunabook-primary))] hover:bg-[hsl(var(--tunabook-primary-hover))]"
              >
                Comment
              </Button>
            </div>
          </div>

          {/* Comments */}
          <div className="tunabook-card p-4 mt-4">
            <h3 className="font-medium text-[hsl(var(--tunabook-text-primary))] mb-4">
              Comments ({post.comment_count || 0})
            </h3>
            
            {isLoadingComments ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <TunaCommentTree
                comments={comments}
                userVotes={commentVotes}
                onVote={handleCommentVote}
                onReply={handleReply}
                isAuthenticated={false}
              />
            )}
          </div>
        </TunaBookLayout>
      </LaunchpadLayout>
    </div>
  );
}
