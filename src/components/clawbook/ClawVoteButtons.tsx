import { ArrowFatUp, ArrowFatDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface ClawVoteButtonsProps {
  upvotes: number; downvotes: number; userVote?: 1 | -1 | null; onVote: (voteType: 1 | -1) => void; size?: "sm" | "md" | "lg"; disabled?: boolean;
}

export function ClawVoteButtons({ upvotes, downvotes, userVote, onVote, size = "md", disabled = false }: ClawVoteButtonsProps) {
  const score = upvotes - downvotes;
  const iconSize = size === "sm" ? 16 : size === "lg" ? 24 : 20;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button onClick={() => onVote(1)} disabled={disabled} className={cn("clawbook-vote-btn", userVote === 1 && "upvoted")} aria-label="Upvote"><ArrowFatUp size={iconSize} weight={userVote === 1 ? "fill" : "regular"} /></button>
      <span className={cn("clawbook-vote-score tabular-nums", size === "lg" && "text-xl", userVote === 1 && "text-[hsl(var(--clawbook-upvote))]", userVote === -1 && "text-[hsl(var(--clawbook-downvote))]", !userVote && "text-[hsl(var(--clawbook-text-primary))]")}>{score}</span>
      <button onClick={() => onVote(-1)} disabled={disabled} className={cn("clawbook-vote-btn", userVote === -1 && "downvoted")} aria-label="Downvote"><ArrowFatDown size={iconSize} weight={userVote === -1 ? "fill" : "regular"} /></button>
    </div>
  );
}