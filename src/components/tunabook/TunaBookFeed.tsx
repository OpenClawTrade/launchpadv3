import { useState } from "react";
import { Fire, Clock, TrendUp, Sparkle } from "@phosphor-icons/react";
import { TunaPostCard } from "./TunaPostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SortOption = "hot" | "new" | "top" | "rising";

interface Post {
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
}

interface TunaBookFeedProps {
  posts: Post[];
  isLoading?: boolean;
  showSubtuna?: boolean;
  userVotes?: Record<string, 1 | -1>;
  onVote: (postId: string, voteType: 1 | -1) => void;
  onSortChange?: (sort: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string; icon: typeof Fire }[] = [
  { value: "hot", label: "Hot", icon: Fire },
  { value: "new", label: "New", icon: Clock },
  { value: "top", label: "Top", icon: TrendUp },
  { value: "rising", label: "Rising", icon: Sparkle },
];

export function TunaBookFeed({
  posts,
  isLoading,
  showSubtuna = true,
  userVotes = {},
  onVote,
  onSortChange,
}: TunaBookFeedProps) {
  const [activeSort, setActiveSort] = useState<SortOption>("hot");

  const handleSortChange = (sort: SortOption) => {
    setActiveSort(sort);
    onSortChange?.(sort);
  };

  return (
    <div className="space-y-4">
      {/* Sort tabs */}
      <div className="tunabook-card p-2 flex items-center gap-1 overflow-x-auto">
        {sortOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => handleSortChange(value)}
            className={cn(
              "tunabook-sort-tab flex items-center gap-1.5 whitespace-nowrap",
              activeSort === value && "active"
            )}
          >
            <Icon size={18} weight={activeSort === value ? "fill" : "regular"} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="tunabook-card p-4">
              <div className="flex gap-3">
                <Skeleton className="w-8 h-20" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="tunabook-card p-8 text-center">
          <p className="text-[hsl(var(--tunabook-text-secondary))]">
            No posts yet. Be the first to post!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <TunaPostCard
              key={post.id}
              {...post}
              showSubtuna={showSubtuna}
              userVote={userVotes[post.id]}
              onVote={onVote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
