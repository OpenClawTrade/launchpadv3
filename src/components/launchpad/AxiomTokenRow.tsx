import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Globe, MessageCircle, Users, Copy, CheckCircle, Bot, Sparkles } from "lucide-react";
import { FunToken } from "@/hooks/useFunTokensPaginated";
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
    <Link
      to={tradeUrl}
      className="axiom-row group"
    >
      {/* Row 1: Avatar + Name + Stats */}
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <div className="axiom-avatar flex-shrink-0">
          {token.image_url ? (
            <img
              src={token.image_url}
              alt={token.name}
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
            />
          ) : (
            <div className="w-full h-full rounded-lg flex items-center justify-center text-[11px] font-bold bg-muted text-success">
              {token.ticker?.slice(0, 2)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Name + ticker + badges */}
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-foreground truncate">{token.name}</span>
            <span className="text-[10px] font-mono text-success flex-shrink-0">${token.ticker}</span>
            {badgeLabel && (
              <span className="axiom-platform-badge">{badgeLabel}</span>
            )}
            {isAgent && (
              <span className="axiom-agent-badge">
                <Sparkles className="h-2.5 w-2.5" />
              </span>
            )}
          </div>

          {/* Line 2: Age + creator + socials */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-mono text-muted-foreground">{age}</span>
            {xUsername && (
              <span className="text-[10px] font-mono truncate max-w-[80px]" style={{ color: "hsl(187 70% 55%)" }}>
                @{xUsername}
              </span>
            )}
            {/* Social icons */}
            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
              {token.twitter_url && (
                <a
                  href={token.twitter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
              )}
              {holders > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] font-mono text-muted-foreground/60">
                  <Users className="h-2.5 w-2.5" />{holders}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side stats */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/50 font-mono">MC</span>
            <span className="text-[11px] font-mono font-bold text-success">{mcap}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/50 font-mono">V</span>
            <span className="text-[10px] font-mono text-foreground/70">{vol}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/50 font-mono">F</span>
            <span className="text-[10px] font-mono text-foreground/50">{fees}</span>
          </div>
        </div>
      </div>

      {/* Row 2: Progress bar + bonding % + CA copy */}
      <div className="flex items-center gap-2 mt-1.5">
        {/* Progress */}
        <div className="flex-1 flex items-center gap-2">
          <div className="axiom-progress-track flex-1">
            <div
              className="axiom-progress-fill"
              style={{
                width: `${Math.max(Math.min(bondingProgress, 100), 2)}%`,
                background: bondingProgress >= 80
                  ? "linear-gradient(90deg, hsl(24 95% 53%), hsl(16 85% 48%))"
                  : "linear-gradient(90deg, hsl(160 84% 39%), hsl(142 76% 42%))",
              }}
            />
          </div>
          <span className="text-[10px] font-mono font-bold flex-shrink-0" style={{
            color: bondingProgress >= 80 ? "hsl(24 95% 60%)" : "hsl(160 84% 55%)"
          }}>
            {bondingProgress.toFixed(bondingProgress >= 1 ? 0 : 1)}%
          </span>
        </div>

        {/* CA copy */}
        {token.mint_address && (
          <button
            onClick={handleCopyCA}
            className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
          >
            <span>{token.mint_address.slice(0, 4)}..{token.mint_address.slice(-3)}</span>
            {copiedCA ? <CheckCircle className="h-2.5 w-2.5 text-success" /> : <Copy className="h-2.5 w-2.5" />}
          </button>
        )}
      </div>
    </Link>
  );
});
