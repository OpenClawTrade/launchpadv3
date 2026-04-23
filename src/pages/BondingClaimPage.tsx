// /bonding/claim — single-tx sweep of all creator fees via the central FeeRouter
// (0xcf859a7c…). One transaction claims every curve at once. Pending balance is
// read from the same router so it updates instantly after each trade.
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createPublicClient, createWalletClient, custom, http,
  encodeAbiParameters, decodeAbiParameters, formatEther,
  type Address, type Hash, type Hex,
} from "viem";
import { mainnet } from "viem/chains";
import { supabase } from "@/integrations/supabase/client";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { UNICURVE_FEE_ROUTER } from "@/lib/ethereum/unicurveFactory";
import { ArrowLeft, Loader2, Coins, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface MyToken {
  id: string;
  token_address: string;
  curve_address: string;
  name: string;
  symbol: string;
  image_url: string | null;
  graduated: boolean;
  pendingWei?: bigint;
}

// Real on-chain selectors (decoded from live claim tx 0x885f8300…0f6dc)
const PENDING_SELECTOR = "0x3e48abb8" as const; // pending(address[]) -> uint256[]
const CLAIM_SELECTOR   = "0xf74e246f" as const; // claim(address[],address,address[])
const FEE_CLAIMED_TOPIC =
  "0xc1ede5e15d35c62084fa6c180bfc24b92ec8fe9bfdc891ca069a004d588c6bf7" as Hex;
const EVENT_BUS = "0x7CaE6f8c3c03A746F66f1a4d757519936F0bEe6a" as Address;

async function getEthUsd(): Promise<number> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    );
    const j = await r.json();
    return j?.ethereum?.usd ?? 0;
  } catch { return 0; }
}

export default function BondingClaimPage() {
  const { authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const me = (user?.wallet?.address as Address | undefined)?.toLowerCase() as Address | undefined;

  const [tokens, setTokens] = useState<MyToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ethUsd, setEthUsd] = useState(0);
  const [lifetimeWei, setLifetimeWei] = useState<bigint>(0n);

  const publicClient = useMemo(
    () => createPublicClient({ chain: mainnet, transport: http() }) as any,
    [],
  );

  /* Read pending fees for ALL curves in a single eth_call */
  const refreshPending = useCallback(async (rows: MyToken[]) => {
    if (rows.length === 0) return rows;
    const curves = rows.map((t) => t.curve_address.toLowerCase() as Address);
    const data = (PENDING_SELECTOR + encodeAbiParameters(
      [{ type: "address[]" }],
      [curves],
    ).slice(2)) as Hex;
    try {
      const result = await publicClient.call({ to: UNICURVE_FEE_ROUTER, data });
      const [amounts] = decodeAbiParameters(
        [{ type: "uint256[]" }],
        result.data as Hex,
      ) as unknown as [bigint[]];
      return rows.map((t, i) => ({ ...t, pendingWei: amounts[i] ?? 0n }));
    } catch (err) {
      console.warn("[claim] pending() reverted, defaulting to 0", err);
      return rows.map((t) => ({ ...t, pendingWei: 0n }));
    }
  }, [publicClient]);

  const reload = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    const { data } = await supabase
      .from("bonding_tokens")
      .select("id, token_address, curve_address, name, symbol, image_url, graduated")
      .eq("creator_address", me)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as MyToken[];
    const enriched = await refreshPending(list);
    setTokens(enriched);
    setLoading(false);
  }, [me, refreshPending]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { getEthUsd().then(setEthUsd); }, []);

  /* Live polling — pending grows instantly with every on-chain trade */
  useEffect(() => {
    if (tokens.length === 0) return;
    const i = setInterval(async () => {
      const updated = await refreshPending(tokens);
      const changed = updated.some((t, idx) => t.pendingWei !== tokens[idx].pendingWei);
      if (changed) setTokens(updated);
    }, 8000);
    return () => clearInterval(i);
  }, [tokens, refreshPending]);

  /* Lifetime claimed (sum of FeeClaimed events emitted to me) */
  useEffect(() => {
    if (!me) return;
    (async () => {
      try {
        const meTopic = ("0x" + me.slice(2).padStart(64, "0")) as Hex;
        const logs = await publicClient.getLogs({
          address: EVENT_BUS,
          topics: [FEE_CLAIMED_TOPIC, null, null, meTopic],
          fromBlock: 0n,
          toBlock: "latest",
        });
        let total = 0n;
        for (const l of logs as any[]) {
          if (typeof l.data === "string" && l.data.length >= 2 + 64 * 3) {
            // data layout: kind | amount | extra
            const amount = BigInt("0x" + l.data.slice(2 + 64, 2 + 128));
            total += amount;
          }
        }
        setLifetimeWei(total);
      } catch { /* non-fatal */ }
    })();
  }, [me, publicClient]);

  const totalPending = tokens.reduce((acc, t) => acc + (t.pendingWei ?? 0n), 0n);
  const claimable = tokens.filter((t) => (t.pendingWei ?? 0n) > 0n);
  const graduatedCount = tokens.filter((t) => t.graduated).length;
  const pendingEth = Number(formatEther(totalPending));
  const lifetimeEth = Number(formatEther(lifetimeWei));

  async function claimAll() {
    if (!me || claimable.length === 0) { toast.info("Nothing to claim"); return; }
    setBusy(true);
    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy") || wallets[0];
      if (!wallet) throw new Error("No wallet");
      await wallet.switchChain(mainnet.id);
      const provider = await wallet.getEthereumProvider();
      const wc = createWalletClient({ chain: mainnet, transport: custom(provider) }) as any;

      const curves = claimable.map((t) => t.curve_address.toLowerCase() as Address);
      const graduatedTokens = claimable
        .filter((t) => t.graduated)
        .map((t) => t.token_address.toLowerCase() as Address);

      const data = (CLAIM_SELECTOR + encodeAbiParameters(
        [{ type: "address[]" }, { type: "address" }, { type: "address[]" }],
        [curves, me, graduatedTokens],
      ).slice(2)) as Hex;

      const hash: Hash = await wc.sendTransaction({
        account: me,
        chain: mainnet,
        to: UNICURVE_FEE_ROUTER,
        data,
      });
      toast.success("Claim sent…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast.success(`Claimed ${pendingEth.toFixed(6)} ETH`);
        setTokens((arr) => arr.map((t) => ({ ...t, pendingWei: 0n })));
        setTimeout(reload, 1500);
      } else {
        throw new Error("Reverted");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Claim failed");
    } finally { setBusy(false); }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-pop-cream">
        <PopshibaTopNav />
        <main className="max-w-[640px] mx-auto px-4 py-12 text-center">
          <Coins className="w-12 h-12 mx-auto text-pop-ink/40 mb-4" />
          <h1 className="font-pop-display text-[28px] text-pop-ink mb-2">Your earnings</h1>
          <p className="text-[14px] text-pop-ink/70 mb-6">
            Connect your wallet to see fees you've accrued.
          </p>
          <button
            onClick={login}
            className="px-6 py-3 font-bold border-2 border-pop-ink bg-pop-orange shadow-[3px_3px_0_hsl(var(--pop-ink))]"
          >
            Connect wallet
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pop-cream">
      <PopshibaTopNav />
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
        <Link
          to="/bonding"
          className="inline-flex items-center gap-1.5 text-[12px] font-pop-mono text-pop-ink/70 hover:text-pop-ink mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> BACK
        </Link>

        <h1 className="font-pop-display text-[36px] sm:text-[44px] tracking-tight text-pop-ink leading-none">
          Your earnings
        </h1>
        <p className="text-[13px] text-pop-ink/70 mt-2 mb-6">
          Fees you've accrued from coins you launched — curve-phase plus post-graduation LP rewards.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <StatCard
            label="Curve pending"
            highlight
            value={pendingEth > 0 ? `$${(pendingEth * ethUsd).toFixed(2)}` : "$0"}
            sub={`${pendingEth.toFixed(4)} ETH`}
          />
          <StatCard
            label="Lifetime earned"
            value={`$${(lifetimeEth * ethUsd).toFixed(2)}`}
            sub={`${lifetimeEth.toFixed(4)} ETH`}
          />
          <StatCard
            label="Graduated coins"
            value={`${graduatedCount}`}
            sub={graduatedCount === 0 ? "none yet" : `${graduatedCount} live LP`}
          />
        </div>

        <button
          onClick={claimAll}
          disabled={busy || totalPending === 0n}
          className="w-full mb-6 inline-flex items-center justify-center gap-2 font-bold text-[16px] py-4 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[4px_4px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[5px_5px_0_hsl(var(--pop-ink))] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          Claim ${(pendingEth * ethUsd).toFixed(2)}
        </button>

        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-pop-mono uppercase tracking-[0.14em] text-pop-ink/70">
            Curve fees — claimable
          </p>
          <p className="text-[11px] font-pop-mono text-pop-ink/60">
            {claimable.length} {claimable.length === 1 ? "coin" : "coins"}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-pop-ink/60" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="border-2 border-dashed border-pop-ink/30 p-10 text-center">
            <p className="font-pop-display text-[18px] text-pop-ink">
              You haven't launched any coins yet.
            </p>
            <Link
              to="/bonding/create"
              className="inline-block mt-4 font-bold text-pop-orange"
            >
              Launch your first →
            </Link>
          </div>
        ) : (
          <div className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] divide-y-2 divide-pop-ink/10">
            {tokens
              .slice()
              .sort((a, b) => Number((b.pendingWei ?? 0n) - (a.pendingWei ?? 0n)))
              .map((t) => {
                const pending = t.pendingWei ?? 0n;
                const eth = Number(formatEther(pending));
                const usd = eth * ethUsd;
                const has = pending > 0n;
                return (
                  <Link
                    key={t.id}
                    to={`/bonding/token/${t.token_address}`}
                    className="flex items-center gap-3 p-3 hover:bg-pop-cream/40 transition-colors"
                  >
                    <div className="w-12 h-12 border-2 border-pop-ink bg-pop-cream overflow-hidden flex-shrink-0">
                      {t.image_url && (
                        <img src={t.image_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-pop-display text-[15px] truncate">
                        {t.name}{" "}
                        <span className="text-pop-ink/60 font-pop-mono text-[12px]">
                          ${t.symbol}
                        </span>
                      </p>
                      <p className="font-pop-mono text-[10px] text-pop-ink/50 truncate">
                        {t.token_address.slice(0, 6)}…{t.token_address.slice(-4)}
                        {t.graduated && (
                          <span className="ml-2 text-emerald-600">GRADUATED</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-[14px] tabular-nums ${has ? "text-pop-orange" : "text-pop-ink/40"}`}>
                        ${usd.toFixed(2)}
                      </p>
                      <p className="text-[10px] font-pop-mono text-pop-ink/60 tabular-nums">
                        {eth.toFixed(4)} ETH
                      </p>
                    </div>
                  </Link>
                );
              })}
          </div>
        )}

        <p className="text-[10px] font-pop-mono text-pop-ink/50 text-center mt-6">
          Sweeps via FeeRouter{" "}
          <a
            href={`https://etherscan.io/address/${UNICURVE_FEE_ROUTER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-pop-ink"
          >
            {UNICURVE_FEE_ROUTER.slice(0, 8)}…
            <ExternalLink className="w-2.5 h-2.5" />
          </a>{" "}
          · one transaction claims all coins at once · payouts arrive in your connected wallet.
        </p>
      </main>
    </div>
  );
}

function StatCard({
  label, value, sub, highlight,
}: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] p-4">
      <p className="text-[10px] font-pop-mono uppercase tracking-[0.14em] text-pop-ink/70">
        {label}
      </p>
      <p className={`font-pop-display text-[28px] mt-1 tabular-nums leading-none ${highlight ? "text-pop-orange" : "text-pop-ink"}`}>
        {value}
      </p>
      <p className="text-[11px] font-pop-mono text-pop-ink/60 mt-1.5">{sub}</p>
    </div>
  );
}
