// Popshiba Alpha — live feed of every /ape trade across the platform.
// Reads from the `alpha_trades` table (chain = ethereum), with realtime updates.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { ArrowLeft, ExternalLink, RefreshCw, TrendingUp, TrendingDown, Loader2, Activity } from "lucide-react";

interface AlphaTradeRow {
  id: string;
  wallet_address: string;
  token_mint: string;
  token_name: string | null;
  token_ticker: string | null;
  trade_type: string;          // "buy" | "sell"
  amount_sol: number;          // ETH amount for the eth chain
  amount_tokens: number;
  price_usd: number | null;
  tx_hash: string;
  created_at: string;
  chain: string | null;
}

const SHORT = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
const fmtEth = (n: number) => (n < 0.0001 ? n.toExponential(2) : n.toFixed(n < 1 ? 4 : 3));
const fmtTokens = (n: number) => {
  if (!isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
};
function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function PopshibaAlphaPage() {
  const [rows, setRows] = useState<AlphaTradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");

  const load = async () => {
    setRefreshing(true);
    const { data, error } = await (supabase as any)
      .from("alpha_trades")
      .select("id,wallet_address,token_mint,token_name,token_ticker,trade_type,amount_sol,amount_tokens,price_usd,tx_hash,created_at,chain")
      .eq("chain", "ethereum")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setRows(data as AlphaTradeRow[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("alpha-trades-popshiba")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alpha_trades" },
        (payload) => {
          const row = payload.new as AlphaTradeRow;
          if ((row.chain || "ethereum") !== "ethereum") return;
          setRows((prev) => [row, ...prev].slice(0, 200));
        }
      )
      .subscribe();
    const t = window.setInterval(load, 15000);
    return () => { window.clearInterval(t); supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.trade_type === filter)),
    [rows, filter]
  );

  const totals = useMemo(() => {
    const buys = rows.filter((r) => r.trade_type === "buy").length;
    const sells = rows.filter((r) => r.trade_type === "sell").length;
    const eth = rows.reduce((a, r) => a + (Number(r.amount_sol) || 0), 0);
    const wallets = new Set(rows.map((r) => r.wallet_address.toLowerCase())).size;
    return { buys, sells, eth, wallets };
  }, [rows]);

  return (
    <div className="min-h-screen bg-pop-cream text-pop-ink">
      <PopshibaTopNav />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-[12px] uppercase font-pop-mono tracking-[0.1em] text-pop-ink/70 hover:text-pop-ink mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Back home
        </Link>

        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="font-pop-mono text-[11px] tracking-[0.18em] uppercase text-pop-ink/60 mb-2">
              // Live trade feed
            </div>
            <h1 className="font-pop-display text-[36px] sm:text-[48px] leading-[0.95] tracking-[-0.02em]">
              Alpha
            </h1>
            <p className="font-pop-mono text-[12px] uppercase tracking-[0.1em] text-pop-ink/70 mt-2">
              Every swap from <Link to="/ape" className="text-pop-orange underline">/ape</Link> · Ethereum
            </p>
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-2 font-bold text-[12px] px-4 py-2.5 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_hsl(var(--pop-ink))] transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Stat label="Trades" value={String(rows.length)} />
          <Stat label="Buys" value={String(totals.buys)} accent="up" />
          <Stat label="Sells" value={String(totals.sells)} accent="down" />
          <Stat label="Wallets" value={String(totals.wallets)} />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-0 mb-5 border-2 border-pop-ink bg-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] w-fit">
          {(["all", "buy", "sell"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 font-pop-display text-[12px] tracking-[0.06em] uppercase transition-colors ${
                filter === f ? "bg-pop-orange text-pop-ink" : "text-pop-cream/75 hover:text-pop-cream"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Feed */}
        <section className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))]">
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-pop-ink bg-pop-cream">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <h2 className="font-pop-display text-[16px] tracking-[-0.01em]">Recent trades</h2>
            </div>
            <span className="font-pop-mono text-[10px] uppercase tracking-[0.1em] text-pop-ink/60">
              {filtered.length} shown · live
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center font-pop-mono text-[12px] uppercase tracking-[0.1em] text-pop-ink/60">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading
            </div>
          ) : filtered.length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-pop-cream/60 text-left font-pop-mono text-[10px] uppercase tracking-[0.1em] text-pop-ink/70">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-3 py-3">Token</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-3 py-3 text-right">Tokens</th>
                    <th className="px-3 py-3">Trader</th>
                    <th className="px-3 py-3 text-right">When</th>
                    <th className="px-3 py-3 text-right">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const isBuy = r.trade_type === "buy";
                    return (
                      <tr key={r.id} className="border-t border-pop-ink/10 hover:bg-pop-cream/30 transition-colors">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 font-pop-mono text-[10px] uppercase tracking-[0.1em] px-2 py-1 border-[1.5px] ${
                              isBuy
                                ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                                : "border-rose-700 bg-rose-50 text-rose-800"
                            }`}
                          >
                            {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {r.trade_type}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Link to={`/ape/${r.token_mint}`} className="block min-w-0">
                            <div className="font-bold truncate hover:text-pop-orange">
                              {r.token_name || r.token_ticker || SHORT(r.token_mint)}
                            </div>
                            <div className="font-pop-mono text-[10px] uppercase tracking-[0.08em] text-pop-ink/60">
                              {r.token_ticker ? `$${r.token_ticker} · ` : ""}{SHORT(r.token_mint)}
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold">
                          {fmtEth(Number(r.amount_sol) || 0)} ETH
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-pop-ink/75">
                          {fmtTokens(Number(r.amount_tokens) || 0)}
                        </td>
                        <td className="px-3 py-3">
                          <a
                            href={`https://etherscan.io/address/${r.wallet_address}`}
                            target="_blank" rel="noopener noreferrer"
                            className="font-pop-mono text-[11px] text-pop-ink/75 hover:text-pop-orange"
                          >
                            {SHORT(r.wallet_address)}
                          </a>
                        </td>
                        <td className="px-3 py-3 text-right font-pop-mono text-[11px] text-pop-ink/60">
                          {timeAgo(r.created_at)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <a
                            href={`https://etherscan.io/tx/${r.tx_hash}`}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-pop-ink/60 hover:text-pop-orange"
                            title={r.tx_hash}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-6 font-pop-mono text-[10px] uppercase tracking-[0.1em] text-pop-ink/50 text-center">
          Trades are recorded after each swap on /ape · feed updates live every 15s
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "up" | "down" }) {
  const tone =
    accent === "up" ? "text-emerald-700"
    : accent === "down" ? "text-rose-700"
    : "text-pop-ink";
  return (
    <div className="border-2 border-pop-ink bg-white p-4 shadow-[3px_3px_0_hsl(var(--pop-ink))]">
      <div className="font-pop-mono text-[10px] uppercase tracking-[0.1em] text-pop-ink/70">{label}</div>
      <div className={`font-pop-display text-[28px] tracking-[-0.02em] mt-1 tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="p-12 text-center">
      <Activity className="w-10 h-10 mx-auto text-pop-ink/30 mb-3" />
      <p className="font-pop-display text-[18px] tracking-[-0.01em]">No trades yet</p>
      <p className="font-pop-mono text-[11px] uppercase tracking-[0.1em] text-pop-ink/60 mt-2">
        Swap on /ape to populate this feed
      </p>
      <Link
        to="/ape"
        className="inline-flex items-center gap-2 mt-5 font-bold text-[12px] px-4 py-2.5 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[2px_2px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0_hsl(var(--pop-ink))] transition-all"
      >
        Open /ape
      </Link>
    </div>
  );
}
