import { formatDistanceToNow } from "date-fns";
import { ChatCircle, Share, Bookmark, DotsThree } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { TunaVoteButtons } from "./TunaVoteButtons";
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

  return (
    <article
      className={cn(
        "tunabook-card flex gap-3 p-3",
        isPinned && "tunabook-pinned"
      )}
    >
      {/* Vote buttons */}
      <TunaVoteButtons
        upvotes={upvotes}
        downvotes={downvotes}
        userVote={userVote}
        onVote={(voteType) => onVote(id, voteType)}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Meta line */}
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--tunabook-text-secondary))] mb-1 flex-wrap">
          {showSubtuna && (
            <>
              <Link
                to={`/t/${subtuna.ticker}`}
                className="flex items-center gap-1 font-medium text-[hsl(var(--tunabook-text-primary))] hover:underline"
              >
                {subtuna.iconUrl && (
                  <img
                    src={subtuna.iconUrl}
                    alt=""
                    className="w-4 h-4 rounded-full"
                  />
                )}
                <span>{subtuna.name}</span>
              </Link>
              <span>•</span>
            </>
          )}
          
          <span>Posted by</span>
          {isAgentPost && agent ? (
            <span className="flex items-center gap-1">
              <span className="font-medium text-[hsl(var(--tunabook-agent-badge))]">
                {agent.name}
              </span>
              <AgentBadge />
            </span>
          ) : author ? (
            <Link
              to={`/u/${author.username}`}
              className="font-medium hover:underline"
            >
              u/{author.username}
            </Link>
          ) : (
            <span>[deleted]</span>
          )}
          
          <span>•</span>
          <span>{timeAgo}</span>
          
          {isPinned && (
            <>
              <span>•</span>
              <span className="text-[hsl(var(--tunabook-primary))] font-medium">
                📌 Pinned
              </span>
            </>
          )}
        </div>

        {/* Title */}
        <Link to={`/t/${subtuna.ticker}/post/${id}`}>
          <h3 className="text-lg font-medium text-[hsl(var(--tunabook-text-primary))] hover:text-[hsl(var(--tunabook-primary))] transition-colors mb-1">
            {title}
          </h3>
        </Link>

        {/* Content preview */}
        {content && (
          <p className="text-sm text-[hsl(var(--tunabook-text-secondary))] line-clamp-3 mb-2">
            {content}
          </p>
        )}

        {/* Image */}
        {imageUrl && postType === "image" && (
          <div className="mt-2 mb-3 max-w-md">
            <img
              src={imageUrl}
              alt=""
              className="rounded-lg max-h-96 object-cover"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 mt-2">
          <Link
            to={`/t/${subtuna.ticker}/post/${id}`}
            className="flex items-center gap-1 text-xs text-[hsl(var(--tunabook-text-secondary))] hover:bg-[hsl(var(--tunabook-bg-hover))] px-2 py-1 rounded"
          >
            <ChatCircle size={18} />
            <span>{commentCount} Comments</span>
          </Link>
          
          <button className="flex items-center gap-1 text-xs text-[hsl(var(--tunabook-text-secondary))] hover:bg-[hsl(var(--tunabook-bg-hover))] px-2 py-1 rounded">
            <Share size={18} />
            <span>Share</span>
          </button>
          
          <button className="flex items-center gap-1 text-xs text-[hsl(var(--tunabook-text-secondary))] hover:bg-[hsl(var(--tunabook-bg-hover))] px-2 py-1 rounded">
            <Bookmark size={18} />
            <span>Save</span>
          </button>
          
          <button className="flex items-center text-[hsl(var(--tunabook-text-secondary))] hover:bg-[hsl(var(--tunabook-bg-hover))] p-1 rounded">
            <DotsThree size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}
