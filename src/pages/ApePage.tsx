import { useState, useMemo, useEffect } from "react";
import { useZeroxSwap, type ApeChain } from "@/hooks/useZeroxSwap";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Zap, ArrowDownToLine, Shield, Gauge, Settings2, ExternalLink, Copy, TrendingUp, TrendingDown } from "lucide-react";
import { showTradeSuccess } from "@/stores/tradeSuccessStore";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";
import { supabase } from "@/integrations/supabase/client";

const ETH_LOGO = "https://assets.coingecko.com/coins/images/279/small/ethereum.png";
const BNB_LOGO = "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png";

const PRESETS: Record<ApeChain, number[]> = {
  eth: [0.01, 0.05, 0.1, 0.5, 1, 5],
  bnb: [0.01, 0.05, 0.1, 0.25, 0.5, 1],
};

interface MarketData {
  name?: string;
  symbol?: string;
  priceUsd?: number;
  marketCap?: number;
  volumeH24?: number;
  liquidityUsd?: number;
  priceChangeH24?: number;
  decimals?: number;
}

function fmtUsd(v?: number): string {
  if (v == null || !isFinite(v)) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(4)}`;
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

  const [chain, setChain] = useState<ApeChain>("eth");
  const [tokenAddress, setTokenAddress] = useState("");
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

  const chainLogo = chain === "eth" ? ETH_LOGO : BNB_LOGO;
  const chainSymbol = chain === "eth" ? "ETH" : "BNB";
  const presets = PRESETS[chain];

  const isValidAddress = useMemo(
    () => /^0x[a-fA-F0-9]{40}$/.test(tokenAddress.trim()),
    [tokenAddress]
  );

  // Fetch on-chain market data when a valid address is entered (or chain changes)
  useEffect(() => {
    if (!isValidAddress) { setMarket(null); return; }
    let cancelled = false;
    setMarketLoading(true);
    (async () => {
      try {
        const fnName = chain === "bnb" ? "bnb-batch-market" : "eth-batch-market";
        const { data } = await supabase.functions.invoke(fnName, {
          body: { addresses: [tokenAddress.trim()] },
        });
        if (cancelled) return;
        const result = (data?.results ?? {}) as Record<string, MarketData>;
        const m = result[tokenAddress.trim().toLowerCase()] ?? result[tokenAddress.trim()] ?? null;
        setMarket(m);
        if (m?.decimals) setTokenDecimals(String(m.decimals));
      } catch {
        if (!cancelled) setMarket(null);
      } finally {
        if (!cancelled) setMarketLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tokenAddress, chain, isValidAddress]);

  // DexScreener embed src — supports ethereum + bsc
  const chartSrc = useMemo(() => {
    if (!isValidAddress) return null;
    const dsChain = chain === "bnb" ? "bsc" : "ethereum";
    return `https://dexscreener.com/${dsChain}/${tokenAddress.trim()}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=15`;
  }, [tokenAddress, chain, isValidAddress]);

  const handleSwap = async () => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    if (!evmAddress) { toast.error("EVM wallet not ready"); return; }
    if (!isValidAddress) { toast.error("Enter a valid token contract address"); return; }
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
    } else {
      toast.error("Swap failed", { id: toastId, description: result.error?.slice(0, 160) });
    }
  };

  const copyAddress = () => {
    if (!isValidAddress) return;
    navigator.clipboard.writeText(tokenAddress.trim());
    toast.success("Address copied");
  };

  useEffect(() => {
    document.title = "Ape Terminal — Trade Any ETH/BNB Token Instantly";
  }, []);

  const change24 = market?.priceChangeH24;
  const isUp = (change24 ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-3 md:px-5 py-4 md:py-6">
        {/* Page header */}
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-mono text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground">
              🦍 APE TERMINAL
            </h1>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              Trade ANY ERC-20 on ETH or BNB · Best price across 70+ DEXs · 1% platform fee
            </p>
          </div>
          {/* Chain switcher (top-right for desktop) */}
          <div className="flex gap-2 p-1 bg-muted/30 rounded-lg">
            <button
              onClick={() => setChain("eth")}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase rounded-md transition-all flex items-center gap-2 ${
                chain === "eth"
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <img src={ETH_LOGO} alt="ETH" className="h-4 w-4 rounded-full" />
              Ethereum
            </button>
            <button
              onClick={() => setChain("bnb")}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase rounded-md transition-all flex items-center gap-2 ${
                chain === "bnb"
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <img src={BNB_LOGO} alt="BNB" className="h-4 w-4 rounded-full" />
              BNB Chain
            </button>
          </div>
        </div>

        {/* Token-stats strip (only when valid address) */}
        {isValidAddress && (
          <div className="mb-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 rounded-lg border border-border/40 bg-muted/10">
            <div className="col-span-2 sm:col-span-2 flex items-center gap-2 min-w-0">
              <img src={chainLogo} alt={chainSymbol} className="h-7 w-7 rounded-full flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-mono font-bold text-foreground truncate">
                  {market?.name ?? "Unknown Token"} {market?.symbol && <span className="text-muted-foreground">· ${market.symbol}</span>}
                </div>
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  {tokenAddress.slice(0, 6)}…{tokenAddress.slice(-4)}
                  <Copy className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Price</div>
              <div className="text-sm font-mono font-bold text-foreground">{fmtUsd(market?.priceUsd)}</div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">24h</div>
              <div className={`text-sm font-mono font-bold flex items-center gap-1 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                {change24 != null && (isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
                {fmtPct(change24)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">MCap</div>
              <div className="text-sm font-mono font-bold text-foreground">{fmtUsd(market?.marketCap)}</div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">Vol 24h</div>
              <div className="text-sm font-mono font-bold text-foreground">{fmtUsd(market?.volumeH24)}</div>
            </div>
          </div>
        )}

        {/* Main 2-column layout: chart left (8) + trade form right (4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
          {/* CHART (left) */}
          <div className="lg:col-span-8 order-2 lg:order-1">
            <div className="rounded-lg overflow-hidden border border-border/40 bg-[#0F172A]" style={{ minHeight: 520 }}>
              {chartSrc ? (
                <div className="relative w-full" style={{ height: "calc(100vh - 280px)", minHeight: 520 }}>
                  <iframe
                    key={chartSrc}
                    src={chartSrc}
                    className="w-full h-full border-0"
                    style={{ colorScheme: "dark" }}
                    title="Token Chart"
                    allow="clipboard-write"
                    loading="lazy"
                  />
                  {/* Cover DexScreener branding */}
                  <div
                    className="absolute bottom-0 left-0 pointer-events-none"
                    style={{ width: 180, height: 40, background: "linear-gradient(to right, #0b0f1a 70%, transparent)", zIndex: 10 }}
                  />
                  <div
                    className="absolute top-0 right-0 pointer-events-none"
                    style={{ width: 140, height: 32, background: "linear-gradient(to left, #0b0f1a 60%, transparent)", zIndex: 10 }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-10" style={{ minHeight: 520 }}>
                  <div className="text-5xl mb-3">📊</div>
                  <p className="text-sm font-mono text-muted-foreground/80 mb-1">
                    Paste a token contract on the right
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground/50">
                    Live chart, market data & 1-click swap will appear here
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* TRADE FORM (right) */}
          <div className="lg:col-span-4 order-1 lg:order-2">
            <div className="trade-glass-panel p-4 space-y-3 lg:sticky lg:top-4">
              {/* Token contract input */}
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider mb-1 block">
                  Token Contract
                </label>
                <input
                  type="text"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  placeholder="0x..."
                  className={`w-full bg-muted/20 border rounded-lg px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-1 ${
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

              {/* Advanced toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-center gap-2 text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <Settings2 className="h-3 w-3" />
                {showAdvanced ? "Hide" : "Show"} Advanced Settings
              </button>

              {showAdvanced && (
                <div className="space-y-3 pt-2 border-t border-border/30">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider mb-1 block">
                      Slippage Tolerance
                    </label>
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
                      <Gauge className="h-3 w-3" /> Gas Speed
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
                        antiMev
                          ? "bg-primary/10 border-primary/25 text-primary"
                          : "bg-muted/20 border-border/40 text-muted-foreground"
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
                      <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider mb-1 block">
                        Token Decimals
                      </label>
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

              {/* Execute */}
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

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <span className="text-[9px] font-mono text-muted-foreground/60">
                  Routed via 0x · 70+ DEXs · 1% fee
                </span>
                <a
                  href="https://0x.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] font-mono text-muted-foreground/60 hover:text-foreground flex items-center gap-1"
                >
                  0x <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>

              {evmAddress && (
                <p className="text-center text-[10px] font-mono text-muted-foreground">
                  Wallet: <span className="text-foreground">{evmAddress.slice(0, 6)}…{evmAddress.slice(-4)}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <NotLoggedInModal open={showLoginModal} onOpenChange={setShowLoginModal} />
      </div>
    </div>
  );
}
