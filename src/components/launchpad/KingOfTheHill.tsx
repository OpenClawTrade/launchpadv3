import { Link } from "react-router-dom";
import { Users, Bot, Zap, BadgeCheck } from "lucide-react";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useKingOfTheHill, type KingToken } from "@/hooks/useKingOfTheHill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PumpBadge } from "@/components/clawbook/PumpBadge";
import { BagsBadge } from "@/components/clawbook/BagsBadge";
import { useEffect, useState } from "react";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";

/* ─── rank config ─── */
const RANK_CONFIG = [
  {
    border: "border-orange-500/20",
    hoverBorder: "hover:border-orange-400/50",
    glow: "shadow-[0_0_20px_rgba(249,115,22,0.1),0_4px_24px_rgba(0,0,0,0.4)]",
    hoverGlow: "hover:shadow-[0_0_36px_rgba(249,115,22,0.25),0_8px_40px_rgba(0,0,0,0.5)]",
    badgeBg: "bg-gradient-to-br from-orange-500 to-amber-600",
    mcapColor: "text-orange-400",
    ringColor: "ring-orange-500/30",
    isKing: true,
  },
  {
    border: "border-cyan-500/12",
    hoverBorder: "hover:border-cyan-400/35",
    glow: "shadow-[0_0_14px_rgba(34,211,238,0.06),0_4px_20px_rgba(0,0,0,0.35)]",
    hoverGlow: "hover:shadow-[0_0_28px_rgba(34,211,238,0.18),0_8px_32px_rgba(0,0,0,0.45)]",
    badgeBg: "bg-gradient-to-br from-cyan-500 to-teal-600",
    mcapColor: "text-cyan-400",
    ringColor: "ring-cyan-500/20",
    isKing: false,
  },
  {
    border: "border-slate-600/15",
    hoverBorder: "hover:border-cyan-500/25",
    glow: "shadow-[0_0_10px_rgba(34,211,238,0.04),0_4px_16px_rgba(0,0,0,0.3)]",
    hoverGlow: "hover:shadow-[0_0_22px_rgba(34,211,238,0.12),0_8px_28px_rgba(0,0,0,0.4)]",
    badgeBg: "bg-gradient-to-br from-teal-600 to-cyan-700",
    mcapColor: "text-teal-400",
    ringColor: "ring-teal-500/15",
    isKing: false,
  },
];

/* ─── extract X username from twitter_url ─── */
function extractXUsername(twitterUrl?: string | null): string | null {
  if (!twitterUrl) return null;
  try {
    const url = new URL(twitterUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] || null;
  } catch {
    return null;
  }
}

/* ─── progress bar ─── */
function ProgressBar({ value }: { value: number }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(value, 100)), 80);
    return () => clearTimeout(t);
  }, [value]);

  const isUrgent = value >= 70;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] tracking-wide text-muted-foreground/40 font-medium">
          Progress
        </span>
        <span className="text-sm font-bold text-white font-mono tabular-nums">
          {value.toFixed(0)}%
        </span>
      </div>
      <div className="relative h-2.5 w-full rounded-full bg-slate-700/60 overflow-hidden">
        <div className="absolute inset-0 z-10 rounded-full bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-[1200ms] ease-out relative",
            isUrgent
              ? "from-orange-500 via-amber-400 to-orange-500"
              : "from-teal-500 via-cyan-400 to-emerald-400"
          )}
          style={{ width: `${Math.max(width, 2.5)}%` }}
        >
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute -left-full top-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── crown SVG ─── */
function ClawCrown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 18L5 8L9 12L12 4L15 12L19 8L21 18H3Z"
        fill="url(#crownG)"
        stroke="rgba(251,191,36,0.5)"
        strokeWidth="0.8"
      />
      <defs>
        <linearGradient id="crownG" x1="3" y1="4" x2="21" y2="18">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── single card ─── */
function KothCard({ token, rank }: { token: KingToken; rank: number }) {
  const { solPrice } = useSolPrice();
  const progress = token.bonding_progress ?? 0;
  const marketCapUsd = (token.market_cap_sol ?? 0) * (solPrice || 0);
  const isPumpFun = token.launchpad_type === "pumpfun";
  const isBags = token.launchpad_type === "bags";
  const isTradingAgent = !!(token.trading_agent_id || token.is_trading_agent_token);
  const idx = rank - 1;
  const config = RANK_CONFIG[idx] || RANK_CONFIG[2];

  const xUsername = extractXUsername(token.twitter_url);
  const xAvatar = token.twitter_avatar_url;
  const isVerified = token.twitter_verified;
  const verifiedType = token.twitter_verified_type;
  const checkColor =
    verifiedType === "business" || verifiedType === "government"
      ? "hsl(38 92% 50%)"
      : "hsl(210 100% 52%)";

  const tradeUrl =
    isPumpFun || isBags || isTradingAgent
      ? `/t/${token.ticker}`
      : token.agent_id
        ? `/t/${token.ticker}`
        : `/launchpad/${token.mint_address || token.dbc_pool_address || token.id}`;

  return (
    <Link
      to={tradeUrl}
      className={cn(
        "group relative flex flex-col rounded-2xl",
        "bg-[#0F172A]/70 backdrop-blur-[20px]",
        "border transition-all duration-300 ease-spring cursor-pointer",
        "p-4 md:p-5",
        // flex sizing: equal width on desktop row
        "md:flex-1 md:min-w-0",
        config.border,
        config.hoverBorder,
        config.glow,
        config.hoverGlow,
        "hover:scale-[1.03] active:scale-[0.98]",
        config.isKing && "animate-king-pulse"
      )}
    >
      {/* Urgency badge */}
      {progress >= 70 && (
        <div className="absolute top-2.5 right-3 flex items-center gap-0.5 text-orange-400 animate-pulse z-10">
          <Zap className="w-3 h-3 fill-orange-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Graduating</span>
        </div>
      )}

      {/* Top row: rank + avatar + name */}
      <div className="flex items-center gap-3 mb-3">
        {/* Rank badge */}
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              "flex items-center justify-center rounded-full font-black text-white shadow-lg",
              config.badgeBg,
              config.isKing ? "w-12 h-12 text-lg" : "w-10 h-10 text-base"
            )}
          >
            #{rank}
          </div>
          {config.isKing && (
            <div className="absolute -top-2.5 -right-1 animate-bounce-subtle">
              <ClawCrown className="w-4.5 h-4.5 drop-shadow-[0_0_5px_rgba(251,191,36,0.4)]" />
            </div>
          )}
        </div>

        {/* Avatar */}
        <div
          className={cn(
            "relative rounded-full flex-shrink-0 overflow-hidden ring-2 ring-offset-1 ring-offset-transparent",
            config.ringColor,
            config.isKing ? "w-12 h-12" : "w-10 h-10"
          )}
        >
          <OptimizedTokenImage
            src={token.image_url}
            alt={token.name}
            fallbackText={token.ticker}
            size={96}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Name + creator */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[15px] md:text-base font-bold text-white truncate leading-tight">
              {token.name}
            </span>
            {isTradingAgent && (
              <span className="flex items-center gap-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-px rounded-full text-[8px] font-semibold flex-shrink-0 uppercase tracking-wider">
                <Bot className="w-2.5 h-2.5" />
                Trader
              </span>
            )}
            {isPumpFun && (
              <PumpBadge
                mintAddress={token.mint_address ?? undefined}
                showText={false}
                size="sm"
                className="px-0 py-0 bg-transparent hover:bg-transparent"
              />
            )}
            {isBags && <BagsBadge mintAddress={token.mint_address ?? undefined} showText={false} />}
          </div>
          {/* Creator X attribution */}
          {xUsername && (
            <div className="flex items-center gap-1 mt-0.5">
              {xAvatar && (
                <img
                  src={xAvatar}
                  alt={`@${xUsername}`}
                  className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                />
              )}
              <span className="text-[11px] text-muted-foreground/60 truncate">
                @{xUsername}
              </span>
              {isVerified && (
                <BadgeCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: checkColor }} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: mcap + holders + progress */}
      <div className="flex items-end gap-3">
        {/* Mcap + holders */}
        <div className="flex-shrink-0 space-y-0.5">
          <span
            className={cn(
              "font-extrabold font-mono tabular-nums block",
              config.isKing ? "text-xl" : "text-lg",
              config.mcapColor
            )}
          >
            ${marketCapUsd >= 1000 ? `${(marketCapUsd / 1000).toFixed(1)}K` : marketCapUsd.toFixed(0)}
          </span>
          <div className="flex items-center gap-1 text-muted-foreground/35">
            <Users className="w-3 h-3" />
            <span className="text-[10px] font-mono">{token.holder_count ?? 0}</span>
          </div>
        </div>

        {/* Progress — fills remaining space */}
        <div className="flex-1 min-w-0">
          <ProgressBar value={progress} />
        </div>
      </div>
    </Link>
  );
}

/* ─── skeleton ─── */
function KothSkeleton({ rank }: { rank: number }) {
  const config = RANK_CONFIG[rank - 1] || RANK_CONFIG[2];
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl p-4 md:p-5 md:flex-1",
        "bg-[#0F172A]/70 backdrop-blur-[20px] border",
        config.border,
        config.glow
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className={cn("rounded-full", config.isKing ? "w-12 h-12" : "w-10 h-10")} />
        <Skeleton className={cn("rounded-full", config.isKing ? "w-12 h-12" : "w-10 h-10")} />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="flex-1 space-y-1">
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

/* ─── main export ─── */
export function KingOfTheHill() {
  const { tokens, isLoading } = useKingOfTheHill();

  return (
    <div className="w-full">
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-4">
        <img src="/claw-logo.png" alt="Claw" className="w-5 h-5 object-contain" />
        <h2 className="text-sm md:text-base font-bold uppercase tracking-[0.12em] text-foreground">
          King of the Claws
        </h2>
        <span className="text-[11px] text-muted-foreground/50">Soon to Graduate</span>
        <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent ml-1" />
      </div>

      {/* Cards — horizontal on md+, vertical on mobile */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <KothSkeleton key={i} rank={i} />
            ))}
          </>
        ) : !tokens || tokens.length === 0 ? null : (
          tokens.map((token, index) => (
            <KothCard key={token.id} token={token} rank={index + 1} />
          ))
        )}
      </div>
    </div>
  );
}
