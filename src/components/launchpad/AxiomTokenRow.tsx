import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Globe, Users, Copy, CheckCircle, Sparkles, Zap } from "lucide-react";
import { FunToken } from "@/hooks/useFunTokensPaginated";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { toast } from "sonner";

interface AxiomTokenRowProps {
  token: FunToken;
  solPrice: number | null;
}

function formatUsd(mcapSol: number | null | undefined, solPrice: number | null): string {
  if (!mcapSol || !solPrice) return "$0";
  const usd = mcapSol * solPrice;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

function formatVolume(vol: number | null | undefined, solPrice: number | null): string {
  if (!vol || !solPrice) return "$0";
  const usd = vol * solPrice;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

function formatAge(createdAt: string): string {
  return formatDistanceToNow(new Date(createdAt), { addSuffix: false })
    .replace("about ", "")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" seconds", "s").replace(" second", "s")
    .replace(" days", "d").replace(" day", "d")
    .replace(" months", "mo").replace(" month", "mo")
    .replace("less than a", "<1");
}

function extractXUsername(twitterUrl?: string | null): string | null {
  if (!twitterUrl) return null;
  try {
    const url = new URL(twitterUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] || null;
  } catch {
    return null;
  }
}

function getBadgeLabel(type?: string | null): string | null {
  if (type === 'pumpfun') return 'P';
  if (type === 'bags') return 'B';
  if (type === 'phantom') return 'PH';
  return null;
}

export const AxiomTokenRow = memo(function AxiomTokenRow({ token, solPrice }: AxiomTokenRowProps) {
  const [copiedCA, setCopiedCA] = useState(false);
  const bondingProgress = token.bonding_progress ?? 0;
  const isAgent = !!token.agent_id;
  const xUsername = extractXUsername(token.twitter_url);
  const badgeLabel = getBadgeLabel(token.launchpad_type);
  const mcap = formatUsd(token.market_cap_sol, solPrice);
  const vol = formatVolume(token.volume_24h_sol, solPrice);
  const fees = token.total_fees_earned?.toFixed(3) ?? "0";
  const holders = token.holder_count ?? 0;
  const age = formatAge(token.created_at);
  const shortAddr = token.mint_address ? `${token.mint_address.slice(0, 4)}..${token.mint_address.slice(-4)}` : "";

  const tradeUrl = token.mint_address
    ? `/launchpad/${token.mint_address}`
    : `/launchpad/${token.id}`;

  const handleCopyCA = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (token.mint_address) {
      navigator.clipboard.writeText(token.mint_address);
      setCopiedCA(true);
      toast.success("CA copied!");
      setTimeout(() => setCopiedCA(false), 2000);
    }
  };

  return (
    <Link to={tradeUrl} className="pulse-card group">
      {/* Top section: Avatar + Info + MCAP */}
      <div className="flex items-start gap-3">
        <div className="pulse-avatar">
          <OptimizedTokenImage
            src={token.image_url}
            fallbackText={token.ticker}
            size={48}
            loading="eager"
            alt={token.name}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-foreground truncate">{token.name}</span>
            <span className="text-[11px] text-muted-foreground truncate">{token.ticker}</span>
            {badgeLabel && <span className="axiom-platform-badge">{badgeLabel}</span>}
            {isAgent && (
              <span className="axiom-agent-badge">
                <Sparkles className="h-2.5 w-2.5" />
              </span>
            )}
          </div>

          {/* Creator row */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-mono text-muted-foreground">{age}</span>
            {token.twitter_url && (
              <a href={token.twitter_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            )}
            {token.website_url && (
              <a href={token.website_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                <Globe className="h-2.5 w-2.5" />
              </a>
            )}
            {xUsername && (
              <span className="text-[10px] font-mono text-accent-foreground truncate max-w-[80px]">
                @{xUsername}
              </span>
            )}
            {holders > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-mono text-muted-foreground/60">
                <Users className="h-2.5 w-2.5" />{holders}
              </span>
            )}
          </div>

          {/* Short address */}
          {shortAddr && (
            <span className="text-[9px] font-mono text-muted-foreground/40 mt-0.5 block">{shortAddr}</span>
          )}
        </div>

        {/* Right: MC + Volume */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/50 font-mono">MC</span>
            <span className="text-[13px] font-mono font-bold text-foreground">{mcap}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/50 font-mono">V</span>
            <span className="text-[11px] font-mono text-foreground/70">{vol}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/50 font-mono">F</span>
            <span className="text-[10px] font-mono text-foreground/50">{fees}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mt-2">
        <div className="pulse-progress-track flex-1">
          <div
            className="pulse-progress-fill"
            style={{ width: `${Math.max(Math.min(bondingProgress, 100), 2)}%` }}
          />
        </div>
        <span className="text-[10px] font-mono font-bold flex-shrink-0" style={{
          color: bondingProgress >= 80 ? "hsl(38 92% 50%)" : "hsl(160 84% 50%)"
        }}>
          {bondingProgress.toFixed(bondingProgress >= 1 ? 0 : 1)}%
        </span>
      </div>

      {/* Bottom row: metrics + action */}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-2">
          {token.price_change_24h != null && token.price_change_24h !== 0 && (
            <span className={`text-[10px] font-mono ${token.price_change_24h > 0 ? "text-success" : "text-destructive"}`}>
              {token.price_change_24h > 0 ? "+" : ""}{token.price_change_24h.toFixed(0)}%
            </span>
          )}
          {token.mint_address && (
            <button
              onClick={handleCopyCA}
              className="flex items-center gap-0.5 text-[9px] font-mono text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              {copiedCA ? <CheckCircle className="h-2.5 w-2.5 text-success" /> : <Copy className="h-2.5 w-2.5" />}
            </button>
          )}
        </div>

        <div className="pulse-sol-btn">
          <Zap className="h-3 w-3" />
          <span>0 SOL</span>
        </div>
      </div>
    </Link>
  );
});
