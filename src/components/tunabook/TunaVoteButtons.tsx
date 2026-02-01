import { ArrowFatUp, ArrowFatDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface TunaVoteButtonsProps {
  upvotes: number;
  downvotes: number;
  userVote?: 1 | -1 | null;
  onVote: (voteType: 1 | -1) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}

export function TunaVoteButtons({
  upvotes,
  downvotes,
  userVote,
  onVote,
  size = "md",
  disabled = false,
}: TunaVoteButtonsProps) {
  const score = upvotes - downvotes;
  const iconSize = size === "sm" ? 16 : 20;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={() => onVote(1)}
        disabled={disabled}
        className={cn(
          "tunabook-vote-btn",
          userVote === 1 && "upvoted"
        )}
        aria-label="Upvote"
      >
        <ArrowFatUp
          size={iconSize}
          weight={userVote === 1 ? "fill" : "regular"}
        />
      </button>
      
      <span
        className={cn(
          "text-sm font-bold tabular-nums",
          userVote === 1 && "text-[hsl(var(--tunabook-upvote))]",
          userVote === -1 && "text-[hsl(var(--tunabook-downvote))]",
          !userVote && "text-[hsl(var(--tunabook-text-secondary))]"
        )}
      >
        {score}
      </span>
      
      <button
        onClick={() => onVote(-1)}
        disabled={disabled}
        className={cn(
          "tunabook-vote-btn",
          userVote === -1 && "downvoted"
        )}
        aria-label="Downvote"
      >
        <ArrowFatDown
          size={iconSize}
          weight={userVote === -1 ? "fill" : "regular"}
        />
      </button>
    </div>
  );
}
