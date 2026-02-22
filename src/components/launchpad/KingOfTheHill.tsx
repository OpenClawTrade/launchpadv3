import { Link } from "react-router-dom";
import { Users, Bot, BadgeCheck } from "lucide-react";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useKingOfTheHill, type KingToken } from "@/hooks/useKingOfTheHill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PumpBadge } from "@/components/clawbook/PumpBadge";
import { BagsBadge } from "@/components/clawbook/BagsBadge";
import { useEffect, useState } from "react";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";

/* ── rank styling ── */
const RANKS = [
  { accent: "border-orange-500/20", hoverAccent: "hover:border-orange-400/40", mcap: "text-emerald-400", badgeBg: "from-orange-500 to-amber-600", king: true },
  { accent: "border-slate-600/20", hoverAccent: "hover:border-cyan-500/30", mcap: "text-emerald-400", badgeBg: "from-cyan-600 to-teal-700", king: false },
  { accent: "border-slate-600/15", hoverAccent: "hover:border-cyan-500/20", mcap: "text-emerald-400", badgeBg: "from-slate-600 to-slate-700", king: false },
];

function extractXUsername(url?: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).pathname.split("/").filter(Boolean)[0] || null; } catch { return null; }
}

/* ── progress bar ── */
function Bar({ value }: { value: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(Math.min(value, 100)), 100); return () => clearTimeout(t); }, [value]);

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium">Progress</span>
        <span className="text-sm font-bold text-foreground font-mono tabular-nums">{value.toFixed(0)}%</span>
      </div>
      <div className="h-2.5 w-full rounded-md overflow-hidden" style={{ background: "hsl(215 25% 18%)" }}>
        <div
          className="h-full rounded-md bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-[1s] ease-out relative"
          style={{ width: `${Math.max(w, 2)}%` }}
        >
          <div className="absolute inset-0 rounded-md overflow-hidden">
            <div className="absolute -left-full top-0 w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── card ── */
function Card({ token, rank }: { token: KingToken; rank: number }) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const schedule = () => {
      const delay = 2000 + Math.random() * 4000; // 2-6s random
      return setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 300);
        timerId = schedule();
      }, delay);
    };
    let timerId = schedule();
    return () => clearTimeout(timerId);
  }, []);
  const { solPrice } = useSolPrice();
  const progress = token.bonding_progress ?? 0;
  const mcapUsd = (token.market_cap_sol ?? 0) * (solPrice || 0);
  const isPump = token.launchpad_type === "pumpfun";
  const isBags = token.launchpad_type === "bags";
  const isTrader = !!(token.trading_agent_id || token.is_trading_agent_token);
  const r = RANKS[rank - 1] || RANKS[2];

  const xUser = extractXUsername(token.twitter_url);
  const xAvatar = token.twitter_avatar_url;
  const verified = token.twitter_verified;
  const vType = token.twitter_verified_type;
  const checkClr = vType === "business" || vType === "government" ? "#EAB308" : "#1D9BF0";

  const url = `/launchpad/${token.mint_address || token.dbc_pool_address || token.id}`;

  return (
    <Link
      to={url}
      className={cn(
        "group relative flex flex-col md:flex-1 md:min-w-0",
        "rounded-xl border transition-all duration-200",
        "cursor-pointer",
        "p-4 md:p-5",
        r.accent, r.hoverAccent,
        "hover:scale-[1.02] active:scale-[0.99]",
        blink && "animate-[king-blink_0.3s_ease-in-out]",
      )}
      style={{
        background: "hsl(215 28% 12% / 0.55)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Top: rank + avatar + name block */}
      <div className="flex items-center gap-3 mb-3.5">
        {/* Rank */}
        <div className={cn(
          "flex-shrink-0 flex items-center justify-center rounded-lg font-bold text-white text-sm shadow-sm bg-gradient-to-br",
          r.badgeBg,
          r.king ? "w-10 h-10" : "w-9 h-9 text-xs",
        )}>
          #{rank}
        </div>

        {/* Avatar */}
        <div className={cn(
          "flex-shrink-0 rounded-full overflow-hidden",
          r.king ? "w-10 h-10" : "w-9 h-9",
        )} style={{ border: "1.5px solid hsl(215 20% 25%)" }}>
          <OptimizedTokenImage
            src={token.image_url}
            alt={token.name}
            fallbackText={token.ticker}
            size={80}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Name + creator */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-semibold text-foreground truncate">{token.name}</span>
            {isTrader && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                style={{ background: "hsl(187 70% 55% / 0.1)", color: "hsl(187 70% 55%)", border: "1px solid hsl(187 70% 55% / 0.15)" }}>
                <Bot className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />Trader
              </span>
            )}
            {isPump && <PumpBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />}
            {isBags && <BagsBadge mintAddress={token.mint_address ?? undefined} showText={false} />}
          </div>
          {xUser && (
            <div className="flex items-center gap-1 mt-0.5">
              {xAvatar && (
                <img src={xAvatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0" style={{ border: "1px solid hsl(215 20% 28%)" }} />
              )}
              <span className="text-[11px] text-muted-foreground/50 truncate">@{xUser}</span>
              {verified && <BadgeCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: checkClr }} />}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: mcap + holders | progress */}
      <div className="flex items-end gap-4">
        <div className="flex-shrink-0">
          <span className={cn("text-lg font-bold font-mono tabular-nums block leading-none", r.mcap)}>
            ${mcapUsd >= 1000 ? `${(mcapUsd / 1000).toFixed(1)}K` : mcapUsd.toFixed(0)}
          </span>
          <div className="flex items-center gap-1 mt-1 text-muted-foreground/30">
            <Users className="w-3 h-3" />
            <span className="text-[10px] font-mono">{token.holder_count ?? 0}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <Bar value={progress} />
        </div>
      </div>
    </Link>
  );
}

/* ── skeleton ── */
function CardSkeleton() {
  return (
    <div className="flex flex-col md:flex-1 rounded-xl border border-slate-700/20 p-4 md:p-5"
      style={{ background: "hsl(215 28% 12% / 0.55)", backdropFilter: "blur(20px)" }}>
      <div className="flex items-center gap-3 mb-3.5">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <Skeleton className="w-9 h-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-2.5 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

/* ── export ── */
export function KingOfTheHill() {
  const { tokens, isLoading } = useKingOfTheHill();

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-baseline gap-3 mb-4">
        <img src="/claw-logo.png" alt="" className="w-4 h-4 object-contain self-center" />
        <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-foreground">King of the Claws</h2>
        <span className="text-[11px] text-muted-foreground/40">Soon to Graduate</span>
        <div className="flex-1 h-px bg-border/40 ml-1 self-center" />
      </div>

      {/* Row */}
      <div className="flex flex-col md:flex-row gap-3">
        {isLoading
          ? [1, 2, 3].map(i => <CardSkeleton key={i} />)
          : tokens?.map((t, i) => <Card key={t.id} token={t} rank={i + 1} />)
        }
      </div>
    </div>
  );
}
