import { Link } from "react-router-dom";
import { Users, Bot } from "lucide-react";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useKingOfTheHill, type KingToken } from "@/hooks/useKingOfTheHill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PumpBadge } from "@/components/clawbook/PumpBadge";
import { BagsBadge } from "@/components/clawbook/BagsBadge";



const GRADUATION_THRESHOLD = 85;

function KothRow({ token, rank }: { token: KingToken; rank: number }) {
  const { solPrice } = useSolPrice();
  const progress = token.bonding_progress ?? 0;
  const marketCapUsd = (token.market_cap_sol ?? 0) * (solPrice || 0);
  const isPumpFun = token.launchpad_type === 'pumpfun';
  const isBags = token.launchpad_type === 'bags';
  const isPhantom = token.launchpad_type === 'phantom';
  const isTradingAgent = !!(token.trading_agent_id || token.is_trading_agent_token);

  const tradeUrl = (isPumpFun || isBags || isTradingAgent)
    ? `/t/${token.ticker}`
    : token.agent_id
      ? `/t/${token.ticker}`
      : `/launchpad/${token.mint_address || token.dbc_pool_address || token.id}`;

  const rankColors = ["text-yellow-400", "text-slate-300", "text-orange-500"];

  return (
    <Link
      to={tradeUrl}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 border-b border-border/40 last:border-b-0",
        "hover:bg-secondary/50 transition-colors group"
      )}
    >
      {/* Rank */}
      <span className={cn(
        "text-[9px] font-bold font-mono w-4 text-center flex-shrink-0",
        rankColors[rank - 1] || "text-muted-foreground",
      )}>
        #{rank}
      </span>

      {/* Avatar */}
      <div className="w-6 h-6 rounded flex-shrink-0 overflow-hidden bg-secondary">
        {token.image_url ? (
          <img
            src={token.image_url}
            alt={token.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-muted-foreground">
            {token.ticker?.slice(0, 2)}
          </div>
        )}
      </div>

      {/* Name + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-px">
          <span className="text-[11px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {token.name}
          </span>
          {isTradingAgent && (
            <span className="flex items-center gap-0.5 bg-amber-500/15 text-amber-400 px-0.5 rounded flex-shrink-0">
              <Bot className="w-2 h-2" />
              <span className="text-[7px] font-medium">TRADER</span>
            </span>
          )}
          {isPumpFun && <PumpBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />}
          {isBags && <BagsBadge mintAddress={token.mint_address ?? undefined} showText={false} />}
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-px bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(progress, 100)}%`,
                background: progress >= 80 ? 'hsl(25 95% 60%)' : 'hsl(0 84% 60%)',
              }}
            />
          </div>
          <span className="text-[9px] font-mono text-muted-foreground flex-shrink-0">
            {progress.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col items-end gap-px flex-shrink-0">
        <span className="text-[11px] font-bold font-mono text-emerald-400">
          ${marketCapUsd >= 1000 ? `${(marketCapUsd / 1000).toFixed(1)}K` : marketCapUsd.toFixed(0)}
        </span>
        <div className="flex items-center gap-1 text-muted-foreground/60">
          <Users className="w-2 h-2" />
          <span className="text-[9px] font-mono">{token.holder_count ?? 0}</span>
        </div>
      </div>
    </Link>
  );
}

export function KingOfTheHill() {
  const { tokens, isLoading } = useKingOfTheHill();

  return (
    <div className="w-full">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <img src="/claw-logo.png" alt="Claw" className="w-4 h-4 object-contain" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          King of the Claws
        </span>
        <span className="text-[10px] text-muted-foreground/50">— Soon to Graduate</span>
        <div className="flex-1 h-px bg-border ml-1" />
      </div>

      {/* Panel */}
      <div className="bg-card border border-border rounded overflow-hidden">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-border/40 last:border-b-0">
                <Skeleton className="w-5 h-4 rounded" />
                <Skeleton className="w-7 h-7 rounded flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-px w-full" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-2.5 w-8" />
                </div>
              </div>
            ))}
          </>
        ) : !tokens || tokens.length === 0 ? null : (
          tokens.map((token, index) => (
            <KothRow key={token.id} token={token} rank={index + 1} />
          ))
        )}
      </div>
    </div>
  );
}
