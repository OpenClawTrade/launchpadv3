import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useJupiterSwap } from "@/hooks/useJupiterSwap";
import { usePumpFunSwap } from "@/hooks/usePumpFunSwap";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { ArrowDown, Loader2, Wallet, AlertTriangle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { VersionedTransaction, Connection, PublicKey } from "@solana/web3.js";

interface TokenInfo {
  mint_address: string;
  ticker: string;
  name: string;
  decimals?: number;
  /** Whether this token has graduated/migrated from bonding curve to DEX */
  graduated?: boolean;
  /** Current price in SOL (used for PumpPortal estimate) */
  price_sol?: number;
}

interface UniversalTradePanelProps {
  token: TokenInfo;
  userTokenBalance?: number;
}

const SLIPPAGE_PRESETS = [0.5, 1, 2, 5, 10];

const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=7305c408-6932-49f6-8613-2ec8606fb82d";

export function UniversalTradePanel({ token, userTokenBalance: externalTokenBalance }: UniversalTradePanelProps) {
  const { isAuthenticated, login, solanaAddress } = useAuth();
  const { getBuyQuote, getSellQuote, buyToken, sellToken, isLoading: swapLoading } = useJupiterSwap();
  const { swap: pumpFunSwap } = usePumpFunSwap();
  const { signAndSendTransaction, isWalletReady, getBalance } = useSolanaWalletWithPrivy();

  const signAndSendTx = useCallback(async (tx: VersionedTransaction): Promise<{ signature: string; confirmed: boolean }> => {
    return await signAndSendTransaction(tx);
  }, [signAndSendTransaction]);

  // Determine swap route: graduated tokens use Jupiter, bonding curve tokens use PumpPortal
  const useJupiterRoute = token.graduated !== false; // default to Jupiter if graduated is undefined or true

  const { toast } = useToast();
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [slippage, setSlippage] = useState(5);
  const [customSlippage, setCustomSlippage] = useState<string>('');
  const [showCustomSlippage, setShowCustomSlippage] = useState(false);
  const [quote, setQuote] = useState<{ outAmount: string; priceImpactPct: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [onChainTokenBalance, setOnChainTokenBalance] = useState<number | null>(null);

  const isBuy = tradeType === 'buy';
  const numericAmount = parseFloat(amount) || 0;
  const tokenDecimals = token.decimals || 9;

  // The effective token balance: prefer on-chain, fall back to external prop
  const userTokenBalance = onChainTokenBalance ?? externalTokenBalance ?? 0;

  // Fetch SOL balance
  useEffect(() => {
    if (isAuthenticated && solanaAddress) {
      getBalance().then(setSolBalance).catch(() => setSolBalance(null));
    }
  }, [isAuthenticated, solanaAddress, getBalance, isLoading]);

  // Fetch on-chain SPL token balance
  useEffect(() => {
    if (!isAuthenticated || !solanaAddress || !token.mint_address) {
      setOnChainTokenBalance(null);
      return;
    }
    const fetchTokenBal = async () => {
      try {
        const connection = new Connection(HELIUS_RPC);
        const owner = new PublicKey(solanaAddress);
        const mint = new PublicKey(token.mint_address);
        const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint });
        const account = resp.value[0];
        const bal = account?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
        setOnChainTokenBalance(bal);
      } catch {
        setOnChainTokenBalance(0);
      }
    };
    fetchTokenBal();
  }, [isAuthenticated, solanaAddress, token.mint_address, isLoading]);

  // Only fetch Jupiter quotes for graduated tokens
  useEffect(() => {
    if (!useJupiterRoute) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }
    const fetchQuote = async () => {
      if (numericAmount <= 0 || !token.mint_address) {
        setQuote(null);
        return;
      }
      setQuoteLoading(true);
      try {
        const result = isBuy
          ? await getBuyQuote(token.mint_address, numericAmount, slippage * 100)
          : await getSellQuote(token.mint_address, numericAmount, tokenDecimals, slippage * 100);
        if (result) {
          setQuote({ outAmount: result.outAmount, priceImpactPct: result.priceImpactPct });
        } else {
          setQuote(null);
        }
      } catch {
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    };
    const t = setTimeout(fetchQuote, 500);
    return () => clearTimeout(t);
  }, [numericAmount, isBuy, token.mint_address, tokenDecimals, slippage, getBuyQuote, getSellQuote, useJupiterRoute]);

  // For Jupiter route, use quote data; for PumpPortal, estimate from token price
  const outputAmount = (() => {
    if (useJupiterRoute && quote) {
      return parseInt(quote.outAmount) / (10 ** (isBuy ? tokenDecimals : 9));
    }
    if (!useJupiterRoute && numericAmount > 0 && token.price_sol && token.price_sol > 0) {
      if (isBuy) {
        // Buying tokens with SOL: tokens = SOL / price_per_token
        return numericAmount / token.price_sol;
      } else {
        // Selling tokens for SOL: SOL = tokens * price_per_token
        return numericAmount * token.price_sol;
      }
    }
    return 0;
  })();
  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;

  const quickBuyAmounts = [0.1, 0.5, 1, 5];
  const quickSellPct = [25, 50, 75, 100];

  const formatAmount = (amt: number, decimals: number = 4) => {
    if (amt >= 1_000_000) return `${(amt / 1_000_000).toFixed(2)}M`;
    if (amt >= 1_000) return `${(amt / 1_000).toFixed(2)}K`;
    return amt.toFixed(decimals);
  };

  const handleQuickAmount = (value: number) => {
    if (isBuy) {
      setAmount(value.toString());
    } else {
      const tokenAmount = (userTokenBalance * value) / 100;
      setAmount(tokenAmount.toString());
    }
  };

  const handleSlippagePreset = (val: number) => {
    setSlippage(val);
    setShowCustomSlippage(false);
    setCustomSlippage('');
  };

  const handleCustomSlippage = (val: string) => {
    setCustomSlippage(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && num <= 50) setSlippage(num);
  };

  const handleTrade = async () => {
    if (!numericAmount || numericAmount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    if (!isBuy && numericAmount > userTokenBalance) {
      toast({ title: "Insufficient token balance", variant: "destructive" });
      return;
    }
    if (!solanaAddress) {
      toast({ title: "Please connect your wallet", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      let result: { signature?: string; outputAmount?: number };

      if (useJupiterRoute) {
        // Jupiter route for graduated tokens
        if (!signAndSendTx) {
          toast({ title: "Wallet not ready", variant: "destructive" });
          return;
        }
        result = isBuy
          ? await buyToken(token.mint_address, numericAmount, solanaAddress, signAndSendTx, slippage * 100)
          : await sellToken(token.mint_address, numericAmount, tokenDecimals, solanaAddress, signAndSendTx, slippage * 100);
      } else {
        // PumpPortal route for bonding curve tokens
        const pumpResult = await pumpFunSwap(
          token.mint_address,
          numericAmount,
          isBuy,
          slippage,
        );
        result = { signature: pumpResult.signature, outputAmount: pumpResult.outputAmount };
      }

      setAmount('');
      setQuote(null);

      toast({
        title: `${isBuy ? 'Buy' : 'Sell'} successful!`,
        description: (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span>
              {result.outputAmount
                ? (isBuy
                  ? `Bought ${formatAmount(result.outputAmount)} ${token.ticker}`
                  : `Sold for ${formatAmount(result.outputAmount)} SOL`)
                : `${isBuy ? 'Buy' : 'Sell'} confirmed`}
            </span>
            {result.signature && (
              <a href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ),
      });
    } catch (error) {
      console.error('Trade error:', error);
      toast({
        title: "Trade failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buttonLoading = isLoading || swapLoading;

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      {/* Buy / Sell Toggle */}
      <div className="grid grid-cols-2">
        <button
          onClick={() => { setTradeType('buy'); setQuote(null); }}
          className={`py-3 text-sm font-bold font-mono uppercase tracking-widest transition-all ${
            isBuy
              ? 'bg-green-500/15 text-green-400 border-b-2 border-green-500'
              : 'bg-card/50 text-muted-foreground hover:text-foreground border-b border-border/40'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => { setTradeType('sell'); setQuote(null); }}
          className={`py-3 text-sm font-bold font-mono uppercase tracking-widest transition-all ${
            !isBuy
              ? 'bg-destructive/15 text-destructive border-b-2 border-destructive'
              : 'bg-card/50 text-muted-foreground hover:text-foreground border-b border-border/40'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Input */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {isBuy ? 'You Pay' : 'You Sell'}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              Bal: {isBuy 
                ? (solBalance !== null ? `${solBalance.toFixed(4)} SOL` : '—') 
                : `${formatAmount(userTokenBalance)} ${token.ticker}`}
            </span>
          </div>
          <div className="relative bg-background/60 border border-border/50 rounded-lg hover:border-border/80 focus-within:border-primary/50 transition-colors">
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-0 bg-transparent text-xl font-mono h-14 pr-16 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/30"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted-foreground">
              {isBuy ? 'SOL' : token.ticker}
            </span>
          </div>
        </div>

        {/* Quick Amounts */}
        <div className="flex gap-1.5">
          {isBuy
            ? quickBuyAmounts.map((v) => (
                <button
                  key={v}
                  onClick={() => handleQuickAmount(v)}
                  className="flex-1 text-[10px] font-mono py-1.5 rounded-full border border-border/40 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all bg-background/40"
                >
                  {v} SOL
                </button>
              ))
            : quickSellPct.map((v) => (
                <button
                  key={v}
                  onClick={() => handleQuickAmount(v)}
                  className="flex-1 text-[10px] font-mono py-1.5 rounded-full border border-border/40 text-muted-foreground hover:border-destructive/50 hover:text-destructive transition-all bg-background/40"
                >
                  {v}%
                </button>
              ))}
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="bg-secondary/50 p-1.5 rounded-full border border-border/30">
            <ArrowDown className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>

        {/* Output */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
            You Receive
          </span>
          <div className="bg-background/40 border border-border/30 rounded-lg p-4 flex justify-between items-center min-h-[60px]">
            <span className="text-xl font-mono font-bold">
              {quoteLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                numericAmount > 0 ? `${!useJupiterRoute ? '~' : ''}${formatAmount(outputAmount)}` : '0'
              )}
            </span>
            <span className="text-xs font-mono text-muted-foreground">{isBuy ? token.ticker : 'SOL'}</span>
          </div>
        </div>

        {/* Price Impact Warning */}
        {priceImpact > 5 && (
          <div className="flex items-center gap-2 p-2.5 bg-destructive/10 rounded-lg text-destructive text-xs font-mono border border-destructive/20">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>High price impact: {priceImpact.toFixed(2)}%</span>
          </div>
        )}

        {/* Trade Info */}
        {numericAmount > 0 && (useJupiterRoute ? quote : true) && (
          <div className="space-y-1.5 text-[10px] font-mono border-t border-border/30 pt-2.5">
            {quote && (
              <div className="flex justify-between text-muted-foreground">
                <span>Price Impact</span>
                <span className={priceImpact > 5 ? 'text-destructive' : 'text-foreground/70'}>{priceImpact.toFixed(2)}%</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Slippage</span>
              <span className="text-foreground/70">{slippage}%</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Route</span>
              <span className="text-accent-foreground">{useJupiterRoute ? 'Jupiter Aggregator' : 'PumpPortal'}</span>
            </div>
          </div>
        )}

        {/* Slippage Selector */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
            Slippage Tolerance
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {SLIPPAGE_PRESETS.map((v) => (
              <button
                key={v}
                onClick={() => handleSlippagePreset(v)}
                className={`text-[10px] font-mono px-2.5 py-1 rounded-full border transition-all ${
                  slippage === v && !showCustomSlippage
                    ? 'border-primary/60 bg-primary/10 text-primary'
                    : 'border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground bg-background/40'
                }`}
              >
                {v}%
              </button>
            ))}
            <button
              onClick={() => setShowCustomSlippage(!showCustomSlippage)}
              className={`text-[10px] font-mono px-2.5 py-1 rounded-full border transition-all ${
                showCustomSlippage
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground bg-background/40'
              }`}
            >
              Custom
            </button>
            {showCustomSlippage && (
              <div className="relative w-20">
                <Input
                  type="number"
                  placeholder="0.5"
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippage(e.target.value)}
                  className="h-6 text-[10px] font-mono pr-5 border-border/40 bg-background/40 rounded-full"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-mono">%</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        {!isAuthenticated ? (
          <Button className="w-full h-12 font-mono text-sm uppercase tracking-widest bg-green-500 hover:bg-green-600 text-white" onClick={() => login()}>
            <Wallet className="h-4 w-4 mr-2" />
            Connect Wallet
          </Button>
        ) : (
          <button
            onClick={handleTrade}
            disabled={buttonLoading || !numericAmount || (useJupiterRoute && (quoteLoading || !quote)) || !isWalletReady}
            className={`w-full h-12 rounded-lg font-mono text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              isBuy
                ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/40 hover:border-green-500/60 hover:shadow-[0_0_16px_hsl(142_60%_40%/0.25)]'
                : 'bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/40 hover:border-destructive/60 hover:shadow-[0_0_16px_hsl(var(--destructive)/0.25)]'
            }`}
          >
            {buttonLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : useJupiterRoute && quoteLoading ? (
              'Getting quote...'
            ) : useJupiterRoute && !quote && numericAmount > 0 ? (
              'No route found'
            ) : (
              `${isBuy ? 'Buy' : 'Sell'} ${token.ticker}`
            )}
          </button>
        )}

        {/* Jupiter Link */}
        <div className="text-center pt-0.5">
          <a
            href={`https://jup.ag/swap/SOL-${token.mint_address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-muted-foreground hover:text-accent-foreground inline-flex items-center gap-1 transition-colors"
          >
            Trade on Jupiter <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
