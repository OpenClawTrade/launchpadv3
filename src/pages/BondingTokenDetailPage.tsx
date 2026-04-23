import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http, parseEther, formatEther, type Address } from "viem";
import { mainnet } from "viem/chains";
import { supabase } from "@/integrations/supabase/client";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import {
  UNICURVE_CURVE_ABI,
  GRADUATION_THRESHOLD,
  computeProgress,
  computePrice,
} from "@/lib/ethereum/unicurveFactory";
import { ArrowLeft, ExternalLink, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

interface BondingToken {
  id: string;
  token_address: string;
  curve_address: string;
  creator_address: string;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  twitter_url: string | null;
  telegram_url: string | null;
  website_url: string | null;
  graduated: boolean;
  tx_hash: string;
  created_at: string;
}

interface CurveState {
  realEth: bigint;
  realTokens: bigint;
  virtualEth: bigint;
  virtualTokens: bigint;
  graduated: boolean;
}

export default function BondingTokenDetailPage() {
  const { address } = useParams<{ address: string }>();
  const { authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const [token, setToken] = useState<BondingToken | null>(null);
  const [state, setState] = useState<CurveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const publicClient = createPublicClient({ chain: mainnet, transport: http() }) as any;

  const loadToken = useCallback(async () => {
    if (!address) return;
    const { data } = await supabase
      .from("bonding_tokens")
      .select("*")
      .eq("token_address", address.toLowerCase())
      .maybeSingle();
    if (data) setToken(data as BondingToken);
    setLoading(false);
  }, [address]);

  const loadState = useCallback(async (curveAddr: Address) => {
    try {
      const [realEth, realTokens, virtualEth, virtualTokens, graduated] = await Promise.all([
        publicClient.readContract({ address: curveAddr, abi: UNICURVE_CURVE_ABI, functionName: "realEthReserves" }),
        publicClient.readContract({ address: curveAddr, abi: UNICURVE_CURVE_ABI, functionName: "realTokenReserves" }),
        publicClient.readContract({ address: curveAddr, abi: UNICURVE_CURVE_ABI, functionName: "virtualEthReserves" }),
        publicClient.readContract({ address: curveAddr, abi: UNICURVE_CURVE_ABI, functionName: "virtualTokenReserves" }),
        publicClient.readContract({ address: curveAddr, abi: UNICURVE_CURVE_ABI, functionName: "graduated" }),
      ]);
      setState({
        realEth: realEth as bigint,
        realTokens: realTokens as bigint,
        virtualEth: virtualEth as bigint,
        virtualTokens: virtualTokens as bigint,
        graduated: graduated as boolean,
      });
    } catch (err) {
      console.warn("Could not read curve state:", err);
    }
  }, []);

  useEffect(() => { loadToken(); }, [loadToken]);
  useEffect(() => {
    if (token?.curve_address) {
      loadState(token.curve_address as Address);
      const i = setInterval(() => loadState(token.curve_address as Address), 15000);
      return () => clearInterval(i);
    }
  }, [token?.curve_address, loadState]);

  async function handleTrade() {
    if (!authenticated) { login(); return; }
    if (!token || !amount || Number(amount) <= 0) return;
    const userAddr = user?.wallet?.address as Address | undefined;
    if (!userAddr) { toast.error("No wallet"); return; }

    setBusy(true);
    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy") || wallets[0];
      if (!wallet) throw new Error("No wallet");
      await wallet.switchChain(mainnet.id);
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({ chain: mainnet, transport: custom(provider) }) as any;

      const curveAddr = token.curve_address as Address;
      let hash;
      if (side === "buy") {
        const ethIn = parseEther(amount);
        hash = await walletClient.writeContract({
          account: userAddr,
          address: curveAddr,
          abi: UNICURVE_CURVE_ABI,
          functionName: "buy",
          args: [0n], // minTokensOut=0 (no slippage protection in MVP)
          value: ethIn,
        });
      } else {
        const tokenAmt = parseEther(amount);
        hash = await walletClient.writeContract({
          account: userAddr,
          address: curveAddr,
          abi: UNICURVE_CURVE_ABI,
          functionName: "sell",
          args: [tokenAmt, 0n],
        });
      }

      toast.success("Transaction sent…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast.success(side === "buy" ? "Bought!" : "Sold!");
        setAmount("");
        loadState(curveAddr);
      } else {
        toast.error("Transaction reverted");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Trade failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-pop-cream">
        <PopshibaTopNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-pop-ink/60" />
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-pop-cream">
        <PopshibaTopNav />
        <main className="max-w-[720px] mx-auto px-4 py-12 text-center">
          <p className="font-pop-display text-[24px] text-pop-ink">Token not found</p>
          <Link to="/bonding" className="inline-block mt-4 font-bold text-pop-orange">← Back to bonding</Link>
        </main>
      </div>
    );
  }

  const progress = state ? computeProgress(state.realEth) : 0;
  const price = state ? computePrice(state.virtualEth, state.virtualTokens) : 0;
  const realEthFmt = state ? Number(formatEther(state.realEth)).toFixed(4) : "—";

  return (
    <div className="min-h-screen bg-pop-cream">
      <PopshibaTopNav />
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
        <Link to="/bonding" className="inline-flex items-center gap-1.5 text-[12px] font-pop-mono text-pop-ink/70 hover:text-pop-ink mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> BACK
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Main */}
          <div className="space-y-6">
            <div className="border-2 border-pop-ink bg-white shadow-[4px_4px_0_hsl(var(--pop-ink))] p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 border-2 border-pop-ink bg-pop-cream overflow-hidden flex-shrink-0">
                  {token.image_url ? (
                    <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-pop-ink/30 text-2xl">?</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-pop-display text-[24px] sm:text-[28px] tracking-[-0.02em] text-pop-ink truncate">
                    {token.name}
                  </h1>
                  <p className="font-pop-mono text-[13px] text-pop-ink/70">${token.symbol}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <a
                      href={`https://etherscan.io/token/${token.token_address}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-pop-mono text-pop-ink/70 hover:text-pop-ink"
                    >
                      {token.token_address.slice(0, 6)}…{token.token_address.slice(-4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {state?.graduated && (
                      <span className="text-[10px] font-pop-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-700 border border-emerald-700/30">
                        GRADUATED
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {token.description && (
                <p className="mt-4 text-[14px] text-pop-ink/80 whitespace-pre-wrap">{token.description}</p>
              )}
              <div className="flex gap-3 mt-4 text-[12px] font-pop-mono">
                {token.website_url && <a href={token.website_url} target="_blank" rel="noopener noreferrer" className="text-pop-orange hover:underline">WEBSITE</a>}
                {token.twitter_url && <a href={token.twitter_url} target="_blank" rel="noopener noreferrer" className="text-pop-orange hover:underline">X</a>}
                {token.telegram_url && <a href={token.telegram_url} target="_blank" rel="noopener noreferrer" className="text-pop-orange hover:underline">TELEGRAM</a>}
              </div>
            </div>

            {/* Bonding progress */}
            <div className="border-2 border-pop-ink bg-white shadow-[4px_4px_0_hsl(var(--pop-ink))] p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink">Bonding Progress</span>
                <span className="text-[11px] font-pop-mono text-pop-ink/70">
                  {realEthFmt} / {(Number(GRADUATION_THRESHOLD) / 1e18).toFixed(0)} ETH
                </span>
              </div>
              <div className="h-3 bg-pop-cream border-2 border-pop-ink overflow-hidden">
                <div
                  className="h-full bg-pop-orange transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-pop-ink/60 mt-2">
                When this curve hits 3 ETH, liquidity migrates to Uniswap V4 and LP is locked permanently.
              </p>
            </div>

            <div className="border-2 border-pop-ink bg-white shadow-[4px_4px_0_hsl(var(--pop-ink))] p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <Stat label="Price" value={price > 0 ? `${price.toExponential(2)} Ξ` : "—"} />
              <Stat label="Real ETH" value={realEthFmt} />
              <Stat label="Curve" value={`${token.curve_address.slice(0, 6)}…`} />
              <Stat label="Status" value={state?.graduated ? "Graduated" : "Bonding"} />
            </div>
          </div>

          {/* Trade panel */}
          <aside className="border-2 border-pop-ink bg-white shadow-[4px_4px_0_hsl(var(--pop-ink))] p-5 h-fit lg:sticky lg:top-24">
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setSide("buy")}
                className={`py-2.5 font-bold text-[13px] border-2 border-pop-ink ${side === "buy" ? "bg-emerald-500 text-pop-ink" : "bg-pop-cream text-pop-ink/60"}`}
              >
                <TrendingUp className="w-4 h-4 inline mr-1" /> BUY
              </button>
              <button
                onClick={() => setSide("sell")}
                className={`py-2.5 font-bold text-[13px] border-2 border-pop-ink ${side === "sell" ? "bg-rose-500 text-pop-ink" : "bg-pop-cream text-pop-ink/60"}`}
              >
                <TrendingDown className="w-4 h-4 inline mr-1" /> SELL
              </button>
            </div>

            <label className="block text-[11px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink mb-1.5">
              {side === "buy" ? "ETH IN" : `${token.symbol} IN`}
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full px-3 py-2.5 border-2 border-pop-ink bg-pop-cream/50 text-[15px] font-pop-mono focus:outline-none focus:bg-white"
            />

            {side === "buy" && (
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {["0.01", "0.1", "0.5", "1"].map((v) => (
                  <button
                    key={v} type="button"
                    onClick={() => setAmount(v)}
                    className="py-1.5 text-[11px] font-pop-mono border border-pop-ink bg-pop-cream hover:bg-pop-orange transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleTrade}
              disabled={busy || state?.graduated}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 font-bold text-[14px] px-4 py-3 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> :
                state?.graduated ? "Graduated — trade on Uniswap" :
                authenticated ? (side === "buy" ? "Buy" : "Sell") : "Connect Wallet"}
            </button>

            {state?.graduated && (
              <a
                href={`https://app.uniswap.org/explore/tokens/ethereum/${token.token_address}`}
                target="_blank" rel="noopener noreferrer"
                className="block mt-2 text-center text-[12px] font-pop-mono text-pop-orange hover:underline"
              >
                Open on Uniswap →
              </a>
            )}

            <p className="text-[10px] font-pop-mono text-pop-ink/50 text-center mt-3">
              1% TRADING FEE · MAINNET
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink/60">{label}</p>
      <p className="font-pop-display text-[16px] text-pop-ink mt-0.5 truncate">{value}</p>
    </div>
  );
}
