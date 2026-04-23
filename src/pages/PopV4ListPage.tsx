// /popv4 — list of all PopShiba V4 launches (queried from bonding_tokens
// where curve_address is one of our hooks). Designed as the V4 cousin of
// /bonding for live testing.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Rocket, ShieldCheck } from "lucide-react";

interface TokenRow {
  id: string;
  name: string;
  symbol: string;
  token_address: string;
  curve_address: string;
  image_url: string | null;
  description: string | null;
  graduated: boolean;
  real_eth_reserves: number | null;
  progress_bps: number | null;
  total_trades: number | null;
  created_at: string;
}

export default function PopV4ListPage() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // network filter: V4 launches are stored with the V4 factory's tx_hash.
      // Until we add a network column we just show every bonding_token; the
      // detail page resolves to the right hook ABI either way.
      const { data } = await supabase
        .from("bonding_tokens")
        .select("id,name,symbol,token_address,curve_address,image_url,description,graduated,real_eth_reserves,progress_bps,total_trades,created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      setTokens((data as TokenRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <LaunchpadLayout>
      <div className="mx-auto max-w-6xl py-6 md:py-10">
        <div className="border-2 border-pop-ink bg-pop-cream p-5 md:p-6 rounded-2xl shadow-[6px_6px_0_0_hsl(var(--pop-ink))]">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-pop-display text-pop-ink/60">
            <ShieldCheck className="h-4 w-4" /> Uniswap V4 · PopShiba hook
          </div>
          <div className="mt-1 flex items-end justify-between gap-3 flex-wrap">
            <h1 className="text-3xl md:text-5xl font-pop-display font-black text-pop-ink leading-none">
              PopShiba V4 launches
            </h1>
            <div className="flex items-center gap-2">
              <Link
                to="/v4-proof"
                className="inline-flex items-center gap-1 px-3 py-2 text-[12px] font-pop-display font-bold border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))]"
              >
                Proof vs Unicurve
              </Link>
              <Link
                to="/bonding/create"
                className="inline-flex items-center gap-1 px-3 py-2 text-[12px] font-pop-display font-bold border-2 border-pop-ink bg-emerald-500 text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))]"
              >
                <Rocket className="h-3.5 w-3.5" /> Launch
              </Link>
            </div>
          </div>
          <p className="mt-2 text-[13px] text-pop-ink/75 max-w-2xl">
            Every launch goes through our <code>PopBondingFactoryV4</code>. Pre-graduation, swaps
            route through our hook's bonding curve via the Uniswap V4 PoolManager.
            Post-graduation, LP is locked forever in the same V4 pool.
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-pop-ink/60" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="mt-6 border-2 border-pop-ink bg-white p-6 rounded-2xl text-center">
            <div className="font-pop-display font-black text-pop-ink text-lg">No launches yet</div>
            <div className="text-pop-ink/70 text-[13px] mt-1">
              Once the first V4 launch lands via <code>popv4-launch</code>, it'll appear here.
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((t) => (
              <Link
                key={t.id}
                to={`/popv4/${t.curve_address}`}
                className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[5px_5px_0_hsl(var(--pop-ink))] transition-all p-3 rounded-xl flex gap-3"
              >
                {t.image_url ? (
                  <img src={t.image_url} alt={t.symbol} className="w-16 h-16 rounded-lg border-2 border-pop-ink object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg border-2 border-pop-ink bg-pop-orange flex items-center justify-center font-pop-display font-black text-lg text-pop-ink flex-shrink-0">
                    {t.symbol.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="font-pop-display font-black text-pop-ink truncate">{t.name}</div>
                    <span className="text-[11px] font-pop-mono text-pop-ink/55">${t.symbol}</span>
                    {t.graduated && (
                      <span className="text-[9px] uppercase tracking-wider px-1 py-px rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-pop-display">
                        grad
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <div className="text-[11.5px] text-pop-ink/65 line-clamp-2 mt-0.5">{t.description}</div>
                  )}
                  <div className="mt-1.5 h-1.5 w-full bg-pop-cream/70 border border-pop-ink/30 rounded overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (t.progress_bps ?? 0) / 100)}%` }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10.5px] font-pop-mono text-pop-ink/55">
                    <span>{((t.progress_bps ?? 0) / 100).toFixed(1)}%</span>
                    <span>{t.total_trades ?? 0} trades</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </LaunchpadLayout>
  );
}
