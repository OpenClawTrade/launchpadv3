import { useState, useMemo } from "react";
import { useZeroxSwap, type ApeChain } from "@/hooks/useZeroxSwap";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Zap, ArrowDownToLine, Shield, Gauge, Settings2, ExternalLink } from "lucide-react";
import { showTradeSuccess } from "@/stores/tradeSuccessStore";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";
import { Helmet } from "react-helmet-async";

const ETH_LOGO = "https://assets.coingecko.com/coins/images/279/small/ethereum.png";
const BNB_LOGO = "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png";

const PRESETS: Record<ApeChain, number[]> = {
  eth: [0.01, 0.05, 0.1, 0.5, 1, 5],
  bnb: [0.01, 0.05, 0.1, 0.25, 0.5, 1],
};

export default function ApePage() {
  const { isAuthenticated } = useAuth();
  const { address: evmAddress } = usePrivyEvmWallet();
  const { executeApeSwap, isLoading } = useZeroxSwap();

  const [chain, setChain] = useState<ApeChain>("eth");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState<string>("18");
  const [isBuy, setIsBuy] = useState(true);
  const [amount, setAmount] = useState("0.05");
  const [slippageBps, setSlippageBps] = useState(100); // 1%
  const [gasTier, setGasTier] = useState<"standard" | "fast" | "instant">("fast");
  const [antiMev, setAntiMev] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const chainLogo = chain === "eth" ? ETH_LOGO : BNB_LOGO;
  const chainSymbol = chain === "eth" ? "ETH" : "BNB";
  const presets = PRESETS[chain];

  const isValidAddress = useMemo(() => /^0x[a-fA-F0-9]{40}$/.test(tokenAddress.trim()), [tokenAddress]);

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
        ticker: "TOKEN",
        tokenName: tokenAddress.slice(0, 10),
        mintAddress: tokenAddress,
        amount: `${amt} ${isBuy ? chainSymbol : "TOKEN"}`,
        signature: result.txHash,
        chain: chain as any,
        explorerUrl: result.explorerUrl,
      });
    } else {
      toast.error("Swap failed", { id: toastId, description: result.error?.slice(0, 160) });
    }
  };

  return (
    <>
      <Helmet>
        <title>Ape Terminal — Trade Any ETH/BNB Token Instantly</title>
        <meta name="description" content="Trade any ERC20 on Ethereum or BNB Chain via 0x aggregator. Best price routing, MEV protection, instant execution." />
      </Helmet>

      <div className="min-h-screen bg-background py-6 md:py-10 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="font-mono text-3xl md:text-4xl font-black uppercase tracking-tight text-foreground mb-2">
              🦍 APE TERMINAL
            </h1>
            <p className="text-xs font-mono text-muted-foreground">
              Trade ANY ERC-20 on ETH or BNB · Best price across 70+ DEXs · 1% platform fee
            </p>
          </div>

          {/* Main panel */}
          <div className="trade-glass-panel p-5 space-y-4">
            {/* Chain switcher */}
            <div className="flex gap-2 p-1 bg-muted/30 rounded-lg">
              <button
                onClick={() => setChain("eth")}
                className={`flex-1 py-2.5 text-xs font-mono font-bold uppercase rounded-md transition-all flex items-center justify-center gap-2 ${
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
                className={`flex-1 py-2.5 text-xs font-mono font-bold uppercase rounded-md transition-all flex items-center justify-center gap-2 ${
                  chain === "bnb"
                    ? "bg-primary/15 text-primary border border-primary/25"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <img src={BNB_LOGO} alt="BNB" className="h-4 w-4 rounded-full" />
                BNB Chain
              </button>
            </div>

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
                className={`w-full bg-muted/20 border rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:ring-1 ${
                  tokenAddress && !isValidAddress
                    ? "border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20 text-red-400"
                    : "border-border/40 focus:border-primary/40 focus:ring-primary/20 text-foreground"
                }`}
              />
            </div>

            {/* Buy/Sell */}
            <div className="flex gap-1 p-0.5 bg-muted/30 rounded-lg">
              <button
                onClick={() => setIsBuy(true)}
                className={`flex-1 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-md transition-all ${
                  isBuy ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Zap className="inline h-3 w-3 mr-1" />BUY
              </button>
              <button
                onClick={() => setIsBuy(false)}
                className={`flex-1 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-md transition-all ${
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
                className="w-full bg-muted/20 border border-border/40 rounded-lg px-4 py-3 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {isBuy && <img src={chainLogo} alt={chainSymbol} className="h-4 w-4 rounded-full" />}
                <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                  {isBuy ? chainSymbol : "TOKEN"}
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
                {/* Slippage */}
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

                {/* Gas tier */}
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

                {/* Anti-MEV (ETH) */}
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

                {/* Token decimals (sells) */}
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
              className={`w-full py-3.5 rounded-lg text-sm font-mono font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
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
                Powered by 0x <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>

          {/* Wallet info */}
          {evmAddress && (
            <p className="mt-4 text-center text-[10px] font-mono text-muted-foreground">
              Trading from: <span className="text-foreground">{evmAddress.slice(0, 6)}…{evmAddress.slice(-4)}</span>
            </p>
          )}
        </div>

        <NotLoggedInModal open={showLoginModal} onOpenChange={setShowLoginModal} />
      </div>
    </>
  );
}
