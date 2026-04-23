// 1:1 token detail page — chart + buy/sell + curve progress + holders + trade history.
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createPublicClient, createWalletClient, custom, http,
  parseEther, formatEther, type Address, type Hash,
} from "viem";
import { mainnet } from "viem/chains";
import { supabase } from "@/integrations/supabase/client";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { UNICURVE_CURVE_ABI, GRADUATION_THRESHOLD } from "@/lib/ethereum/unicurveFactory";
import { BondingPriceChart } from "@/components/bonding/BondingPriceChart";
import { UniswapV4SwapPanel } from "@/components/bonding/UniswapV4SwapPanel";
import { ArrowLeft, ExternalLink, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface BondingToken {
  id: string; token_address: string; curve_address: string; creator_address: string;
  name: string; symbol: string; description: string | null; image_url: string | null;
  twitter_url: string | null; telegram_url: string | null; website_url: string | null;
  graduated: boolean; tx_hash: string; created_at: string;
  market_cap_usd: number | null; price_eth: number | null;
}
interface Trade {
  id: string; trader_address: string; side: string; eth_amount: number;
  token_amount: number; tx_hash: string; created_at: string;
}
interface Holder { holder_address: string; balance: number; percentage: number; }
interface CurveState {
  realEth: bigint; realTokens: bigint;
  creatorFees: bigint; protocolFees: bigint;
  graduated: boolean;
}

const SLIPPAGE = [0.5, 1, 3] as const;
const QUICK_ETH = ["0.01", "0.1", "0.5", "1"] as const;
const QUICK_PCT = [25, 50, 75, 100] as const;

function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }
function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtToken(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}
function fmtUsd(n?: number | null) {
  if (!n) return "$0";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export default function BondingTokenDetailPage() {
  const { address } = useParams<{ address: string }>();
  const { authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const userAddr = (user?.wallet?.address as Address | undefined) ?? undefined;

  const [token, setToken] = useState<BondingToken | null>(null);
  const [state, setState] = useState<CurveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slip, setSlip] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ethBal, setEthBal] = useState<bigint>(0n);
  const [tokenBal, setTokenBal] = useState<bigint>(0n);
  const [quote, setQuote] = useState<bigint | null>(null);

  const publicClient = useMemo(() => createPublicClient({ chain: mainnet, transport: http() }) as any, []);

  /* ---------- data loaders ---------- */
  const loadToken = useCallback(async () => {
    if (!address) return;
    const { data } = await supabase.from("bonding_tokens").select("*").eq("token_address", address.toLowerCase()).maybeSingle();
    if (data) setToken(data as BondingToken);
    setLoading(false);
  }, [address]);

  const loadAux = useCallback(async () => {
    if (!address) return;
    const [{ data: t }, { data: h }] = await Promise.all([
      supabase.from("bonding_trades").select("*").eq("token_address", address.toLowerCase()).order("created_at", { ascending: false }).limit(50),
      supabase.from("bonding_holders").select("*").eq("token_address", address.toLowerCase()).order("balance", { ascending: false }).limit(20),
    ]);
    if (t) setTrades(t as Trade[]);
    if (h) setHolders(h as Holder[]);
  }, [address]);

  const loadOnchain = useCallback(async (curveAddr: Address, tokenAddr: Address) => {
    try {
      const [realEth, realTokens, creatorFees, protocolFees] = await Promise.all([
        publicClient.readContract({ address: curveAddr, abi: UNICURVE_CURVE_ABI, functionName: "realEthReserves" }),
        publicClient.readContract({ address: curveAddr, abi: UNICURVE_CURVE_ABI, functionName: "realTokenReserves" }),
        publicClient.readContract({ address: curveAddr, abi: UNICURVE_CURVE_ABI, functionName: "creatorFeesAccrued" }).catch(() => 0n),
        publicClient.readContract({ address: curveAddr, abi: UNICURVE_CURVE_ABI, functionName: "protocolFeesAccrued" }).catch(() => 0n),
      ]);
      setState({
        realEth: realEth as bigint, realTokens: realTokens as bigint,
        creatorFees: creatorFees as bigint, protocolFees: protocolFees as bigint,
        graduated: (realEth as bigint) >= GRADUATION_THRESHOLD,
      });

      if (userAddr) {
        const [eb, tb] = await Promise.all([
          publicClient.getBalance({ address: userAddr }),
          publicClient.readContract({
            address: tokenAddr,
            abi: [{ inputs: [{ name: "a", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }],
            functionName: "balanceOf", args: [userAddr],
          }),
        ]);
        setEthBal(eb); setTokenBal(tb as bigint);
      }
    } catch (err) { console.warn("on-chain read failed", err); }
  }, [publicClient, userAddr]);

  useEffect(() => { loadToken(); }, [loadToken]);
  useEffect(() => { loadAux(); }, [loadAux]);
  useEffect(() => {
    if (!token?.curve_address) return;
    const curve = token.curve_address as Address;
    const tokenA = token.token_address as Address;
    loadOnchain(curve, tokenA);
    const i = setInterval(() => loadOnchain(curve, tokenA), 12000);
    return () => clearInterval(i);
  }, [token?.curve_address, token?.token_address, loadOnchain]);

  /* Trigger re-index immediately on view + every 15s while page is open
     so trades / holders / market cap stay live without a cron. */
  useEffect(() => {
    if (!address) return;
    const addr = address.toLowerCase();
    const reindex = () =>
      supabase.functions.invoke("bonding-index-trades", { body: { token_address: addr } })
        .then(() => loadAux()).catch(() => {});
    reindex();
    const i = setInterval(reindex, 15_000);
    return () => clearInterval(i);
  }, [address, loadAux]);

  /* Realtime: when a new trade row lands, refresh aux + on-chain state immediately. */
  useEffect(() => {
    if (!address || !token?.curve_address) return;
    const addr = address.toLowerCase();
    const ch = supabase
      .channel(`bonding_detail:${addr}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "bonding_trades", filter: `token_address=eq.${addr}` },
        () => {
          loadAux();
          loadOnchain(token.curve_address as Address, token.token_address as Address);
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "bonding_tokens", filter: `token_address=eq.${addr}` },
        (p) => setToken((t) => (t ? { ...t, ...(p.new as BondingToken) } : t)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [address, token?.curve_address, token?.token_address, loadAux, loadOnchain]);

  /* Quote refresh */
  useEffect(() => {
    if (!token?.curve_address || !amount || Number(amount) <= 0) { setQuote(null); return; }
    const curve = token.curve_address as Address;
    const wei = (() => {
      try { return parseEther(amount); } catch { return null; }
    })();
    if (!wei) return;
    let cancelled = false;
    (async () => {
      try {
        const fn = side === "buy" ? "quoteBuy" : "quoteSell";
        const out = await publicClient.readContract({ address: curve, abi: UNICURVE_CURVE_ABI, functionName: fn, args: [wei] });
        if (!cancelled) setQuote(out as bigint);
      } catch { if (!cancelled) setQuote(null); }
    })();
    return () => { cancelled = true; };
  }, [amount, side, token?.curve_address, publicClient]);

  /* ---------- trade ---------- */
  async function handleTrade() {
    if (!authenticated) { login(); return; }
    if (!token || !amount || Number(amount) <= 0) return;
    if (!userAddr) { toast.error("No wallet"); return; }

    setBusy(true);
    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy") || wallets[0];
      if (!wallet) throw new Error("No wallet");
      await wallet.switchChain(mainnet.id);
      const provider = await wallet.getEthereumProvider();
      const wc = createWalletClient({ chain: mainnet, transport: custom(provider) }) as any;
      const curve = token.curve_address as Address;
      let hash: Hash;

      if (side === "buy") {
        const ethIn = parseEther(amount);
        // slippage on tokens out
        const minOut = quote ? (quote * BigInt(Math.floor((100 - slip) * 100))) / 10_000n : 0n;
        hash = await wc.writeContract({
          account: userAddr, chain: mainnet,
          address: curve, abi: UNICURVE_CURVE_ABI, functionName: "buy",
          args: [minOut, userAddr], value: ethIn,
        });
      } else {
        const tokIn = parseEther(amount);
        const minOut = quote ? (quote * BigInt(Math.floor((100 - slip) * 100))) / 10_000n : 0n;
        hash = await wc.writeContract({
          account: userAddr, chain: mainnet,
          address: curve, abi: UNICURVE_CURVE_ABI, functionName: "sell",
          args: [tokIn, minOut],
        });
      }

      toast.success("Transaction sent…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        toast.success(side === "buy" ? "Bought!" : "Sold!");
        setAmount("");
        // refresh in background
        supabase.functions.invoke("bonding-index-trades", { body: { token_address: token.token_address } }).then(() => loadAux());
        loadOnchain(curve, token.token_address as Address);
      } else throw new Error("Reverted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Trade failed");
    } finally { setBusy(false); }
  }

  function applyPercent(p: number) {
    if (side === "buy") {
      const wei = (ethBal * BigInt(p)) / 100n;
      setAmount(formatEther(wei));
    } else {
      const wei = (tokenBal * BigInt(p)) / 100n;
      setAmount(formatEther(wei));
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-pop-cream"><PopshibaTopNav />
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-pop-ink/60" /></div>
      </div>
    );
  }
  if (!token) {
    return (
      <div className="min-h-screen bg-pop-cream"><PopshibaTopNav />
        <main className="max-w-[720px] mx-auto px-4 py-12 text-center">
          <p className="font-pop-display text-[24px] text-pop-ink">Token not found</p>
          <Link to="/bonding" className="inline-block mt-4 font-bold text-pop-orange">← Back</Link>
        </main>
      </div>
    );
  }

  const realEthN = state ? Number(formatEther(state.realEth)) : 0;
  const gradN = Number(formatEther(GRADUATION_THRESHOLD));
  const progress = Math.min(100, (realEthN / gradN) * 100);
  const isGrad = state?.graduated || token.graduated;

  return (
    <div className="min-h-screen bg-pop-cream">
      <PopshibaTopNav />
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
        <Link to="/bonding" className="inline-flex items-center gap-1.5 text-[12px] font-pop-mono text-pop-ink/70 hover:text-pop-ink mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> BACK
        </Link>

        {/* HEADER */}
        <div className="border-2 border-pop-ink bg-white shadow-[4px_4px_0_hsl(var(--pop-ink))] p-4 sm:p-5 mb-5 flex flex-col sm:flex-row gap-4">
          <div className="w-20 h-20 border-2 border-pop-ink bg-pop-cream overflow-hidden flex-shrink-0">
            {token.image_url ? <img src={token.image_url} alt="" className="w-full h-full object-cover" /> : null}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-pop-display text-[26px] tracking-tight text-pop-ink">{token.name}</h1>
              <span className="font-pop-mono text-[14px] text-pop-ink/70">${token.symbol}</span>
              {isGrad && (
                <span className="text-[10px] font-pop-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-700 border border-emerald-700/30">GRADUATED</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <button
                onClick={() => { navigator.clipboard.writeText(token.token_address); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="inline-flex items-center gap-1.5 px-2 py-1 border border-pop-ink/30 bg-pop-cream text-[11px] font-pop-mono hover:bg-pop-orange/30 transition-colors"
              >
                CA {shortAddr(token.token_address)} {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
              <a href={`https://etherscan.io/address/${token.token_address}`} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 text-[11px] font-pop-mono text-pop-ink/70 hover:text-pop-ink">
                Etherscan <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] font-pop-mono text-pop-ink/60 mt-1.5">
              created by{" "}
              <Link to={`/bonding/profile/${token.creator_address}`} className="text-pop-orange hover:underline">
                {shortAddr(token.creator_address)}
              </Link>{" "}
              · {timeAgo(token.created_at)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-pop-mono uppercase tracking-[0.12em] text-pop-ink/60">Market cap</p>
            <p className="font-pop-display text-[28px] text-pop-orange tabular-nums">{fmtUsd(token.market_cap_usd)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          {/* LEFT */}
          <div className="space-y-5">
            {/* Price chart */}
            <BondingPriceChart tokenAddress={token.token_address} />

            {/* Bonding curve */}
            <div className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-pop-mono uppercase tracking-[0.12em] text-pop-ink">Bonding curve</span>
                <span className="text-[11px] font-pop-mono text-pop-ink/70">
                  {realEthN.toFixed(4)} / {gradN.toFixed(0)} ETH · {progress.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 bg-pop-cream border-2 border-pop-ink overflow-hidden">
                <div className={`h-full ${isGrad ? "bg-emerald-500" : "bg-pop-orange"} transition-all`} style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[11px] text-pop-ink/60 mt-2">
                When this curve hits 3 ETH, 206.9M tokens + raised ETH seed a Uniswap V4 pool. LP locked forever. Creators earn 50% of post-grad fees.
              </p>
            </div>

            {/* About */}
            {token.description && (
              <div className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] p-5">
                <p className="text-[11px] font-pop-mono uppercase tracking-[0.12em] text-pop-ink/70 mb-2">About</p>
                <p className="text-[13.5px] text-pop-ink/90 whitespace-pre-wrap">{token.description}</p>
                <div className="flex gap-3 mt-3 text-[12px] font-pop-mono">
                  {token.website_url && <a href={token.website_url} target="_blank" rel="noopener noreferrer" className="text-pop-orange hover:underline">WEBSITE</a>}
                  {token.twitter_url && <a href={token.twitter_url} target="_blank" rel="noopener noreferrer" className="text-pop-orange hover:underline">X</a>}
                  {token.telegram_url && <a href={token.telegram_url} target="_blank" rel="noopener noreferrer" className="text-pop-orange hover:underline">TELEGRAM</a>}
                </div>
              </div>
            )}

            {/* Trades */}
            <div className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-pop-mono uppercase tracking-[0.12em] text-pop-ink/70">Trades</p>
                <p className="text-[11px] font-pop-mono text-pop-ink/60">{trades.length} total</p>
              </div>
              {trades.length === 0 ? (
                <p className="text-[12px] text-pop-ink/50 text-center py-6">No trades yet — be the first.</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-[10px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink/60">
                        <th className="text-left px-2 py-1.5">Account</th>
                        <th className="text-left px-2 py-1.5">Type</th>
                        <th className="text-right px-2 py-1.5">ETH</th>
                        <th className="text-right px-2 py-1.5">{token.symbol}</th>
                        <th className="text-right px-2 py-1.5">Time</th>
                        <th className="text-right px-2 py-1.5">Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((t) => (
                        <tr key={t.id} className="border-t border-pop-ink/10">
                          <td className="px-2 py-1.5 font-pop-mono text-[11px]">
                            <Link to={`/bonding/profile/${t.trader_address}`} className="hover:text-pop-orange">{shortAddr(t.trader_address)}</Link>
                          </td>
                          <td className={`px-2 py-1.5 font-bold uppercase ${t.side === "buy" ? "text-emerald-600" : "text-rose-600"}`}>{t.side}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{t.eth_amount.toFixed(4)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtToken(t.token_amount)}</td>
                          <td className="px-2 py-1.5 text-right text-pop-ink/70">{timeAgo(t.created_at)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <a href={`https://etherscan.io/tx/${t.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-pop-orange hover:underline font-pop-mono">
                              {t.tx_hash.slice(0, 6)}…
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Trade panel + holders */}
          <aside className="space-y-5">
            <div className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] p-4 lg:sticky lg:top-24">
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => setSide("buy")}
                  className={`py-2.5 font-bold text-[13px] border-2 border-pop-ink ${side === "buy" ? "bg-emerald-500 text-pop-ink shadow-[2px_2px_0_hsl(var(--pop-ink))]" : "bg-pop-cream text-pop-ink/60"}`}>BUY</button>
                <button onClick={() => setSide("sell")}
                  className={`py-2.5 font-bold text-[13px] border-2 border-pop-ink ${side === "sell" ? "bg-rose-500 text-pop-cream shadow-[2px_2px_0_hsl(var(--pop-ink))]" : "bg-pop-cream text-pop-ink/60"}`}>SELL</button>
              </div>

              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink/70">You pay</span>
                <span className="text-[10px] font-pop-mono text-pop-ink/60">
                  Bal: {side === "buy" ? `${Number(formatEther(ethBal)).toFixed(4)} ETH` : `${fmtToken(Number(formatEther(tokenBal)))} ${token.symbol}`}
                </span>
              </div>
              <div className="border-2 border-pop-ink bg-pop-cream/50 px-3 py-2 flex items-center gap-2">
                <input
                  type="number" step="0.0001" min="0" inputMode="decimal"
                  value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0"
                  className="flex-1 bg-transparent text-[20px] font-pop-display tabular-nums focus:outline-none"
                />
                <span className="text-[12px] font-pop-mono text-pop-ink/70">{side === "buy" ? "ETH" : token.symbol}</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {(side === "buy" ? QUICK_ETH : QUICK_PCT.map(String)).map((v, i) => (
                  <button
                    key={i} type="button"
                    onClick={() => side === "buy" ? setAmount(v as string) : applyPercent(QUICK_PCT[i])}
                    className="py-1.5 text-[11px] font-pop-mono border border-pop-ink bg-pop-cream hover:bg-pop-orange/30 transition-colors"
                  >
                    {side === "buy" ? v : `${v}%`}
                  </button>
                ))}
              </div>

              {/* Quote */}
              {quote !== null && Number(amount) > 0 && (
                <div className="mt-3 px-3 py-2 bg-pop-cream/60 border border-pop-ink/20 text-[11px] font-pop-mono text-pop-ink/80">
                  ≈ <span className="font-bold text-pop-ink">
                    {side === "buy"
                      ? `${fmtToken(Number(formatEther(quote)))} ${token.symbol}`
                      : `${Number(formatEther(quote)).toFixed(6)} ETH`}
                  </span>
                </div>
              )}

              {/* Slippage */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink/70">Max slippage</span>
                {SLIPPAGE.map((s) => (
                  <button
                    key={s} type="button" onClick={() => setSlip(s)}
                    className={`px-2 py-0.5 text-[11px] font-pop-mono border ${slip === s ? "bg-pop-ink text-pop-cream border-pop-ink" : "bg-pop-cream border-pop-ink/30 text-pop-ink/70"}`}
                  >
                    {s}%
                  </button>
                ))}
              </div>

              <button
                onClick={handleTrade}
                disabled={busy || isGrad || !amount}
                className="w-full mt-4 inline-flex items-center justify-center gap-2 font-bold text-[14px] px-4 py-3 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> :
                  isGrad ? "Graduated — trade on Uniswap" :
                  authenticated ? (side === "buy" ? "Buy" : "Sell") : "Connect wallet"}
              </button>

              {isGrad && (
                <a href={`https://app.uniswap.org/explore/tokens/ethereum/${token.token_address}`} target="_blank" rel="noopener noreferrer"
                   className="block mt-2 text-center text-[12px] font-pop-mono text-pop-orange hover:underline">
                  Open on Uniswap →
                </a>
              )}
              <p className="text-[10px] font-pop-mono text-pop-ink/50 text-center mt-3">1% TRADING FEE · MAINNET</p>
            </div>

            {/* Top holders */}
            <div className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-pop-mono uppercase tracking-[0.12em] text-pop-ink/70">Top holders</p>
                <p className="text-[11px] font-pop-mono text-pop-ink/60">{holders.length} total</p>
              </div>
              {holders.length === 0 ? (
                <p className="text-[11px] text-pop-ink/50 text-center py-3">No holders yet.</p>
              ) : (
                <ol className="space-y-1.5 text-[12px]">
                  {holders.slice(0, 10).map((h, i) => {
                    const isDev = h.holder_address.toLowerCase() === token.creator_address.toLowerCase();
                    return (
                      <li key={h.holder_address} className="flex items-center gap-2">
                        <span className="text-pop-ink/50 font-pop-mono w-4">{i + 1}.</span>
                        <Link to={`/bonding/profile/${h.holder_address}`} className="font-pop-mono hover:text-pop-orange truncate flex-1">
                          {shortAddr(h.holder_address)}
                        </Link>
                        {isDev && <span className="text-[9px] font-pop-mono px-1 bg-pop-orange text-pop-ink">DEV</span>}
                        <span className="font-bold tabular-nums">{h.percentage.toFixed(2)}%</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
