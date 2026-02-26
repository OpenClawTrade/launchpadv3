import { useMemo, useState } from "react";
import { Rocket, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePunchTokenFeed } from "@/hooks/usePunchTokenFeed";
import { usePunchVotes } from "@/hooks/usePunchVotes";
import { usePunchMarketData } from "@/hooks/usePunchMarketData";
import { PunchTokenCard } from "./PunchTokenCard";

const PAGE_SIZE = 10;

export function PunchTokenFeed() {
  const { tokens, loading } = usePunchTokenFeed();
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(tokens.length / PAGE_SIZE));
  const pagedTokens = useMemo(
    () => tokens.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [tokens, page]
  );

  // Only fetch votes/market data for current page
  const tokenIds = pagedTokens.map((t) => t.id);
  const { votes, vote } = usePunchVotes(tokenIds);
  const marketTokens = useMemo(
    () => pagedTokens.filter((t) => t.mint_address).map((t) => ({
      mint_address: t.mint_address!,
      created_at: t.created_at,
    })),
    [pagedTokens]
  );
  const marketData = usePunchMarketData(marketTokens);

  // Reset to page 0 if new tokens arrive and we're on page 0
  // (so new tokens appear immediately)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
        <Rocket className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-black text-foreground tracking-tight uppercase">
          Tokens Launched 🔥
        </h2>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {tokens.length} total
        </span>
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
          {pagedTokens.map((token) => (
            <PunchTokenCard
              key={token.id}
              token={token}
              voteCounts={votes[token.id] || { likes: 0, dislikes: 0, userVote: null }}
              onVote={vote}
              marketData={token.mint_address ? marketData[token.mint_address] : undefined}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-3 py-2 border-t border-border">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-mono text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
