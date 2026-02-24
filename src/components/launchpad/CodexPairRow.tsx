import { memo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Users, Copy, CheckCircle, Globe } from "lucide-react";
import { CodexPairToken } from "@/hooks/useCodexNewPairs";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { toast } from "sonner";

function formatUsdCompact(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  if (usd >= 1) return `$${usd.toFixed(0)}`;
  return "$0";
}

function formatAge(createdAt: string | null): string {
  if (!createdAt) return "?";
  try {
    return formatDistanceToNow(new Date(parseInt(createdAt) * 1000), { addSuffix: false })
      .replace("about ", "")
      .replace(" hours", "h").replace(" hour", "h")
      .replace(" minutes", "m").replace(" minute", "m")
      .replace(" seconds", "s").replace(" second", "s")
      .replace(" days", "d").replace(" day", "d")
      .replace(" months", "mo").replace(" month", "mo")
      .replace("less than a", "<1");
  } catch {
    return "?";
  }
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

export const CodexPairRow = memo(function CodexPairRow({ token }: { token: CodexPairToken }) {
  const [copiedCA, setCopiedCA] = useState(false);
  const gradPct = token.graduationPercent ?? 0;
  const mcap = formatUsdCompact(token.marketCap);
  const vol = formatUsdCompact(token.volume24h);
  const age = formatAge(token.createdAt);
  const xUsername = extractXUsername(token.twitterUrl);

  const handleCopyCA = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (token.address) {
      navigator.clipboard.writeText(token.address);
      setCopiedCA(true);
      toast.success("CA copied!");
      setTimeout(() => setCopiedCA(false), 2000);
    }
  };

  const externalUrl = token.address
    ? `https://pump.fun/coin/${token.address}`
    : "#";

  return (
    <a
      href={externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="axiom-row group"
    >
      {/* Row 1: Avatar + Name + Stats */}
      <div className="flex items-start gap-2">
        <div className="axiom-avatar flex-shrink-0">
          <OptimizedTokenImage
            src={token.imageUrl}
            fallbackText={token.symbol}
            size={48}
            loading="eager"
            alt={token.name}
            className="w-full h-full object-cover rounded-lg"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-foreground truncate">{token.name}</span>
            <span className="text-[10px] font-mono text-success flex-shrink-0">${token.symbol}</span>
            <span className="axiom-platform-badge" style={{ background: "hsl(280 60% 45%)", color: "white" }}>PF</span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-mono text-muted-foreground">{age}</span>
            {xUsername && (
              <span className="text-[10px] font-mono truncate max-w-[80px]" style={{ color: "hsl(187 70% 55%)" }}>
                @{xUsername}
              </span>
            )}
            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
              {token.twitterUrl && (
                <a
                  href={token.twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
              )}
              {token.websiteUrl && (
                <a
                  href={token.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <Globe className="h-2.5 w-2.5" />
                </a>
              )}
              {token.telegramUrl && (
                <a
                  href={token.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                </a>
              )}
              {token.holders > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] font-mono text-muted-foreground/60">
                  <Users className="h-2.5 w-2.5" />{token.holders}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/50 font-mono">MC</span>
            <span className="text-[11px] font-mono font-bold text-success">{mcap}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/50 font-mono">V</span>
            <span className="text-[10px] font-mono text-foreground/70">{vol}</span>
          </div>
          {token.change24h !== 0 && (
            <div className="flex items-center gap-1">
              <span className={`text-[10px] font-mono ${token.change24h > 0 ? "text-success" : "text-destructive"}`}>
                {token.change24h > 0 ? "+" : ""}{token.change24h.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Progress bar + bonding % + CA copy */}
      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex-1 flex items-center gap-2">
          <div className="axiom-progress-track flex-1">
            <div
              className="axiom-progress-fill"
              style={{
                width: `${Math.max(Math.min(gradPct, 100), 2)}%`,
                background: gradPct >= 80
                  ? "linear-gradient(90deg, hsl(280 60% 45%), hsl(280 50% 55%))"
                  : "linear-gradient(90deg, hsl(280 60% 35%), hsl(280 50% 45%))",
              }}
            />
          </div>
          <span className="text-[10px] font-mono font-bold flex-shrink-0" style={{
            color: gradPct >= 80 ? "hsl(280 60% 65%)" : "hsl(280 50% 55%)"
          }}>
            {gradPct.toFixed(gradPct >= 1 ? 0 : 1)}%
          </span>
        </div>

        {token.address && (
          <button
            onClick={handleCopyCA}
            className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
          >
            <span>{token.address.slice(0, 4)}..{token.address.slice(-3)}</span>
            {copiedCA ? <CheckCircle className="h-2.5 w-2.5 text-success" /> : <Copy className="h-2.5 w-2.5" />}
          </button>
        )}
      </div>
    </a>
  );
});
