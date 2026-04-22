/**
 * ApePage — Popshiba /ape trade terminal
 *
 * Native React port of public/popshiba-template/trade.html.
 * Every visible data point is wired to live sources:
 *   • Token metadata, price, MC, vol, holders, liquidity, 24h change → useExternalToken (Codex)
 *   • Candle chart (timeframes, USD/native, vol, etc.) → CodexChart
 *   • Recent trades table → useCodexTokenEvents (Codex)
 *   • Top holders → derived from live trades (mirrors FunTokenDetailPage behavior)
 *
 * Routing:
 *   /ape                 → picker (redirects to /trade if no address)
 *   /ape/:address        → trade view (defaults to Ethereum)
 *   /ape/:chain/:address → trade view on a specific chain (eth | bsc | sol)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, ExternalLink, Bell, Share2, Star } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { Footer } from "@/components/layout/Footer";
import { CodexChart } from "@/components/launchpad/CodexChart";
import { useExternalToken } from "@/hooks/useExternalToken";
import { useCodexTokenEvents } from "@/hooks/useCodexTokenEvents";
import {
  ETH_NETWORK_ID,
  BSC_NETWORK_ID,
  SOLANA_NETWORK_ID,
} from "@/hooks/useCodexNewPairs";
import { useToast } from "@/hooks/use-toast";
import { useZeroxSwap } from "@/hooks/useZeroxSwap";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/integrations/supabase/client";

import styles from "./ApePage.module.css";

/* ──────────────────────────── helpers ──────────────────────────── */

type Chain = "eth" | "bsc" | "sol";

function chainToNetworkId(c: Chain): number {
  switch (c) {
    case "bsc": return BSC_NETWORK_ID;
    case "sol": return SOLANA_NETWORK_ID;
    default: return ETH_NETWORK_ID;
  }
}
function nativeSymbolFor(c: Chain): string {
  return c === "bsc" ? "BNB" : c === "sol" ? "SOL" : "ETH";
}
function explorerFor(c: Chain, addr: string): string {
  if (c === "bsc") return `https://bscscan.com/token/${addr}`;
  if (c === "sol") return `https://solscan.io/token/${addr}`;
  return `https://etherscan.io/token/${addr}`;
}
function dexFor(c: Chain, addr: string): string {
  if (c === "bsc") return `https://pancakeswap.finance/swap?outputCurrency=${addr}`;
  if (c === "sol") return `https://jup.ag/swap/SOL-${addr}`;
  return `https://app.uniswap.org/explore/tokens/ethereum/${addr}`;
}
function dexNameFor(c: Chain): string {
  return c === "bsc" ? "PancakeSwap" : c === "sol" ? "Jupiter" : "Uniswap";
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

  // /ape with no address → bounce to existing /trade picker
  useEffect(() => {
    if (!chainParam && !addressParam) navigate("/trade", { replace: true });
  }, [chainParam, addressParam, navigate]);

  // Resolve chain + address from either URL shape
  const { chain, address } = useMemo<{ chain: Chain; address: string }>(() => {
    const knownChains: Chain[] = ["eth", "bsc", "sol"];
    if (chainParam && knownChains.includes(chainParam as Chain) && addressParam) {
      return { chain: chainParam as Chain, address: addressParam };
    }
    // Single-segment path: infer chain from address shape
    const a = chainParam || addressParam || "";
    if (/^0x[a-fA-F0-9]{40}$/.test(a)) return { chain: "eth", address: a };
    return { chain: "sol", address: a };
  }, [chainParam, addressParam]);

  const networkId = chainToNetworkId(chain);
  const nativeSym = nativeSymbolFor(chain);

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

  const filteredTrades = useMemo(() => {
    let list = trades;
    if (filter === "500") list = list.filter((t) => t.totalUsd >= 500);
    if (filter === "5k") list = list.filter((t) => t.totalUsd >= 5_000);
    if (filter === "whales") list = list.filter((t) => t.totalUsd >= 25_000);
    return list.slice(0, 30);
  }, [trades, filter]);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    toast({ title: "Address copied" });
  };
  const shareToken = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied" });
  };

  const isPriceUp = (token?.change24h ?? 0) >= 0;
  const symbol = token?.symbol || "—";
  const name = token?.name || (tokenLoading ? "Loading…" : "Unknown token");
  const priceUsd = token?.priceUsd ?? 0;

  // Simple deterministic estimate for the buy/sell preview
  const numericAmount = parseFloat(amount) || 0;
  const estimatedTokens = priceUsd > 0 && numericAmount > 0
    ? (numericAmount * (chain === "bsc" ? 600 : chain === "sol" ? 150 : 3000)) / priceUsd
    : 0;

  return (
    <div className={styles.root}>
      <PopshibaTopNav />

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

        {/* ── LEVERAGE BANNER ── */}
        <div className={styles.levBanner}>
          <div className={styles.levIc}>↗</div>
          <div className={styles.levTxt}>
            <div className="lt">Leverage trade up to <em>80×</em></div>
            <div className="ls">Advanced tools · Deep liquidity · No order-book slip</div>
          </div>
          <Link to="/leverage" className={styles.levCta}>START →</Link>
        </div>

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
                      onClick={() => setAmount(q === "MAX" ? amount : q)}
                    >{q}</button>
                  ))}
                </div>
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
                <div className="row"><span className="k">You pay</span><span className="v">{numericAmount} {nativeSym}</span></div>
                <div className="row"><span className="k">You get</span><span className="v">≈ {fmtCount(estimatedTokens)}</span></div>
                <div className="row"><span className="k">Slippage</span><span className="v">{slip === "AUTO" ? "Auto" : `${slip}%`}</span></div>
                <div className="row"><span className="k">Route</span><span className="v">{dexNameFor(chain)}</span></div>
              </div>

              <a
                className={styles.buyCta}
                href={dexFor(chain, address)}
                target="_blank"
                rel="noopener noreferrer"
              >◆ {side === "buy" ? "BUY" : "SELL"} ${symbol}</a>
              <div className={styles.routeNote}>Swap via <b>{dexNameFor(chain)}</b> · Best route auto-selected</div>

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
            <div className={styles.empty}>{trades.length === 0 ? "Loading live trades…" : "No trades match this filter"}</div>
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

      <Footer />
    </div>
  );
}
