// /bonding/profile/:address — public creator page (mirrors unicurve.fun/profile)
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { createPublicClient, http, formatEther, type Address } from "viem";
import { mainnet } from "viem/chains";
import { supabase } from "@/integrations/supabase/client";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { ExternalLink, Loader2, Rocket, ArrowLeft } from "lucide-react";
import { UNICURVE_CURVE_ABI } from "@/lib/ethereum/unicurveFactory";

interface Coin {
  id: string;
  token_address: string;
  curve_address: string;
  name: string;
  symbol: string;
  image_url: string | null;
  graduated: boolean;
  market_cap_usd: number | null;
  progress_bps: number | null;
  created_at: string;
  pendingEth?: bigint;
}

function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }
function fmtUsd(n?: number | null) {
  if (!n || n <= 0) return "$0";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export default function BondingProfilePage() {
  const { address } = useParams<{ address: string }>();
  const addr = address?.toLowerCase();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [walletEth, setWalletEth] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);

  const publicClient = useMemo(
    () => createPublicClient({ chain: mainnet, transport: http() }) as any,
    [],
  );

  useEffect(() => {
    if (!addr) return;
    (async () => {
      setLoading(true);
      const [{ data }, bal] = await Promise.all([
        supabase
          .from("bonding_tokens")
          .select("id, token_address, curve_address, name, symbol, image_url, graduated, market_cap_usd, progress_bps, created_at")
          .eq("creator_address", addr)
          .order("created_at", { ascending: false }),
        publicClient.getBalance({ address: addr as Address }).catch(() => 0n),
      ]);
      const list = (data ?? []) as Coin[];
      const enriched = await Promise.all(
        list.map(async (c) => {
          try {
            const pending = await publicClient.readContract({
              address: c.curve_address as Address,
              abi: UNICURVE_CURVE_ABI,
              functionName: "creatorFeesAccrued",
            });
            return { ...c, pendingEth: pending as bigint };
          } catch { return { ...c, pendingEth: 0n }; }
        }),
      );
      setCoins(enriched);
      setWalletEth(bal);
      setLoading(false);
    })();
  }, [addr, publicClient]);

  const totalPending = coins.reduce((acc, c) => acc + (c.pendingEth ?? 0n), 0n);

  if (!addr) return null;

  return (
    <div className="min-h-screen bg-pop-cream">
      <PopshibaTopNav />
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
        <Link to="/bonding" className="inline-flex items-center gap-1.5 text-[12px] font-pop-mono text-pop-ink/70 hover:text-pop-ink mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> BACK
        </Link>

        {/* Header */}
        <div className="border-2 border-pop-ink bg-white shadow-[4px_4px_0_hsl(var(--pop-ink))] p-5 sm:p-6 mb-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-14 h-14 border-2 border-pop-ink bg-pop-orange/40 flex items-center justify-center font-pop-display text-[18px]">
              {addr.slice(2, 4).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-pop-display text-[24px] sm:text-[28px] tracking-tight text-pop-ink truncate">
                {shortAddr(addr)}
              </h1>
              <a
                href={`https://etherscan.io/address/${addr}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-pop-mono text-pop-ink/70 hover:text-pop-ink"
              >
                {addr} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full sm:w-auto">
              <Stat label="Wallet" value={`${Number(formatEther(walletEth)).toFixed(4)} ETH`} />
              <Stat label="Coins" value={`${coins.length}`} />
              <Stat label="Pending" value={`${Number(formatEther(totalPending)).toFixed(4)} ETH`} highlight />
              <Stat label="Graduated" value={`${coins.filter((c) => c.graduated).length}`} />
            </div>
          </div>
        </div>

        {/* Coins */}
        <h2 className="text-[12px] font-pop-mono uppercase tracking-[0.14em] text-pop-ink/70 mb-3">
          Coins created ({coins.length})
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-pop-ink/60" />
          </div>
        ) : coins.length === 0 ? (
          <div className="border-2 border-dashed border-pop-ink/30 p-10 text-center">
            <p className="text-[14px] text-pop-ink/70">No coins launched.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coins.map((c) => {
              const pct = Math.min(100, (c.progress_bps ?? 0) / 100);
              return (
                <Link
                  key={c.id}
                  to={`/bonding/token/${c.token_address}`}
                  className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all p-3 flex gap-3"
                >
                  <div className="w-16 h-16 border-2 border-pop-ink bg-pop-cream overflow-hidden flex-shrink-0">
                    {c.image_url ? <img src={c.image_url} className="w-full h-full object-cover" alt="" /> : <Rocket className="w-6 h-6 m-auto text-pop-ink/30" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-pop-display text-[14px] truncate">{c.name}</p>
                    <p className="font-pop-mono text-[11px] text-pop-ink/60 truncate">${c.symbol}</p>
                    <p className="text-[12px] mt-1">mcap <span className="font-bold text-pop-orange">{fmtUsd(c.market_cap_usd)}</span></p>
                    <div className="mt-1.5 h-1.5 bg-pop-cream border border-pop-ink/20 overflow-hidden">
                      <div className={`h-full ${c.graduated ? "bg-emerald-500" : "bg-pop-orange"}`} style={{ width: `${pct}%` }} />
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

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink/60">{label}</p>
      <p className={`font-pop-display text-[16px] mt-0.5 truncate ${highlight ? "text-pop-orange" : "text-pop-ink"}`}>
        {value}
      </p>
    </div>
  );
}
