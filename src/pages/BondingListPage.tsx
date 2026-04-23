import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { Rocket, Plus, Loader2 } from "lucide-react";

interface BondingToken {
  id: string;
  token_address: string;
  curve_address: string;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  graduated: boolean;
  created_at: string;
}

export default function BondingListPage() {
  const [tokens, setTokens] = useState<BondingToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("bonding_tokens")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) setTokens(data as BondingToken[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-pop-cream">
      <PopshibaTopNav />
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <span className="inline-block px-2 py-1 text-[10px] font-pop-mono tracking-[0.12em] bg-pop-ink text-pop-cream mb-2">
              BONDING · ETHEREUM
            </span>
            <h1 className="font-pop-display text-[28px] sm:text-[36px] tracking-[-0.02em] text-pop-ink">
              Unicurve Bonding Tokens
            </h1>
            <p className="text-[13px] text-pop-ink/70 mt-1">
              1B supply · 1.06 ETH virtual reserves · 3 ETH graduation → Uniswap V4 with locked LP
            </p>
          </div>
          <Link
            to="/bonding/create"
            className="inline-flex items-center gap-2 font-bold text-[13px] px-4 py-2.5 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            Launch Token
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-pop-ink/60" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="border-2 border-dashed border-pop-ink/30 p-12 text-center">
            <Rocket className="w-10 h-10 mx-auto text-pop-ink/40 mb-3" />
            <p className="font-pop-display text-[20px] text-pop-ink">No tokens launched yet</p>
            <p className="text-[13px] text-pop-ink/60 mt-1">Be the first to launch on Unicurve.</p>
            <Link
              to="/bonding/create"
              className="inline-flex items-center gap-2 mt-5 font-bold text-[13px] px-4 py-2.5 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))]"
            >
              <Plus className="w-4 h-4" strokeWidth={3} />
              Launch the first one
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tokens.map((t) => (
              <Link
                key={t.id}
                to={`/bonding/token/${t.token_address}`}
                className="group border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all p-3"
              >
                <div className="aspect-square w-full bg-pop-cream border border-pop-ink/20 mb-3 overflow-hidden">
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-pop-ink/30">
                      <Rocket className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-pop-display text-[16px] tracking-tight text-pop-ink truncate">
                    {t.name}
                  </span>
                  {t.graduated && (
                    <span className="text-[9px] font-pop-mono px-1.5 py-0.5 bg-emerald-500/20 text-emerald-700 border border-emerald-700/30">
                      GRAD
                    </span>
                  )}
                </div>
                <p className="font-pop-mono text-[11px] text-pop-ink/60 truncate">${t.symbol}</p>
                {t.description && (
                  <p className="text-[12px] text-pop-ink/70 mt-2 line-clamp-2">{t.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
