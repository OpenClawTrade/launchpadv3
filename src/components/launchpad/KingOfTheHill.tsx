import { Link } from "react-router-dom";
import { Users, Bot, Crown } from "lucide-react";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useKingOfTheHill, type KingToken } from "@/hooks/useKingOfTheHill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PumpBadge } from "@/components/clawbook/PumpBadge";
import { BagsBadge } from "@/components/clawbook/BagsBadge";
import { useEffect, useState } from "react";

const RANK_CONFIG = [
  {
    border: "border-orange-500/30",
    glow: "shadow-[0_0_20px_rgba(249,115,22,0.15),0_8px_32px_rgba(0,0,0,0.4)]",
    hoverGlow: "hover:shadow-[0_0_30px_rgba(249,115,22,0.25),0_12px_40px_rgba(0,0,0,0.5)]",
    badgeBg: "bg-gradient-to-br from-orange-500 to-amber-600",
    badgeText: "text-white",
    mcapColor: "text-orange-400",
    progressFill: "from-orange-500 via-amber-400 to-orange-500",
    pulseClass: "animate-king-pulse",
    label: "👑",
  },
  {
    border: "border-cyan-500/20",
    glow: "shadow-[0_0_16px_rgba(34,211,238,0.1),0_8px_28px_rgba(0,0,0,0.35)]",
    hoverGlow: "hover:shadow-[0_0_24px_rgba(34,211,238,0.2),0_12px_36px_rgba(0,0,0,0.45)]",
    badgeBg: "bg-gradient-to-br from-slate-400 to-slate-500",
    badgeText: "text-white",
    mcapColor: "text-cyan-400",
    progressFill: "from-emerald-500 via-emerald-400 to-teal-400",
    pulseClass: "",
    label: "🦀",
  },
  {
    border: "border-amber-700/20",
    glow: "shadow-[0_0_14px_rgba(180,83,9,0.1),0_8px_24px_rgba(0,0,0,0.3)]",
    hoverGlow: "hover:shadow-[0_0_22px_rgba(180,83,9,0.18),0_12px_32px_rgba(0,0,0,0.4)]",
    badgeBg: "bg-gradient-to-br from-amber-700 to-amber-800",
    badgeText: "text-amber-100",
    mcapColor: "text-amber-400",
    progressFill: "from-emerald-500 via-emerald-400 to-teal-400",
    pulseClass: "",
    label: "🦞",
  },
];

function AnimatedProgress({ value, rankIndex }: { value: number; rankIndex: number }) {
  const [width, setWidth] = useState(0);
  const config = RANK_CONFIG[rankIndex] || RANK_CONFIG[2];

  useEffect(() => {
    const timer = setTimeout(() => setWidth(Math.min(value, 100)), 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="relative w-full">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium mb-0.5 block">
        Progress
      </span>
      <div className="relative h-[10px] w-full rounded-full bg-slate-700/60 overflow-hidden">
        {/* Shine overlay */}
        <div className="absolute inset-0 z-10 rounded-full bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
        {/* Fill */}
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out relative",
            config.progressFill
          )}
          style={{ width: `${Math.max(width, 3)}%` }}
        >
          {/* Gloss animation */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute -left-full top-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>
      {/* % label */}
      <span className="absolute right-0 -top-0.5 text-[15px] font-bold text-white font-mono tabular-nums">
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

function KothCard({ token, rank }: { token: KingToken; rank: number }) {
  const { solPrice } = useSolPrice();
  const progress = token.bonding_progress ?? 0;
  const marketCapUsd = (token.market_cap_sol ?? 0) * (solPrice || 0);
  const isPumpFun = token.launchpad_type === "pumpfun";
  const isBags = token.launchpad_type === "bags";
  const isTradingAgent = !!(token.trading_agent_id || token.is_trading_agent_token);
  const rankIdx = rank - 1;
  const config = RANK_CONFIG[rankIdx] || RANK_CONFIG[2];

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
        // Base glassmorphism card
        "group relative flex items-center gap-3 px-4 py-3 rounded-2xl",
        "bg-slate-800/40 backdrop-blur-xl",
        "border",
        config.border,
        config.glow,
        config.hoverGlow,
        // Hover lift
        "hover:scale-[1.04] active:scale-[0.98] hover:animate-claw-shake",
        "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "cursor-pointer",
        // King pulse for #1
        config.pulseClass
      )}
    >
      {/* Rank Badge */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center font-black text-lg",
            config.badgeBg,
            config.badgeText,
            "shadow-lg"
          )}
        >
          #{rank}
        </div>
        {/* Crown / emblem on top */}
        {rank === 1 && (
          <div className="absolute -top-2.5 -right-1 text-base drop-shadow-lg animate-bounce-subtle">
            <Crown className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          </div>
        )}
      </div>

      {/* Token Avatar */}
      <div className={cn(
        "relative w-12 h-12 rounded-full flex-shrink-0 overflow-hidden",
        "ring-2 ring-offset-1 ring-offset-transparent",
        rank === 1 ? "ring-orange-500/40" : rank === 2 ? "ring-cyan-500/30" : "ring-amber-700/30"
      )}>
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
          <div className="w-full h-full flex items-center justify-center bg-secondary text-xs font-bold text-muted-foreground">
            {token.ticker?.slice(0, 2)}
          </div>
        )}
      </div>

      {/* Middle: Name + Mcap */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold text-foreground truncate group-hover:text-white transition-colors">
            {token.name}
          </span>
          {isTradingAgent && (
            <span className="flex items-center gap-0.5 bg-amber-500/15 text-amber-400 px-1 py-px rounded text-[8px] font-semibold flex-shrink-0">
              <Bot className="w-2.5 h-2.5" />
              TRADER
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

        {/* Market cap */}
        <div className="flex items-center gap-2">
          <span className={cn("text-lg font-extrabold font-mono tabular-nums", config.mcapColor)}>
            ${marketCapUsd >= 1000 ? `${(marketCapUsd / 1000).toFixed(1)}K` : marketCapUsd.toFixed(0)}
          </span>
          <div className="flex items-center gap-0.5 text-muted-foreground/50">
            <Users className="w-2.5 h-2.5" />
            <span className="text-[10px] font-mono">{token.holder_count ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Right: Progress */}
      <div className="w-28 sm:w-36 flex-shrink-0">
        <AnimatedProgress value={progress} rankIndex={rankIdx} />
      </div>
    </Link>
  );
}

function KothSkeleton({ rank }: { rank: number }) {
  const config = RANK_CONFIG[rank - 1] || RANK_CONFIG[2];
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl",
        "bg-slate-800/40 backdrop-blur-xl border",
        config.border,
        config.glow
      )}
    >
      <Skeleton className="w-11 h-11 rounded-full" />
      <Skeleton className="w-12 h-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="w-28 space-y-1.5">
        <Skeleton className="h-2 w-12" />
        <Skeleton className="h-[10px] w-full rounded-full" />
      </div>
    </div>
  );
}

export function KingOfTheHill() {
  const { tokens, isLoading } = useKingOfTheHill();

  return (
    <div className="w-full">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <img src="/claw-logo.png" alt="Claw" className="w-4 h-4 object-contain" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          King of the Claws
        </span>
        <span className="text-[10px] text-muted-foreground/50">— Soon to Graduate</span>
        <div className="flex-1 h-px bg-border ml-1" />
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
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
