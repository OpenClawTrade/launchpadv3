import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useFunTokensPaginated } from "@/hooks/useFunTokensPaginated";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import {
  Copy,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Users,
  Flame,
  Crown,
  Gem,
  Bot,
  ExternalLink,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PumpBadge } from "@/components/tunabook/PumpBadge";
import { BagsBadge } from "@/components/tunabook/BagsBadge";
import { PhantomBadge } from "@/components/tunabook/PhantomBadge";

interface TokenTableProps {
  solPrice: number | null;
  promotedTokenIds?: Set<string>;
  onPromote?: (tokenId: string, name: string, ticker: string) => void;
}

export function TokenTable({ solPrice, promotedTokenIds, onPromote }: TokenTableProps) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const pageSize = 60;

  const { tokens, totalCount, isLoading } = useFunTokensPaginated(page, pageSize);
  const totalPages = Math.ceil(totalCount / pageSize);

  const copyToClipboard = (text: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    toast({ title: "Copied!", description: "Address copied to clipboard" });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatUsd = (mcapSol: number | null | undefined) => {
    if (!mcapSol || !solPrice) return "$0";
    const usd = mcapSol * solPrice;
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
    return `$${usd.toFixed(0)}`;
  };

  const formatAge = (createdAt: string | null) => {
    if (!createdAt) return "-";
    return formatDistanceToNow(new Date(createdAt), { addSuffix: false });
  };

  // Segment tokens into 3 columns by bonding progress
  const newPairs = tokens.filter(t => (t.bonding_progress ?? 0) < 30);
  const almostBonded = tokens.filter(t => (t.bonding_progress ?? 0) >= 30 && (t.bonding_progress ?? 0) < 80);
  const bonded = tokens.filter(t => (t.bonding_progress ?? 0) >= 80);

  const TokenRow = ({ token, index }: { token: typeof tokens[number]; index: number }) => {
    const isNearGraduation = (token.bonding_progress ?? 0) >= 80;
    const isPromoted = promotedTokenIds?.has(token.id) || false;
    const isPumpFun = token.launchpad_type === 'pumpfun';
    const isBags = token.launchpad_type === 'bags';
    const isPhantom = token.launchpad_type === 'phantom';
    const isAgent = !!token.agent_id;

    const tradeUrl = (isPumpFun || isBags || isAgent)
      ? `/t/${token.ticker}`
      : `/launchpad/${token.mint_address}`;

    const priceChange = token.price_change_24h;
    const progress = token.bonding_progress ?? 0;

    return (
      <Link
        to={tradeUrl}
        className={`
          flex items-center gap-2 px-3 py-2 border-b border-border/50 last:border-b-0
          hover:bg-secondary/40 transition-colors group cursor-pointer
          ${isPromoted ? "bg-warning/5 border-l-2 border-l-warning" : ""}
        `}
      >
        {/* Token Image */}
        <div className={`
          relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-secondary
          ${isNearGraduation ? "ring-1 ring-orange-500" : ""}
          ${isPromoted ? "ring-1 ring-warning" : ""}
        `}>
          {token.image_url ? (
            <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
              {token.ticker?.slice(0, 2)}
            </div>
          )}
          {/* Source badge overlay */}
          <div className="absolute -bottom-0.5 -right-0.5">
            {isPumpFun ? (
              <PumpBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />
            ) : isBags ? (
              <BagsBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />
            ) : isPhantom ? (
              <PhantomBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" />
            ) : null}
          </div>
        </div>

        {/* Token Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-xs font-semibold text-foreground truncate leading-tight">
              {token.name}
            </span>
            {isNearGraduation && <Flame className="h-2.5 w-2.5 text-orange-500 flex-shrink-0" />}
            {isPromoted && <Crown className="h-2.5 w-2.5 text-warning flex-shrink-0" />}
            {(token.fee_mode === "holder_rewards" || token.fee_mode === "holders") && (
              <Gem className="h-2.5 w-2.5 text-accent-foreground flex-shrink-0" />
            )}
            {isAgent && <Bot className="h-2.5 w-2.5 text-purple-400 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground">${token.ticker}</span>
            <span className="text-[10px] text-muted-foreground/60">·</span>
            <span className="text-[10px] text-muted-foreground/60">{formatAge(token.created_at)}</span>
          </div>
          {/* Bonding progress bar */}
          <Progress value={progress} className="h-0.5 mt-1 w-full" />
        </div>

        {/* Stats */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0 min-w-[60px]">
          <span className="text-xs font-semibold text-foreground">{formatUsd(token.market_cap_sol)}</span>
          {priceChange != null ? (
            <span className={`text-[10px] font-medium flex items-center gap-0.5 ${
              priceChange > 0 ? "text-success" : priceChange < 0 ? "text-destructive" : "text-muted-foreground"
            }`}>
              {priceChange > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : priceChange < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
              {priceChange === 0 ? "0%" : `${priceChange > 0 ? "+" : ""}${priceChange.toFixed(1)}%`}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">0%</span>
          )}
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />{token.holder_count ?? 0}
          </span>
        </div>

        {/* Quick Buy Button */}
        <Button
          size="sm"
          className="h-6 px-2 text-[10px] font-bold bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/30 rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`https://raydium.io/swap/?inputMint=sol&outputMint=${token.mint_address}`, '_blank');
          }}
        >
          <Zap className="h-3 w-3 mr-0.5" />
          Buy
        </Button>
      </Link>
    );
  };

  const ColumnSkeleton = () => (
    <div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-3 w-24 mb-1" />
            <Skeleton className="h-2 w-16 mb-1" />
            <Skeleton className="h-0.5 w-full" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-2 w-8" />
          </div>
        </div>
      ))}
    </div>
  );

  const ColumnHeader = ({ title, count, color }: { title: string; count: number; color: string }) => (
    <div className={`flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">{title}</span>
      </div>
      <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{count}</span>
    </div>
  );

  return (
    <div className="w-full">
      {/* 3-Column Trading Terminal Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Column 1: New Pairs */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <ColumnHeader title="New Pairs" count={newPairs.length} color="bg-primary" />
          <div className="overflow-y-auto max-h-[600px] scrollbar-thin">
            {isLoading ? (
              <ColumnSkeleton />
            ) : newPairs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">No new pairs yet</div>
            ) : (
              newPairs.map((token, i) => <TokenRow key={token.id} token={token} index={i} />)
            )}
          </div>
        </div>

        {/* Column 2: Almost Bonded */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <ColumnHeader title="Almost Bonded" count={almostBonded.length} color="bg-warning" />
          <div className="overflow-y-auto max-h-[600px] scrollbar-thin">
            {isLoading ? (
              <ColumnSkeleton />
            ) : almostBonded.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">No tokens almost bonded</div>
            ) : (
              almostBonded.map((token, i) => <TokenRow key={token.id} token={token} index={i} />)
            )}
          </div>
        </div>

        {/* Column 3: Bonded / Near Graduation */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <ColumnHeader title="Bonded" count={bonded.length} color="bg-success" />
          <div className="overflow-y-auto max-h-[600px] scrollbar-thin">
            {isLoading ? (
              <ColumnSkeleton />
            ) : bonded.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">No bonded tokens</div>
            ) : (
              bonded.map((token, i) => <TokenRow key={token.id} token={token} index={i} />)
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages} ({totalCount} tokens)</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-7 px-2 text-xs"
            >
              <ChevronLeft className="h-3 w-3 mr-1" />Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-7 px-2 text-xs"
            >
              Next<ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
