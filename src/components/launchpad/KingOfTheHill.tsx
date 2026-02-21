import { Link } from "react-router-dom";
import { Users, Bot, Zap } from "lucide-react";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useKingOfTheHill, type KingToken } from "@/hooks/useKingOfTheHill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PumpBadge } from "@/components/clawbook/PumpBadge";
import { BagsBadge } from "@/components/clawbook/BagsBadge";
import { useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ─── rank visual config ─── */
const RANK_CONFIG = [
  {
    // #1 — KING
    border: "border-orange-500/25",
    hoverBorder: "hover:border-orange-400/60",
    glowShadow: "shadow-[0_0_24px_rgba(249,115,22,0.12),0_8px_32px_rgba(0,0,0,0.5)]",
    hoverGlow: "hover:shadow-[0_0_40px_rgba(249,115,22,0.3),0_16px_48px_rgba(0,0,0,0.6)]",
    badgeBg: "bg-gradient-to-br from-orange-500 to-amber-600",
    mcapColor: "text-orange-400",
    ringColor: "ring-orange-500/30",
    isKing: true,
  },
  {
    // #2
    border: "border-cyan-500/15",
    hoverBorder: "hover:border-cyan-400/40",
    glowShadow: "shadow-[0_0_16px_rgba(34,211,238,0.08),0_6px_24px_rgba(0,0,0,0.4)]",
    hoverGlow: "hover:shadow-[0_0_30px_rgba(34,211,238,0.2),0_12px_36px_rgba(0,0,0,0.5)]",
    badgeBg: "bg-gradient-to-br from-cyan-500 to-teal-600",
    mcapColor: "text-cyan-400",
    ringColor: "ring-cyan-500/25",
    isKing: false,
  },
  {
    // #3
    border: "border-cyan-600/12",
    hoverBorder: "hover:border-cyan-500/30",
    glowShadow: "shadow-[0_0_12px_rgba(34,211,238,0.06),0_4px_20px_rgba(0,0,0,0.35)]",
    hoverGlow: "hover:shadow-[0_0_24px_rgba(34,211,238,0.15),0_10px_32px_rgba(0,0,0,0.45)]",
    badgeBg: "bg-gradient-to-br from-teal-600 to-cyan-700",
    mcapColor: "text-teal-400",
    ringColor: "ring-teal-500/20",
    isKing: false,
  },
];

/* ─── animated progress bar ─── */
function ProgressBar({ value, rankIndex }: { value: number; rankIndex: number }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(Math.min(value, 100)), 80);
    return () => clearTimeout(timer);
  }, [value]);

  const isUrgent = value >= 70;

  return (
    <div className="relative w-full">
      <span className="text-[10px] tracking-wide text-muted-foreground/40 font-medium mb-1 block">
        Progress
      </span>
      <div className="relative h-[10px] w-full rounded-md bg-slate-700/70 overflow-hidden">
        {/* subtle top highlight */}
        <div className="absolute inset-0 z-10 rounded-md bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
        {/* fill */}
        <div
          className={cn(
            "h-full rounded-md bg-gradient-to-r transition-all duration-[1200ms] ease-out relative",
            isUrgent
              ? "from-orange-500 via-amber-400 to-orange-500"
              : "from-emerald-500 via-emerald-400 to-cyan-400"
          )}
          style={{ width: `${Math.max(width, 2.5)}%` }}
        >
          {/* shimmer gloss */}
          <div className="absolute inset-0 rounded-md overflow-hidden">
            <div className="absolute -left-full top-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>
      {/* percentage */}
      <span className="absolute right-0 -top-0.5 text-[16px] font-extrabold text-white font-mono tabular-nums">
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

/* ─── claw crown SVG icon for #1 ─── */
function ClawCrown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M3 18L5 8L9 12L12 4L15 12L19 8L21 18H3Z"
        fill="url(#crownGrad)"
        stroke="rgba(251,191,36,0.6)"
        strokeWidth="1"
      />
      <defs>
        <linearGradient id="crownGrad" x1="3" y1="4" x2="21" y2="18">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── single KOTH card ─── */
function KothCard({ token, rank }: { token: KingToken; rank: number }) {
  const { solPrice } = useSolPrice();
  const progress = token.bonding_progress ?? 0;
  const marketCapUsd = (token.market_cap_sol ?? 0) * (solPrice || 0);
  const isPumpFun = token.launchpad_type === "pumpfun";
  const isBags = token.launchpad_type === "bags";
  const isTradingAgent = !!(token.trading_agent_id || token.is_trading_agent_token);
  const idx = rank - 1;
  const config = RANK_CONFIG[idx] || RANK_CONFIG[2];

  const tradeUrl =
    isPumpFun || isBags || isTradingAgent
      ? `/t/${token.ticker}`
      : token.agent_id
        ? `/t/${token.ticker}`
        : `/launchpad/${token.mint_address || token.dbc_pool_address || token.id}`;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={tradeUrl}
            className={cn(
              "group relative flex items-center gap-3.5 rounded-2xl",
              "bg-[#1E293B]/50 backdrop-blur-[20px]",
              "border transition-all duration-300 ease-spring",
              "cursor-pointer",
              // sizing — #1 gets extra padding
              config.isKing ? "px-5 py-4" : "px-4 py-3.5",
              // border & glow
              config.border,
              config.hoverBorder,
              config.glowShadow,
              config.hoverGlow,
              // hover lift
              "hover:scale-[1.03] active:scale-[0.98]",
              // king pulse for #1
              config.isKing && "animate-king-pulse"
            )}
          >
            {/* ── Rank Badge ── */}
            <div className="relative flex-shrink-0">
              <div
                className={cn(
                  "flex items-center justify-center rounded-full font-black text-white shadow-lg",
                  config.badgeBg,
                  config.isKing ? "w-14 h-14 text-xl" : "w-12 h-12 text-lg"
                )}
              >
                #{rank}
              </div>
              {/* Crown icon for #1 */}
              {config.isKing && (
                <div className="absolute -top-3 -right-1.5 animate-bounce-subtle">
                  <ClawCrown className="w-5 h-5 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
                </div>
              )}
            </div>

            {/* ── Avatar ── */}
            <div
              className={cn(
                "relative rounded-full flex-shrink-0 overflow-hidden ring-2 ring-offset-2 ring-offset-transparent",
                config.ringColor,
                config.isKing ? "w-[52px] h-[52px]" : "w-11 h-11"
              )}
            >
              {token.image_url ? (
                <img
                  src={token.image_url}
                  alt={token.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-700 text-xs font-bold text-muted-foreground">
                  {token.ticker?.slice(0, 2)}
                </div>
              )}
            </div>

            {/* ── Name + Mcap + Meta ── */}
            <div className="flex-1 min-w-0 space-y-1">
              {/* top row: name + badges */}
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "font-bold text-white truncate leading-tight",
                    config.isKing ? "text-[17px]" : "text-[15px]"
                  )}
                >
                  {token.name}
                </span>
                {isTradingAgent && (
                  <span className="flex items-center gap-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-px rounded-full text-[9px] font-semibold flex-shrink-0 uppercase tracking-wider">
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

              {/* bottom row: mcap + holders */}
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "font-extrabold font-mono tabular-nums",
                    config.isKing ? "text-xl" : "text-lg",
                    config.mcapColor
                  )}
                >
                  ${marketCapUsd >= 1000 ? `${(marketCapUsd / 1000).toFixed(1)}K` : marketCapUsd.toFixed(0)}
                </span>
                <div className="flex items-center gap-1 text-muted-foreground/40">
                  <Users className="w-3 h-3" />
                  <span className="text-[11px] font-mono">{token.holder_count ?? 0}</span>
                </div>
              </div>
            </div>

            {/* ── Progress ── */}
            <div className={cn("flex-shrink-0", config.isKing ? "w-32 sm:w-40" : "w-28 sm:w-36")}>
              <ProgressBar value={progress} rankIndex={idx} />
            </div>

            {/* ── Urgency badge on high progress ── */}
            {progress >= 70 && (
              <div className="absolute top-2 right-3 flex items-center gap-0.5 text-orange-400 animate-pulse">
                <Zap className="w-3 h-3 fill-orange-400" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Graduating</span>
              </div>
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-slate-800 border-slate-700 text-white">
          {progress >= 70
            ? "🔥 Close to graduation! Act fast."
            : `${token.name} — ${progress.toFixed(1)}% bonding progress`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ─── skeleton ─── */
function KothSkeleton({ rank }: { rank: number }) {
  const config = RANK_CONFIG[rank - 1] || RANK_CONFIG[2];
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-2xl",
        "bg-[#1E293B]/50 backdrop-blur-[20px] border",
        config.border,
        config.glowShadow,
        config.isKing ? "px-5 py-4" : "px-4 py-3.5"
      )}
    >
      <Skeleton className={cn("rounded-full", config.isKing ? "w-14 h-14" : "w-12 h-12")} />
      <Skeleton className={cn("rounded-full", config.isKing ? "w-[52px] h-[52px]" : "w-11 h-11")} />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="w-28 space-y-1.5">
        <Skeleton className="h-2 w-14" />
        <Skeleton className="h-[10px] w-full rounded-md" />
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
      <div className="flex items-center gap-2 mb-3">
        <img src="/claw-logo.png" alt="Claw" className="w-4 h-4 object-contain" />
        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          King of the Claws
        </span>
        <span className="text-[10px] text-muted-foreground/40 italic">Soon to Graduate</span>
        <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent ml-2" />
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5">
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
