import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { Plus, Loader2, Search, Rocket } from "lucide-react";

interface BondingToken {
  id: string;
  token_address: string;
  curve_address: string;
  creator_address: string;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  graduated: boolean;
  created_at: string;
  market_cap_usd: number | null;
  price_eth: number | null;
  progress_bps: number | null;
  last_trade_at: string | null;
  total_trades: number | null;
  holder_count: number | null;
}

type Sort = "new" | "movers" | "graduated" | "mcap" | "oldest" | "lasttrade";

const TABS: { id: Sort; label: string }[] = [
  { id: "new",       label: "New" },
  { id: "movers",    label: "Movers" },
  { id: "graduated", label: "Graduated" },
  { id: "mcap",      label: "Market cap" },
  { id: "oldest",    label: "Oldest" },
  { id: "lasttrade", label: "Last trade" },
];

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtUsd(n?: number | null) {
  if (!n || n <= 0) return "$0";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}
function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }

export default function BondingListPage() {
  const [tokens, setTokens] = useState<BondingToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>("new");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("bonding_tokens")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (data) setTokens(data as BondingToken[]);
      setLoading(false);
    })();
  }, []);

  const sorted = useMemo(() => {
    let arr = [...tokens];
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter(
        (t) =>
          t.name.toLowerCase().includes(s) ||
          t.symbol.toLowerCase().includes(s) ||
          t.token_address.toLowerCase().includes(s),
      );
    }
    switch (sort) {
      case "new":       arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)); break;
      case "oldest":    arr.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)); break;
      case "graduated": arr = arr.filter((t) => t.graduated); break;
      case "mcap":      arr.sort((a, b) => (b.market_cap_usd ?? 0) - (a.market_cap_usd ?? 0)); break;
      case "movers":    arr.sort((a, b) => (b.progress_bps ?? 0) - (a.progress_bps ?? 0)); break;
      case "lasttrade":
        arr.sort((a, b) => (+new Date(b.last_trade_at ?? 0)) - (+new Date(a.last_trade_at ?? 0)));
        break;
    }
    return arr;
  }, [tokens, sort, q]);

  const trending = useMemo(
    () => [...tokens].sort((a, b) => (b.market_cap_usd ?? 0) - (a.market_cap_usd ?? 0)).slice(0, 4),
    [tokens],
  );

  return (
    <div className="min-h-screen bg-pop-cream">
      <PopshibaTopNav />
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
        {/* Trending strip */}
        {trending.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[16px]">🔥</span>
              <span className="text-[11px] font-pop-mono uppercase tracking-[0.14em] text-pop-ink/70">Trending now</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {trending.map((t) => (
                <Link
                  key={t.id}
                  to={`/bonding/token/${t.token_address}`}
                  className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all p-3 flex items-center gap-3"
                >
                  <div className="w-12 h-12 border-2 border-pop-ink bg-pop-cream overflow-hidden flex-shrink-0">
                    {t.image_url ? <img src={t.image_url} alt="" className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-pop-display text-[13px] truncate">{t.name}</p>
                    <p className="font-pop-mono text-[11px] text-pop-ink/60 truncate">${t.symbol}</p>
                    <p className="font-bold text-[12px] text-pop-orange">{fmtUsd(t.market_cap_usd)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Sort tabs + search + create */}
        <section className="flex flex-col lg:flex-row gap-3 mb-5">
          <div className="relative flex-1 lg:max-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pop-ink/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, ticker, contract…"
              className="w-full pl-9 pr-3 py-2.5 border-2 border-pop-ink bg-white text-[13px] focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 items-center bg-white border-2 border-pop-ink p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSort(t.id)}
                className={`px-3 py-1.5 text-[12px] font-pop-mono uppercase tracking-[0.06em] transition-colors ${
                  sort === t.id ? "bg-pop-ink text-pop-cream" : "text-pop-ink/70 hover:text-pop-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Link
            to="/bonding/create"
            className="inline-flex items-center justify-center gap-2 font-bold text-[13px] px-4 py-2.5 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all lg:ml-auto"
          >
            <Plus className="w-4 h-4" strokeWidth={3} /> Create coin
          </Link>
          <Link
            to="/bonding/claim"
            className="inline-flex items-center justify-center gap-2 font-bold text-[13px] px-4 py-2.5 border-2 border-pop-ink bg-white text-pop-ink hover:bg-pop-cream transition-colors"
          >
            Claim fees
          </Link>
        </section>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-pop-ink/60" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="border-2 border-dashed border-pop-ink/30 p-12 text-center">
            <Rocket className="w-10 h-10 mx-auto text-pop-ink/40 mb-3" />
            <p className="font-pop-display text-[20px] text-pop-ink">No tokens match</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map((t) => {
              const pct = Math.min(100, (t.progress_bps ?? 0) / 100);
              return (
                <Link
                  key={t.id}
                  to={`/bonding/token/${t.token_address}`}
                  className="group border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all p-3 flex gap-3"
                >
                  <div className="w-[88px] h-[88px] sm:w-[96px] sm:h-[96px] border-2 border-pop-ink bg-pop-cream overflow-hidden flex-shrink-0">
                    {t.image_url ? (
                      <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-pop-ink/30">
                        <Rocket className="w-7 h-7" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-pop-display text-[15px] tracking-tight truncate">{t.name}</span>
                      <span className="font-pop-mono text-[11px] text-pop-ink/60 shrink-0">${t.symbol}</span>
                    </div>
                    <p className="text-[11px] font-pop-mono text-pop-ink/60 truncate mt-0.5">
                      by {shortAddr(t.creator_address)} · {timeAgo(t.created_at)}
                    </p>
                    <p className="text-[12px] mt-1.5">
                      mcap <span className="font-bold text-pop-orange">{fmtUsd(t.market_cap_usd)}</span>
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-pop-cream border border-pop-ink/20 overflow-hidden">
                        <div
                          className={`h-full ${t.graduated ? "bg-emerald-500" : "bg-pop-orange"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {t.graduated ? (
                        <span className="text-[9px] font-pop-mono px-1.5 py-0.5 bg-emerald-500/20 text-emerald-700 border border-emerald-700/30">
                          GRAD
                        </span>
                      ) : (
                        <span className="text-[10px] font-pop-mono text-pop-ink/70 tabular-nums">
                          {pct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
