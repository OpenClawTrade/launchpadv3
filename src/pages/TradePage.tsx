import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, Zap, TrendingUp, Flame, Layers, Copy, CheckCircle } from "lucide-react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { useFunTokensPaginated, FunToken } from "@/hooks/useFunTokensPaginated";
import { Input } from "@/components/ui/input";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatSol(val: number | null | undefined): string {
  if (!val) return "0 SOL";
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K SOL`;
  return `${val.toFixed(2)} SOL`;
}

function formatUsd(mcapSol: number | null | undefined, solPrice = 150): string {
  if (!mcapSol) return "$0";
  const usd = mcapSol * solPrice;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

// ─── Token row card ───────────────────────────────────────────────────────────

function TradeTokenCard({ token }: { token: FunToken }) {
  const [copiedCA, setCopiedCA] = useState(false);
  const isGraduated = token.status === "graduated";
  const isNearGrad = (token.bonding_progress ?? 0) >= 80;
  const tradeUrl = token.mint_address ? `/launchpad/${token.mint_address}` : `/t/${token.ticker}`;
  const priceChange = token.price_change_24h ?? 0;

  const handleCopyCA = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (token.mint_address) {
      navigator.clipboard.writeText(token.mint_address);
      setCopiedCA(true);
      setTimeout(() => setCopiedCA(false), 2000);
    }
  };

  return (
    <Link
      to={tradeUrl}
      className="group flex items-center gap-3 px-3 py-2.5 border border-border/40 rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-all duration-150"
    >
      {/* Image */}
      <div className="flex-shrink-0 w-9 h-9 rounded-md overflow-hidden bg-muted">
        {token.image_url ? (
          <img
            src={token.image_url}
            alt={token.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold font-mono text-muted-foreground">
            {token.ticker?.slice(0, 2)}
          </div>
        )}
      </div>

      {/* Name + ticker */}
      <div className="min-w-0 w-28 flex-shrink-0">
        <div className="text-[12px] font-semibold text-foreground truncate leading-tight">{token.name}</div>
        <div className="text-[10px] font-mono text-muted-foreground">${token.ticker}</div>
      </div>

      {/* CA */}
      {token.mint_address && (
        <div className="hidden sm:flex min-w-0 w-28 flex-shrink-0 items-center gap-1">
          <code className="text-[10px] font-mono text-muted-foreground truncate">
            {token.mint_address.slice(0, 4)}...{token.mint_address.slice(-4)}
          </code>
          <button
            onClick={handleCopyCA}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            {copiedCA ? <CheckCircle className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      )}

      {/* Mcap */}
      <div className="hidden sm:block min-w-0 w-24 flex-shrink-0">
        <div className="text-[11px] font-mono text-foreground">{formatUsd(token.market_cap_sol)}</div>
        <div className="text-[9px] text-muted-foreground">Market Cap</div>
      </div>

      {/* Volume */}
      <div className="hidden md:block min-w-0 w-24 flex-shrink-0">
        <div className="text-[11px] font-mono text-foreground">{formatSol(token.volume_24h_sol)}</div>
        <div className="text-[9px] text-muted-foreground">Vol 24h</div>
      </div>

      {/* Price change */}
      <div className="hidden lg:block min-w-0 w-16 flex-shrink-0">
        <div className={`text-[11px] font-mono font-semibold ${priceChange >= 0 ? "text-green-400" : "text-destructive"}`}>
          {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(1)}%
        </div>
        <div className="text-[9px] text-muted-foreground">24h</div>
      </div>

      {/* Bonding bar / status */}
      <div className="flex-1 min-w-0">
        {isGraduated ? (
          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-bold bg-green-500/15 text-green-400 border border-green-500/30">
            ✓ Graduated
          </span>
        ) : (
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>{isNearGrad ? "🔥" : ""}Bonding</span>
              <span>{Math.round(token.bonding_progress ?? 0)}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(token.bonding_progress ?? 0, 100)}%`,
                  background: isNearGrad ? "#ea580c" : "hsl(var(--primary))",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Trade button */}
      <div className="flex-shrink-0">
        <span className="text-[10px] font-mono font-bold text-primary border border-primary/40 px-2 py-1 rounded group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-150">
          TRADE →
        </span>
      </div>
    </Link>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = "all" | "bonding" | "graduated" | "hot";

const TABS: { id: FilterTab; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: <Layers className="h-3 w-3" /> },
  { id: "bonding", label: "Bonding", icon: <TrendingUp className="h-3 w-3" /> },
  { id: "graduated", label: "Graduated", icon: <Zap className="h-3 w-3" /> },
  { id: "hot", label: "Hot", icon: <Flame className="h-3 w-3" /> },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TradePage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const { tokens, totalCount, isLoading } = useFunTokensPaginated(page, PAGE_SIZE);

  const filtered = useMemo(() => {
    let list = tokens;

    // Tab filter
    if (activeTab === "bonding") list = list.filter((t) => t.status !== "graduated");
    if (activeTab === "graduated") list = list.filter((t) => t.status === "graduated");
    if (activeTab === "hot") list = list.filter((t) => (t.bonding_progress ?? 0) >= 60);

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.ticker.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [tokens, activeTab, search]);

  return (
    <LaunchpadLayout>
      <div className="space-y-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold font-mono text-foreground">Terminal</h1>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse inline-block" />
                LIVE
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Select a token to start advanced trading
            </p>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {totalCount.toLocaleString()} tokens
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or ticker..."
            className="pl-8 h-9 text-sm font-mono bg-secondary/30 border-border/60 focus-visible:border-primary/60"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono font-semibold transition-all duration-150 ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-3 text-[9px] font-mono text-muted-foreground uppercase tracking-widest border-b border-border/30 pb-1.5">
          <div className="w-9 flex-shrink-0" />
          <div className="w-28 flex-shrink-0">Token</div>
          <div className="hidden sm:block w-24 flex-shrink-0">Market Cap</div>
          <div className="hidden md:block w-24 flex-shrink-0">Vol 24h</div>
          <div className="hidden lg:block w-16 flex-shrink-0">24h %</div>
          <div className="flex-1">Bonding / Status</div>
          <div className="flex-shrink-0 w-16" />
        </div>

        {/* Token list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-secondary/20 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground font-mono text-sm">
            {search ? `No tokens matching "${search}"` : "No tokens found"}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((token) => (
              <TradeTokenCard key={token.id} token={token} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!search && totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-[11px] font-mono px-3 py-1.5 border border-border/50 rounded hover:border-primary/50 disabled:opacity-30 transition-all"
            >
              ← Prev
            </button>
            <span className="text-[11px] font-mono text-muted-foreground">
              {page} / {Math.ceil(totalCount / PAGE_SIZE)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}
              className="text-[11px] font-mono px-3 py-1.5 border border-border/50 rounded hover:border-primary/50 disabled:opacity-30 transition-all"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </LaunchpadLayout>
  );
}
