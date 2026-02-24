import { TokenTradeEvent } from "@/hooks/useCodexTokenEvents";
import { Copy, ExternalLink } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

function formatAge(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

function formatTokenAmt(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

interface Props {
  events: TokenTradeEvent[];
  isLoading: boolean;
}

export function CodexTokenTrades({ events, isLoading }: Props) {
  const { toast } = useToast();

  const copyAddr = (addr: string) => {
    copyToClipboard(addr);
    toast({ title: "Address copied!" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-xs font-mono text-muted-foreground animate-pulse">Loading trades...</span>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-xs font-mono text-muted-foreground">No trades yet</span>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <table className="w-full text-[11px] font-mono">
        <thead className="sticky top-0 z-10" style={{ backgroundColor: '#0d0d0d' }}>
          <tr className="text-muted-foreground/60 uppercase tracking-wider text-[9px]">
            <th className="text-left py-1.5 px-2 font-medium">Age</th>
            <th className="text-left py-1.5 px-2 font-medium">Type</th>
            <th className="text-right py-1.5 px-2 font-medium">USD</th>
            <th className="text-right py-1.5 px-2 font-medium hidden sm:table-cell">Amount</th>
            <th className="text-right py-1.5 px-2 font-medium hidden md:table-cell">Price</th>
            <th className="text-right py-1.5 px-2 font-medium">Maker</th>
            <th className="text-right py-1.5 px-2 font-medium w-8">Tx</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => {
            const isBuy = e.type === "Buy";
            const color = isBuy ? "text-green-400" : "text-red-400";
            return (
              <tr
                key={`${e.txHash}-${i}`}
                className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
              >
                <td className="py-1.5 px-2 text-muted-foreground/70">{formatAge(e.timestamp)}</td>
                <td className={`py-1.5 px-2 font-semibold ${color}`}>{e.type}</td>
                <td className={`py-1.5 px-2 text-right font-medium ${color}`}>{formatUsd(e.totalUsd)}</td>
                <td className="py-1.5 px-2 text-right text-foreground/70 hidden sm:table-cell">{formatTokenAmt(e.tokenAmount)}</td>
                <td className="py-1.5 px-2 text-right text-foreground/70 hidden md:table-cell">{formatUsd(e.priceUsd)}</td>
                <td className="py-1.5 px-2 text-right">
                  <span className="inline-flex items-center gap-1">
                    <span className="text-foreground/60">{truncateAddr(e.maker)}</span>
                    <button
                      onClick={() => copyAddr(e.maker)}
                      className="text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </span>
                </td>
                <td className="py-1.5 px-2 text-right">
                  <a
                    href={`https://solscan.io/tx/${e.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground/40 hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}
