// /bonding/claim — single-page sweep of all creator fees across every token
// the connected wallet has launched on the Unicurve factory.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http, formatEther, type Address, type Hash } from "viem";
import { mainnet } from "viem/chains";
import { supabase } from "@/integrations/supabase/client";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { UNICURVE_CURVE_ABI } from "@/lib/ethereum/unicurveFactory";
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
  pendingEth?: bigint;
  claiming?: boolean;
}

export default function BondingClaimPage() {
  const { authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const me = (user?.wallet?.address as Address | undefined)?.toLowerCase();

  const [tokens, setTokens] = useState<MyToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const publicClient = useMemo(
    () => createPublicClient({ chain: mainnet, transport: http() }),
    [],
  );

  useEffect(() => {
    if (!me) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("bonding_tokens")
        .select("id, token_address, curve_address, name, symbol, image_url, graduated")
        .eq("creator_address", me)
        .order("created_at", { ascending: false });
      const list = (data ?? []) as MyToken[];

      // Read pending creator fees in parallel
      const enriched = await Promise.all(
        list.map(async (t) => {
          try {
            const pending = await publicClient.readContract({
              address: t.curve_address as Address,
              abi: UNICURVE_CURVE_ABI,
              functionName: "creatorFeesAccrued",
            });
            return { ...t, pendingEth: pending as bigint };
          } catch {
            return { ...t, pendingEth: 0n };
          }
        }),
      );
      setTokens(enriched);
      setLoading(false);
    })();
  }, [me, publicClient]);

  const totalPending = tokens.reduce((acc, t) => acc + (t.pendingEth ?? 0n), 0n);

  async function getWalletClient() {
    const wallet = wallets.find((w) => w.walletClientType === "privy") || wallets[0];
    if (!wallet) throw new Error("No wallet");
    await wallet.switchChain(mainnet.id);
    const provider = await wallet.getEthereumProvider();
    return createWalletClient({ chain: mainnet, transport: custom(provider) });
  }

  async function claimOne(t: MyToken) {
    if (!me) return;
    setTokens((arr) => arr.map((x) => (x.id === t.id ? { ...x, claiming: true } : x)));
    try {
      const wc = await getWalletClient();
      const hash: Hash = await wc.writeContract({
        account: me as Address,
        chain: mainnet,
        address: t.curve_address as Address,
        abi: UNICURVE_CURVE_ABI,
        functionName: "claimCreatorFees",
      });
      toast.success(`Claim sent for ${t.symbol}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast.success(`Claimed ${t.symbol}!`);
        // refresh that row's pending
        const fresh = await publicClient.readContract({
          address: t.curve_address as Address,
          abi: UNICURVE_CURVE_ABI,
          functionName: "creatorFeesAccrued",
        });
        setTokens((arr) =>
          arr.map((x) => (x.id === t.id ? { ...x, pendingEth: fresh as bigint, claiming: false } : x)),
        );
      } else {
        throw new Error("Reverted");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Claim failed");
      setTokens((arr) => arr.map((x) => (x.id === t.id ? { ...x, claiming: false } : x)));
    }
  }

  async function claimAll() {
    if (!me) return;
    const eligible = tokens.filter((t) => (t.pendingEth ?? 0n) > 0n);
    if (eligible.length === 0) { toast.info("Nothing to claim"); return; }
    setBulkBusy(true);
    for (const t of eligible) {
      // sequential — each is its own user-signed tx
      await claimOne(t);
    }
    setBulkBusy(false);
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-pop-cream">
        <PopshibaTopNav />
        <main className="max-w-[640px] mx-auto px-4 py-12 text-center">
          <Coins className="w-12 h-12 mx-auto text-pop-ink/40 mb-4" />
          <h1 className="font-pop-display text-[28px] text-pop-ink mb-2">Creator rewards</h1>
          <p className="text-[14px] text-pop-ink/70 mb-6">Connect your wallet to see your unclaimed fees.</p>
          <button onClick={login} className="px-6 py-3 font-bold border-2 border-pop-ink bg-pop-orange shadow-[3px_3px_0_hsl(var(--pop-ink))]">
            Connect wallet
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pop-cream">
      <PopshibaTopNav />
      <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-6">
        <Link to="/bonding" className="inline-flex items-center gap-1.5 text-[12px] font-pop-mono text-pop-ink/70 hover:text-pop-ink mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> BACK
        </Link>

        {/* Summary card */}
        <div className="border-2 border-pop-ink bg-white shadow-[5px_5px_0_hsl(var(--pop-ink))] p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-pop-mono uppercase tracking-[0.12em] text-pop-ink/70">Total pending</p>
              <p className="font-pop-display text-[40px] text-pop-orange tabular-nums leading-tight">
                {Number(formatEther(totalPending)).toFixed(6)} <span className="text-[24px]">ETH</span>
              </p>
              <p className="text-[12px] text-pop-ink/60 mt-1">
                Across {tokens.length} {tokens.length === 1 ? "coin" : "coins"} you launched.
              </p>
            </div>
            <button
              onClick={claimAll}
              disabled={bulkBusy || totalPending === 0n}
              className="inline-flex items-center gap-2 font-bold text-[14px] px-5 py-3 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[4px_4px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[5px_5px_0_hsl(var(--pop-ink))] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkBusy && <Loader2 className="w-4 h-4 animate-spin" />}
              Claim all
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-pop-ink/60" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="border-2 border-dashed border-pop-ink/30 p-10 text-center">
            <p className="font-pop-display text-[18px] text-pop-ink">You haven't launched any coins yet.</p>
            <Link to="/bonding/create" className="inline-block mt-4 font-bold text-pop-orange">Launch your first →</Link>
          </div>
        ) : (
          <div className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] divide-y-2 divide-pop-ink/10">
            {tokens.map((t) => {
              const pending = t.pendingEth ?? 0n;
              const has = pending > 0n;
              return (
                <div key={t.id} className="flex items-center gap-3 p-3">
                  <div className="w-12 h-12 border-2 border-pop-ink bg-pop-cream overflow-hidden flex-shrink-0">
                    {t.image_url && <img src={t.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/bonding/token/${t.token_address}`} className="font-pop-display text-[15px] hover:text-pop-orange truncate block">
                      {t.name} <span className="text-pop-ink/60 font-pop-mono text-[12px]">${t.symbol}</span>
                    </Link>
                    <a
                      href={`https://etherscan.io/address/${t.curve_address}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-pop-mono text-pop-ink/60 hover:text-pop-ink"
                    >
                      curve {t.curve_address.slice(0, 6)}…<ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-[14px] tabular-nums ${has ? "text-pop-orange" : "text-pop-ink/40"}`}>
                      {Number(formatEther(pending)).toFixed(6)} ETH
                    </p>
                  </div>
                  <button
                    onClick={() => claimOne(t)}
                    disabled={!has || t.claiming}
                    className="px-3 py-2 font-bold text-[12px] border-2 border-pop-ink bg-pop-cream hover:bg-pop-orange transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t.claiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Claim"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
