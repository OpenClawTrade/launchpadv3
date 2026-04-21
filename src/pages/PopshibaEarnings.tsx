// Popshiba Earnings — per-token creator fee dashboard for the connected wallet.
// Lists every token the user launched on Ethereum with lifetime pool fees,
// their 50% creator share, claimable balance, and per-token Claim / Sync actions.
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { formatEther } from "viem";
import { Coins, Loader2, RefreshCw, ExternalLink, ArrowLeft, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { useClaimableCreatorFees } from "@/hooks/useClaimableCreatorFees";

interface LedgerRow {
  token_address: string;
  creator_wallet: string;
  total_collected_weth: string | number | null;
  creator_share_weth: string | number | null;
  creator_paid_weth: string | number | null;
  last_collect_at: string | null;
  last_claim_at: string | null;
  last_claim_tx: string | null;
}

interface TokenMeta {
  mint_address: string;
  name: string | null;
  ticker: string | null;
  image_url: string | null;
}

interface Row extends LedgerRow {
  meta?: TokenMeta;
  totalCollectedWei: bigint;
  shareWei: bigint;
  paidWei: bigint;
  owedWei: bigint;
}

const fmt = (wei: bigint, digits = 6) => parseFloat(formatEther(wei)).toFixed(digits);

export default function PopshibaEarnings() {
  const { address } = useAccount();
  const { login, authenticated } = usePrivy();
  const { totalEth, totalWei, refetch: refetchTotals } = useClaimableCreatorFees(address);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimingOne, setClaimingOne] = useState<string | null>(null);
  const [syncingOne, setSyncingOne] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    if (!address) { setRows([]); return; }
    setLoading(true);
    try {
      // 1. Pull fee ledger (rows only exist after first fee collection)
      const { data: ledger, error } = await supabase
        .from("eth_creator_fee_ledger")
        .select("token_address,creator_wallet,total_collected_weth,creator_share_weth,creator_paid_weth,last_collect_at,last_claim_at,last_claim_tx")
        .ilike("creator_wallet", address);
      if (error) throw error;

      // 2. Pull every successful launch by this wallet — so creators see ALL their tokens,
      //    even ones that haven't generated fees yet.
      const { data: launches } = await (supabase as any)
        .from("eth_launch_requests")
        .select("token_address,token_name,token_ticker,image_url,status")
        .ilike("creator_wallet", address)
        .eq("status", "live")
        .not("token_address", "is", null);

      const ledgerRows = (ledger ?? []) as LedgerRow[];
      const ledgerMap = new Map(ledgerRows.map((r) => [r.token_address.toLowerCase(), r]));

      // Merge: every launched token + ledger data when present
      const allAddrs = new Set<string>(ledgerRows.map((r) => r.token_address.toLowerCase()));
      const launchMeta = new Map<string, { name: string; ticker: string; image: string | null }>();
      for (const l of (launches ?? []) as Array<{ token_address: string; token_name: string; token_ticker: string; image_url: string | null }>) {
        const a = l.token_address.toLowerCase();
        allAddrs.add(a);
        launchMeta.set(a, { name: l.token_name, ticker: l.token_ticker, image: l.image_url });
      }

      const addrs = Array.from(allAddrs);
      let meta: TokenMeta[] = [];
      if (addrs.length > 0) {
        const { data: tokens } = await supabase
          .from("tokens")
          .select("mint_address,name,ticker,image_url")
          .in("mint_address", addrs);
        meta = (tokens ?? []) as TokenMeta[];
      }
      const metaMap = new Map(meta.map((m) => [m.mint_address.toLowerCase(), m]));

      const enriched: Row[] = addrs.map((addr) => {
        const r = ledgerMap.get(addr);
        const totalCollectedWei = safeBig(r?.total_collected_weth);
        const shareWei = safeBig(r?.creator_share_weth);
        const paidWei = safeBig(r?.creator_paid_weth);
        const owedWei = shareWei > paidWei ? shareWei - paidWei : 0n;
        // Prefer tokens table meta, fall back to launch request data
        const tokenMeta = metaMap.get(addr);
        const lm = launchMeta.get(addr);
        const fallbackMeta: TokenMeta | undefined = tokenMeta ?? (lm ? {
          mint_address: addr, name: lm.name, ticker: lm.ticker, image_url: lm.image,
        } : undefined);
        return {
          token_address: addr,
          creator_wallet: r?.creator_wallet ?? address,
          total_collected_weth: r?.total_collected_weth ?? "0",
          creator_share_weth: r?.creator_share_weth ?? "0",
          creator_paid_weth: r?.creator_paid_weth ?? "0",
          last_collect_at: r?.last_collect_at ?? null,
          last_claim_at: r?.last_claim_at ?? null,
          last_claim_tx: r?.last_claim_tx ?? null,
          meta: fallbackMeta,
          totalCollectedWei, shareWei, paidWei, owedWei,
        };
      });
      // Sort: claimable first (desc), then total earned desc
      enriched.sort((a, b) => {
        if (a.owedWei !== b.owedWei) return a.owedWei > b.owedWei ? -1 : 1;
        return a.shareWei > b.shareWei ? -1 : 1;
      });
      setRows(enriched);
    } catch (e) {
      console.error("[PopshibaEarnings] load error", e);
      toast.error("Failed to load earnings");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const lifetimeShareWei = useMemo(
    () => rows.reduce((acc, r) => acc + r.shareWei, 0n),
    [rows]
  );
  const lifetimePoolWei = useMemo(
    () => rows.reduce((acc, r) => acc + r.totalCollectedWei, 0n),
    [rows]
  );
  const lastClaim = useMemo(() => {
    const withTx = rows.filter((r) => r.last_claim_tx && r.last_claim_at);
    if (!withTx.length) return null;
    withTx.sort((a, b) => (a.last_claim_at! < b.last_claim_at! ? 1 : -1));
    return withTx[0];
  }, [rows]);

  const handleClaimOne = async (r: Row) => {
    if (!address || r.owedWei === 0n) return;
    setClaimingOne(r.token_address);
    try {
      const { data, error } = await supabase.functions.invoke("eth-claim-creator-fees", {
        body: { tokenAddress: r.token_address, creatorWallet: address },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Claim failed");
      toast.success("Claimed", { description: `${fmt(r.owedWei)} ETH sent` });
      await Promise.all([loadRows(), refetchTotals()]);
    } catch (e) {
      console.error("[PopshibaEarnings] claim", e);
      toast.error("Claim failed", { description: e instanceof Error ? e.message : "Try again" });
    } finally {
      setClaimingOne(null);
    }
  };

  const handleSyncOne = async (r: Row) => {
    setSyncingOne(r.token_address);
    try {
      const { data, error } = await supabase.functions.invoke("eth-collect-fees", {
        body: { tokenAddress: r.token_address },
      });
      if (error) throw new Error(error.message);
      toast.success("Pool fees synced", {
        description: data?.collected ? `+${parseFloat(formatEther(BigInt(data.collected))).toFixed(6)} ETH collected` : "Up to date",
      });
      await Promise.all([loadRows(), refetchTotals()]);
    } catch (e) {
      console.error("[PopshibaEarnings] sync", e);
      toast.error("Sync failed", { description: e instanceof Error ? e.message : "Try again" });
    } finally {
      setSyncingOne(null);
    }
  };

  const handleClaimAll = async () => {
    if (!address) return;
    const claimable = rows.filter((r) => r.owedWei > 0n);
    if (claimable.length === 0) return;
    setClaimingAll(true);
    let ok = 0, failed = 0;
    try {
      for (const r of claimable) {
        try {
          const { data, error } = await supabase.functions.invoke("eth-claim-creator-fees", {
            body: { tokenAddress: r.token_address, creatorWallet: address },
          });
          if (error) throw new Error(error.message);
          if (!data?.success) throw new Error(data?.error || "Claim failed");
          ok++;
        } catch (e) {
          console.error("[claim-all]", r.token_address, e);
          failed++;
        }
      }
      if (ok > 0) toast.success(`Claimed ${ok} token${ok === 1 ? "" : "s"}`, {
        description: failed > 0 ? `${failed} failed — try again later` : `${totalEth} ETH sent`,
      });
      else toast.error("All claims failed");
      await Promise.all([loadRows(), refetchTotals()]);
    } finally {
      setClaimingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-pop-cream text-pop-ink">
      <PopshibaTopNav />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-[12px] uppercase font-pop-mono tracking-[0.1em] text-pop-ink/70 hover:text-pop-ink mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Back home
        </Link>

        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-pop-display text-[36px] sm:text-[48px] leading-[0.95] tracking-[-0.02em] text-pop-ink">
              Your Earnings
            </h1>
            <p className="font-pop-mono text-[12px] uppercase tracking-[0.1em] text-pop-ink/70 mt-2">
              Creator fees · 50% of Uniswap V3 pool fees on every token you launched
            </p>
          </div>
        </div>

        {!authenticated || !address ? (
          <ConnectCard onConnect={login} />
        ) : (
          <>
            {/* Header stats card */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <StatCard
                label="Lifetime earned (your 50%)"
                value={`${fmt(lifetimeShareWei, 6)} ETH`}
                hint={`Pool total: ${fmt(lifetimePoolWei, 6)} ETH`}
              />
              <StatCard
                label="Claimable now"
                value={`${parseFloat(totalEth).toFixed(6)} ETH`}
                hint={`Across ${rows.filter((r) => r.owedWei > 0n).length} token${rows.filter((r) => r.owedWei > 0n).length === 1 ? "" : "s"}`}
                accent
              />
              <div className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] p-4 flex flex-col">
                <span className="font-pop-mono text-[11px] uppercase tracking-[0.1em] text-pop-ink/70">Last claim</span>
                {lastClaim ? (
                  <a
                    href={`https://etherscan.io/tx/${lastClaim.last_claim_tx}`}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 font-bold text-[14px] text-pop-ink hover:text-pop-orange break-all"
                  >
                    {short(lastClaim.last_claim_tx!)} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                ) : (
                  <span className="mt-2 font-bold text-[14px] text-pop-ink/50">No claims yet</span>
                )}
                <button
                  onClick={handleClaimAll}
                  disabled={claimingAll || totalWei === 0n}
                  className="mt-auto pt-3 inline-flex items-center justify-center gap-2 font-bold text-[12px] px-3 py-2.5 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[2px_2px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0_hsl(var(--pop-ink))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_hsl(var(--pop-ink))] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {claimingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                  Claim all ({parseFloat(totalEth).toFixed(4)} ETH)
                </button>
              </div>
            </section>

            {/* Tokens */}
            <section className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))]">
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-pop-ink bg-pop-cream">
                <h2 className="font-pop-display text-[18px] tracking-[-0.01em]">Your launched tokens</h2>
                <button
                  onClick={() => loadRows()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 font-pop-mono text-[11px] uppercase tracking-[0.1em] text-pop-ink/70 hover:text-pop-ink"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>

              {loading && rows.length === 0 ? (
                <div className="p-12 text-center font-pop-mono text-[12px] uppercase tracking-[0.1em] text-pop-ink/60">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading
                </div>
              ) : rows.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead className="bg-pop-cream/60 text-left font-pop-mono text-[10px] uppercase tracking-[0.1em] text-pop-ink/70">
                      <tr>
                        <th className="px-4 py-3">Token</th>
                        <th className="px-3 py-3 text-right">Pool fees</th>
                        <th className="px-3 py-3 text-right">Your share (50%)</th>
                        <th className="px-3 py-3 text-right">Claimable</th>
                        <th className="px-3 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const claimDisabled = r.owedWei === 0n || claimingOne === r.token_address || claimingAll;
                        return (
                          <tr key={r.token_address} className="border-t border-pop-ink/10 hover:bg-pop-cream/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {r.meta?.image_url ? (
                                  <img src={r.meta.image_url} alt="" className="w-9 h-9 object-cover border-2 border-pop-ink" />
                                ) : (
                                  <div className="w-9 h-9 border-2 border-pop-ink bg-pop-cream flex items-center justify-center font-pop-display text-[14px]">
                                    {(r.meta?.ticker || "?").slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-bold truncate">{r.meta?.name || "Unknown token"}</div>
                                  <div className="font-pop-mono text-[10px] uppercase tracking-[0.08em] text-pop-ink/60 flex items-center gap-1">
                                    {r.meta?.ticker && <span>${r.meta.ticker}</span>}
                                    <a
                                      href={`https://etherscan.io/token/${r.token_address}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="hover:text-pop-orange inline-flex items-center gap-0.5"
                                      title={r.token_address}
                                    >
                                      {short(r.token_address)} <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">{fmt(r.totalCollectedWei)} ETH</td>
                            <td className="px-3 py-3 text-right tabular-nums">{fmt(r.shareWei)} ETH</td>
                            <td className={`px-3 py-3 text-right tabular-nums font-bold ${r.owedWei > 0n ? "text-pop-orange" : "text-pop-ink/40"}`}>
                              {fmt(r.owedWei)} ETH
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleSyncOne(r)}
                                  disabled={syncingOne === r.token_address}
                                  className="inline-flex items-center gap-1 font-pop-mono text-[10px] uppercase tracking-[0.08em] px-2 py-1.5 border-[1.5px] border-pop-ink bg-white hover:bg-pop-cream disabled:opacity-50 transition-colors"
                                  title="Force-collect pool fees from Uniswap"
                                >
                                  {syncingOne === r.token_address
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <RefreshCw className="w-3 h-3" />}
                                  Sync
                                </button>
                                <button
                                  onClick={() => handleClaimOne(r)}
                                  disabled={claimDisabled}
                                  className="inline-flex items-center gap-1 font-bold text-[11px] px-3 py-1.5 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[2px_2px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0_hsl(var(--pop-ink))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_hsl(var(--pop-ink))] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0_hsl(var(--pop-ink))]"
                                >
                                  {claimingOne === r.token_address
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <Coins className="w-3 h-3" />}
                                  Claim
                                </button>
                                {r.last_claim_tx && (
                                  <a
                                    href={`https://etherscan.io/tx/${r.last_claim_tx}`}
                                    target="_blank" rel="noopener noreferrer"
                                    title="Last claim tx"
                                    className="text-pop-ink/60 hover:text-pop-orange"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
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
              Fees are collected from Uniswap V3 LP positions. Your 50% share is paid in ETH (auto-unwrapped from WETH).
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, hint, accent = false }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`border-2 border-pop-ink p-4 shadow-[3px_3px_0_hsl(var(--pop-ink))] ${accent ? "bg-pop-orange" : "bg-white"}`}>
      <div className="font-pop-mono text-[11px] uppercase tracking-[0.1em] text-pop-ink/70">{label}</div>
      <div className="font-pop-display text-[28px] tracking-[-0.02em] mt-1 tabular-nums">{value}</div>
      {hint && <div className="font-pop-mono text-[10px] uppercase tracking-[0.08em] text-pop-ink/60 mt-1">{hint}</div>}
    </div>
  );
}

function ConnectCard({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] p-12 text-center">
      <Wallet className="w-12 h-12 mx-auto text-pop-orange mb-4" strokeWidth={2.25} />
      <h2 className="font-pop-display text-[24px] tracking-[-0.01em] mb-2">Connect your wallet</h2>
      <p className="font-pop-mono text-[11px] uppercase tracking-[0.1em] text-pop-ink/60 mb-6">
        Sign in to view your creator fees and claim earnings
      </p>
      <button
        onClick={onConnect}
        className="inline-flex items-center gap-2 font-bold text-[13px] px-5 py-3 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all"
      >
        Connect wallet
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center">
      <Coins className="w-10 h-10 mx-auto text-pop-ink/30 mb-3" />
      <p className="font-pop-display text-[18px] tracking-[-0.01em]">No earnings yet</p>
      <p className="font-pop-mono text-[11px] uppercase tracking-[0.1em] text-pop-ink/60 mt-2">
        Launch a token to start earning 50% of pool fees
      </p>
      <Link
        to="/launch"
        className="inline-flex items-center gap-2 mt-5 font-bold text-[12px] px-4 py-2.5 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[2px_2px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0_hsl(var(--pop-ink))] transition-all"
      >
        Launch a token
      </Link>
    </div>
  );
}

function safeBig(v: string | number | null | undefined): bigint {
  try {
    if (v === null || v === undefined) return 0n;
    if (typeof v === "number") return BigInt(Math.trunc(v));
    return BigInt(v);
  } catch { return 0n; }
}
function short(s: string) { return `${s.slice(0, 6)}…${s.slice(-4)}`; }
