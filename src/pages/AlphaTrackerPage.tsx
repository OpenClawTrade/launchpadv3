import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { useAlphaTrades, PositionSummary } from "@/hooks/useAlphaTrades";
import { Crosshair, ExternalLink, ArrowUpRight, ArrowDownRight, Search, X, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useState, useMemo } from "react";

function timeAgo(dateStr: string) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatTokenAmt(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}

function StatusBadge({ status, pnl, netTokens }: { status: PositionSummary["status"]; pnl: number; netTokens: number }) {
  const config = {
    HOLDING: { label: "HOLDING", bg: "bg-green-500/15", text: "text-green-400", dot: "bg-green-400" },
    PARTIAL: { label: "PARTIAL", bg: "bg-yellow-500/15", text: "text-yellow-400", dot: "bg-yellow-400" },
    SOLD: { label: "SOLD", bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400" },
  }[status];

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${config.bg} ${config.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
      {status !== "HOLDING" && (
        <span className={`text-[9px] font-mono font-bold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
          {pnl >= 0 ? "+" : ""}{pnl.toFixed(4)} SOL
        </span>
      )}
      {status === "HOLDING" && netTokens > 0 && (
        <span className="text-[9px] font-mono text-muted-foreground">
          {formatTokenAmt(netTokens)} tokens
        </span>
      )}
    </div>
  );
}

type TradeTypeFilter = "all" | "buy" | "sell";
type HoldingFilter = "all" | "HOLDING" | "PARTIAL" | "SOLD";

export default function AlphaTrackerPage() {
  const { trades, loading, positions } = useAlphaTrades(100);

  const [searchToken, setSearchToken] = useState("");
  const [searchWallet, setSearchWallet] = useState("");
  const [tradeTypeFilter, setTradeTypeFilter] = useState<TradeTypeFilter>("all");
  const [holdingFilter, setHoldingFilter] = useState<HoldingFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = searchToken || searchWallet || tradeTypeFilter !== "all" || holdingFilter !== "all";

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (searchToken) {
        const q = searchToken.toLowerCase();
        const matchesToken =
          (t.token_ticker?.toLowerCase().includes(q)) ||
          (t.token_name?.toLowerCase().includes(q)) ||
          t.token_mint.toLowerCase().includes(q);
        if (!matchesToken) return false;
      }
      if (searchWallet) {
        const q = searchWallet.toLowerCase();
        const matchesWallet =
          t.wallet_address.toLowerCase().includes(q) ||
          (t.trader_display_name?.toLowerCase().includes(q));
        if (!matchesWallet) return false;
      }
      if (tradeTypeFilter !== "all" && t.trade_type !== tradeTypeFilter) return false;
      if (holdingFilter !== "all") {
        const posKey = `${t.wallet_address}::${t.token_mint}`;
        const pos = positions.get(posKey);
        if (!pos || pos.status !== holdingFilter) return false;
      }
      return true;
    });
  }, [trades, searchToken, searchWallet, tradeTypeFilter, holdingFilter, positions]);

  const clearFilters = () => {
    setSearchToken("");
    setSearchWallet("");
    setTradeTypeFilter("all");
    setHoldingFilter("all");
  };

  return (
    <LaunchpadLayout hideFooter noPadding>
      <div className="space-y-0 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <Crosshair className="h-4 w-4 text-primary" />
          <h1 className="text-[15px] font-bold text-foreground tracking-tight">Alpha Tracker</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">
              {filteredTrades.length}/{trades.length}
            </span>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded-md transition-colors ${
                showFilters || hasActiveFilters
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-border/40 space-y-2.5 bg-muted/20">
            {/* Search inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Token name or mint..."
                  value={searchToken}
                  onChange={(e) => setSearchToken(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 rounded-md bg-background border border-border text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Wallet or trader name..."
                  value={searchWallet}
                  onChange={(e) => setSearchWallet(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 rounded-md bg-background border border-border text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* Toggle buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Trade Type */}
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider mr-1">Type</span>
                {(["all", "buy", "sell"] as TradeTypeFilter[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setTradeTypeFilter(v)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      tradeTypeFilter === v
                        ? v === "buy"
                          ? "bg-green-500/20 text-green-400"
                          : v === "sell"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {v.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Holding Status */}
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider mr-1">Status</span>
                {(["all", "HOLDING", "PARTIAL", "SOLD"] as HoldingFilter[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setHoldingFilter(v)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      holdingFilter === v
                        ? v === "HOLDING"
                          ? "bg-green-500/20 text-green-400"
                          : v === "PARTIAL"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : v === "SOLD"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {v === "all" ? "ALL" : v}
                  </button>
                ))}
              </div>

              {/* Clear */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Trade Feed */}
        <div className="divide-y divide-border/20">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 border-2 border-transparent border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Crosshair className="h-8 w-8 mb-3 opacity-30" />
              <p className="text-[13px] font-medium">{hasActiveFilters ? "No matching trades" : "No trades yet"}</p>
              <p className="text-[11px] opacity-60">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "Trades from tracked wallets will appear here in real-time"}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-2 text-[11px] text-primary hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            filteredTrades.map((trade) => {
              const isBuy = trade.trade_type === "buy";
              const posKey = `${trade.wallet_address}::${trade.token_mint}`;
              const position = positions.get(posKey);

              return (
                <div
                  key={trade.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  {/* Token Logo */}
                  <div className="h-8 w-8 rounded-full bg-muted border border-border overflow-hidden flex-shrink-0 flex items-center justify-center mt-0.5">
                    {trade.token_image_url ? (
                      <img src={trade.token_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {(trade.token_ticker || trade.token_name || trade.token_mint)?.slice(0, 2)?.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Row 1: Name + Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-foreground truncate">
                        {trade.trader_display_name || `${trade.wallet_address.slice(0, 4)}..${trade.wallet_address.slice(-4)}`}
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isBuy
                            ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {isBuy ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                        {isBuy ? "BUY" : "SELL"}
                      </span>
                    </div>

                    {/* Row 2: Token + SOL amount + token amount */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {trade.token_mint && (
                        <Link
                          to={`/trade/${trade.token_mint}`}
                          className="text-[10px] font-mono text-primary hover:underline truncate"
                        >
                          {trade.token_ticker || trade.token_name || `${trade.token_mint.slice(0, 6)}..`}
                        </Link>
                      )}
                      <span className="text-[10px] font-mono text-foreground/80">
                        {trade.amount_sol?.toFixed(4)} SOL
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        · {formatTokenAmt(trade.amount_tokens)} tokens
                      </span>
                    </div>

                    {/* Row 3: Price + MCap + Timestamp */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {trade.price_sol != null && (
                        <>
                          <span className="text-[9px] font-mono text-muted-foreground">
                            @ {trade.price_sol.toFixed(10)} SOL
                          </span>
                          <span className="text-[9px] font-mono text-muted-foreground/70">
                            MCap {(trade.price_sol * 1_000_000_000).toFixed(1)} SOL
                          </span>
                        </>
                      )}
                      <span className="text-[9px] text-muted-foreground/60">
                        {format(new Date(trade.created_at), "MMM d, h:mm a")}
                      </span>
                      <span className="text-[9px] text-muted-foreground/40">
                        ({timeAgo(trade.created_at)})
                      </span>
                    </div>

                    {/* Row 4: Position summary line */}
                    {position && (
                      <div className="text-[9px] font-mono text-muted-foreground/70">
                        Bought {position.total_bought_sol.toFixed(3)} SOL
                        {position.total_sold_sol > 0 && (
                          <> → Sold {position.total_sold_sol.toFixed(3)} SOL</>
                        )}
                        {position.status !== "HOLDING" && (
                          <span className={position.realized_pnl_sol >= 0 ? "text-green-400" : "text-red-400"}>
                            {" "}→ PnL: {position.realized_pnl_sol >= 0 ? "+" : ""}{position.realized_pnl_sol.toFixed(4)} SOL
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right side: Status + TX */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {position && (
                      <StatusBadge
                        status={position.status}
                        pnl={position.realized_pnl_sol}
                        netTokens={position.net_tokens}
                      />
                    )}
                    {trade.tx_hash && (
                      <a
                        href={`https://solscan.io/tx/${trade.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground/50 hover:text-foreground transition-colors inline-flex items-center gap-0.5"
                      >
                        <span className="text-[9px] font-mono">{trade.tx_hash.slice(0, 6)}...</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </LaunchpadLayout>
  );
}
