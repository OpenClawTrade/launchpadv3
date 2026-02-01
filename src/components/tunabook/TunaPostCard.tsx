import { formatDistanceToNow } from "date-fns";
import { ChatCircle, Share, Bookmark, DotsThree, ArrowFatUp, ArrowFatDown } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { AgentBadge } from "./AgentBadge";
import { cn } from "@/lib/utils";

interface TunaPostCardProps {
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
  author?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  agent?: {
    id: string;
    name: string;
  };
  subtuna: {
    name: string;
    ticker: string;
    iconUrl?: string;
  };
  userVote?: 1 | -1 | null;
  onVote: (postId: string, voteType: 1 | -1) => void;
  showSubtuna?: boolean;
}

export function TunaPostCard({
  id,
  title,
  content,
  imageUrl,
  postType,
  upvotes,
  downvotes,
  commentCount,
  isPinned,
  isAgentPost,
  createdAt,
  author,
  agent,
  subtuna,
  userVote,
  onVote,
  showSubtuna = true,
}: TunaPostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  const score = upvotes - downvotes;

  return (
    <article
      className={cn(
        "tunabook-card flex gap-4 p-4",
        isPinned && "tunabook-pinned"
      )}
    >
      {/* Vote buttons - Larger style */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => onVote(id, 1)}
          className={cn(
            "tunabook-vote-btn p-1.5",
            userVote === 1 && "upvoted"
          )}
          aria-label="Upvote"
        >
          <ArrowFatUp
            size={22}
            weight={userVote === 1 ? "fill" : "regular"}
          />
        </button>
        
        <span
          className={cn(
            "tunabook-vote-score tabular-nums",
            userVote === 1 && "text-[hsl(var(--tunabook-upvote))]",
            userVote === -1 && "text-[hsl(var(--tunabook-downvote))]",
            !userVote && "text-[hsl(var(--tunabook-text-primary))]"
          )}
        >
          {score}
        </span>
        
        <button
          onClick={() => onVote(id, -1)}
          className={cn(
            "tunabook-vote-btn p-1.5",
            userVote === -1 && "downvoted"
          )}
          aria-label="Downvote"
        >
          <ArrowFatDown
            size={22}
            weight={userVote === -1 ? "fill" : "regular"}
          />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Meta line */}
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--tunabook-text-secondary))] mb-1.5 flex-wrap">
          {showSubtuna && (
            <>
              <Link
                to={`/t/${subtuna.ticker}`}
                className="tunabook-community-link flex items-center gap-1"
              >
                {subtuna.iconUrl && (
                  <img
                    src={subtuna.iconUrl}
                    alt=""
                    className="w-4 h-4 rounded-full"
                  />
                )}
                <span>t/{subtuna.ticker}</span>
              </Link>
              <span className="text-[hsl(var(--tunabook-text-muted))]">•</span>
            </>
          )}
          
          <span>Posted by</span>
          {isAgentPost && agent ? (
            <Link
              to={`/agent/${agent.id}`}
              className="flex items-center gap-1 hover:underline"
            >
              <span className="font-medium text-[hsl(var(--tunabook-agent-badge))]">
                {agent.name}
              </span>
              <AgentBadge />
            </Link>
          ) : author ? (
            <Link
              to={`/u/${author.username}`}
              className="font-medium hover:underline text-[hsl(var(--tunabook-text-primary))]"
            >
              u/{author.username}
            </Link>
          ) : (
            <span className="text-[hsl(var(--tunabook-text-muted))]">[deleted]</span>
          )}
          
          <span className="text-[hsl(var(--tunabook-text-muted))]">•</span>
          <span>{timeAgo}</span>
          
          {isPinned && (
            <>
              <span className="text-[hsl(var(--tunabook-text-muted))]">•</span>
              <span className="text-[hsl(var(--tunabook-primary))] font-medium">
                📌 Pinned
              </span>
            </>
          )}
        </div>

        {/* Title */}
        <Link to={`/t/${subtuna.ticker}/post/${id}`}>
          <h3 className="text-base font-semibold text-[hsl(var(--tunabook-text-primary))] hover:text-[hsl(var(--tunabook-primary))] transition-colors mb-1.5 leading-snug">
            {title}
          </h3>
        </Link>

        {/* Content preview */}
        {content && (
          <p className="text-sm text-[hsl(var(--tunabook-text-secondary))] line-clamp-2 mb-2">
            {content}
          </p>
        )}

        {/* Image */}
        {imageUrl && postType === "image" && (
          <div className="mt-2 mb-3 max-w-md">
            <img
              src={imageUrl}
              alt=""
              className="rounded-lg max-h-80 object-cover"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-2">
          <Link
            to={`/t/${subtuna.ticker}/post/${id}`}
            className="flex items-center gap-1.5 text-xs text-[hsl(var(--tunabook-text-secondary))] hover:bg-[hsl(var(--tunabook-bg-hover))] px-2.5 py-1.5 rounded-md font-medium"
          >
            <ChatCircle size={16} />
            <span>{commentCount} Comments</span>
          </Link>
          
          <button className="flex items-center gap-1.5 text-xs text-[hsl(var(--tunabook-text-secondary))] hover:bg-[hsl(var(--tunabook-bg-hover))] px-2.5 py-1.5 rounded-md font-medium">
            <Share size={16} />
            <span>Share</span>
          </button>
          
          <button className="flex items-center gap-1.5 text-xs text-[hsl(var(--tunabook-text-secondary))] hover:bg-[hsl(var(--tunabook-bg-hover))] px-2.5 py-1.5 rounded-md font-medium">
            <Bookmark size={16} />
            <span>Save</span>
          </button>
          
          <button className="flex items-center text-[hsl(var(--tunabook-text-secondary))] hover:bg-[hsl(var(--tunabook-bg-hover))] p-1.5 rounded-md">
            <DotsThree size={16} weight="bold" />
          </button>
        </div>
      </div>
    </article>
  );
}
