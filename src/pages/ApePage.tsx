import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useZeroxSwap, type ApeChain } from "@/hooks/useZeroxSwap";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Loader2, Zap, ArrowDownToLine, Shield, Gauge, Settings2, ExternalLink, Copy,
  TrendingUp, TrendingDown, ArrowLeft, RefreshCw, Share2, BarChart3, Activity,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { showTradeSuccess } from "@/stores/tradeSuccessStore";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";
import { supabase } from "@/integrations/supabase/client";
import { CodexChart } from "@/components/launchpad/CodexChart";
import { TokenDataTabs } from "@/components/launchpad/TokenDataTabs";
import { ETH_NETWORK_ID, BSC_NETWORK_ID } from "@/hooks/useCodexNewPairs";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const ETH_LOGO = "https://assets.coingecko.com/coins/images/279/small/ethereum.png";
const BNB_LOGO = "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png";
const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

const PRESETS: Record<ApeChain, number[]> = {
  eth: [0.01, 0.05, 0.1, 0.5, 1, 5],
  bnb: [0.01, 0.05, 0.1, 0.25, 0.5, 1],
};

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

function fmtUsd(v?: number): string {
  if (v == null || !isFinite(v) || v <= 0) return "—";
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(4)}`;
}
function fmtPriceUsd(v?: number): string {
  if (v == null || !isFinite(v) || v <= 0) return "—";
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(8)}`;
}
function fmtPct(v?: number): string {
  if (v == null || !isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export default function ApePage() {
  const { isAuthenticated } = useAuth();
  const { address: evmAddress } = usePrivyEvmWallet();
  const { executeApeSwap, isLoading } = useZeroxSwap();

  // URL params: /ape, /ape/:address, /ape/:chain/:address
  const params = useParams<{ address?: string; chain?: string }>();
  const navigate = useNavigate();
  const urlChain: ApeChain | null =
    params.chain === "bnb" || params.chain === "bsc" ? "bnb" :
    params.chain === "eth" || params.chain === "ethereum" ? "eth" : null;
  const urlAddress = params.address && ADDR_RE.test(params.address) ? params.address : "";

  const [chain, setChain] = useState<ApeChain>(urlChain ?? "eth");
  const [tokenAddress, setTokenAddress] = useState(urlAddress);
  const [tokenDecimals, setTokenDecimals] = useState<string>("18");
  const [isBuy, setIsBuy] = useState(true);
  const [amount, setAmount] = useState("0.05");
  const [slippageBps, setSlippageBps] = useState(100);
  const [gasTier, setGasTier] = useState<"standard" | "fast" | "instant">("fast");
  const [antiMev, setAntiMev] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<"trade" | "chart" | "info">("chart");

  const chainLogo = chain === "eth" ? ETH_LOGO : BNB_LOGO;
  const chainSymbol = chain === "eth" ? "ETH" : "BNB";
  const presets = PRESETS[chain];
  const networkId = chain === "bnb" ? BSC_NETWORK_ID : ETH_NETWORK_ID;
  const isValidAddress = useMemo(() => ADDR_RE.test(tokenAddress.trim()), [tokenAddress]);

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

  // Reflect URL → state when navigating between /ape/<addr> links
  useEffect(() => {
    if (urlAddress && urlAddress.toLowerCase() !== tokenAddress.toLowerCase()) {
      setTokenAddress(urlAddress);
    }
    if (urlChain && urlChain !== chain) setChain(urlChain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlAddress, urlChain]);

  // Fetch market data
  const loadMarket = async () => {
    if (!isValidAddress) { setMarket(null); return; }
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
      ? `${market.name} ($${market.symbol}) — Ape Terminal`
      : "Ape Terminal — Trade Any ETH/BNB Token";
  }, [market]);

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
      gasTier,
      antiMev: chain === "eth" ? antiMev : false,
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
        chain: chain as any,
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
  const shareToken = () => {
    if (navigator.share) {
      navigator.share({ title: market?.name ?? "Token", url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    }
  };
  const explorerUrl = isValidAddress
    ? (chain === "bnb"
        ? `https://bscscan.com/token/${tokenAddress.trim()}`
        : `https://etherscan.io/token/${tokenAddress.trim()}`)
    : "#";

  const change24 = market?.priceChangeH24;
  const isUp = (change24 ?? 0) >= 0;

  const stats = [
    { label: "MCAP", value: fmtUsd(market?.marketCap), accent: true },
    { label: "VOL 24H", value: fmtUsd(market?.volumeH24) },
    { label: "LIQ", value: fmtUsd(market?.liquidityUsd) },
    { label: "PRICE", value: fmtPriceUsd(market?.priceUsd) },
    { label: "24H", value: fmtPct(change24) },
  ];

  /* ─────────── Reusable sections ─────────── */

  const ChartSection = ({ chartHeight = 460 }: { chartHeight?: number }) => (
    <div className="trade-glass-panel-glow trade-chart-wrapper overflow-hidden">
      {isValidAddress ? (
        <CodexChart
          key={`${chain}-${tokenAddress.trim()}`}
          tokenAddress={tokenAddress.trim()}
          networkId={networkId}
          height={chartHeight}
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-10" style={{ height: chartHeight }}>
          <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-mono text-muted-foreground/70 mb-1">
            Paste a token contract or open <code className="text-primary/70">/ape/&lt;address&gt;</code>
          </p>
          <p className="text-[11px] font-mono text-muted-foreground/40">
            Live candles, market data &amp; 1-click swap will appear here
          </p>
        </div>
      )}
    </div>
  );

  const TradeSection = () => (
    <div className="trade-glass-panel p-4 space-y-3">
      {/* Chain + contract input (always present) */}
      <div className="flex gap-1 p-0.5 bg-muted/30 rounded-lg">
        <button
          onClick={() => setChain("eth")}
          className={`flex-1 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1.5 ${
            chain === "eth" ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <img src={ETH_LOGO} alt="ETH" className="h-3.5 w-3.5 rounded-full" /> ETH
        </button>
        <button
          onClick={() => setChain("bnb")}
          className={`flex-1 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1.5 ${
            chain === "bnb" ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <img src={BNB_LOGO} alt="BNB" className="h-3.5 w-3.5 rounded-full" /> BNB
        </button>
      </div>

      <div>
        <input
          type="text"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          placeholder="Paste token contract 0x…"
          spellCheck={false}
          className={`w-full bg-muted/20 border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 ${
            tokenAddress && !isValidAddress
              ? "border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20 text-red-400"
              : "border-border/40 focus:border-primary/40 focus:ring-primary/20 text-foreground"
          }`}
        />
        {marketLoading && (
          <p className="mt-1 text-[9px] font-mono text-muted-foreground/60 flex items-center gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Fetching market data…
          </p>
        )}
      </div>

      {/* Buy/Sell */}
      <div className="flex gap-1 p-0.5 bg-muted/30 rounded-lg">
        <button
          onClick={() => setIsBuy(true)}
          className={`flex-1 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-md transition-all ${
            isBuy ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Zap className="inline h-3 w-3 mr-1" />BUY
        </button>
        <button
          onClick={() => setIsBuy(false)}
          className={`flex-1 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-md transition-all ${
            !isBuy ? "bg-red-500/15 text-red-400 border border-red-500/25" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowDownToLine className="inline h-3 w-3 mr-1" />SELL
        </button>
      </div>

      {/* Amount */}
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            if (v.split(".").length <= 2) setAmount(v);
          }}
          placeholder={isBuy ? `Amount in ${chainSymbol}` : "Amount in tokens"}
          className="w-full bg-muted/20 border border-border/40 rounded-lg px-3 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {isBuy && <img src={chainLogo} alt={chainSymbol} className="h-4 w-4 rounded-full" />}
          <span className="text-[10px] font-mono text-muted-foreground font-semibold">
            {isBuy ? chainSymbol : (market?.symbol ?? "TOKEN")}
          </span>
        </div>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-6 gap-1">
        {(isBuy ? presets : [10, 25, 50, 75, 90, 100]).map((p) => (
          <button
            key={p}
            onClick={() => setAmount(String(p))}
            className={`py-1.5 text-[10px] font-mono font-semibold rounded-md transition-all ${
              amount === String(p)
                ? "bg-primary/15 text-primary border border-primary/25"
                : "bg-muted/20 text-muted-foreground hover:bg-muted/40 border border-transparent"
            }`}
          >
            {isBuy ? p : `${p}%`}
          </button>
        ))}
      </div>

      {/* Advanced */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center justify-center gap-2 text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        <Settings2 className="h-3 w-3" />
        {showAdvanced ? "Hide" : "Show"} Advanced
      </button>

      {showAdvanced && (
        <div className="space-y-3 pt-2 border-t border-border/30">
          <div>
            <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider mb-1 block">Slippage</label>
            <div className="grid grid-cols-4 gap-1">
              {[50, 100, 300, 500].map((bps) => (
                <button
                  key={bps}
                  onClick={() => setSlippageBps(bps)}
                  className={`py-1.5 text-[10px] font-mono font-semibold rounded-md transition-all ${
                    slippageBps === bps
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "bg-muted/20 text-muted-foreground hover:bg-muted/40 border border-transparent"
                  }`}
                >
                  {(bps / 100).toFixed(bps < 100 ? 1 : 0)}%
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider mb-1 block flex items-center gap-1">
              <Gauge className="h-3 w-3" /> Gas
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(["standard", "fast", "instant"] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setGasTier(tier)}
                  className={`py-1.5 text-[10px] font-mono font-semibold uppercase rounded-md transition-all ${
                    gasTier === tier
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "bg-muted/20 text-muted-foreground hover:bg-muted/40 border border-transparent"
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          {chain === "eth" && (
            <button
              onClick={() => setAntiMev(!antiMev)}
              className={`w-full flex items-center justify-between py-2 px-3 rounded-md border transition-all ${
                antiMev ? "bg-primary/10 border-primary/25 text-primary" : "bg-muted/20 border-border/40 text-muted-foreground"
              }`}
            >
              <span className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase">
                <Shield className="h-3 w-3" /> Anti-MEV (Flashbots)
              </span>
              <span className="text-[10px] font-mono">{antiMev ? "ON" : "OFF"}</span>
            </button>
          )}

          {!isBuy && (
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider mb-1 block">Token Decimals</label>
              <input
                type="number"
                value={tokenDecimals}
                onChange={(e) => setTokenDecimals(e.target.value)}
                className="w-full bg-muted/20 border border-border/40 rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary/40"
              />
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleSwap}
        disabled={isLoading || !isValidAddress}
        className={`w-full py-3 rounded-lg text-sm font-mono font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
          isBuy
            ? "bg-primary/15 text-primary hover:bg-primary/25 border border-primary/25"
            : "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        {isLoading ? "Executing…" : `${isBuy ? "APE IN" : "DUMP"}`}
      </button>

      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <span className="text-[9px] font-mono text-muted-foreground/60">Routed via 0x · 1% fee</span>
        {evmAddress && (
          <span className="text-[9px] font-mono text-muted-foreground/60">
            {evmAddress.slice(0, 6)}…{evmAddress.slice(-4)}
          </span>
        )}
      </div>
    </div>
  );

  const TokenDetailsSection = () => (
    <div className="trade-glass-panel p-5 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground/50 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary/50" /> Token Details
        </h3>
      </div>
      {[
        { label: "Price", value: fmtPriceUsd(market?.priceUsd) },
        { label: "Market Cap", value: fmtUsd(market?.marketCap) },
        { label: "Volume 24h", value: fmtUsd(market?.volumeH24) },
        { label: "Liquidity", value: fmtUsd(market?.liquidityUsd) },
        { label: "24h Change", value: fmtPct(change24) },
        { label: "Decimals", value: market?.decimals != null ? String(market.decimals) : tokenDecimals },
      ].map((row, i) => (
        <div key={i} className="trade-detail-row">
          <span className="text-[12px] font-mono text-muted-foreground/50">{row.label}</span>
          <span className="text-[12px] font-mono text-foreground/80 font-semibold">{row.value}</span>
        </div>
      ))}
    </div>
  );

  const ContractSection = () => isValidAddress ? (
    <div className="trade-glass-panel p-5 space-y-2">
      <h3 className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/40">Contract</h3>
      <div className="flex items-center gap-2">
        <code className="text-[12px] font-mono text-foreground/60 truncate flex-1">
          {tokenAddress.slice(0, 10)}…{tokenAddress.slice(-4)}
        </code>
        <button onClick={copyAddress} className="text-muted-foreground/40 hover:text-foreground transition-colors shrink-0 p-2">
          <Copy className="h-4 w-4" />
        </button>
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/40 hover:text-foreground transition-colors shrink-0 p-2">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  ) : null;

  /* ─────────── Page render ─────────── */

  return (
    <LaunchpadLayout>
      <div className="trade-page-bg -mx-4 -mt-4 px-4 pt-4 md:mx-0 md:mt-0 md:pl-6 md:pr-4 md:pt-4 md:rounded-xl lg:px-6 lg:pt-6">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-4 pb-32 md:pb-24">

          {/* ──── TOP BAR ──── */}
          <div className="trade-topbar">
            <div className="flex items-center gap-3 px-5 py-3.5">
              <Link to="/" className="shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.06] rounded-lg">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>

              <Avatar className="h-10 w-10 rounded-xl trade-avatar-glow shrink-0">
                <AvatarImage src={market?.imageUrl} className="object-cover" />
                <AvatarFallback className="rounded-xl text-xs font-bold bg-primary/8 text-primary font-mono">
                  {(market?.symbol || "🦍").slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              <div className="flex items-center gap-2.5 min-w-0 shrink">
                <h1 className="text-[15px] md:text-base font-bold font-mono tracking-tight truncate max-w-[120px] sm:max-w-[200px] md:max-w-[280px] lg:max-w-none text-foreground">
                  {market?.name || (isValidAddress ? "Loading…" : "🦍 Ape Terminal")}
                </h1>
                {market?.symbol && <span className="text-[13px] font-mono text-muted-foreground/50 shrink-0">${market.symbol}</span>}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/8 text-primary/90 border border-primary/15 flex items-center gap-1 shrink-0 uppercase">
                  <img src={chainLogo} alt={chainSymbol} className="h-3 w-3 rounded-full" />
                  {chainSymbol}
                </span>
              </div>

              {isValidAddress && (
                <div className="flex items-center gap-2.5 ml-auto sm:ml-4 shrink-0">
                  <span className="text-[15px] sm:text-base font-mono font-bold text-foreground">
                    {fmtPriceUsd(market?.priceUsd)}
                  </span>
                  {change24 != null && change24 !== 0 && (
                    <span className={`trade-price-pill ${isUp ? "trade-price-pill-up" : "trade-price-pill-down"}`}>
                      {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {fmtPct(change24)}
                    </span>
                  )}
                </div>
              )}

              {/* Inline stats — lg+ */}
              {isValidAddress && (
                <div className="hidden lg:flex items-center gap-6 ml-6 min-w-0">
                  {stats.slice(0, 4).map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-wider">{s.label}</span>
                      <span className={`text-[13px] font-mono font-semibold ${s.accent ? "text-yellow-400" : "text-foreground/80"}`}>{s.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 ml-auto lg:ml-3">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg" onClick={loadMarket} disabled={!isValidAddress}>
                  <RefreshCw className={`h-3.5 w-3.5 ${marketLoading ? "animate-spin" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg" onClick={copyAddress} disabled={!isValidAddress}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="hidden sm:flex h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg" onClick={shareToken} disabled={!isValidAddress}>
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
                {isValidAddress && (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* Tablet stats row */}
            {isValidAddress && (
              <div className="hidden sm:flex lg:hidden items-center gap-6 px-5 py-2.5 overflow-x-auto scrollbar-none border-t border-white/[0.04]">
                {stats.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-wider">{s.label}</span>
                    <span className={`text-[13px] font-mono font-semibold ${s.accent ? "text-yellow-400" : "text-foreground/80"}`}>{s.value}</span>
                  </div>
                ))}
                <span className="text-[9px] font-mono px-2.5 py-1 rounded-full bg-primary/6 text-primary/70 border border-primary/12 flex items-center gap-1 shrink-0">
                  <Shield className="h-3 w-3" /> 0x · 1% FEE
                </span>
              </div>
            )}
          </div>

          {/* ── PHONE STATS ── */}
          {isValidAddress && (
            <div className="md:hidden grid grid-cols-3 gap-2.5">
              {stats.slice(0, 3).map((s, i) => (
                <div key={i} className="trade-stat-card">
                  <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">{s.label}</p>
                  <p className={`text-sm font-mono font-bold mt-1 ${s.accent ? "text-yellow-400" : "text-foreground/90"}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── PHONE TAB SWITCHER ── */}
          <div className="md:hidden">
            <div className="flex bg-white/[0.02] rounded-xl p-1 border border-white/[0.06]">
              {(["trade", "chart", "info"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMobileTab(tab)}
                  className={`flex-1 py-2.5 text-[12px] font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 rounded-lg ${
                    mobileTab === tab
                      ? "bg-white/[0.06] text-foreground font-bold"
                      : "text-muted-foreground/40 hover:text-muted-foreground/60"
                  }`}
                >
                  {tab === "trade" && <Activity className="h-3.5 w-3.5" />}
                  {tab === "chart" && <BarChart3 className="h-3.5 w-3.5" />}
                  {tab === "info" && <Shield className="h-3.5 w-3.5" />}
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* ═══ MAIN CONTENT — 3 layouts ═══ */}

          {/* PHONE */}
          <div className="md:hidden flex flex-col gap-3">
            {mobileTab === "trade" && <TradeSection />}
            {mobileTab === "chart" && (
              <>
                <ChartSection chartHeight={360} />
                {isValidAddress && (
                  <TokenDataTabs
                    tokenAddress={tokenAddress.trim()}
                    userWallet={evmAddress ?? undefined}
                    currentPriceUsd={market?.priceUsd ?? 0}
                    isBsc={chain === "bnb"}
                  />
                )}
              </>
            )}
            {mobileTab === "info" && (
              <>
                <TokenDetailsSection />
                <ContractSection />
              </>
            )}
          </div>

          {/* TABLET */}
          <div className="hidden md:grid lg:hidden grid-cols-12 gap-4">
            <div className="col-span-7 flex flex-col gap-4">
              <ChartSection chartHeight={440} />
              {isValidAddress && (
                <TokenDataTabs
                  tokenAddress={tokenAddress.trim()}
                  userWallet={evmAddress ?? undefined}
                  currentPriceUsd={market?.priceUsd ?? 0}
                  isBsc={chain === "bnb"}
                />
              )}
              <TokenDetailsSection />
              <ContractSection />
            </div>
            <div className="col-span-5 flex flex-col gap-4">
              <div className="sticky top-4 flex flex-col gap-4">
                <TradeSection />
              </div>
            </div>
          </div>

          {/* DESKTOP */}
          <div className="hidden lg:grid grid-cols-12 gap-4 flex-1">
            <div className="col-span-9 flex flex-col gap-4">
              <ChartSection chartHeight={460} />
              {isValidAddress && (
                <TokenDataTabs
                  tokenAddress={tokenAddress.trim()}
                  userWallet={evmAddress ?? undefined}
                  currentPriceUsd={market?.priceUsd ?? 0}
                  isBsc={chain === "bnb"}
                />
              )}
              <div className="grid grid-cols-2 gap-4">
                <TokenDetailsSection />
                <ContractSection />
              </div>
            </div>
            <div className="col-span-3 flex flex-col gap-4">
              <div className="sticky top-4 flex flex-col gap-4">
                <TradeSection />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* PHONE bottom bar */}
      <div className="md:hidden fixed left-0 right-0 z-50 trade-mobile-bar" style={{ bottom: "48px", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 4px)" }}>
        <div className="flex items-center gap-3 px-5 py-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[12px] font-mono text-muted-foreground/50 truncate">
              {isValidAddress ? fmtPriceUsd(market?.priceUsd) : "Paste a contract"}
            </span>
            {change24 != null && change24 !== 0 && (
              <span className={`text-[12px] font-mono font-bold ${isUp ? "text-green-400" : "text-destructive"}`}>
                {fmtPct(change24)}
              </span>
            )}
          </div>
          <button onClick={() => { setIsBuy(true); setMobileTab("trade"); }} className="trade-btn-buy font-mono text-sm font-bold min-w-[76px] px-6 py-2.5 rounded-lg min-h-[42px] active:scale-95">BUY</button>
          <button onClick={() => { setIsBuy(false); setMobileTab("trade"); }} className="trade-btn-sell font-mono text-sm font-bold min-w-[76px] px-6 py-2.5 rounded-lg min-h-[42px] active:scale-95">SELL</button>
        </div>
      </div>

      <NotLoggedInModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </LaunchpadLayout>
  );
}
