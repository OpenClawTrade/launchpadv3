// Popshiba — Trade page (/ape)
// 1:1 port of trade-standalone-src.html template, wired to live wallet/swap logic.
// All template styling is inlined via a scoped <style> block so the rest of the
// app's design tokens are not affected.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { useZeroxSwap, type ApeChain } from "@/hooks/useZeroxSwap";
import { useAlphaTrades } from "@/hooks/useAlphaTrades";
import { showTradeSuccess } from "@/stores/tradeSuccessStore";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";
import { CodexChart } from "@/components/launchpad/CodexChart";
import { ETH_NETWORK_ID, BSC_NETWORK_ID } from "@/hooks/useCodexNewPairs";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { PopshibaFooter } from "@/components/layout/PopshibaFooter";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const PRESETS_BUY = [0.01, 0.05, 0.1, 0.25, 0.5];
const PRESETS_SELL_PCT = [10, 25, 50, 75, 100];

interface MarketData {
  name?: string;
  symbol?: string;
  imageUrl?: string;
  priceUsd?: number;
  marketCap?: number;
  volumeH24?: number;
  liquidityUsd?: number;
  priceChangeH24?: number;
  decimals?: number;
}

const fmtUsd = (v?: number | null): string => {
  if (v == null || !isFinite(v) || v <= 0) return "—";
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(4)}`;
};
const fmtPriceUsd = (v?: number | null): string => {
  if (v == null || !isFinite(v) || v <= 0) return "—";
  if (v >= 1) return `$${v.toFixed(4)}`;
  if (v >= 0.01) return `$${v.toFixed(5)}`;
  return `$${v.toFixed(7)}`;
};
const fmtPct = (v?: number | null): string => {
  if (v == null || !isFinite(v)) return "—";
  const sign = v >= 0 ? "▲" : "▼";
  return `${sign} ${Math.abs(v).toFixed(2)}%`;
};
const fmtCount = (v?: number | null): string => {
  if (v == null || !isFinite(v)) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
};
const shortAddr = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const ageOf = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

type TradeTab = "all" | "yours" | "holders";

export default function ApePage() {
  const { isAuthenticated } = useAuth();
  const { address: evmAddress } = usePrivyEvmWallet();
  const { executeApeSwap, isLoading } = useZeroxSwap();

  // URL: /ape, /ape/:address, /ape/:chain/:address
  const params = useParams<{ address?: string; chain?: string }>();
  const navigate = useNavigate();
  const urlChain: ApeChain | null =
    params.chain === "bnb" || params.chain === "bsc" ? "bnb"
      : params.chain === "eth" || params.chain === "ethereum" ? "eth"
        : null;
  const urlAddress = params.address && ADDR_RE.test(params.address) ? params.address : "";

  const [chain] = useState<ApeChain>("eth"); // ETH-only on Popshiba
  const [tokenAddress, setTokenAddress] = useState(urlAddress);
  const [tokenDecimals, setTokenDecimals] = useState("18");

  const [isBuy, setIsBuy] = useState(true);
  const [amount, setAmount] = useState("0.05");
  const [slippageBps, setSlippageBps] = useState(100);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [market, setMarket] = useState<MarketData | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);

  const [tradeTab, setTradeTab] = useState<TradeTab>("all");

  const isValidAddress = useMemo(() => ADDR_RE.test(tokenAddress.trim()), [tokenAddress]);
  const networkId = chain === "bnb" ? BSC_NETWORK_ID : ETH_NETWORK_ID;
  const chainSymbol = chain === "eth" ? "ETH" : "BNB";

  // Sync state ⇆ URL
  useEffect(() => {
    if (isValidAddress) {
      const target = `/ape/${chain}/${tokenAddress.trim().toLowerCase()}`;
      if (window.location.pathname.toLowerCase() !== target) {
        navigate(target, { replace: true });
      }
    } else if (tokenAddress === "" && (params.address || params.chain)) {
      navigate("/ape", { replace: true });
    }
  }, [tokenAddress, chain, isValidAddress, navigate, params.address, params.chain]);

  useEffect(() => {
    if (urlAddress && urlAddress.toLowerCase() !== tokenAddress.toLowerCase()) {
      setTokenAddress(urlAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlAddress]);

  // Market data
  const loadMarket = async () => {
    if (!isValidAddress) {
      setMarket(null);
      return;
    }
    setMarketLoading(true);
    try {
      const fnName = chain === "bnb" ? "bnb-batch-market" : "eth-batch-market";
      const { data } = await supabase.functions.invoke(fnName, {
        body: { addresses: [tokenAddress.trim()] },
      });
      const result = (data?.results ?? {}) as Record<string, MarketData>;
      const m = result[tokenAddress.trim().toLowerCase()] ?? result[tokenAddress.trim()] ?? null;
      setMarket(m);
      if (m?.decimals) setTokenDecimals(String(m.decimals));
    } catch {
      setMarket(null);
    } finally {
      setMarketLoading(false);
    }
  };
  useEffect(() => {
    loadMarket();
    const id = setInterval(loadMarket, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenAddress, chain, isValidAddress]);

  useEffect(() => {
    document.title = market?.name
      ? `${market.name} ($${market.symbol}) — Popshiba Trade`
      : "Popshiba — Trade";
  }, [market]);

  // Live trades for this token (from alpha_trades feed)
  const { trades: allAlpha } = useAlphaTrades(80);
  const tokenTrades = useMemo(
    () => allAlpha.filter((t) => t.token_mint?.toLowerCase() === tokenAddress.trim().toLowerCase()),
    [allAlpha, tokenAddress]
  );
  const yourTrades = useMemo(
    () => tokenTrades.filter((t) => evmAddress && t.wallet_address?.toLowerCase() === evmAddress.toLowerCase()),
    [tokenTrades, evmAddress]
  );

  // Top holders derived from trade flow (best-effort placeholder until real holder API is wired)
  const topHolders = useMemo(() => {
    const balances = new Map<string, number>();
    for (const t of tokenTrades) {
      const cur = balances.get(t.wallet_address) ?? 0;
      const delta = t.trade_type === "buy" ? Number(t.amount_tokens || 0) : -Number(t.amount_tokens || 0);
      balances.set(t.wallet_address, cur + delta);
    }
    const total = Array.from(balances.values()).reduce((s, n) => s + Math.max(0, n), 0);
    return Array.from(balances.entries())
      .map(([wallet, amt]) => ({ wallet, amount: Math.max(0, amt), pct: total > 0 ? (Math.max(0, amt) / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [tokenTrades]);

  const handleSwap = async () => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    if (!evmAddress) { toast.error("EVM wallet not ready"); return; }
    if (!isValidAddress) { toast.error("Enter a valid token contract"); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }

    const toastId = `ape-${Date.now()}`;
    toast.loading(`⚡ ${isBuy ? "Buying" : "Selling"} via 0x…`, { id: toastId });

    const result = await executeApeSwap({
      chain,
      tokenAddress: tokenAddress.trim(),
      action: isBuy ? "buy" : "sell",
      amount: amt,
      slippageBps,
      tokenDecimals: parseInt(tokenDecimals) || 18,
      gasTier: "fast",
      antiMev: chain === "eth",
    });

    if (result.success) {
      toast.dismiss(toastId);
      showTradeSuccess({
        type: isBuy ? "buy" : "sell",
        ticker: market?.symbol ?? "TOKEN",
        tokenName: market?.name ?? tokenAddress.slice(0, 10),
        mintAddress: tokenAddress,
        amount: `${amt} ${isBuy ? chainSymbol : (market?.symbol ?? "TOKEN")}`,
        signature: result.txHash,
        chain: chain as never,
        explorerUrl: result.explorerUrl,
      });
      loadMarket();
    } else {
      toast.error("Swap failed", { id: toastId, description: result.error?.slice(0, 160) });
    }
  };

  const copyAddress = () => {
    if (!isValidAddress) return;
    navigator.clipboard.writeText(tokenAddress.trim());
    toast.success("Address copied");
  };
  const explorerUrl = isValidAddress
    ? `https://etherscan.io/token/${tokenAddress.trim()}`
    : "#";

  const change24 = market?.priceChangeH24;
  const isUp = (change24 ?? 0) >= 0;

  // Visible trade rows for current tab
  const visibleTrades = tradeTab === "yours" ? yourTrades : tokenTrades;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f5a524" }}>
      {/* Scoped template styles */}
      <style>{TEMPLATE_CSS}</style>

      <PopshibaTopNav />

      <main className="ape-main">

        {/* TOKEN HEADER BAR */}
        <div className="tok-bar">
          <Link to="/" className="tok-back" aria-label="Back">←</Link>
          <div className="tok-id">
            <div
              className="tok-av"
              style={market?.imageUrl ? { backgroundImage: `url(${market.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              {!market?.imageUrl && (market?.symbol?.[0]?.toUpperCase() ?? "?")}
            </div>
            <div>
              <div className="tok-name">
                {market?.name || (isValidAddress ? "Loading…" : "Ape Terminal")}{" "}
                {market?.symbol && <span className="tok-sym">${market.symbol.toUpperCase()}</span>}{" "}
                {isValidAddress && (
                  <span className="live-pill"><span className="d" />LIVE</span>
                )}
              </div>
            </div>
          </div>

          <div className="tok-price">{fmtPriceUsd(market?.priceUsd)}</div>

          {change24 != null && isFinite(change24) && (
            <div className={`tok-pct ${isUp ? "up" : ""}`}>{fmtPct(change24)}</div>
          )}

          <div className="tok-stats">
            <div className="tok-stat"><span className="k">MCAP</span><span className="v">{fmtUsd(market?.marketCap)}</span></div>
            <div className="tok-stat"><span className="k">VOL 24H</span><span className="v">{fmtUsd(market?.volumeH24)}</span></div>
            <div className="tok-stat"><span className="k">LIQ</span><span className="v">{fmtUsd(market?.liquidityUsd)}</span></div>
            <div className="tok-stat"><span className="k">HOLDERS</span><span className="v">{topHolders.length || "—"}</span></div>
          </div>

          <div className="tok-actions">
            <button className="icon-btn" title="Refresh" onClick={loadMarket} disabled={!isValidAddress}>↻</button>
            <button className="icon-btn" title="Copy" onClick={copyAddress} disabled={!isValidAddress}>⧉</button>
            <a className="icon-btn" title="Explorer" href={explorerUrl} target="_blank" rel="noopener noreferrer">↗</a>
          </div>
        </div>

        {/* Address input — only when no token selected */}
        {!isValidAddress && (
          <div className="addr-card">
            <label className="bp-label">Token contract</label>
            <input
              className="addr-input"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="Paste any ERC-20 contract 0x…"
              spellCheck={false}
            />
            <p className="addr-hint">
              Live candles, market data &amp; 1-click swap will appear here.
            </p>
          </div>
        )}

        {/* MAIN GRID: chart + buy panel */}
        <div className="grid">
          {/* Chart — CodexChart provides its own functional toolbar */}
          <section className="chart-panel">
            <div className="chart-body">
              {isValidAddress ? (
                <CodexChart
                  key={`${chain}-${tokenAddress.trim()}`}
                  tokenAddress={tokenAddress.trim()}
                  networkId={networkId}
                  height={460}
                />
              ) : (
                <div className="chart-empty">
                  <p className="ce-title">No token loaded</p>
                  <p className="ce-sub">Paste a contract above to see live candles.</p>
                </div>
              )}
              {marketLoading && (
                <div className="chart-loading">
                  <Loader2 className="spinner" />
                </div>
              )}
            </div>
          </section>

          {/* Buy / Sell */}
          <aside className="buy-panel">
            <div className="tabs">
              <button
                className={`tab ${isBuy ? "on buy" : ""}`}
                onClick={() => setIsBuy(true)}
              >
                <span className="ic">⚡</span>QUICK BUY
              </button>
              <button
                className={`tab ${!isBuy ? "on sell" : ""}`}
                onClick={() => setIsBuy(false)}
              >
                <span className="ic">↓</span>SELL
              </button>
            </div>

            <div className="buy-body">
              <div className="bp-section">
                <div className="bp-label">Amount</div>
                <div className="amt-row">
                  <input
                    className="amt-in"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, "");
                      if (v.split(".").length <= 2) setAmount(v);
                    }}
                    placeholder="0.0"
                  />
                  <span className="amt-sym">
                    <span className="coin" />
                    {isBuy ? chainSymbol : (market?.symbol?.toUpperCase() || "TOKEN")}
                  </span>
                </div>
                <div className="amt-chips">
                  {(isBuy ? PRESETS_BUY.map(String) : PRESETS_SELL_PCT.map((p) => `${p}%`)).map((p) => (
                    <button
                      key={p}
                      className={`amt-chip ${amount === p.replace("%", "") ? "on" : ""}`}
                      onClick={() => setAmount(p.replace("%", ""))}
                    >
                      {p}
                    </button>
                  ))}
                  <button className="amt-chip" onClick={() => setAmount("MAX")}>MAX</button>
                </div>
              </div>

              <div className="bp-section">
                <div className="bp-label">Slippage</div>
                <div className="slippage">
                  <button className={`slip ${slippageBps === 50 ? "on" : ""}`} onClick={() => setSlippageBps(50)}>0.5%</button>
                  <button className={`slip ${slippageBps === 100 ? "on" : ""}`} onClick={() => setSlippageBps(100)}>1%</button>
                  <button className={`slip ${slippageBps === 300 ? "on" : ""}`} onClick={() => setSlippageBps(300)}>AUTO</button>
                </div>
              </div>

              {(() => {
                const amtN = parseFloat(amount) || 0;
                const px = market?.priceUsd ?? 0;
                const ethToUsd = isBuy && px > 0 ? amtN * (market?.priceUsd ?? 0) : 0;
                const youGet = isBuy && px > 0 ? amtN / px : 0;
                return (
                  <div className="bp-stats">
                    <div className="row"><span className="k">You pay</span><span className="v">{amount || "0"} {isBuy ? chainSymbol : (market?.symbol?.toUpperCase() || "TKN")}</span></div>
                    <div className="row"><span className="k">You get</span><span className="v">{isBuy && youGet > 0 ? `≈ ${fmtCount(youGet)}` : "—"}</span></div>
                    <div className="row"><span className="k">Price impact</span><span className="v">{amtN > 0 ? "<0.5%" : "—"}</span></div>
                    <div className="row"><span className="k">Fee</span><span className="v">1%</span></div>
                  </div>
                );
              })()}

              <button
                className={`buy-cta ${isBuy ? "" : "sell"}`}
                onClick={handleSwap}
                disabled={isLoading || !isValidAddress}
              >
                {isLoading ? <Loader2 className="spinner" /> : "◆"}
                {isLoading ? "EXECUTING…" : (isBuy ? `BUY ${market?.symbol ? `$${market.symbol.toUpperCase()}` : ""}` : `SELL ${market?.symbol ? `$${market.symbol.toUpperCase()}` : ""}`)}
              </button>
              <div className="route-note">Swap via <b>0x Aggregator</b> · Best route auto-selected</div>

              <div className="bp-links">
                <a className="bp-link" href={explorerUrl} target="_blank" rel="noopener noreferrer">CONTRACT</a>
                <a className="bp-link" href={isValidAddress ? `https://app.uniswap.org/explore/tokens/ethereum/${tokenAddress.trim()}` : "#"} target="_blank" rel="noopener noreferrer">LIQUIDITY</a>
                <a className="bp-link" href={isValidAddress ? `https://dexscreener.com/ethereum/${tokenAddress.trim()}` : "#"} target="_blank" rel="noopener noreferrer">CHART ↗</a>
              </div>
            </div>
          </aside>
        </div>

        {/* TRADES TABLE */}
        <section className="trades-panel">
          <div className="trades-head">
            <button className={`tr-tab ${tradeTab === "all" ? "on" : ""}`} onClick={() => setTradeTab("all")}>ALL TRADES</button>
            <button className={`tr-tab ${tradeTab === "yours" ? "on" : ""}`} onClick={() => setTradeTab("yours")}>YOUR TRADES</button>
            <button className={`tr-tab ${tradeTab === "holders" ? "on" : ""}`} onClick={() => setTradeTab("holders")}>
              HOLDERS <span className="c">({topHolders.length})</span>
            </button>
            <div className="trades-head-right">
              <span className="filter-chip on">LIVE</span>
              <span className="filter-chip">&gt; $500</span>
              <span className="filter-chip">&gt; $5K</span>
              <span className="filter-chip">WHALES</span>
            </div>
          </div>

          {tradeTab === "holders" ? (
            <div>
              {topHolders.length === 0 && <div className="empty-row">No holder data yet — first trades will populate this.</div>}
              {topHolders.map((h, i) => (
                <div key={h.wallet} className="holder-row">
                  <div className={`hr-rank ${i < 3 ? "top" : ""}`}>{String(i + 1).padStart(2, "0")}</div>
                  <div className="hr-addr">
                    <span className="wav" />
                    <span className="a">{shortAddr(h.wallet)}</span>
                  </div>
                  <div className="hr-pct">{h.pct.toFixed(2)}%</div>
                  <div className="hr-bar" style={{ ["--w" as never]: `${Math.min(100, h.pct * 4)}%` }} />
                </div>
              ))}
            </div>
          ) : (
            <table className="trades">
              <thead>
                <tr>
                  <th>AGE</th>
                  <th>TYPE</th>
                  <th className="r">USD</th>
                  <th className="r">PRICE</th>
                  <th className="r">TOKENS</th>
                  <th className="r">{chainSymbol}</th>
                  <th>WALLET</th>
                  <th className="r">TX</th>
                </tr>
              </thead>
              <tbody>
                {visibleTrades.length === 0 && (
                  <tr><td colSpan={8} className="empty-row">No trades yet for this token.</td></tr>
                )}
                {visibleTrades.slice(0, 25).map((t) => (
                  <tr key={t.id}>
                    <td className="age-cell">{ageOf(t.created_at)}</td>
                    <td>
                      <span className={`type-pill ${t.trade_type === "buy" ? "buy" : "sell"}`}>
                        {t.trade_type === "buy" ? "BUY" : "SELL"}
                      </span>
                    </td>
                    <td className={`r ${t.trade_type === "buy" ? "gain-cell" : "loss-cell"}`}>
                      {fmtUsd(Number(t.amount_sol) * (t.price_usd ?? 0) / (t.price_sol ?? 1))}
                    </td>
                    <td className="r">{fmtPriceUsd(t.price_usd ?? undefined)}</td>
                    <td className="r">{fmtCount(Number(t.amount_tokens))}</td>
                    <td className="r">{Number(t.amount_sol).toFixed(4)}</td>
                    <td>
                      <span className="wallet">
                        <span className="wav" />
                        {shortAddr(t.wallet_address)}
                      </span>
                    </td>
                    <td className="r tx-link">
                      <a href={`https://etherscan.io/tx/${t.tx_hash}`} target="_blank" rel="noopener noreferrer">↗</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* SECONDARY: about + holders snapshot */}
        <div className="grid-2">
          <section className="panel">
            <div className="panel-h"><span className="ico">◆</span>ABOUT {market?.symbol ? `$${market.symbol.toUpperCase()}` : "TOKEN"}</div>
            <div className="panel-b">
              <h2 className="about-title">{market?.name || "—"}</h2>
              <p className="about-desc">
                Live ERC-20 trading on Popshiba via the 0x aggregator. All trades route through the
                deepest available liquidity, with anti-MEV protection enabled by default.
              </p>
              <div className="about-meta">
                <div className="meta-row"><span className="k">Price</span><span className="v">{fmtPriceUsd(market?.priceUsd)}</span></div>
                <div className="meta-row"><span className="k">Mcap</span><span className="v">{fmtUsd(market?.marketCap)}</span></div>
                <div className="meta-row"><span className="k">Vol 24h</span><span className="v">{fmtUsd(market?.volumeH24)}</span></div>
                <div className="meta-row"><span className="k">Liquidity</span><span className="v">{fmtUsd(market?.liquidityUsd)}</span></div>
                <div className="meta-row"><span className="k">Decimals</span><span className="v">{market?.decimals ?? tokenDecimals}</span></div>
                <div className="meta-row"><span className="k">Chain</span><span className="v">Ethereum</span></div>
                {isValidAddress && (
                  <div className="contract-row">
                    <span className="k">CA</span>
                    <span className="addr">{tokenAddress.trim()}</span>
                    <button className="copy" onClick={copyAddress}>COPY</button>
                    <a className="copy" href={explorerUrl} target="_blank" rel="noopener noreferrer">↗</a>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-h"><span className="ico">◎</span>TOP HOLDERS<span className="cnt">{topHolders.length}</span></div>
            <div>
              {topHolders.length === 0 && <div className="empty-row">No holders indexed yet.</div>}
              {topHolders.slice(0, 10).map((h, i) => (
                <div key={h.wallet} className="holder-row">
                  <div className={`hr-rank ${i < 3 ? "top" : ""}`}>{String(i + 1).padStart(2, "0")}</div>
                  <div className="hr-addr">
                    <span className="wav" />
                    <span className="a">{shortAddr(h.wallet)}</span>
                  </div>
                  <div className="hr-pct">{h.pct.toFixed(2)}%</div>
                  <div className="hr-bar" style={{ ["--w" as never]: `${Math.min(100, h.pct * 4)}%` }} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <PopshibaFooter />
      <NotLoggedInModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </div>
  );
}

/* ─────────── Template CSS, scoped to this page ─────────── */
const TEMPLATE_CSS = `
  .ape-main {
    max-width: 1440px;
    margin: 0 auto;
    padding: 24px 28px 60px;
    width: 100%;
    flex: 1;
    color: #0e0b08;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 500;
  }
  .ape-main * { box-sizing: border-box; }

  /* TOKEN HEADER BAR */
  .tok-bar { display:flex; align-items:center; gap:18px; padding:14px 18px; background:#fff4dc; border:2px solid #0e0b08; box-shadow:5px 5px 0 #0e0b08; margin-bottom:18px; flex-wrap:wrap; }
  .tok-back { width:34px; height:34px; border:2px solid #0e0b08; background:#fff; display:flex; align-items:center; justify-content:center; font-family:'Archivo Black',sans-serif; font-size:16px; box-shadow:2px 2px 0 #0e0b08; transition:transform .08s, box-shadow .08s; color:#0e0b08; text-decoration:none; }
  .tok-back:hover { transform:translate(-1px,-1px); box-shadow:3px 3px 0 #0e0b08; }
  .tok-id { display:flex; align-items:center; gap:10px; }
  .tok-av { width:40px; height:40px; border-radius:50%; border:2px solid #0e0b08; background:#e69cd4; display:flex; align-items:center; justify-content:center; font-family:'Archivo Black',sans-serif; font-size:14px; color:#0e0b08; box-shadow:2px 2px 0 #0e0b08; overflow:hidden; }
  .tok-name { font-family:'Archivo Black',sans-serif; font-size:18px; letter-spacing:-0.02em; color:#0e0b08; }
  .tok-sym { font-family:'JetBrains Mono',monospace; font-size:11px; color:#3a1f14; letter-spacing:0.1em; font-weight:700; }
  .live-pill { display:inline-flex; align-items:center; gap:6px; background:#0e0b08; color:#f5a524; padding:4px 9px; font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:700; letter-spacing:0.12em; }
  .live-pill .d { width:6px; height:6px; border-radius:50%; background:#f5a524; animation: ape-pulse 1.4s infinite; }
  @keyframes ape-pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  .tok-price { font-family:'Archivo Black',sans-serif; font-size:22px; letter-spacing:-0.02em; color:#0e0b08; }
  .tok-pct { display:inline-flex; align-items:center; gap:4px; background:#f8d6d4; border:1.5px solid #c8372d; color:#c8372d; padding:4px 10px; font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:700; }
  .tok-pct.up { background:#d6f5dd; border-color:#0b8a3a; color:#0b8a3a; }
  .tok-stats { display:flex; gap:16px; margin-left:8px; flex-wrap:wrap; }
  .tok-stat { font-family:'JetBrains Mono',monospace; font-size:11px; display:flex; align-items:baseline; gap:6px; letter-spacing:0.05em; }
  .tok-stat .k { color:#3a1f14; text-transform:uppercase; font-size:10px; letter-spacing:0.12em; }
  .tok-stat .v { color:#0e0b08; font-weight:700; font-size:13px; }
  .tok-actions { margin-left:auto; display:flex; gap:6px; }
  .icon-btn { width:32px; height:32px; border:1.5px solid #0e0b08; background:#fff; display:flex; align-items:center; justify-content:center; color:#0e0b08; font-size:13px; text-decoration:none; cursor:pointer; }
  .icon-btn:hover { background:#f5a524; }
  .icon-btn:disabled { opacity:0.4; cursor:not-allowed; }

  /* ADDRESS INPUT CARD */
  .addr-card { background:#fff4dc; border:2px solid #0e0b08; box-shadow:5px 5px 0 #0e0b08; padding:18px; margin-bottom:18px; }
  .addr-input { width:100%; background:#fff; border:2px solid #0e0b08; box-shadow:2px 2px 0 #0e0b08; padding:12px 14px; font-family:'JetBrains Mono',monospace; font-size:13px; color:#0e0b08; outline:none; }
  .addr-hint { margin-top:8px; font-family:'JetBrains Mono',monospace; font-size:11px; color:#3a1f14; }

  /* MAIN GRID */
  .grid { display:grid; grid-template-columns: minmax(0,1fr) 360px; gap:18px; margin-bottom:18px; }

  /* CHART */
  .chart-panel { background:#0e0b08; color:#fff4dc; border:2px solid #0e0b08; box-shadow:5px 5px 0 #fff4dc, 5px 5px 0 2px #0e0b08; display:flex; flex-direction:column; overflow:hidden; }
  .chart-toolbar { display:flex; align-items:center; gap:4px; padding:10px 14px; border-bottom:1px solid #2b2218; background:#171310; flex-wrap:wrap; }
  .tf { font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700; padding:6px 10px; color:#a49a8a; background:transparent; border:1.5px solid transparent; letter-spacing:0.05em; cursor:pointer; }
  .tf:hover { color:#fff4dc; }
  .tf.on { color:#f5a524; border-color:#f5a524; background:rgba(245,165,36,0.08); }
  .tf-sep { width:1px; height:18px; background:#2b2218; margin:0 6px; display:inline-block; }
  .expand { width:26px; height:26px; border:1.5px solid #f5a524; color:#f5a524; background:transparent; display:flex; align-items:center; justify-content:center; font-size:12px; cursor:pointer; }
  .toolbar-opt { font-family:'JetBrains Mono',monospace; font-size:11px; color:#fff4dc; padding:4px 8px; display:inline-flex; align-items:center; gap:5px; letter-spacing:0.05em; }
  .toolbar-opt .pre { color:#f5a524; }
  .toolbar-right { margin-left:auto; display:flex; align-items:center; gap:10px; font-family:'JetBrains Mono',monospace; font-size:11px; }
  .toolbar-right .live { color:#f5a524; display:inline-flex; align-items:center; gap:5px; font-weight:700; letter-spacing:0.15em; }
  .toolbar-right .live .d { width:7px; height:7px; border-radius:50%; background:#f5a524; animation: ape-pulse 1.4s infinite; }
  .chart-body { position:relative; min-height:460px; background:#0e0b08; }
  .chart-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:460px; gap:8px; }
  .ce-title { font-family:'Archivo Black',sans-serif; font-size:18px; color:#fff4dc; }
  .ce-sub { font-family:'JetBrains Mono',monospace; font-size:11px; color:#a49a8a; }
  .chart-loading { position:absolute; top:8px; right:8px; }
  .spinner { width:16px; height:16px; animation: spin 1s linear infinite; color:#f5a524; }
  @keyframes spin { to { transform:rotate(360deg); } }

  /* BUY PANEL */
  .buy-panel { background:#fff4dc; border:2px solid #0e0b08; box-shadow:5px 5px 0 #0e0b08; display:flex; flex-direction:column; }
  .tabs { display:grid; grid-template-columns:1fr 1fr; border-bottom:2px solid #0e0b08; }
  .tab { font-family:'Archivo Black',sans-serif; font-size:13px; letter-spacing:0.08em; padding:14px 10px; text-align:center; background:#fff; color:#3a1f14; border:none; border-right:2px solid #0e0b08; display:inline-flex; align-items:center; justify-content:center; gap:6px; cursor:pointer; }
  .tab:last-child { border-right:none; }
  .tab.on.buy { background:#5ce68e; color:#0e0b08; }
  .tab.on.sell { background:#e8605a; color:#fff4dc; }
  .tab .ic { font-family:inherit; font-size:12px; }

  .buy-body { padding:18px; }
  .bp-section { margin-bottom:14px; }
  .bp-label { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.15em; text-transform:uppercase; color:#3a1f14; margin-bottom:8px; font-weight:700; }
  .amt-row { display:flex; align-items:center; gap:10px; padding:12px 14px; background:#fff; border:2px solid #0e0b08; box-shadow:2px 2px 0 #0e0b08; }
  .amt-in { flex:1; border:0; background:transparent; font-family:'Archivo Black',sans-serif; font-size:22px; color:#0e0b08; outline:none; letter-spacing:-0.01em; min-width:0; width:100%; }
  .amt-sym { display:inline-flex; align-items:center; gap:6px; font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:700; letter-spacing:0.1em; color:#0e0b08; padding:4px 8px; background:#f5a524; border:1.5px solid #0e0b08; white-space:nowrap; }
  .amt-sym .coin { width:14px; height:14px; border-radius:50%; background: radial-gradient(circle at 30% 30%, #f3ba2f, #a07418); border:1.5px solid #0e0b08; }

  .amt-chips { display:grid; grid-template-columns: repeat(6, 1fr); gap:6px; margin-top:10px; }
  .amt-chip { font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700; padding:8px 0; background:#fff; border:1.5px solid #0e0b08; color:#0e0b08; text-align:center; letter-spacing:0.05em; cursor:pointer; }
  .amt-chip:hover { background:#fff4dc; }
  .amt-chip.on { background:#f5a524; color:#0e0b08; box-shadow:2px 2px 0 #0e0b08; }

  .slippage { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:6px; margin-top:8px; }
  .slip { font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700; padding:8px 0; background:#fff; border:1.5px solid #0e0b08; text-align:center; color:#0e0b08; cursor:pointer; }
  .slip.on { background:#0e0b08; color:#f5a524; }

  .bp-stats { display:grid; grid-template-columns: 1fr 1fr; gap:10px; padding:12px; background:#fff; border:1.5px dashed #0e0b08; margin-top:12px; font-family:'JetBrains Mono',monospace; font-size:10px; }
  .bp-stats .row { display:flex; justify-content:space-between; letter-spacing:0.05em; }
  .bp-stats .row .k { color:#3a1f14; text-transform:uppercase; font-size:9px; letter-spacing:0.12em; }
  .bp-stats .row .v { color:#0e0b08; font-weight:700; font-size:11px; }

  .buy-cta { width:100%; padding:16px; background:#0e0b08; color:#f5a524; border:2px solid #0e0b08; font-family:'Archivo Black',sans-serif; font-size:16px; letter-spacing:0.05em; box-shadow:3px 3px 0 #f5a524; margin-top:14px; display:inline-flex; align-items:center; justify-content:center; gap:8px; text-transform:uppercase; cursor:pointer; }
  .buy-cta:hover { transform:translate(-1px,-1px); box-shadow:4px 4px 0 #f5a524; }
  .buy-cta:active { transform:translate(1px,1px); box-shadow:1px 1px 0 #f5a524; }
  .buy-cta:disabled { opacity:0.5; cursor:not-allowed; transform:none; box-shadow:3px 3px 0 #f5a524; }
  .buy-cta.sell { background:#e8605a; color:#fff4dc; box-shadow:3px 3px 0 #0e0b08; }
  .buy-cta.sell:hover { box-shadow:4px 4px 0 #0e0b08; }

  .route-note { text-align:center; margin-top:10px; font-family:'JetBrains Mono',monospace; font-size:10px; color:#3a1f14; letter-spacing:0.08em; }
  .route-note b { color:#0e0b08; font-weight:700; }

  .bp-links { display:flex; gap:6px; margin-top:14px; padding-top:14px; border-top:1.5px dashed #0e0b08; }
  .bp-link { flex:1; padding:8px 6px; border:1.5px solid #0e0b08; background:#fff; text-align:center; font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:700; letter-spacing:0.08em; color:#0e0b08; text-decoration:none; cursor:pointer; }
  .bp-link:hover { background:#f5a524; }

  /* TRADES TABLE */
  .trades-panel { background:#fff4dc; border:2px solid #0e0b08; box-shadow:5px 5px 0 #0e0b08; }
  .trades-head { display:flex; align-items:center; gap:0; border-bottom:2px solid #0e0b08; background:#fff; }
  .tr-tab { font-family:'Archivo Black',sans-serif; font-size:12px; letter-spacing:0.1em; padding:14px 20px; color:#3a1f14; background:transparent; border:none; border-right:1.5px solid #0e0b08; position:relative; cursor:pointer; }
  .tr-tab .c { font-family:'JetBrains Mono',monospace; font-weight:400; font-size:10px; margin-left:6px; opacity:0.7; }
  .tr-tab.on { background:#f5a524; color:#0e0b08; }
  .tr-tab.on::after { content:''; position:absolute; left:0; right:0; bottom:-2px; height:3px; background:#0e0b08; }
  .trades-head-right { margin-left:auto; display:flex; gap:6px; padding:10px 14px; align-items:center; }
  .filter-chip { padding:5px 10px; border:1.5px solid #0e0b08; background:#fff; font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:700; letter-spacing:0.08em; }
  .filter-chip.on { background:#0e0b08; color:#f5a524; }

  table.trades { width:100%; border-collapse:collapse; font-family:'JetBrains Mono',monospace; font-size:12px; }
  table.trades thead th { font-family:'JetBrains Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.15em; color:#3a1f14; padding:10px 18px; text-align:left; background:#fff; border-bottom:1.5px dashed #0e0b08; font-weight:700; }
  table.trades thead th.r { text-align:right; }
  table.trades tbody tr { border-bottom:1.5px dashed rgba(14,11,8,0.15); }
  table.trades tbody tr:hover { background:#fff; }
  table.trades tbody td { padding:10px 18px; color:#0e0b08; font-weight:500; vertical-align:middle; }
  table.trades tbody td.r { text-align:right; font-weight:700; }
  .type-pill { display:inline-flex; align-items:center; gap:4px; font-family:'Archivo Black',sans-serif; font-size:11px; padding:3px 8px; letter-spacing:0.08em; }
  .type-pill.buy { background:#5ce68e; color:#0e0b08; }
  .type-pill.sell { background:#e8605a; color:#fff4dc; }
  .wallet { font-family:'JetBrains Mono',monospace; font-size:11px; color:#3a1f14; display:inline-flex; align-items:center; gap:6px; }
  .wallet .wav { width:16px; height:16px; border-radius:50%; border:1px solid #0e0b08; display:inline-block; background:#7fb5e6; }
  .gain-cell { color:#0b8a3a; }
  .loss-cell { color:#c8372d; }
  .age-cell { color:#3a1f14; }
  .tx-link { color:#3a1f14; }
  .tx-link a { color:inherit; text-decoration:none; }
  .empty-row { padding:24px 18px; text-align:center; font-family:'JetBrains Mono',monospace; font-size:11px; color:#3a1f14; }

  /* SECONDARY */
  .grid-2 { display:grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap:18px; margin-top:18px; }
  .panel { background:#fff4dc; border:2px solid #0e0b08; box-shadow:5px 5px 0 #0e0b08; }
  .panel-h { display:flex; align-items:center; gap:10px; padding:14px 20px; background:#0e0b08; color:#fff4dc; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.15em; text-transform:uppercase; font-weight:700; }
  .panel-h .ico { color:#f5a524; }
  .panel-h .cnt { margin-left:auto; color:#f5a524; }
  .panel-b { padding:20px; }
  .about-title { font-family:'Archivo Black',sans-serif; font-size:22px; letter-spacing:-0.02em; margin:0 0 8px; color:#0e0b08; }
  .about-desc { font-size:14px; color:#3a1f14; line-height:1.5; margin:0 0 16px; }
  .about-meta { display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; }
  .meta-row { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#fff; border:1.5px dashed #0e0b08; font-family:'JetBrains Mono',monospace; font-size:11px; }
  .meta-row .k { color:#3a1f14; text-transform:uppercase; font-size:9px; letter-spacing:0.12em; }
  .meta-row .v { color:#0e0b08; font-weight:700; }
  .contract-row { grid-column: 1 / -1; display:flex; align-items:center; gap:10px; padding:10px 12px; background:#0e0b08; color:#f5a524; border:1.5px solid #0e0b08; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.05em; }
  .contract-row .k { color:#fff4dc; font-size:9px; letter-spacing:0.15em; text-transform:uppercase; }
  .contract-row .addr { flex:1; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .contract-row .copy { border:1.5px solid #f5a524; color:#f5a524; background:transparent; padding:4px 8px; font-family:inherit; font-size:10px; font-weight:700; cursor:pointer; text-decoration:none; }

  .holder-row { display:grid; grid-template-columns: 28px 1fr auto auto; gap:12px; align-items:center; padding:10px 18px; border-bottom:1.5px dashed rgba(14,11,8,0.15); font-family:'JetBrains Mono',monospace; font-size:11px; }
  .holder-row:last-child { border-bottom:none; }
  .holder-row:hover { background:#fff; }
  .hr-rank { font-family:'Archivo Black',sans-serif; font-size:12px; color:#3a1f14; text-align:center; }
  .hr-rank.top { color:#f5a524; background:#0e0b08; padding:2px 4px; border-radius:2px; }
  .hr-addr { display:flex; align-items:center; gap:8px; min-width:0; }
  .hr-addr .wav { width:20px; height:20px; border-radius:50%; border:1.5px solid #0e0b08; flex-shrink:0; background:#7fb5e6; }
  .hr-addr .a { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:700; color:#0e0b08; }
  .hr-pct { color:#0e0b08; font-weight:700; font-size:12px; text-align:right; }
  .hr-bar { width:70px; height:6px; background:#fff; border:1.5px solid #0e0b08; position:relative; overflow:hidden; }
  .hr-bar::after { content:''; position:absolute; inset:0; background:#f5a524; width: var(--w, 50%); }

  @media (max-width: 1100px) {
    .grid { grid-template-columns: 1fr; }
    .grid-2 { grid-template-columns: 1fr; }
    .tok-stats { width:100%; }
  }
  @media (max-width: 760px) {
    .ape-main { padding: 16px 14px 40px; }
    .tok-bar { padding:12px 12px; }
    .tok-price { font-size:18px; }
    table.trades thead th, table.trades tbody td { padding:8px 10px; font-size:11px; }
  }
`;
