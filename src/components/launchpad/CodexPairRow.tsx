import { memo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Users, Copy, CheckCircle } from "lucide-react";
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

export const CodexPairRow = memo(function CodexPairRow({ token }: { token: CodexPairToken }) {
  const [copiedCA, setCopiedCA] = useState(false);
  const gradPct = token.graduationPercent ?? 0;
  const mcap = formatUsdCompact(token.marketCap);
  const vol = formatUsdCompact(token.volume24h);
  const age = formatAge(token.createdAt);

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

  // Link to pump.fun or dexscreener for external tokens
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
            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
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
