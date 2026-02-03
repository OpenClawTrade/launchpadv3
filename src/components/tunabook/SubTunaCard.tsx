import { Link } from "react-router-dom";
import { Users, Article, TrendUp, Rocket } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface SubTunaCardProps {
  id: string;
  name: string;
  ticker: string;
  description?: string;
  iconUrl?: string;
  memberCount: number;
  postCount: number;
  marketCapSol?: number;
  launchpadType?: string | null;
  className?: string;
}

export function SubTunaCard({
  name,
  ticker,
  description,
  iconUrl,
  memberCount,
  postCount,
  marketCapSol,
  launchpadType,
  className,
}: SubTunaCardProps) {
  const isPumpFun = launchpadType === 'pumpfun';
  return (
    <Link
      to={`/t/${ticker}`}
      className={cn(
        "tunabook-card block p-4 hover:border-[hsl(var(--tunabook-primary))] transition-colors",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[hsl(var(--tunabook-bg-elevated))] flex items-center justify-center text-lg font-bold text-[hsl(var(--tunabook-primary))]">
            {ticker.charAt(0)}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[hsl(var(--tunabook-text-primary))] truncate flex items-center gap-1.5">
            {name}
            {isPumpFun && (
              <span 
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#00ff00]/20 text-[#00ff00] text-[10px] font-medium"
                title="pump.fun Token"
              >
                <Rocket size={10} weight="fill" />
                <span>pump</span>
              </span>
            )}
          </h3>
          <p className="text-sm text-[hsl(var(--tunabook-text-secondary))]">
            t/{ticker}
          </p>
          
          {description && (
            <p className="text-xs text-[hsl(var(--tunabook-text-muted))] line-clamp-2 mt-1">
              {description}
            </p>
          )}
          
          <div className="flex items-center gap-4 mt-2 text-xs text-[hsl(var(--tunabook-text-secondary))]">
            <span className="flex items-center gap-1">
              <Users size={14} />
              {memberCount.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Article size={14} />
              {postCount}
            </span>
            {marketCapSol !== undefined && (
              <span className="flex items-center gap-1 text-[hsl(var(--tunabook-primary))]">
                <TrendUp size={14} />
                {marketCapSol.toFixed(2)} SOL
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
