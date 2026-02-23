import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Token, calculateBuyQuote, calculateSellQuote, formatTokenAmount, formatSolAmount, useLaunchpad } from "@/hooks/useLaunchpad";
import { useAuth } from "@/hooks/useAuth";
import { ArrowDown, Loader2, Wallet, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TradePanelWithSwapProps {
  token: Token;
  userBalance?: number;
}

const SLIPPAGE_PRESETS = [0.5, 1, 2, 5, 10];

export function TradePanelWithSwap({ token, userBalance = 0 }: TradePanelWithSwapProps) {
  const { isAuthenticated, login, solanaAddress, profileId } = useAuth();
  const { executeSwap } = useLaunchpad();
  const { toast } = useToast();
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [slippage, setSlippage] = useState(5);
  const [customSlippage, setCustomSlippage] = useState<string>('');
  const [showCustomSlippage, setShowCustomSlippage] = useState(false);

  const isBuy = tradeType === 'buy';
  const numericAmount = parseFloat(amount) || 0;

  const virtualSol = (token.virtual_sol_reserves || 30) + (token.real_sol_reserves || 0);
  const virtualToken = (token.virtual_token_reserves || 1_000_000_000) - (token.real_token_reserves || 0);

  const buyQuote = calculateBuyQuote(numericAmount, virtualSol, virtualToken);
  const sellQuote = calculateSellQuote(numericAmount, virtualSol, virtualToken);

  const outputAmount = isBuy ? buyQuote.tokensOut : sellQuote.solOut;
  const priceImpact = isBuy ? buyQuote.priceImpact : sellQuote.priceImpact;
  const newPrice = isBuy ? buyQuote.newPrice : sellQuote.newPrice;

  const quickBuyAmounts = [0.1, 0.5, 1, 5];
  const quickSellPct = [25, 50, 75, 100];

  const handleQuickAmount = (value: number) => {
    if (isBuy) {
      setAmount(value.toString());
    } else {
      const tokenAmount = (userBalance * value) / 100;
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
    if (!isNaN(num) && num > 0 && num <= 50) {
      setSlippage(num);
    }
  };

  const handleTrade = async () => {
    const tradeAmount = parseFloat(amount);
    console.log("[TradePanelWithSwap] handleTrade called, amount state:", amount, "parsed:", tradeAmount);
    if (!tradeAmount || tradeAmount <= 0 || isNaN(tradeAmount)) {
      toast({ title: "Invalid amount", description: `Entered: "${amount}", parsed: ${tradeAmount}`, variant: "destructive" });
      return;
    }
    if (!isBuy && tradeAmount > userBalance) {
      toast({ title: "Insufficient token balance", variant: "destructive" });
      return;
    }
    if (!solanaAddress) {
      toast({ title: "Please connect your wallet", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const result = await executeSwap.mutateAsync({
        mintAddress: token.mint_address,
        userWallet: solanaAddress,
        amount: tradeAmount,
        isBuy,
        profileId: profileId || undefined,
      });

      setAmount('');
      toast({
        title: `${isBuy ? 'Buy' : 'Sell'} successful!`,
        description: (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span>
              {isBuy
                ? `Bought ${formatTokenAmount(result.tokensOut || 0)} ${token.ticker}`
                : `Sold for ${formatSolAmount(result.solOut || 0)} SOL`}
            </span>
            {result.signature && !result.signature.startsWith('pending_') && (
              <a href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                View TX ↗
              </a>
            )}
          </div>
        ),
      });

      if (result.graduated) {
        toast({
          title: "🎓 Token Graduated!",
          description: "This token has reached the graduation threshold and will migrate to DEX!",
        });
      }
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

  const isGraduated = token.status === 'graduated';

  if (isGraduated) {
    return (
      <div className="border border-border/40 rounded-lg p-8 text-center space-y-4">
        <div className="text-4xl">🎓</div>
        <h3 className="font-bold text-sm font-mono uppercase tracking-widest">Token Graduated</h3>
        <p className="text-muted-foreground text-xs font-mono">
          This token has graduated to the DEX. Trade on Jupiter or other DEX aggregators.
        </p>
        <Button
          className="w-full h-10 font-mono text-xs uppercase tracking-widest"
          onClick={() => window.open(`https://jup.ag/swap/SOL-${token.mint_address}`, '_blank')}
        >
          Trade on Jupiter
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      {/* Buy / Sell Toggle */}
      <div className="grid grid-cols-2">
        <button
          onClick={() => setTradeType('buy')}
          className={`py-3 text-sm font-bold font-mono uppercase tracking-widest transition-all ${
            isBuy
              ? 'bg-green-500/15 text-green-400 border-b-2 border-green-500'
              : 'bg-card/50 text-muted-foreground hover:text-foreground border-b border-border/40'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setTradeType('sell')}
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
        {/* Input Field */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {isBuy ? 'You Pay' : 'You Sell'}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              Bal: {isBuy ? '—' : formatTokenAmount(userBalance)} {isBuy ? 'SOL' : token.ticker}
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

        {/* Output Field */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
            You Receive
          </span>
          <div className="bg-background/40 border border-border/30 rounded-lg p-4 flex justify-between items-center">
            <span className="text-xl font-mono font-bold">
              {numericAmount > 0
                ? isBuy
                  ? formatTokenAmount(outputAmount)
                  : formatSolAmount(outputAmount)
                : '0'}
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
        {numericAmount > 0 && (
          <div className="space-y-1.5 text-[10px] font-mono border-t border-border/30 pt-2.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Price</span>
              <span className="text-foreground/70">{formatSolAmount(newPrice)} SOL / {token.ticker}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Price Impact</span>
              <span className={priceImpact > 5 ? 'text-destructive' : 'text-foreground/70'}>{priceImpact.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Fee</span>
              <span className="text-foreground/70">2%</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Slippage</span>
              <span className="text-foreground/70">{slippage}%</span>
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
          <Button
            className="w-full h-12 font-mono text-sm uppercase tracking-widest border-0 bg-green-500 hover:bg-green-600 text-white"
            onClick={() => login()}
          >
            <Wallet className="h-4 w-4 mr-2" />
            Connect Wallet
          </Button>
        ) : (
          <button
            onClick={handleTrade}
            disabled={isLoading || !numericAmount}
            className={`w-full h-12 rounded-lg font-mono text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              isBuy
                ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/40 hover:border-green-500/60 hover:shadow-[0_0_16px_hsl(142_60%_40%/0.25)]'
                : 'bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/40 hover:border-destructive/60 hover:shadow-[0_0_16px_hsl(var(--destructive)/0.25)]'
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `${isBuy ? 'Buy' : 'Sell'} ${token.ticker}`
            )}
          </button>
        )}
      </div>
    </div>
  );
}
