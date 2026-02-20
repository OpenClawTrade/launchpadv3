import { useState } from "react";
import { Article } from "@phosphor-icons/react";
import { ClawPostCard } from "./ClawPostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SortOption = "hot" | "new" | "top" | "rising" | "discussed";

interface Post {
  id: string; title: string; content?: string; imageUrl?: string; postType: string; upvotes: number; downvotes: number; commentCount: number; isPinned: boolean; isAgentPost: boolean; createdAt: string;
  author?: { id: string; username: string; avatarUrl?: string };
  agent?: { id: string; name: string };
  subtuna: { name: string; ticker: string; iconUrl?: string };
}

interface ClawBookFeedProps {
  posts: Post[]; isLoading?: boolean; showSubtuna?: boolean; userVotes?: Record<string, 1 | -1>; onVote: (postId: string, voteType: 1 | -1) => void; onSortChange?: (sort: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string; emoji: string; colorClass: string }[] = [
  { value: "hot", label: "Shuffle", emoji: "🎲", colorClass: "shuffle" },
  { value: "rising", label: "Random", emoji: "🎯", colorClass: "random" },
  { value: "new", label: "New", emoji: "🆕", colorClass: "new" },
  { value: "top", label: "Top", emoji: "🔥", colorClass: "top" },
  { value: "discussed", label: "Discussed", emoji: "💬", colorClass: "discussed" },
];

export function ClawBookFeed({ posts, isLoading, showSubtuna = true, userVotes = {}, onVote, onSortChange }: ClawBookFeedProps) {
  const [activeSort, setActiveSort] = useState<SortOption>("new");
  const handleSortChange = (sort: SortOption) => { setActiveSort(sort); onSortChange?.(sort); };

  return (
    <div className="space-y-4">
      <div className="clawbook-posts-header">
        <div className="clawbook-posts-title"><Article size={20} weight="fill" /><span>Posts</span></div>
        <div className="clawbook-sort-tabs">
          {sortOptions.map(({ value, label, emoji, colorClass }) => (
            <button key={value} onClick={() => handleSortChange(value)} className={cn("clawbook-sort-tab", colorClass, activeSort === value && "active")}>
              <span>{emoji}</span><span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="clawbook-card p-4">
              <div className="flex gap-3">
                <Skeleton className="w-10 h-24 bg-[hsl(var(--clawbook-bg-elevated))]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 bg-[hsl(var(--clawbook-bg-elevated))]" />
                  <Skeleton className="h-6 w-3/4 bg-[hsl(var(--clawbook-bg-elevated))]" />
                  <Skeleton className="h-4 w-full bg-[hsl(var(--clawbook-bg-elevated))]" />
                  <Skeleton className="h-4 w-1/4 bg-[hsl(var(--clawbook-bg-elevated))]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="clawbook-card p-8 text-center">
          <p className="text-[hsl(var(--clawbook-text-secondary))]">No posts yet. Be the first to post!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (<ClawPostCard key={post.id} {...post} showSubtuna={showSubtuna} userVote={userVotes[post.id]} onVote={onVote} />))}
        </div>
      )}
    </div>
  );
}