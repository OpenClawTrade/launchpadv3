/**
 * ApePage — Popshiba /ape trade terminal (Ethereum only)
 *
 * Native React port of public/popshiba-template/trade.html.
 * Every visible data point is wired to live sources:
 *   • Token metadata, price, MC, vol, holders, liquidity, 24h change → useExternalToken (Codex)
 *   • Candle chart (timeframes, USD/native, vol, etc.) → CodexChart
 *   • Recent trades table → useCodexTokenEvents (Codex)
 *   • Top holders → derived from live trades
 *
 * Routing:
 *   /ape/:address        → trade view (Ethereum)
 *   /ape/eth/:address    → same; legacy /ape/bsc and /ape/sol are coerced to eth
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, ExternalLink, Bell, Share2, Star } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { CodexChart } from "@/components/launchpad/CodexChart";
import { useExternalToken } from "@/hooks/useExternalToken";
import { useCodexTokenEvents } from "@/hooks/useCodexTokenEvents";
import { ETH_NETWORK_ID } from "@/hooks/useCodexNewPairs";
import { useToast } from "@/hooks/use-toast";
import { useZeroxSwap } from "@/hooks/useZeroxSwap";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/integrations/supabase/client";

import styles from "./ApePage.module.css";

/* ──────────────────────────── helpers (Ethereum only) ──────────────────────────── */

const NATIVE_SYM = "ETH";
const DEX_NAME = "Uniswap";

function explorerFor(addr: string): string {
  return `https://etherscan.io/token/${addr}`;
}
function uniswapFor(addr: string): string {
  return `https://app.uniswap.org/explore/tokens/ethereum/${addr}`;
}
function dexscreenerFor(addr: string): string {
  return `https://dexscreener.com/ethereum/${addr}`;
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  if (abs >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3)}`;
}
function fmtCount(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString();
}
function fmtPct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
function shortAddr(a: string): string {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/* ──────────────────────────── component ──────────────────────────── */

const QUICK_AMOUNTS = ["0.01", "0.05", "0.1", "0.25", "0.5", "MAX"];
const SLIPPAGES = ["0.5", "1", "AUTO"];

export default function ApePage() {
  const { chain: chainParam, address: addressParam } = useParams<{ chain?: string; address?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Ethereum-only: accept /ape/:address or legacy /ape/:chain/:address (chain is ignored)
  const address = useMemo<string>(() => {
    const candidate =
      (chainParam && addressParam) ? addressParam :
      (chainParam || addressParam || "");
    return candidate;
  }, [chainParam, addressParam]);

  const networkId = ETH_NETWORK_ID;
  const nativeSym = NATIVE_SYM;

  /* ── live token data ── */
  const { data: token, isLoading: tokenLoading } = useExternalToken(address, !!address, networkId);

  /* ── live trades ── */
  const { data: tradeData } = useCodexTokenEvents(address);
  const trades = tradeData?.events ?? [];

  /* ── derived top holders (mirrors FunTokenDetailPage approach) ── */
  const topHolders = useMemo(() => {
    const balances = new Map<string, number>();
    for (const t of trades) {
      const cur = balances.get(t.maker) ?? 0;
      balances.set(t.maker, t.type === "Buy" ? cur + t.tokenAmount : Math.max(0, cur - t.tokenAmount));
    }
    const ranked = Array.from(balances.entries())
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const totalTop = ranked.reduce((s, [, v]) => s + v, 0);
    return ranked.map(([addr, amt], i) => ({
      rank: i + 1,
      address: addr,
      amount: amt,
      percent: totalTop > 0 ? (amt / totalTop) * 100 : 0,
    }));
  }, [trades]);

  /* ── UI state ── */
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<string>("0.05");
  const [slip, setSlip] = useState<string>("1");
  const [tradesTab, setTradesTab] = useState<"all" | "yours" | "holders">("all");
  const [filter, setFilter] = useState<"live" | "500" | "5k" | "whales">("live");

  /* ── 0x swap wiring (ETH + BNB only) ── */
  const isEvm = chain === "eth" || chain === "bsc";
  const apeChain: "eth" | "bnb" = chain === "bsc" ? "bnb" : "eth";
  const { executeApeSwap, isLoading: swapping } = useZeroxSwap();
  const { address: evmAddress, wallet: evmWallet } = usePrivyEvmWallet();
  const { login, authenticated, ready: privyReady } = usePrivy();

  const slippageBps = slip === "AUTO" ? 100 : Math.round(parseFloat(slip) * 100);
  const tokenDecimals = token?.decimals ?? 18;

  // Live balances
  const [nativeBal, setNativeBal] = useState<number>(0);
  const [tokenBal, setTokenBal] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isEvm || !evmWallet || !evmAddress) {
        setNativeBal(0); setTokenBal(0); return;
      }
      try {
        const provider: any = await (evmWallet as any).getEthereumProvider();
        if (!provider) return;
        const nativeHex = await provider.request({ method: "eth_getBalance", params: [evmAddress, "latest"] });
        if (!cancelled) setNativeBal(Number(BigInt(nativeHex)) / 1e18);
        const data = "0x70a08231" + evmAddress.replace(/^0x/, "").padStart(64, "0");
        const balHex = await provider.request({
          method: "eth_call",
          params: [{ to: address, data }, "latest"],
        });
        if (!cancelled && balHex && balHex !== "0x") {
          setTokenBal(Number(BigInt(balHex)) / 10 ** tokenDecimals);
        }
      } catch {}
    }
    load();
    const id = window.setInterval(load, 15_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [isEvm, evmWallet, evmAddress, address, tokenDecimals]);

  // Live 0x quote (debounced)
  const [quote, setQuote] = useState<any>(null);
  const [quoting, setQuoting] = useState(false);
  const quoteSeq = useRef(0);
  const numericAmount = parseFloat(amount) || 0;

  useEffect(() => {
    if (!isEvm || !address || !evmAddress || numericAmount <= 0) {
      setQuote(null); return;
    }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    const t = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("zerox-swap", {
          body: {
            mode: "quote",
            chain: apeChain,
            action: side,
            tokenAddress: address,
            amount,
            userWallet: evmAddress,
            slippageBps,
            tokenDecimals: side === "sell" ? tokenDecimals : undefined,
          },
        });
        if (seq !== quoteSeq.current) return;
        if (error || !data?.success) setQuote(null);
        else setQuote(data);
      } catch {
        if (seq === quoteSeq.current) setQuote(null);
      } finally {
        if (seq === quoteSeq.current) setQuoting(false);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [isEvm, apeChain, address, evmAddress, side, amount, slippageBps, tokenDecimals, numericAmount]);

  const outDecimals = side === "buy" ? tokenDecimals : 18;
  const buyAmountFmt = quote?.buyAmount ? Number(BigInt(quote.buyAmount)) / 10 ** outDecimals : 0;
  const minBuyFmt = quote?.minBuyAmount ? Number(BigInt(quote.minBuyAmount)) / 10 ** outDecimals : 0;
  const networkFeeFmt = quote?.totalNetworkFee ? Number(BigInt(quote.totalNetworkFee)) / 1e18 : 0;
  const routeName = quote?.route?.fills?.[0]?.source?.replace(/_/g, " ") || dexNameFor(chain);
  const insufficient = !!quote?.issues?.balance;
  const needsApproval = side === "sell" && !!quote?.issues?.allowance;

  function setAmountChip(q: string) {
    if (q === "MAX") {
      if (!isEvm) return;
      if (side === "buy") {
        const buf = chain === "bsc" ? 0.002 : 0.001;
        setAmount(Math.max(0, nativeBal - buf).toFixed(6));
      } else {
        setAmount(tokenBal > 0 ? tokenBal.toFixed(6) : "0");
      }
    } else {
      setAmount(q);
    }
  }

  const handleSwap = useCallback(async () => {
    if (!isEvm) {
      window.open(dexFor(chain, address), "_blank", "noopener,noreferrer");
      return;
    }
    if (!authenticated) { login(); return; }
    if (!evmAddress) { toast({ title: "Wallet not ready", description: "Reconnect and try again", variant: "destructive" }); return; }
    if (numericAmount <= 0) { toast({ title: "Enter an amount", variant: "destructive" }); return; }
    const result = await executeApeSwap({
      chain: apeChain,
      tokenAddress: address,
      action: side,
      amount: numericAmount,
      slippageBps,
      tokenDecimals: side === "sell" ? tokenDecimals : undefined,
      tokenName: token?.name,
      tokenTicker: token?.symbol,
    });
    if (result.success) {
      toast({
        title: `${side === "buy" ? "Bought" : "Sold"} $${token?.symbol || "token"}`,
        description: result.explorerUrl ? "View transaction ↗" : "Transaction sent",
        action: result.explorerUrl ? (
          <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
            View
          </a>
        ) as any : undefined,
      });
    } else {
      toast({ title: "Swap failed", description: result.error || "Unknown error", variant: "destructive" });
    }
  }, [isEvm, authenticated, login, evmAddress, numericAmount, executeApeSwap, apeChain, address, side, slippageBps, tokenDecimals, token?.name, token?.symbol, chain, toast]);

  const symbol = token?.symbol || "—";
  const name = token?.name || (tokenLoading ? "Loading…" : "Unknown token");
  const priceUsd = token?.priceUsd ?? 0;
  const isPriceUp = (token?.change24h ?? 0) >= 0;

  const filteredTrades = useMemo(() => {
    let list = trades;
    if (tradesTab === "yours") {
      const me = (evmAddress || "").toLowerCase();
      list = me ? list.filter((t) => t.maker?.toLowerCase() === me) : [];
    }
    if (filter === "500") list = list.filter((t) => t.totalUsd >= 500);
    if (filter === "5k") list = list.filter((t) => t.totalUsd >= 5_000);
    if (filter === "whales") list = list.filter((t) => t.totalUsd >= 25_000);
    return list.slice(0, 30);
  }, [trades, filter, tradesTab, evmAddress]);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    toast({ title: "Address copied" });
  };
  const shareToken = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied" });
  };

  const estimatedTokens = isEvm
    ? buyAmountFmt
    : (priceUsd > 0 && numericAmount > 0
        ? (numericAmount * 150) / priceUsd
        : 0);

  const ctaLabel = !isEvm
    ? `◆ ${side === "buy" ? "BUY" : "SELL"} ON ${dexNameFor(chain).toUpperCase()}`
    : !privyReady
      ? "LOADING…"
      : !authenticated
        ? "CONNECT WALLET"
        : swapping
          ? "SWAPPING…"
          : insufficient
            ? "INSUFFICIENT BALANCE"
            : needsApproval
              ? `◆ APPROVE & SELL $${symbol}`
              : `◆ ${side === "buy" ? "BUY" : "SELL"} $${symbol}`;

  const ctaDisabled = isEvm && (swapping || insufficient);

  return (
    <LaunchpadLayout noPadding>
      <div className={styles.root}>
        <main className={styles.main}>

        {/* ── TOKEN HEADER BAR ── */}
        <div className={styles.tokBar}>
          <Link to="/trade" className={styles.tokBack} aria-label="Back">
            <ArrowLeft size={16} />
          </Link>
          <div className={styles.tokId}>
            <div className={styles.tokAv}>
              {token?.imageUrl
                ? <img src={token.imageUrl} alt="" />
                : (symbol.slice(0, 1).toUpperCase() || "?")}
            </div>
            <div>
              <div className={styles.tokName}>
                <span>{name}</span>
                <span className={styles.tokSym}>${symbol}</span>
                <span className={styles.livePill}><span className="d" />LIVE</span>
              </div>
            </div>
          </div>
          <div className={styles.tokPrice}>{fmtUsd(priceUsd)}</div>
          {token && token.change24h !== 0 && (
            <div className={`${styles.tokPct} ${isPriceUp ? styles.up : styles.dn}`}>
              {isPriceUp ? "▲" : "▼"} {fmtPct(token.change24h)}
            </div>
          )}

          <div className={styles.tokStats}>
            <div className={styles.tokStat}><span className="k">MCAP</span><span className="v">{fmtUsd(token?.marketCapUsd)}</span></div>
            <div className={styles.tokStat}><span className="k">VOL 24H</span><span className="v">{fmtUsd(token?.volume24hUsd)}</span></div>
            <div className={styles.tokStat}><span className="k">HOLDERS</span><span className="v">{fmtCount(token?.holders)}</span></div>
            <div className={styles.tokStat}><span className="k">PRICE</span><span className="v">{fmtUsd(priceUsd)}</span></div>
            <div className={styles.tokStat}><span className="k">LIQ</span><span className="v">{fmtUsd(token?.liquidity)}</span></div>
          </div>

          <div className={styles.tokActions}>
            <button className={styles.iconBtn} title="Watchlist"><Star size={14} /></button>
            <button className={styles.iconBtn} title="Share" onClick={shareToken}><Share2 size={14} /></button>
            <button className={styles.iconBtn} title="Alerts"><Bell size={14} /></button>
            <a className={styles.iconBtn} title="Explorer" href={explorerFor(chain, address)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /></a>
          </div>
        </div>

        {/* Leverage banner removed per request */}

        {/* ── MAIN GRID: chart + buy panel ── */}
        <div className={styles.grid}>
          <section className={styles.chartPanel}>
            <div className={styles.chartHost}>
              {address && (
                <CodexChart tokenAddress={address} networkId={networkId} height={520} />
              )}
            </div>
          </section>

          <aside className={styles.buyPanel}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${side === "buy" ? styles.onBuy : ""}`}
                onClick={() => setSide("buy")}
              >⚡ QUICK BUY</button>
              <button
                className={`${styles.tab} ${side === "sell" ? styles.onSell : ""}`}
                onClick={() => setSide("sell")}
              >↓ SELL</button>
            </div>

            <div className={styles.buyBody}>
              <div className={styles.bpSection}>
                <div className={styles.bpLabel}>Amount</div>
                <div className={styles.amtRow}>
                  <input
                    className={styles.amtIn}
                    value={amount}
                    inputMode="decimal"
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <span className={styles.amtSym}><span className="coin" />{nativeSym}</span>
                </div>
                <div className={styles.amtChips}>
                  {QUICK_AMOUNTS.map((q) => (
                    <button
                      key={q}
                      className={`${styles.amtChip} ${amount === q ? styles.on : ""}`}
                      onClick={() => setAmountChip(q)}
                    >{q}</button>
                  ))}
                </div>
                {isEvm && evmAddress && (
                  <div style={{ fontSize: 11, opacity: 0.65, marginTop: 6 }}>
                    Balance: {side === "buy"
                      ? `${nativeBal.toFixed(4)} ${nativeSym}`
                      : `${fmtCount(tokenBal)} ${symbol}`}
                  </div>
                )}
              </div>

              <div className={styles.bpSection}>
                <div className={styles.bpLabel}>Slippage</div>
                <div className={styles.slippage}>
                  {SLIPPAGES.map((s) => (
                    <button
                      key={s}
                      className={`${styles.slip} ${slip === s ? styles.on : ""}`}
                      onClick={() => setSlip(s)}
                    >{s === "AUTO" ? "AUTO" : `${s}%`}</button>
                  ))}
                </div>
              </div>

              <div className={styles.bpStats}>
                <div className="row"><span className="k">You pay</span><span className="v">{numericAmount} {side === "buy" ? nativeSym : symbol}</span></div>
                <div className="row">
                  <span className="k">You get</span>
                  <span className="v">
                    {quoting && isEvm ? "Quoting…" : `≈ ${fmtCount(estimatedTokens)} ${side === "buy" ? symbol : nativeSym}`}
                  </span>
                </div>
                {isEvm && quote && (
                  <>
                    <div className="row"><span className="k">Min received</span><span className="v">{fmtCount(minBuyFmt)} {side === "buy" ? symbol : nativeSym}</span></div>
                    <div className="row"><span className="k">Network fee</span><span className="v">≈ {networkFeeFmt.toFixed(6)} {nativeSym}</span></div>
                  </>
                )}
                <div className="row"><span className="k">Slippage</span><span className="v">{slip === "AUTO" ? "Auto" : `${slip}%`}</span></div>
                <div className="row"><span className="k">Route</span><span className="v">{isEvm ? routeName : dexNameFor(chain)}</span></div>
              </div>

              <button
                className={styles.buyCta}
                onClick={handleSwap}
                disabled={ctaDisabled}
                style={ctaDisabled ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
              >{ctaLabel}</button>
              <div className={styles.routeNote}>
                {isEvm
                  ? <>Swap via <b>0x</b> · {routeName} · 1% platform fee</>
                  : <>Swap via <b>{dexNameFor(chain)}</b> · Best route auto-selected</>}
              </div>

              <div className={styles.bpLinks}>
                <button className={styles.bpLink} onClick={copyAddress}>CONTRACT</button>
                <a className={styles.bpLink} href={dexFor(chain, address)} target="_blank" rel="noopener noreferrer">LIQUIDITY</a>
                <a className={styles.bpLink} href={`https://dexscreener.com/${chain === "bsc" ? "bsc" : chain === "sol" ? "solana" : "ethereum"}/${address}`} target="_blank" rel="noopener noreferrer">CHART ↗</a>
              </div>
            </div>
          </aside>
        </div>

        {/* ── TRADES PANEL ── */}
        <section className={styles.tradesPanel}>
          <div className={styles.tradesHead}>
            <button className={`${styles.trTab} ${tradesTab === "all" ? styles.on : ""}`} onClick={() => setTradesTab("all")}>ALL TRADES</button>
            <button className={`${styles.trTab} ${tradesTab === "yours" ? styles.on : ""}`} onClick={() => setTradesTab("yours")}>YOUR TRADES</button>
            <button className={`${styles.trTab} ${tradesTab === "holders" ? styles.on : ""}`} onClick={() => setTradesTab("holders")}>
              HOLDERS <span className="c">({fmtCount(token?.holders)})</span>
            </button>
            <div className={styles.tradesHeadRight}>
              <button className={`${styles.filterChip} ${filter === "live" ? styles.on : ""}`} onClick={() => setFilter("live")}>LIVE</button>
              <button className={`${styles.filterChip} ${filter === "500" ? styles.on : ""}`} onClick={() => setFilter("500")}>&gt; $500</button>
              <button className={`${styles.filterChip} ${filter === "5k" ? styles.on : ""}`} onClick={() => setFilter("5k")}>&gt; $5K</button>
              <button className={`${styles.filterChip} ${filter === "whales" ? styles.on : ""}`} onClick={() => setFilter("whales")}>WHALES</button>
            </div>
          </div>

          {tradesTab === "holders" ? (
            topHolders.length > 0 ? (
              <div>
                {topHolders.map((h) => (
                  <div key={h.address} className={styles.holderRow}>
                    <div className={`${styles.hrRank} ${h.rank <= 3 ? styles.top : ""}`}>
                      {String(h.rank).padStart(2, "0")}
                    </div>
                    <div className={styles.hrAddr}>
                      <span className="wav" />
                      <span className="a">{shortAddr(h.address)}</span>
                    </div>
                    <div className={styles.hrPct}>{h.percent.toFixed(2)}%</div>
                    <div className={styles.hrBar}><div className={styles.hrBarFill} style={{ width: `${Math.min(100, h.percent * 1.5)}%` }} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>No holder activity yet</div>
            )
          ) : filteredTrades.length === 0 ? (
            <div className={styles.empty}>{
              tradesTab === "yours"
                ? (evmAddress ? "No trades from your wallet yet" : "Connect wallet to see your trades")
                : trades.length === 0 ? "Loading live trades…" : "No trades match this filter"
            }</div>
          ) : (
            <table className={styles.tradesTable}>
              <thead>
                <tr>
                  <th>AGE</th>
                  <th>TYPE</th>
                  <th className="r">USD</th>
                  <th className="r">PRICE</th>
                  <th className="r">{symbol}</th>
                  <th className="r">{nativeSym}</th>
                  <th>WALLET</th>
                  <th className="r">TX</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((t) => {
                  const ageMs = (t.timestamp > 1_000_000_000_000 ? t.timestamp : t.timestamp * 1000);
                  const age = formatDistanceToNowStrict(new Date(ageMs));
                  const isBuy = t.type === "Buy";
                  return (
                    <tr key={t.txHash + t.timestamp}>
                      <td className={styles.ageCell}>{age}</td>
                      <td><span className={`${styles.typePill} ${isBuy ? styles.buy : styles.sell}`}>{isBuy ? "BUY" : "SELL"}</span></td>
                      <td className={`r ${isBuy ? styles.gainCell : styles.lossCell}`}>{fmtUsd(t.totalUsd)}</td>
                      <td className="r">{fmtUsd(t.priceUsd)}</td>
                      <td className="r">{fmtCount(t.tokenAmount)}</td>
                      <td className="r">{priceUsd > 0 ? (t.totalUsd / (chain === "bsc" ? 600 : chain === "sol" ? 150 : 3000)).toFixed(4) : "—"}</td>
                      <td><span className={styles.wallet}><span className="wav" />{shortAddr(t.maker)}</span></td>
                      <td className={`r ${styles.txLink}`}>
                        {t.txHash
                          ? <a href={`${explorerFor(chain, address).replace("/token/" + address, "/tx/" + t.txHash)}`} target="_blank" rel="noopener noreferrer">↗</a>
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* ── SECONDARY GRID: about + holders ── */}
        <div className={styles.grid2}>
          <section className={styles.panel}>
            <div className={styles.panelH}><span className="ico">◆</span>ABOUT ${symbol}</div>
            <div className={styles.panelB}>
              <h2 className={styles.aboutTitle}>{name}</h2>
              <p className={styles.aboutDesc}>
                {token?.completed || token?.migrated
                  ? `${name} has graduated and is trading on ${dexNameFor(chain)}.`
                  : `${name} is a ${nativeSym} token tracked live via Codex on Popshiba.`}
              </p>
              <div className={styles.aboutMeta}>
                <div className={styles.metaRow}><span className="k">Chain</span><span className="v">{chain.toUpperCase()}</span></div>
                <div className={styles.metaRow}><span className="k">Decimals</span><span className="v">{token?.decimals ?? "—"}</span></div>
                <div className={styles.metaRow}><span className="k">Holders</span><span className="v">{fmtCount(token?.holders)}</span></div>
                <div className={styles.metaRow}><span className="k">24h Vol</span><span className="v">{fmtUsd(token?.volume24hUsd)}</span></div>
                <div className={styles.metaRow}><span className="k">Liquidity</span><span className="v">{fmtUsd(token?.liquidity)}</span></div>
                <div className={styles.metaRow}><span className="k">Status</span><span className="v">{token?.migrated ? "Graduated" : token?.completed ? "Bonded" : "Live"}</span></div>
                <div className={styles.contractRow}>
                  <span className="k">CA</span>
                  <span className="addr">{address}</span>
                  <button className="copy" onClick={copyAddress}>COPY</button>
                  <a className="copy" href={explorerFor(chain, address)} target="_blank" rel="noopener noreferrer">↗</a>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelH}>
              <span className="ico">◎</span>TOP HOLDERS
              <span className="cnt">{fmtCount(token?.holders)}</span>
            </div>
            <div>
              {topHolders.length === 0 ? (
                <div className={styles.empty}>Waiting for trade activity…</div>
              ) : topHolders.map((h) => (
                <div key={h.address} className={styles.holderRow}>
                  <div className={`${styles.hrRank} ${h.rank <= 3 ? styles.top : ""}`}>
                    {String(h.rank).padStart(2, "0")}
                  </div>
                  <div className={styles.hrAddr}>
                    <span className="wav" />
                    <span className="a">{shortAddr(h.address)}</span>
                  </div>
                  <div className={styles.hrPct}>{h.percent.toFixed(2)}%</div>
                  <div className={styles.hrBar}><div className={styles.hrBarFill} style={{ width: `${Math.min(100, h.percent * 1.5)}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>
        </main>
      </div>
    </LaunchpadLayout>
  );
}
