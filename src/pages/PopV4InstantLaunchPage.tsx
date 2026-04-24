// /popv4instant — public V4-Instant launch UI.
//
// User flow:
//   1. Connect wallet (must be on Ethereum mainnet).
//   2. Pick name + symbol + initial buy + virtual mcap preset.
//   3. Edge function `popv4instant-launch` returns calldata + value.
//   4. User signs ONE tx → factory.launch{value: initialBuy}(params).
//   5. We surface the resulting tx hash + Etherscan link; the indexer
//      cron picks the Launched event up within ~60s and writes the
//      token row to popv4instant_tokens.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWallets } from "@privy-io/react-auth";
import { toast } from "sonner";
import { Loader2, Rocket, ExternalLink, ShieldCheck, Zap } from "lucide-react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";

type Preset = "0.69" | "1" | "2" | "5" | "10";

interface LaunchTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value: `0x${string}`;
  hook: string;
  preset: { targetMarketCapEth: number };
}

interface ActiveDeployment {
  hook_address: string;
  factory_address: string;
}

const PRESETS: { value: Preset; label: string; sub: string }[] = [
  { value: "0.69", label: "0.69 ETH", sub: "Cheapest entry · max upside" },
  { value: "1",    label: "1 ETH",    sub: "Round number · easy mental model" },
  { value: "2",    label: "2 ETH",    sub: "Mid · most common Klik-style" },
  { value: "5",    label: "5 ETH",    sub: "Premium · serious launches" },
  { value: "10",   label: "10 ETH",   sub: "Maxi · institutional vibe" },
];

export default function PopV4InstantLaunchPage() {
  const { wallets } = useWallets();
  const evmWallet = useMemo(
    () => wallets.find((w) => w.walletClientType === "privy") ?? wallets[0],
    [wallets],
  );

  const [active, setActive] = useState<ActiveDeployment | null>(null);
  const [loadingDep, setLoadingDep] = useState(true);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [initialBuyEth, setInitialBuyEth] = useState("0.005");
  const [preset, setPreset] = useState<Preset>("1");
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Estimate dev's % of total supply from the atomic initial buy.
  // LP is seeded single-sided with 961.7M tokens at a starting price
  // that implies FDV ≈ targetMarketCapEth. For small buys we approximate
  // the swap with a constant-product curve against virtual reserves
  // (virtualEth = targetMcapEth, virtualTokens = LP_TOKENS):
  //   tokensOut = LP * buy / (mcap + buy)
  // Plus the implicit ~38.3M reserved for the creator at construction.
  const TOTAL_SUPPLY = 1_000_000_000;
  const LP_TOKENS = 961_700_000;
  const CREATOR_RESERVE = TOTAL_SUPPLY - LP_TOKENS; // 38.3M minted to creator
  const devEstimate = useMemo(() => {
    const buy = Number(initialBuyEth);
    const mcap = Number(preset);
    if (!Number.isFinite(buy) || buy <= 0 || !Number.isFinite(mcap) || mcap <= 0) {
      return null;
    }
    const tokensFromSwap = (LP_TOKENS * buy) / (mcap + buy);
    const totalDev = CREATOR_RESERVE + tokensFromSwap;
    const pct = (totalDev / TOTAL_SUPPLY) * 100;
    return { tokensFromSwap, totalDev, pct };
  }, [initialBuyEth, preset]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("popv4instant_deployments")
        .select("hook_address, factory_address")
        .eq("network", "ethereum")
        .eq("is_active", true)
        .order("deployed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setActive(data as ActiveDeployment | null);
      setLoadingDep(false);
    })();
  }, []);

  async function launch() {
    setErr(null);
    setTxHash(null);
    if (!evmWallet) {
      toast.error("Connect an Ethereum wallet first");
      return;
    }
    if (!name.trim() || !symbol.trim()) {
      toast.error("Name + symbol required");
      return;
    }
    const buyNum = Number(initialBuyEth);
    if (!Number.isFinite(buyNum) || buyNum < 0.001) {
      toast.error("Initial buy must be ≥ 0.001 ETH");
      return;
    }

    setBusy(true);
    try {
      // 1. Build calldata server-side.
      const { data, error } = await supabase.functions.invoke("popv4instant-launch", {
        body: {
          creator: evmWallet.address,
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          initialBuyEth,
          targetMarketCapEth: preset,
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const tx = data as LaunchTx;

      // 2. Sign + send via Privy.
      await evmWallet.switchChain(1);
      const provider = await evmWallet.getEthereumProvider();
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: evmWallet.address,
          to: tx.to,
          data: tx.data,
          value: tx.value,
        }],
      }) as string;

      setTxHash(hash);
      toast.success("Launch tx submitted!", {
        description: "Indexer will pick it up within ~60s.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error("Launch failed", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <LaunchpadLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary mb-2">
            <Zap className="w-3.5 h-3.5" />
            <span>V4 Instant · Ethereum mainnet</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Launch with real liquidity from block 0</h1>
          <p className="text-sm text-muted-foreground mt-2">
            No bonding curve, no graduation. Single-sided LP on Uniswap V4 + your dev buy execute atomically.
            Flat <span className="text-foreground font-semibold">1.25% fee</span> · split 50/50 creator / treasury.
          </p>
        </div>

        {!loadingDep && !active && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm">
            ⚠️ No active V4-Instant deployment found. Admins must run{" "}
            <Link to="/popv4instant/deploy" className="underline">/popv4instant/deploy</Link> first.
          </div>
        )}

        <div className="rounded border border-border bg-card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PopShiba Coin"
                maxLength={48}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground">Symbol</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="POP"
                maxLength={11}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground uppercase"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-muted-foreground">Initial Buy (ETH)</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={initialBuyEth}
              onChange={(e) => setInitialBuyEth(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground"
            />
            <div className="text-[10px] text-muted-foreground mt-1 font-mono">
              Min 0.001 ETH · executed atomically against your own LP
            </div>
            {devEstimate && (
              <div className="mt-2 rounded border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] font-mono space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground uppercase tracking-wider">Your supply at launch</span>
                  <span className="text-primary font-bold">
                    {devEstimate.pct.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>≈ tokens received</span>
                  <span className="text-foreground">
                    {(devEstimate.totalDev / 1_000_000).toFixed(2)}M / 1B
                  </span>
                </div>
                <div className="text-[9px] text-muted-foreground/70 pt-1">
                  {(CREATOR_RESERVE / 1_000_000).toFixed(1)}M reserve + ~{(devEstimate.tokensFromSwap / 1_000_000).toFixed(2)}M from your {initialBuyEth} ETH buy at {preset} ETH FDV
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-muted-foreground mb-2 block">
              Starting Virtual Market Cap
            </label>
            <div className="grid grid-cols-5 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPreset(p.value)}
                  className={`px-2 py-2 rounded border text-xs font-mono transition-colors ${
                    preset === p.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1.5 font-mono">
              {PRESETS.find((p) => p.value === preset)?.sub}
            </div>
          </div>

          <button
            onClick={launch}
            disabled={busy || loadingDep || !active || !evmWallet}
            className="w-full px-4 py-3 rounded bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            {busy ? "Submitting…" : !evmWallet ? "Connect ETH wallet" : "Launch Now"}
          </button>

          {txHash && (
            <div className="rounded border border-primary/40 bg-primary/10 p-3 text-xs font-mono">
              <div className="text-primary uppercase tracking-wider mb-1">✓ Submitted</div>
              <a
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="underline flex items-center gap-1 break-all"
              >
                {txHash} <ExternalLink className="w-3 h-3 inline" />
              </a>
              <div className="text-muted-foreground mt-1">
                Token row will appear on <Link to="/popv4" className="underline">/popv4</Link> within ~60s.
              </div>
            </div>
          )}

          {err && (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs font-mono text-destructive break-all">
              {err}
            </div>
          )}
        </div>

        <div className="rounded border border-border bg-card/50 p-4 text-xs font-mono space-y-1.5">
          <div className="flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> What happens on click
          </div>
          <ul className="text-muted-foreground space-y-0.5 list-disc pl-5">
            <li>Deploy your ERC20 (1B fixed supply, no mint, no transfer tax)</li>
            <li>Create a Uniswap V4 pool ETH/{symbol || "TOKEN"} (fee=0, hook handles 1.25%)</li>
            <li>Seed 961.7M tokens single-sided LP (no ETH from you for liquidity)</li>
            <li>Execute your initial buy as the first swap → tokens to your wallet</li>
            <li>Register pool with the singleton hook so trades pay you fees forever</li>
          </ul>
          {active && (
            <div className="pt-2 mt-2 border-t border-border text-[10px]">
              Hook: <a href={`https://etherscan.io/address/${active.hook_address}`} target="_blank" rel="noreferrer" className="underline">{active.hook_address}</a>
              <br />
              Factory: <a href={`https://etherscan.io/address/${active.factory_address}`} target="_blank" rel="noreferrer" className="underline">{active.factory_address}</a>
            </div>
          )}
        </div>
      </div>
    </LaunchpadLayout>
  );
}
