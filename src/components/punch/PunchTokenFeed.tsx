import { Rocket, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePunchTokenFeed } from "@/hooks/usePunchTokenFeed";
import { usePunchVotes } from "@/hooks/usePunchVotes";
import { PunchTokenCard } from "./PunchTokenCard";

export function PunchTokenFeed() {
  const { tokens, loading } = usePunchTokenFeed();
  const tokenIds = tokens.map((t) => t.id);
  const { votes, vote } = usePunchVotes(tokenIds);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
        <Rocket className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-black text-foreground tracking-tight uppercase">
          Tokens Launched 🔥
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && tokens.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              No tokens punched yet. Be the first! 👊
            </p>
          )}
          {tokens.map((token) => (
            <PunchTokenCard
              key={token.id}
              token={token}
              voteCounts={votes[token.id] || { likes: 0, dislikes: 0, userVote: null }}
              onVote={vote}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
