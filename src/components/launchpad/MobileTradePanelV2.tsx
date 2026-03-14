import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useRealSwap } from "@/hooks/useRealSwap";
import { useJupiterSwap } from "@/hooks/useJupiterSwap";
import { usePumpFunSwap } from "@/hooks/usePumpFunSwap";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { useRugCheck } from "@/hooks/useRugCheck";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, AlertTriangle, ExternalLink } from "lucide-react";
import { AdvancedSettingsSheet } from "./AdvancedSettingsSheet";
import { ProfitCardModal, type ProfitCardData } from "./ProfitCardModal";
import { VersionedTransaction, Connection, PublicKey } from "@solana/web3.js";
import { supabase } from "@/integrations/supabase/client";
import { Token, calculateBuyQuote, calculateSellQuote, formatTokenAmount, formatSolAmount } from "@/hooks/useLaunchpad";

const HELIUS_RPC = import.meta.env.VITE_HELIUS_RPC_URL || (import.meta.env.VITE_HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}` : "https://mainnet.helius-rpc.com");
const SOL_LOGO = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

interface MobileTradePanelV2Props {
  /** For bonding curve tokens — full Token object */
  bondingToken?: Token;
  /** For graduated/external tokens — lightweight info */
  externalToken?: {
    mint_address: string;
    ticker: string;
    name: string;
    decimals?: number;
    graduated?: boolean;
    price_sol?: number;
    imageUrl?: string;
  };
  userTokenBalance?: number;
}

export function MobileTradePanelV2({ bondingToken, externalToken, userTokenBalance: externalBalance = 0 }: MobileTradePanelV2Props) {
  const { isAuthenticated, login, solanaAddress, profileId } = useAuth();
  const { executeRealSwap, isLoading: bondingSwapLoading, getBalance } = useRealSwap();
  const { getBuyQuote, getSellQuote, buyToken, sellToken, isLoading: jupiterLoading } = useJupiterSwap();
  const { swap: pumpFunSwap } = usePumpFunSwap();
  const { signAndSendTransaction, isWalletReady, walletAddress: embeddedWallet, getTokenBalance: getTokenBalancePrivy } = useSolanaWalletWithPrivy();
  const { toast } = useToast();

  const signAndSendTx = useCallback(async (tx: VersionedTransaction): Promise<{ signature: string; confirmed: boolean }> => {
    return await signAndSendTransaction(tx);
  }, [signAndSendTransaction]);

  // Determine mode
  const isBondingMode = !!bondingToken;
  const tokenInfo = bondingToken
    ? { mint_address: bondingToken.mint_address, ticker: bondingToken.ticker, name: bondingToken.name, decimals: 6, price_sol: bondingToken.price_sol, imageUrl: bondingToken.image_url || undefined }
    : externalToken!;

  const mintAddress = tokenInfo.mint_address;
  const tokenDecimals = tokenInfo.decimals || 9;

  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [slippage, setSlippage] = useState(1);
  const [instaBuy, setInstaBuy] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [onChainTokenBalance, setOnChainTokenBalance] = useState<number | null>(null);
  const [jupiterQuoteFailed, setJupiterQuoteFailed] = useState(false);
  const [quote, setQuote] = useState<{ outAmount: string; priceImpactPct: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [profitCardData, setProfitCardData] = useState<ProfitCardData | null>(null);
  const [showProfitCard, setShowProfitCard] = useState(false);

  const isBuy = tradeType === "buy";
  const numericAmount = parseFloat(amount) || 0;
  const effectiveWallet = embeddedWallet || solanaAddress;
  const userTokenBalance = onChainTokenBalance ?? externalBalance;

  // Jupiter routing for graduated tokens
  const useJupiterRoute = !isBondingMode && !jupiterQuoteFailed;

  // SOL balance
  useEffect(() => {
    if (isAuthenticated && solanaAddress) {
      getBalance().then(setSolBalance).catch(() => setSolBalance(null));
    }
  }, [isAuthenticated, solanaAddress, getBalance, isLoading]);

  // Token balance
  const refreshTokenBalance = useCallback(async () => {
    if (!isAuthenticated || !effectiveWallet || !mintAddress) return;
    try {
      if (isBondingMode) {
        const bal = await getTokenBalancePrivy(mintAddress);
        setOnChainTokenBalance(bal);
      } else {
        const connection = new Connection(HELIUS_RPC);
        const owner = new PublicKey(effectiveWallet);
        const mint = new PublicKey(mintAddress);
        const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint });
        const bal = resp.value.reduce((sum, acc) => {
          const ta = acc.account?.data?.parsed?.info?.tokenAmount;
          const v = typeof ta?.uiAmount === "number" ? ta.uiAmount : ta?.uiAmountString ? parseFloat(ta.uiAmountString) : 0;
          return sum + (isFinite(v) ? v : 0);
        }, 0);
        setOnChainTokenBalance(bal);
      }
    } catch { /* keep previous */ }
  }, [isAuthenticated, effectiveWallet, mintAddress, isBondingMode, getTokenBalancePrivy]);

  useEffect(() => { void refreshTokenBalance(); }, [refreshTokenBalance, isLoading, tradeType]);
  useEffect(() => {
    if (!isAuthenticated || !effectiveWallet || !mintAddress) return;
    const interval = window.setInterval(() => void refreshTokenBalance(), 3000);
    const onFocus = () => void refreshTokenBalance();
    const onVis = () => { if (document.visibilityState === "visible") void refreshTokenBalance(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVis); };
  }, [isAuthenticated, effectiveWallet, mintAddress, refreshTokenBalance]);

  // Jupiter quotes for graduated tokens
  useEffect(() => {
    if (isBondingMode) { setQuote(null); return; }
    const fetchQuote = async () => {
      if (numericAmount <= 0 || !mintAddress) { setQuote(null); setJupiterQuoteFailed(false); return; }
      setQuoteLoading(true);
      try {
        const result = isBuy
          ? await getBuyQuote(mintAddress, numericAmount, slippage * 100)
          : await getSellQuote(mintAddress, numericAmount, tokenDecimals, slippage * 100);
        if (result) { setQuote({ outAmount: result.outAmount, priceImpactPct: result.priceImpactPct }); setJupiterQuoteFailed(false); }
        else { setQuote(null); setJupiterQuoteFailed(true); }
      } catch { setQuote(null); setJupiterQuoteFailed(true); }
      finally { setQuoteLoading(false); }
    };
    const t = setTimeout(fetchQuote, 500);
    return () => clearTimeout(t);
  }, [numericAmount, isBuy, mintAddress, tokenDecimals, slippage, getBuyQuote, getSellQuote, isBondingMode]);

  // Compute output
  const outputAmount = (() => {
    if (isBondingMode && bondingToken) {
      const virtualSol = (bondingToken.virtual_sol_reserves || 30) + (bondingToken.real_sol_reserves || 0);
      const virtualToken = (bondingToken.virtual_token_reserves || 1_000_000_000) - (bondingToken.real_token_reserves || 0);
      const q = isBuy ? calculateBuyQuote(numericAmount, virtualSol, virtualToken) : calculateSellQuote(numericAmount, virtualSol, virtualToken);
      return isBuy ? q.tokensOut : q.solOut;
    }
    if (useJupiterRoute && quote) return parseInt(quote.outAmount) / 10 ** (isBuy ? tokenDecimals : 9);
    if (!useJupiterRoute && numericAmount > 0 && tokenInfo.price_sol && tokenInfo.price_sol > 0) {
      return isBuy ? numericAmount / tokenInfo.price_sol : numericAmount * tokenInfo.price_sol;
    }
    return 0;
  })();

  const priceImpact = (() => {
    if (isBondingMode && bondingToken && numericAmount > 0) {
      const virtualSol = (bondingToken.virtual_sol_reserves || 30) + (bondingToken.real_sol_reserves || 0);
      const virtualToken = (bondingToken.virtual_token_reserves || 1_000_000_000) - (bondingToken.real_token_reserves || 0);
      const q = isBuy ? calculateBuyQuote(numericAmount, virtualSol, virtualToken) : calculateSellQuote(numericAmount, virtualSol, virtualToken);
      return q.priceImpact;
    }
    return quote ? parseFloat(quote.priceImpactPct) : 0;
  })();

  const quickBuyAmounts = [0.1, 0.5, 1, 5];
  const quickSellPct = [25, 50, 75, 100];

  const handleQuickAmount = (value: number, index: number) => {
    if (isBuy) setAmount(value.toString());
    else setAmount(((userTokenBalance * value) / 100).toString());
    setSelectedPreset(index);
  };

  const handleMaxClick = () => {
    if (isBuy && solBalance !== null) setAmount(Math.max(0, solBalance - 0.005).toFixed(4));
    else if (!isBuy) setAmount(userTokenBalance.toString());
    setSelectedPreset(null);
  };

  const formatAmount = (amt: number) => {
    if (amt >= 1_000_000) return `${(amt / 1_000_000).toFixed(2)}M`;
    if (amt >= 1_000) return `${(amt / 1_000).toFixed(2)}K`;
    return amt.toFixed(4);
  };

  const handleTrade = async () => {
    if (!numericAmount || numericAmount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    if (!isBuy && numericAmount > userTokenBalance) { toast({ title: "Insufficient token balance", variant: "destructive" }); return; }
    if (isBuy && solBalance !== null && numericAmount > solBalance) { toast({ title: "Insufficient SOL balance", variant: "destructive" }); return; }
    if (!solanaAddress) { toast({ title: "Please connect your wallet", variant: "destructive" }); return; }

    setIsLoading(true);
    try {
      let signature = "";
      let resultOutputAmount: number | undefined;

      if (isBondingMode && bondingToken) {
        const result = await executeRealSwap(bondingToken, numericAmount, isBuy, slippage * 100);
        signature = result.signature;
      } else {
        if (useJupiterRoute) {
          const result = isBuy
            ? await buyToken(mintAddress, numericAmount, solanaAddress, signAndSendTx, slippage * 100)
            : await sellToken(mintAddress, numericAmount, tokenDecimals, solanaAddress, signAndSendTx, slippage * 100);
          signature = result.signature || "";
          resultOutputAmount = result.outputAmount;
        } else {
          const result = await pumpFunSwap(mintAddress, numericAmount, isBuy, slippage);
          signature = result.signature;
          resultOutputAmount = result.outputAmount;
        }

        // Record in DB (non-fatal)
        if (signature) {
          supabase.functions.invoke("launchpad-swap", {
            body: { mintAddress, userWallet: solanaAddress, amount: numericAmount, isBuy, profileId: profileId || undefined, signature, outputAmount: resultOutputAmount ?? null, tokenName: tokenInfo.name, tokenTicker: tokenInfo.ticker, mode: "alpha_only" },
          }).catch(() => {});
        }
      }

      setAmount("");
      setQuote(null);
      setSelectedPreset(null);
      getBalance().then(setSolBalance).catch(() => {});
      void refreshTokenBalance();
      window.setTimeout(() => void refreshTokenBalance(), 1500);
      window.setTimeout(() => void refreshTokenBalance(), 5000);

      setProfitCardData({ action: isBuy ? "buy" : "sell", amountSol: numericAmount, tokenTicker: tokenInfo.ticker, tokenName: tokenInfo.name, outputAmount: resultOutputAmount, signature });
      setShowProfitCard(true);

      toast({
        title: `${isBuy ? "Buy" : "Sell"} successful!`,
        description: (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span>{isBuy ? `Bought ${tokenInfo.ticker}` : `Sold ${tokenInfo.ticker}`}</span>
            {signature && (
              <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ),
      });
    } catch (error) {
      console.error("Trade error:", error);
      toast({ title: "Trade failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Safety checks
  const { data: rugCheck, isLoading: rugLoading } = useRugCheck(mintAddress);
  const safetyChecks = [
    { label: "Launched", passed: isBondingMode ? bondingToken?.status === "graduated" : true, loading: false },
    { label: "Mint revoked", passed: rugCheck?.mintAuthorityRevoked ?? null, loading: rugLoading },
    { label: "Freeze revoked", passed: rugCheck?.freezeAuthorityRevoked ?? null, loading: rugLoading },
    { label: "Liq locked", passed: rugCheck?.liquidityLocked ?? null, loading: rugLoading },
    { label: "Top 10 <30%", passed: rugCheck ? rugCheck.topHolderPct < 30 : null, loading: rugLoading },
  ];

  const tradingDisabled = isLoading || bondingSwapLoading || jupiterLoading;

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* ── BUY / SELL Toggle ── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setTradeType("buy"); setSelectedPreset(null); setQuote(null); }}
            className={`h-14 rounded-2xl font-mono text-base font-bold uppercase tracking-widest transition-all active:scale-[0.97] ${
              isBuy
                ? "bg-green-500/15 text-green-400 border-2 border-green-500/40 shadow-[0_0_20px_hsl(142_70%_45%/0.15)]"
                : "bg-secondary/50 text-muted-foreground border border-border/30 hover:bg-secondary/80"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => { setTradeType("sell"); setSelectedPreset(null); setQuote(null); }}
            className={`h-14 rounded-2xl font-mono text-base font-bold uppercase tracking-widest transition-all active:scale-[0.97] ${
              !isBuy
                ? "bg-destructive/15 text-destructive border-2 border-destructive/40 shadow-[0_0_20px_hsl(0_62%_50%/0.15)]"
                : "bg-secondary/50 text-muted-foreground border border-border/30 hover:bg-secondary/80"
            }`}
          >
            Sell
          </button>
        </div>

        {/* ── Amount Input ── */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-sm font-mono text-muted-foreground">
              {isBuy ? "You pay" : `You sell`}
            </span>
            <span className="text-sm font-mono text-muted-foreground">
              {isBuy
                ? solBalance !== null ? `${solBalance.toFixed(4)} SOL` : "—"
                : `${formatAmount(userTokenBalance)} ${tokenInfo.ticker}`}
            </span>
          </div>
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setSelectedPreset(null); }}
              className="h-16 text-2xl font-mono font-bold pr-28 rounded-2xl border-border/40 bg-secondary/30 focus-visible:ring-primary/30 placeholder:text-muted-foreground/20"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                onClick={handleMaxClick}
                className="h-8 px-3 rounded-xl font-mono text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all active:scale-95"
              >
                MAX
              </button>
              <span className="text-sm font-mono font-bold text-muted-foreground flex items-center gap-1.5">
                {isBuy ? (
                  <img src={SOL_LOGO} alt="SOL" className="w-5 h-5 rounded-full" />
                ) : tokenInfo.imageUrl ? (
                  <img src={tokenInfo.imageUrl} alt={tokenInfo.ticker} className="w-5 h-5 rounded-full" />
                ) : null}
              </span>
            </div>
          </div>
        </div>

        {/* ── Quick Amount Chips ── */}
        <div className="flex gap-2">
          {(isBuy ? quickBuyAmounts : quickSellPct).map((v, i) => (
            <button
              key={v}
              onClick={() => handleQuickAmount(v, i)}
              className={`flex-1 h-12 rounded-2xl font-mono text-sm font-bold border transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                selectedPreset === i
                  ? isBuy
                    ? "border-green-500/40 bg-green-500/10 text-green-400"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border/30 text-muted-foreground bg-secondary/30 hover:bg-secondary/60"
              }`}
            >
              {isBuy && <img src={SOL_LOGO} alt="" className="w-4 h-4 rounded-full" />}
              {isBuy ? v : `${v}%`}
            </button>
          ))}
        </div>

        {/* ── Live Preview ── */}
        {numericAmount > 0 && (
          <div className="rounded-2xl bg-secondary/40 border border-border/30 p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono text-muted-foreground">You get ≈</span>
              <span className="text-lg font-mono font-bold text-foreground">
                {quoteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                ) : (
                  `${formatAmount(outputAmount)} ${isBuy ? tokenInfo.ticker : "SOL"}`
                )}
              </span>
            </div>
            {priceImpact > 0.01 && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-mono text-muted-foreground">Price impact</span>
                <span className={`text-sm font-mono font-semibold ${priceImpact > 5 ? "text-destructive" : "text-muted-foreground"}`}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono text-muted-foreground">Slippage</span>
              <span className="text-sm font-mono text-muted-foreground">{slippage}%</span>
            </div>
          </div>
        )}

        {/* ── Price Impact Warning ── */}
        {priceImpact > 5 && numericAmount > 0 && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-2xl text-destructive border border-destructive/20">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-mono font-semibold">High price impact: {priceImpact.toFixed(2)}%</span>
          </div>
        )}

        {/* ── Action Row: Settings + Trade Button ── */}
        <div className="flex gap-3">
          <AdvancedSettingsSheet
            slippage={slippage}
            onSlippageChange={setSlippage}
            instaBuy={instaBuy}
            onInstaBuyChange={setInstaBuy}
            isBuy={isBuy}
            safetyChecks={safetyChecks}
            onGeneratePnl={() => {
              setProfitCardData({ action: isBuy ? "buy" : "sell", amountSol: numericAmount, tokenTicker: tokenInfo.ticker, tokenName: tokenInfo.name });
              setShowProfitCard(true);
            }}
          />

          {!isAuthenticated ? (
            <Button
              className="flex-1 h-14 rounded-2xl font-mono text-base font-bold uppercase tracking-wider bg-green-500 hover:bg-green-600 text-black"
              onClick={() => login()}
            >
              <Wallet className="h-5 w-5 mr-2" />
              Connect Wallet
            </Button>
          ) : (
            <button
              onClick={handleTrade}
              disabled={tradingDisabled || !numericAmount || (!isBondingMode && useJupiterRoute && quoteLoading)}
              className={`flex-1 h-14 rounded-2xl font-mono text-base font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] flex items-center justify-center gap-2 ${
                isBuy
                  ? "bg-green-500 hover:bg-green-600 text-black shadow-[0_0_24px_hsl(142_70%_45%/0.25)]"
                  : "bg-destructive hover:bg-destructive/90 text-white shadow-[0_0_24px_hsl(0_62%_50%/0.25)]"
              }`}
            >
              {tradingDisabled ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isBuy ? (
                <>
                  BUY
                  {numericAmount > 0 && <img src={SOL_LOGO} alt="" className="w-5 h-5 rounded-full" />}
                  {numericAmount > 0 && <span>{numericAmount}</span>}
                </>
              ) : (
                <>
                  SELL {tokenInfo.ticker}
                </>
              )}
            </button>
          )}
        </div>

        {/* Subtle indicator */}
        <div className="flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground/50">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>MEV Protected · Anti-Sandwich</span>
        </div>
      </div>

      <ProfitCardModal open={showProfitCard} onClose={() => setShowProfitCard(false)} data={profitCardData} />
    </>
  );
}
