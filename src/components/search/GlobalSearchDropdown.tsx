import { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { SearchResult } from "@/hooks/useTokenSearch";
import { Loader2 } from "lucide-react";

function formatNumber(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

interface Props {
  results: SearchResult[];
  isLoading: boolean;
  query: string;
  onClose: () => void;
}

export function GlobalSearchDropdown({ results, isLoading, query, onClose }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  if (query.length < 2) return null;

  const solanaResults = results.filter(r => r.chainId === "solana");
  const otherResults = results.filter(r => r.chainId !== "solana");
  const grouped = [...solanaResults, ...otherResults];

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl overflow-hidden shadow-2xl border border-border/40"
      style={{
        background: "hsl(0 0% 6% / 0.97)",
        backdropFilter: "blur(24px)",
        maxHeight: "420px",
      }}
    >
      {isLoading && results.length === 0 ? (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching...
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-xs">
          No tokens found for "{query}"
        </div>
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
          {grouped.map((r, i) => {
            const change = r.priceChange24h;
            const isPositive = change !== null && change >= 0;
            const isSolana = r.chainId === "solana";

            return (
              <button
                key={`${r.baseToken.address}-${r.pairAddress}-${i}`}
                onClick={() => {
                  if (isSolana && r.baseToken.address) {
                    navigate(`/trade/${r.baseToken.address}`);
                  }
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-card/50 transition-colors text-left group"
              >
                <OptimizedTokenImage
                  src={r.imageUrl}
                  fallbackText={r.baseToken.symbol}
                  size={28}
                  className="w-7 h-7 rounded-full flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {r.baseToken.name}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      ${r.baseToken.symbol}
                    </span>
                    <span
                      className="text-[9px] px-1 py-0.5 rounded font-mono uppercase"
                      style={{
                        background: isSolana ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted) / 0.3)",
                        color: isSolana ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                      }}
                    >
                      {r.chainId}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      MCap {formatNumber(r.marketCap)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Liq {formatNumber(r.liquidity)}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {r.priceUsd && (
                    <div className="text-[11px] font-mono text-foreground">
                      ${parseFloat(r.priceUsd) < 0.01
                        ? parseFloat(r.priceUsd).toExponential(2)
                        : parseFloat(r.priceUsd).toFixed(4)}
                    </div>
                  )}
                  {change !== null && (
                    <div className={`text-[10px] font-mono font-semibold ${isPositive ? "text-green-400" : "text-red-400"}`}>
                      {isPositive ? "+" : ""}{change.toFixed(1)}%
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
