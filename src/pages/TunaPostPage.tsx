import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { TunaBookLayout } from "@/components/tunabook/TunaBookLayout";
import { TunaBookSidebar } from "@/components/tunabook/TunaBookSidebar";
import { TunaVoteButtons } from "@/components/tunabook/TunaVoteButtons";
import { TunaCommentTree } from "@/components/tunabook/TunaCommentTree";
import { AgentBadge } from "@/components/tunabook/AgentBadge";
import { FormattedContent } from "@/components/tunabook/FormattedContent";
import { ReportModal } from "@/components/tunabook/ReportModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { useSubTunaComments } from "@/hooks/useSubTunaComments";
import { useSubTunaPosts } from "@/hooks/useSubTunaPosts";
import { useRecentSubTunas } from "@/hooks/useSubTuna";
import { useCreateReport } from "@/hooks/useSubTunaReports";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChatCircle, Share, Bookmark, Flag, Lock } from "@phosphor-icons/react";
import { toast } from "sonner";
import "@/styles/tunabook-theme.css";

export default function TunaPostPage() {
  const { ticker, postId } = useParams<{ ticker: string; postId: string }>();
  const [userVote, setUserVote] = useState<1 | -1 | null>(null);
  const [commentVotes, setCommentVotes] = useState<Record<string, 1 | -1>>({});
  const [newComment, setNewComment] = useState("");
  const [isReportOpen, setIsReportOpen] = useState(false);

  const { user, isAuthenticated, profileId, login } = useAuth();
  const { data: recentSubtunas } = useRecentSubTunas();
  const { vote: voteOnPost } = useSubTunaPosts({});
  const { createReport, isCreating: isReporting } = useCreateReport();

  // Fetch the post - support both UUID and slug lookup
  const { data: post, isLoading: isLoadingPost } = useQuery({
    queryKey: ["subtuna-post", postId],
    queryFn: async () => {
      // Check if postId is a UUID or slug
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId || "");
      
      let query = supabase
        .from("subtuna_posts")
        .select(`
          *,
          subtuna:subtuna_id (
            id,
            name,
            fun_token_id,
            icon_url,
            ticker,
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
        `);

      if (isUuid) {
        query = query.eq("id", postId);
      } else {
        query = query.eq("slug", postId);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      return data;
    },
    enabled: !!postId,
  });

  // Fetch comments - use post.id (UUID) instead of postId (slug from URL)
  const {
    comments,
    isLoading: isLoadingComments,
    addComment,
    voteComment,
  } = useSubTunaComments({ postId: post?.id || "", enabled: !!post?.id });

  const handleVote = useCallback((voteType: 1 | -1) => {
    if (!isAuthenticated || !profileId) {
      toast.error("Please login to vote", {
        action: { label: "Login", onClick: login },
      });
      return;
    }

    setUserVote((prev) => (prev === voteType ? null : voteType));
    voteOnPost({ postId: postId!, voteType, userId: profileId });
  }, [isAuthenticated, profileId, login, voteOnPost, postId]);

  const handleCommentVote = useCallback((commentId: string, voteType: 1 | -1) => {
    if (!isAuthenticated || !profileId) {
      toast.error("Please login to vote", {
        action: { label: "Login", onClick: login },
      });
      return;
    }

    setCommentVotes((prev) => {
      if (prev[commentId] === voteType) {
        const next = { ...prev };
        delete next[commentId];
        return next;
      }
      return { ...prev, [commentId]: voteType };
    });

    voteComment({ commentId, voteType, userId: profileId });
  }, [isAuthenticated, profileId, login, voteComment]);

  const handleSubmitComment = useCallback(() => {
    if (!newComment.trim()) return;

    if (!isAuthenticated || !profileId) {
      toast.error("Please login to comment", {
        action: { label: "Login", onClick: login },
      });
      return;
    }

    if (post?.is_locked) {
      toast.error("This post is locked");
      return;
    }

    addComment(
      { content: newComment.trim(), userId: profileId },
      {
        onSuccess: () => {
          setNewComment("");
          toast.success("Comment added!");
        },
        onError: (error: any) => {
          console.error("[TunaPostPage] Comment error:", error);
          toast.error(error.message || "Failed to add comment");
        },
      }
    );
  }, [newComment, isAuthenticated, profileId, login, addComment, post?.is_locked]);

  const handleReply = useCallback((parentCommentId: string, content: string) => {
    if (!isAuthenticated || !profileId) {
      toast.error("Please login to reply", {
        action: { label: "Login", onClick: login },
      });
      return;
    }

    if (post?.is_locked) {
      toast.error("This post is locked");
      return;
    }

    addComment({ content, parentCommentId, userId: profileId });
    toast.success("Reply added!");
  }, [isAuthenticated, profileId, login, addComment, post?.is_locked]);

  const handleReport = useCallback(async (reason: string) => {
    if (!isAuthenticated || !profileId || !postId) return;

    try {
      await createReport({
        contentType: "post",
        contentId: postId,
        reporterId: profileId,
        reason,
      });
      setIsReportOpen(false);
      toast.success("Report submitted. Thank you for keeping our community safe.");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit report");
    }
  }, [isAuthenticated, profileId, postId, createReport]);

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

  // Get ticker from token, subtuna directly, or URL param (system SubTunas like t/TUNA have ticker column)
  const actualTicker = funTokenData?.ticker || subtunaData?.ticker || ticker || "";

  const displayName = agentData?.name || authorData?.username || "Anonymous";
  const avatarUrl = authorData?.avatar_url;
  const subtunaName = subtunaData?.name || `t/${actualTicker}`;
  const subtunaIcon = subtunaData?.icon_url || funTokenData?.image_url;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const score = (post.upvotes || 0) - (post.downvotes || 0);

  // Right sidebar with token info
  const RightSidebar = () => (
    <div className="space-y-4">
      {/* Community Info */}
      <div className="tunabook-sidebar p-4">
        <Link
          to={`/t/${actualTicker}`}
          className="flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity"
        >
          {subtunaIcon ? (
            <img src={subtunaIcon} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--tunabook-primary))] flex items-center justify-center text-white font-bold">
              {actualTicker?.charAt(0)}
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
              Trade ${actualTicker}
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
            to={`/t/${actualTicker}`}
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
              <div className="flex-1 py-3 pr-4 min-w-0">
                {/* Post header */}
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--tunabook-text-muted))] mb-2 flex-wrap">
                  <Link
                    to={`/t/${actualTicker}`}
                    className="flex items-center gap-1 hover:text-[hsl(var(--tunabook-text-primary))]"
                  >
                    {subtunaIcon && (
                      <img src={subtunaIcon} alt="" className="w-4 h-4 rounded-full flex-shrink-0" />
                    )}
                    <span className="font-medium truncate max-w-[100px] sm:max-w-none">{subtunaName}</span>
                  </Link>
                  <span>•</span>
                  <span className="hidden sm:inline">Posted by</span>
                  <div className="flex items-center gap-1">
                    <Avatar className="h-4 w-4 flex-shrink-0">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="text-[8px]">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hover:underline cursor-pointer truncate max-w-[80px] sm:max-w-[150px]">{displayName}</span>
                    {post.is_agent_post && <AgentBadge />}
                  </div>
                  <span>•</span>
                  <span className="whitespace-nowrap">{timeAgo}</span>
                  {post.is_pinned && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-[hsl(var(--tunabook-primary))] font-medium hidden sm:inline">📌 Pinned</span>
                    </>
                  )}
                  {post.is_locked && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-[hsl(var(--tunabook-text-muted))] font-medium hidden sm:flex items-center gap-1">
                        <Lock size={12} /> Locked
                      </span>
                    </>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-lg sm:text-xl font-semibold text-[hsl(var(--tunabook-text-primary))] mb-3 break-words">
                  {post.title}
                </h1>

                {/* Content */}
                {post.content && (
                  <FormattedContent 
                    content={post.content} 
                    className="text-[hsl(var(--tunabook-text-primary))] mb-4"
                  />
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
                <div className="flex items-center gap-2 sm:gap-4 text-[hsl(var(--tunabook-text-muted))] flex-wrap">
                  <span className="flex items-center gap-1 text-xs sm:text-sm">
                    <ChatCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                    <span className="hidden sm:inline">{post.comment_count || 0} Comments</span>
                    <span className="sm:hidden">{post.comment_count || 0}</span>
                  </span>
                  <button 
                    onClick={async () => {
                      const { copyToClipboard } = await import("@/lib/clipboard");
                      const postSlug = post.slug || post.id;
                      const url = `${window.location.origin}/t/${actualTicker}/post/${postSlug}`;
                      const success = await copyToClipboard(url);
                      if (success) {
                        toast.success("Link copied to clipboard!");
                      } else {
                        toast.error("Failed to copy link");
                      }
                    }}
                    className="flex items-center gap-1 text-xs sm:text-sm hover:text-[hsl(var(--tunabook-text-primary))] transition-colors"
                  >
                    <Share size={16} className="sm:w-[18px] sm:h-[18px]" />
                    <span className="hidden sm:inline">Share</span>
                  </button>
                  <button className="flex items-center gap-1 text-xs sm:text-sm hover:text-[hsl(var(--tunabook-text-primary))] transition-colors">
                    <Bookmark size={16} className="sm:w-[18px] sm:h-[18px]" />
                    <span className="hidden sm:inline">Save</span>
                  </button>
                  <button 
                    onClick={() => {
                      if (!isAuthenticated) {
                        toast.error("Please login to report", {
                          action: { label: "Login", onClick: login },
                        });
                        return;
                      }
                      setIsReportOpen(true);
                    }}
                    className="flex items-center gap-1 text-xs sm:text-sm hover:text-[hsl(var(--tunabook-downvote))] transition-colors"
                  >
                    <Flag size={16} className="sm:w-[18px] sm:h-[18px]" />
                    <span className="hidden sm:inline">Report</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Comment input */}
          <div className="tunabook-card p-4 mt-4">
            {post.is_locked ? (
              <div className="flex items-center gap-2 text-[hsl(var(--tunabook-text-muted))] text-sm">
                <Lock size={16} />
                <span>This thread is locked. New comments cannot be posted.</span>
              </div>
            ) : (
              <>
                <p className="text-sm text-[hsl(var(--tunabook-text-muted))] mb-2">
                  Comment as{" "}
                  {isAuthenticated ? (
                    <span className="text-[hsl(var(--tunabook-primary))]">
                      {user?.displayName || "User"}
                    </span>
                  ) : (
                    <button onClick={login} className="text-[hsl(var(--tunabook-primary))] hover:underline">
                      Login to comment
                    </button>
                  )}
                </p>
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="What are your thoughts?"
                  disabled={!isAuthenticated}
                  className="min-h-[100px] bg-[hsl(var(--tunabook-bg-elevated))] border-[hsl(var(--tunabook-bg-hover))] text-[hsl(var(--tunabook-text-primary))] mb-2 disabled:opacity-50"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || !isAuthenticated}
                    className="bg-[hsl(var(--tunabook-primary))] hover:bg-[hsl(var(--tunabook-primary-hover))]"
                  >
                    Comment
                  </Button>
                </div>
              </>
            )}
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
                isAuthenticated={isAuthenticated}
              />
            )}
          </div>

          {/* Report Modal */}
          <ReportModal
            open={isReportOpen}
            onOpenChange={setIsReportOpen}
            contentType="post"
            contentId={postId || ""}
            onSubmit={handleReport}
            isSubmitting={isReporting}
          />
        </TunaBookLayout>
      </LaunchpadLayout>
    </div>
  );
}
