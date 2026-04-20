import { Link } from "react-router-dom";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useChain } from "@/contexts/ChainContext";
import { useCodexNewPairs, ETH_NETWORK_ID, BSC_NETWORK_ID, type CodexPairToken } from "@/hooks/useCodexNewPairs";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { LiveAge } from "@/components/ui/LiveAge";
import { Skeleton } from "@/components/ui/skeleton";

const AVATAR_PALETTE = ["#9ee6aa", "#9ec9e6", "#e6a6e6", "#e69c9c", "#f5a524", "#fff", "#ffd58b"];

function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function fmtUsd(v: number) {
  if (!Number.isFinite(v) || v <= 0) return "$0";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function PulseRow({ token, isBig }: { token: CodexPairToken; isBig?: boolean }) {
  const change = token.change24h ?? 0;
  const isUp = change >= 0;
  const initial = (token.symbol || token.name || "?").charAt(0).toUpperCase();
  const color = colorFor(token.symbol || token.name || "x");
  const big = Math.abs(change) >= 100;

  return (
    <Link
      to={`/trade/${token.address}`}
      className="grid grid-cols-[42px_minmax(0,1fr)_auto] gap-3 items-center px-3 sm:px-4 py-3 border-b-2 border-dashed border-pop-ink/15 last:border-b-0 hover:bg-white transition-colors"
    >
      {/* avatar */}
      <div
        className="w-[42px] h-[42px] border-2 border-pop-ink rounded-full flex items-center justify-center font-pop-display text-[15px] text-pop-ink overflow-hidden shrink-0"
        style={{ background: color }}
      >
        {token.imageUrl ? (
          <OptimizedTokenImage src={token.imageUrl} fallbackSrc={token.fallbackImageUrl || undefined} alt={token.name} className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </div>

      {/* info */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-pop-display text-[13px] sm:text-[14px] text-pop-ink tracking-[-0.01em] truncate">
            {token.symbol}
          </span>
          <LiveAge
            createdAt={token.createdAt}
            isUnixSeconds
            className="font-pop-mono font-normal text-[9px] bg-pop-ink text-pop-orange px-1.5 py-[2px] tracking-[0.1em] shrink-0"
          />
        </div>
        <div className="font-pop-mono text-[10px] sm:text-[11px] text-[#3a1f14] tracking-[0.05em] mt-0.5 truncate">
          {token.name}
        </div>
      </div>

      {/* metrics */}
      <div className="text-right font-pop-mono shrink-0">
        <div className="font-bold text-[12px] sm:text-[13px] text-pop-ink">{fmtUsd(token.marketCap)}</div>
        <div
          className={cn(
            "text-[10px] font-bold tracking-[0.05em] mt-[2px]",
            big ? "bg-pop-ink text-pop-orange px-1.5 inline-block" : isUp ? "text-[#0b8a3a]" : "text-[#c8372d]"
          )}
        >
          {isUp ? "+" : ""}
          {change.toFixed(1)}%
        </div>
      </div>
    </Link>
  );
}

function PulseColumn({
  label,
  icon,
  count,
  showDot,
  tokens,
  loading,
}: {
  label: string;
  icon: string;
  count: number;
  showDot?: boolean;
  tokens: CodexPairToken[];
  loading: boolean;
}) {
  return (
    <div className="bg-pop-cream border-2 border-pop-ink shadow-[6px_6px_0_hsl(var(--pop-ink))] flex flex-col">
      {/* head */}
      <div className="flex items-center gap-2 px-4 py-3 bg-pop-ink text-pop-cream font-pop-mono text-[11px] tracking-[0.15em] uppercase font-bold">
        <span className="text-pop-orange">{icon}</span>
        <span>{label}</span>
        <span className="ml-auto text-pop-orange font-bold">· {count}</span>
        {showDot && (
          <span className="w-2 h-2 rounded-full bg-pop-orange shadow-[0_0_10px_hsl(var(--pop-orange))] animate-pulse" />
        )}
      </div>

      {/* rows */}
      <div className="flex-1">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b-2 border-dashed border-pop-ink/15 last:border-b-0">
                <Skeleton className="h-10 bg-pop-ink/10" />
              </div>
            ))
          : tokens.length === 0
            ? <div className="px-4 py-8 text-center font-pop-mono text-[11px] text-pop-ink/60">No tokens yet</div>
            : tokens.map((t) => <PulseRow key={t.address || t.symbol} token={t} />)}
      </div>
    </div>
  );
}

export function PopshibaPulse() {
  const { chain } = useChain();
  const networkId = chain === "bnb" ? BSC_NETWORK_ID : ETH_NETWORK_ID;
  const { newPairs, completing, graduated, isLoading } = useCodexNewPairs(networkId);

  const newPairs5 = useMemo(() => (newPairs || []).slice(0, 5), [newPairs]);
  const completing5 = useMemo(() => (completing || []).slice(0, 5), [completing]);
  const graduated5 = useMemo(() => (graduated || []).slice(0, 5), [graduated]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
      <PulseColumn
        label="New Pairs"
        icon="＋"
        count={newPairs?.length || 0}
        showDot
        tokens={newPairs5}
        loading={isLoading}
      />
      <PulseColumn
        label="Final Stretch"
        icon="◈"
        count={completing?.length || 0}
        tokens={completing5}
        loading={isLoading}
      />
      <div className="md:col-span-2 xl:col-span-1">
        <PulseColumn
          label="Migrated"
          icon="⇆"
          count={graduated?.length || 0}
          tokens={graduated5}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
