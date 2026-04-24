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

interface LaunchTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value: `0x${string}`;
  hook: string;
  configId: number;
}

interface ActiveDeployment {
  hook_address: string;
  factory_address: string;
}

// Klik-parity: configId=0 baked into the factory uses virtualAmount = 1 ETH
// against 1B tokens single-sided LP. FDV at launch ≈ 1 ETH. Not user-tunable.
const KLIK_VIRTUAL_ETH = 1;

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
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Klik-parity dev estimate: 100% of supply in LP, no premint. Apply Klik's
  // anti-sniper penalty curve (basePenalty * penaltyMultiplier/100, where
  // penaltyMultiplier=50 → halved):
  //   <0.05 ETH  → 0%
  //   0.05–0.30  → linear ramp 5%→50% basePenalty (×0.5 → 2.5%→25%)
  //   ≥0.30 ETH  → 25% effective tax (cap)
  // Then CPMM against virtualEth=1, virtualTokens=1B:
  //   tokensOut = LP * buyAfterTax / (1 + buyAfterTax)
  const TOTAL_SUPPLY = 1_000_000_000;
  const LP_TOKENS = 1_000_000_000;
  const devEstimate = useMemo(() => {
    const buy = Number(initialBuyEth);
    if (!Number.isFinite(buy) || buy <= 0) return null;
    let basePenaltyBps = 0;
    if (buy >= 0.30) basePenaltyBps = 5000;
    else if (buy >= 0.05) basePenaltyBps = 500 + ((buy - 0.05) * 18000);
    const taxBps = (basePenaltyBps * 50) / 100;
    const buyAfterTax = buy * (1 - taxBps / 10000);
    const tokensFromSwap = (LP_TOKENS * buyAfterTax) / (KLIK_VIRTUAL_ETH + buyAfterTax);
    const pct = (tokensFromSwap / TOTAL_SUPPLY) * 100;
    return { tokensFromSwap, totalDev: tokensFromSwap, pct, taxBps };
  }, [initialBuyEth]);

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
    const t0 = performance.now();
    console.group("%c[V4-Instant] Launch debug", "color:#a3e635;font-weight:bold");
    try {
      // 1. Build calldata server-side.
      console.log("→ Calling popv4instant-launch with:", {
        creator: evmWallet.address,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        initialBuyEth,
      });
      const { data, error } = await supabase.functions.invoke("popv4instant-launch", {
        body: {
          creator: evmWallet.address,
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          initialBuyEth,
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const tx = data as LaunchTx & { sqrtPriceX96?: string; tickLower?: number; tickUpper?: number; valueWei?: string };

      console.log("← Edge function response:", tx);
      console.log("  to (factory):", tx.to);
      console.log("  hook:", tx.hook);
      console.log("  value (wei):", BigInt(tx.value).toString(), `(${(Number(BigInt(tx.value)) / 1e18).toFixed(6)} ETH)`);
      console.log("  calldata bytes:", (tx.data.length - 2) / 2);
      console.log("  sqrtPriceX96:", tx.sqrtPriceX96);
      console.log("  tickLower / tickUpper:", tx.tickLower, "/", tx.tickUpper);

      // 2. Switch chain + get provider.
      await evmWallet.switchChain(1);
      const provider = await evmWallet.getEthereumProvider();

      // 3. Pre-flight: estimate gas + fetch live fee data so user can see why
      //    MetaMask shows the price it does. All RPC calls go through their
      //    injected provider so they hit the same node MM uses.
      console.log("⛽ Fetching gas/fee data…");
      const txReq = { from: evmWallet.address, to: tx.to, data: tx.data, value: tx.value };
      const [gasHex, gasPriceHex, feeHistory, balanceHex, chainIdHex] = await Promise.all([
        provider.request({ method: "eth_estimateGas", params: [txReq] }).catch((e: any) => {
          console.error("  ❌ eth_estimateGas reverted:", e);
          return null;
        }),
        provider.request({ method: "eth_gasPrice", params: [] }).catch(() => null),
        provider.request({ method: "eth_feeHistory", params: ["0x5", "latest", [25, 50, 75]] }).catch(() => null),
        provider.request({ method: "eth_getBalance", params: [evmWallet.address, "latest"] }),
        provider.request({ method: "eth_chainId", params: [] }),
      ]) as [string | null, string | null, any, string, string];

      const gas = gasHex ? BigInt(gasHex) : null;
      const gasPrice = gasPriceHex ? BigInt(gasPriceHex) : null;
      const balance = BigInt(balanceHex);
      const value = BigInt(tx.value);
      const baseFeeWei = feeHistory?.baseFeePerGas?.[feeHistory.baseFeePerGas.length - 1]
        ? BigInt(feeHistory.baseFeePerGas[feeHistory.baseFeePerGas.length - 1])
        : null;

      const fmtGwei = (w: bigint | null) => (w == null ? "n/a" : (Number(w) / 1e9).toFixed(2) + " gwei");
      const fmtEth = (w: bigint) => (Number(w) / 1e18).toFixed(6) + " ETH";

      console.log("  chainId:", parseInt(chainIdHex, 16), "(expect 1)");
      console.log("  est. gas units:", gas?.toString() ?? "ESTIMATE FAILED — tx will likely revert");
      console.log("  current gas price:", fmtGwei(gasPrice));
      console.log("  current base fee:  ", fmtGwei(baseFeeWei));
      if (gas && gasPrice) {
        const gasCost = gas * gasPrice;
        const total = gasCost + value;
        console.log("  → est. gas cost:   ", fmtEth(gasCost));
        console.log("  → tx value (buy):  ", fmtEth(value));
        console.log("  → TOTAL DEBIT:     ", fmtEth(total));
        console.log("  → wallet balance:  ", fmtEth(balance));
        console.log("  → enough?          ", balance >= total ? "✅ yes" : `❌ short by ${fmtEth(total - balance)}`);
        if (gasPrice > 50_000_000_000n) {
          console.warn(`  ⚠️ Mainnet gas price is ${fmtGwei(gasPrice)} — this is what's making MetaMask show a high fee, NOT us. We send no gas params.`);
        }
      }
      console.log("📤 Sending tx (no custom gas — MM picks fee tier)…");

      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [txReq],
      }) as string;

      console.log("✅ Submitted:", hash, `(${((performance.now() - t0) / 1000).toFixed(1)}s)`);
      setTxHash(hash);
      toast.success("Launch tx submitted!", {
        description: "Indexer will pick it up within ~60s.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("❌ Launch failed:", e);
      setErr(msg);
      toast.error("Launch failed", { description: msg });
    } finally {
      console.groupEnd();
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
            Flat <span className="text-foreground font-semibold">1.00% fee</span> · split 50/50 creator / treasury.
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
                  100% supply in LP · your {initialBuyEth} ETH buys ~{(devEstimate.tokensFromSwap / 1_000_000).toFixed(2)}M tokens at 1 ETH virtual FDV
                  {devEstimate.taxBps > 0 && (
                    <> · anti-snipe tax: {(devEstimate.taxBps / 100).toFixed(2)}%</>
                  )}
                </div>
              </div>
            )}
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
            <li>Create a Uniswap V4 pool ETH/{symbol || "TOKEN"} (fee=0, hook handles 1.00%)</li>
            <li>Seed 100% of supply (1B tokens) single-sided LP (no ETH from you for liquidity)</li>
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
