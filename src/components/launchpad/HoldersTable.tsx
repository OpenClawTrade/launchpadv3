import { useState } from "react";
import { HolderInfo } from "@/hooks/useTokenHolders";
import { useHolderFunding } from "@/hooks/useHolderFunding";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ExternalLink, Filter } from "lucide-react";

interface Props {
  holders: HolderInfo[];
  totalCount: number;
  isLoading: boolean;
}

/** Deterministic gradient for an address */
function addrGradient(addr: string): string {
  if (!addr) return "linear-gradient(135deg, #333, #555)";
  const h1 = (addr.charCodeAt(0) * 37 + addr.charCodeAt(1) * 13) % 360;
  const h2 = (h1 + 40 + (addr.charCodeAt(2) * 7) % 80) % 360;
  return `linear-gradient(135deg, hsl(${h1},60%,45%), hsl(${h2},50%,35%))`;
}

function truncAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatSol(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  if (val >= 1) return val.toFixed(2);
  if (val >= 0.001) return val.toFixed(3);
  return val.toFixed(4);
}

function formatTokenAmt(val: number): string {
  if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toFixed(1);
}

/** Known program addresses that should be labeled */
const KNOWN_LABELS: Record<string, string> = {
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1": "RAYDIUM",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "RAYDIUM AMM",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "ORCA",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": "ORCA CLMM",
};

function HolderFundingCell({ address }: { address: string }) {
  const { data, isLoading } = useHolderFunding(address, true);

  if (isLoading) {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />;
  }

  if (!data?.fundingSource) {
    return <span className="text-muted-foreground/30">—</span>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <a
        href={`https://solscan.io/account/${data.fundingSource}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground/60 hover:text-foreground text-[10px] underline underline-offset-2 transition-colors font-mono"
      >
        {truncAddr(data.fundingSource)}
      </a>
      <div className="flex items-center gap-1 text-[9px] text-muted-foreground/40">
        {data.age && <span>{data.age}</span>}
        {data.fundingAmount > 0 && (
          <>
            <span>•</span>
            <span>≡ {formatSol(data.fundingAmount)}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function HoldersTable({ holders, totalCount, isLoading }: Props) {
  if (isLoading && holders.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (holders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <p className="text-2xl font-mono font-bold text-foreground">{totalCount.toLocaleString()}</p>
        <p className="text-xs font-mono text-muted-foreground/60">Total Holders</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[480px]">
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono min-w-[900px]">
          <thead className="sticky top-0 z-10" style={{ backgroundColor: "#0d0d0d" }}>
            <tr className="text-muted-foreground/50 uppercase tracking-wider text-[9px] border-b border-white/[0.06]">
              <th className="text-left py-2.5 px-2 font-medium w-8">#</th>
              <th className="text-left py-2.5 px-2 font-medium">Wallet</th>
              <th className="text-right py-2.5 px-2 font-medium">SOL Balance</th>
              <th className="text-right py-2.5 px-2 font-medium">Bought (Avg Buy)</th>
              <th className="text-right py-2.5 px-2 font-medium">Sold (Avg Sell)</th>
              <th className="text-right py-2.5 px-2 font-medium">U. PnL ↕</th>
              <th className="text-right py-2.5 px-2 font-medium">Remaining</th>
              <th className="text-left py-2.5 px-2 font-medium">Funding</th>
            </tr>
          </thead>
          <tbody>
            {holders.map((holder, i) => {
              const label = KNOWN_LABELS[holder.address];
              return (
                <tr
                  key={holder.address}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  style={{ height: "52px" }}
                >
                  {/* Rank */}
                  <td className="py-2 px-2 text-muted-foreground/40 text-[11px]">{i + 1}</td>

                  {/* Wallet */}
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <Filter className="h-3 w-3 text-muted-foreground/30 shrink-0 cursor-pointer hover:text-muted-foreground/60 transition-colors" />
                      <a
                        href={`https://solscan.io/account/${holder.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <ExternalLink className="h-3 w-3 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" />
                      </a>
                      <div
                        className="h-6 w-6 rounded-full shrink-0"
                        style={{ background: addrGradient(holder.address) }}
                      />
                      <div className="flex items-center gap-1.5">
                        {label ? (
                          <span className="text-[11px] text-blue-400 font-bold">{label} ◆</span>
                        ) : (
                          <a
                            href={`https://solscan.io/account/${holder.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground/70 text-[11px] hover:text-foreground transition-colors"
                          >
                            {truncAddr(holder.address)}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* SOL Balance */}
                  <td className="py-2 px-2 text-right">
                    <span className="text-foreground/60 text-[11px]">
                      ≡ {formatSol(holder.solBalance)}
                    </span>
                  </td>

                  {/* Bought (Avg Buy) - needs trade analysis */}
                  <td className="py-2 px-2 text-right">
                    <span className="text-muted-foreground/30 text-[11px]">—</span>
                  </td>

                  {/* Sold (Avg Sell) - needs trade analysis */}
                  <td className="py-2 px-2 text-right">
                    <span className="text-muted-foreground/30 text-[11px]">—</span>
                  </td>

                  {/* Unrealized PnL - needs trade analysis */}
                  <td className="py-2 px-2 text-right">
                    <span className="text-muted-foreground/30 text-[11px]">—</span>
                  </td>

                  {/* Remaining */}
                  <td className="py-2 px-2 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-foreground/60 text-[11px]">
                        {formatTokenAmt(holder.tokenAmount)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-muted-foreground/50">
                          {holder.percentage.toFixed(holder.percentage >= 1 ? 2 : 3)}%
                        </span>
                        <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(holder.percentage, 100)}%`,
                              backgroundColor: holder.percentage > 10 ? "#ff4444" : "#22c55e",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Funding */}
                  <td className="py-2 px-2">
                    <HolderFundingCell address={holder.address} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ScrollArea>
  );
}
