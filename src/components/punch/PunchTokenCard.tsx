import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { Link } from "react-router-dom";
import type { PunchToken } from "@/hooks/usePunchTokenFeed";
import type { VoteCounts } from "@/hooks/usePunchVotes";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface PunchTokenCardProps {
  token: PunchToken;
  voteCounts: VoteCounts;
  onVote: (tokenId: string, voteType: 1 | -1) => void;
}

export function PunchTokenCard({ token, voteCounts, onVote }: PunchTokenCardProps) {
  const [shaking, setShaking] = useState(false);

  const handleVote = (voteType: 1 | -1) => {
    setShaking(true);
    onVote(token.id, voteType);
    setTimeout(() => setShaking(false), 300);
  };

  return (
    <div
      className={`flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-card/80 transition-all ${
        shaking ? "animate-punch-vote-shake" : ""
      }`}
    >
      <Link to={token.mint_address ? `/launchpad/${token.mint_address}` : "#"} className="shrink-0">
        <OptimizedTokenImage
          src={token.image_url}
          fallbackText={token.ticker}
          size={80}
          className="w-10 h-10 rounded-lg object-cover"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          to={token.mint_address ? `/launchpad/${token.mint_address}` : "#"}
          className="block truncate text-xs font-bold text-foreground hover:text-primary transition-colors"
        >
          {token.name}
        </Link>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="font-mono">${token.ticker}</span>
          <span>·</span>
          <span>{timeAgo(token.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => handleVote(1)}
          className={`flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] font-bold transition-all active:scale-110 ${
            voteCounts.userVote === 1
              ? "bg-green-500/20 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
              : "text-muted-foreground hover:text-green-400 hover:bg-green-500/10"
          }`}
        >
          <ThumbsUp className="h-3 w-3" />
          <span>{voteCounts.likes}</span>
        </button>
        <button
          onClick={() => handleVote(-1)}
          className={`flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] font-bold transition-all active:scale-110 ${
            voteCounts.userVote === -1
              ? "bg-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
              : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
          }`}
        >
          <ThumbsDown className="h-3 w-3" />
          <span>{voteCounts.dislikes}</span>
        </button>
      </div>
    </div>
  );
}
