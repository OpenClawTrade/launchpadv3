import { formatDistanceToNow } from "date-fns";
import { ChatCircle, Share, ArrowFatUp, ArrowFatDown } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { AgentBadge } from "./AgentBadge";
import { FormattedContent } from "./FormattedContent";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ClawPostCardProps {
  id: string;
  title: string;
  content?: string;
  imageUrl?: string;
  postType: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  isPinned: boolean;
  isAgentPost: boolean;
  createdAt: string;
  slug?: string;
  author?: { id: string; username: string; avatarUrl?: string };
  agent?: { id: string; name: string; avatarUrl?: string | null };
  subtuna: { name: string; ticker: string; iconUrl?: string };
  userVote?: 1 | -1 | null;
  onVote: (postId: string, voteType: 1 | -1) => void;
  showSubtuna?: boolean;
}

export function ClawPostCard({
  id, title, content, imageUrl, postType, upvotes, downvotes, commentCount, isPinned, isAgentPost, createdAt, slug, author, agent, subtuna, userVote, onVote, showSubtuna = true,
}: ClawPostCardProps) {
  const postIdentifier = slug || id;
  const handleShare = async () => {
    const { copyToClipboard } = await import("@/lib/clipboard");
    const url = `${window.location.origin}/t/${subtuna.ticker}/post/${postIdentifier}`;
    const success = await copyToClipboard(url);
    if (success) toast.success("Link copied!");
    else toast.error("Failed to copy link");
  };
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  const score = upvotes - downvotes;

  return (
    <article className={cn("clawbook-card p-4 sm:p-5", isPinned && "clawbook-pinned")}>
      {/* Header row: avatar + meta */}
      <div className="flex items-center gap-3 mb-3">
        {/* Agent/Author avatar */}
        {isAgentPost && agent ? (
          <Link to={`/agent/${agent.id}`} className="flex-shrink-0">
            {agent.avatarUrl ? (
              <img src={agent.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-[hsl(var(--clawbook-primary)/0.3)]" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[hsl(var(--clawbook-primary)/0.15)] flex items-center justify-center text-sm font-bold text-[hsl(var(--clawbook-primary))]">
                {agent.name.charAt(0)}
              </div>
            )}
          </Link>
        ) : (
          <div className="w-9 h-9 rounded-full bg-[hsl(var(--clawbook-bg-elevated))] flex items-center justify-center text-sm font-bold text-[hsl(var(--clawbook-text-muted))] flex-shrink-0">
            {author?.username?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}
        
        <div className="flex items-center gap-1.5 text-xs flex-wrap min-w-0">
          {isAgentPost && agent ? (
            <Link to={`/agent/${agent.id}`} className="font-semibold text-[hsl(var(--clawbook-text-primary))] hover:text-[hsl(var(--clawbook-primary))] transition-colors truncate">
              {agent.name}
            </Link>
          ) : author ? (
            <span className="font-semibold text-[hsl(var(--clawbook-text-primary))] truncate">{author.username}</span>
          ) : (
            <span className="text-[hsl(var(--clawbook-text-muted))]">[deleted]</span>
          )}
          
          {isAgentPost && <AgentBadge />}
          
          {showSubtuna && (
            <>
              <span className="text-[hsl(var(--clawbook-text-muted))]">in</span>
              <Link to={`/t/${subtuna.ticker}`} className="clawbook-community-link text-xs">
                t/{subtuna.ticker}
              </Link>
            </>
          )}
          
          <span className="text-[hsl(var(--clawbook-text-muted))]">·</span>
          <span className="text-[hsl(var(--clawbook-text-muted))]">{timeAgo}</span>
          {isPinned && <span className="text-[hsl(var(--clawbook-primary))] font-medium ml-1">📌</span>}
        </div>
      </div>

      {/* Title */}
      <Link to={`/t/${subtuna.ticker}/post/${postIdentifier}`}>
        <h3 className="text-[15px] sm:text-base font-bold text-[hsl(var(--clawbook-text-primary))] hover:text-[hsl(var(--clawbook-primary))] transition-colors mb-2 leading-snug break-words">
          {title}
        </h3>
      </Link>

      {/* Content preview */}
      {content && (
        <FormattedContent content={content} truncate className="text-sm text-[hsl(var(--clawbook-text-secondary))] line-clamp-2 mb-3 leading-relaxed" />
      )}

      {/* Image */}
      {imageUrl && postType === "image" && (
        <div className="mb-3 rounded-lg overflow-hidden max-w-md">
          <img src={imageUrl} alt="" className="w-full max-h-72 object-cover" />
        </div>
      )}

      {/* Footer: engagement */}
      <div className="flex items-center gap-1 pt-1 border-t border-[hsl(var(--clawbook-border)/0.5)]">
        <div className="flex items-center gap-0.5 mr-2">
          <button onClick={() => onVote(id, 1)} className={cn("clawbook-vote-btn p-1.5", userVote === 1 && "upvoted")} aria-label="Upvote">
            <ArrowFatUp size={16} weight={userVote === 1 ? "fill" : "regular"} />
          </button>
          <span className={cn("clawbook-vote-score text-xs tabular-nums", userVote === 1 && "text-[hsl(var(--clawbook-upvote))]", userVote === -1 && "text-[hsl(var(--clawbook-downvote))]")}>{score}</span>
          <button onClick={() => onVote(id, -1)} className={cn("clawbook-vote-btn p-1.5", userVote === -1 && "downvoted")} aria-label="Downvote">
            <ArrowFatDown size={16} weight={userVote === -1 ? "fill" : "regular"} />
          </button>
        </div>

        <Link to={`/t/${subtuna.ticker}/post/${postIdentifier}`} className="flex items-center gap-1.5 text-xs text-[hsl(var(--clawbook-text-muted))] hover:text-[hsl(var(--clawbook-primary))] px-2.5 py-1.5 rounded-md transition-colors font-medium">
          <ChatCircle size={14} />
          <span>{commentCount} {commentCount === 1 ? "Reply" : "Replies"}</span>
        </Link>
        
        <button onClick={handleShare} className="flex items-center gap-1.5 text-xs text-[hsl(var(--clawbook-text-muted))] hover:text-[hsl(var(--clawbook-primary))] px-2.5 py-1.5 rounded-md transition-colors font-medium">
          <Share size={14} />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>
    </article>
  );
}
