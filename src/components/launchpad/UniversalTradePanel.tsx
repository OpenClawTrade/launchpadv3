import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { useJupiterSwap } from "@/hooks/useJupiterSwap";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { ArrowDown, Loader2, Wallet, AlertTriangle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { VersionedTransaction } from "@solana/web3.js";

interface TokenInfo {
  mint_address: string;
  ticker: string;
  name: string;
  decimals?: number;
}

interface UniversalTradePanelProps {
  token: TokenInfo;
  userTokenBalance?: number;
}

export function UniversalTradePanel({ token, userTokenBalance = 0 }: UniversalTradePanelProps) {
  const { isAuthenticated, login, solanaAddress } = useAuth();
  const { getBuyQuote, getSellQuote, buyToken, sellToken, isLoading: swapLoading } = useJupiterSwap();
  const { getEmbeddedWallet, isWalletReady } = useSolanaWalletWithPrivy();

  // Create signTransaction function
  const signTransaction = useCallback(async (tx: VersionedTransaction): Promise<VersionedTransaction> => {
    const wallet = getEmbeddedWallet();
    if (!wallet) throw new Error("No embedded wallet connected");
    
    const provider = (wallet as any).getProvider?.() || (wallet as any).getSolanaProvider?.() || wallet;
    if (!provider?.signTransaction) throw new Error("Wallet does not support signing");
    
    return await provider.signTransaction(tx);
  }, [getEmbeddedWallet]);
  const { toast } = useToast();
  
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [slippage, setSlippage] = useState(5);
  const [quote, setQuote] = useState<{ outAmount: string; priceImpactPct: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const isBuy = tradeType === 'buy';
  const numericAmount = parseFloat(amount) || 0;
  const tokenDecimals = token.decimals || 9;

  // Fetch quote when amount changes
  useEffect(() => {
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
          setQuote({
            outAmount: result.outAmount,
            priceImpactPct: result.priceImpactPct,
          });
        } else {
          setQuote(null);
        }
      } catch (error) {
        console.error('Quote error:', error);
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [numericAmount, isBuy, token.mint_address, tokenDecimals, slippage, getBuyQuote, getSellQuote]);

  // Calculate output amount
  const outputAmount = quote 
    ? parseInt(quote.outAmount) / (10 ** (isBuy ? tokenDecimals : 9))
    : 0;
  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;

  // Quick amount buttons
  const quickAmounts = isBuy
    ? [0.1, 0.5, 1, 5]
    : [25, 50, 75, 100]; // percentages for sell

  const handleQuickAmount = (value: number) => {
    if (isBuy) {
      setAmount(value.toString());
    } else {
      const tokenAmount = (userTokenBalance * value) / 100;
      setAmount(tokenAmount.toString());
    }
  };

  const formatAmount = (amt: number, decimals: number = 4) => {
    if (amt >= 1_000_000) return `${(amt / 1_000_000).toFixed(2)}M`;
    if (amt >= 1_000) return `${(amt / 1_000).toFixed(2)}K`;
    return amt.toFixed(decimals);
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

    if (!signTransaction) {
      toast({ title: "Wallet not ready", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const result = isBuy
        ? await buyToken(
            token.mint_address,
            numericAmount,
            solanaAddress,
            signTransaction,
            slippage * 100
          )
        : await sellToken(
            token.mint_address,
            numericAmount,
            tokenDecimals,
            solanaAddress,
            signTransaction,
            slippage * 100
          );

      setAmount('');
      setQuote(null);
      
      toast({ 
        title: `${isBuy ? 'Buy' : 'Sell'} successful!`,
        description: (
          <div className="flex items-center gap-2">
            <span>
              {isBuy 
                ? `Bought ${formatAmount(result.outputAmount)} ${token.ticker}`
                : `Sold for ${formatAmount(result.outputAmount)} SOL`}
            </span>
            {result.signature && (
              <a 
                href={`https://solscan.io/tx/${result.signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-primary hover:underline"
              >
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
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buttonLoading = isLoading || swapLoading;

  return (
    <Card className="p-4">
      <Tabs value={tradeType} onValueChange={(v) => { setTradeType(v as 'buy' | 'sell'); setQuote(null); }}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="buy" className="flex-1 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-500">
            Buy
          </TabsTrigger>
          <TabsTrigger value="sell" className="flex-1 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500">
            Sell
          </TabsTrigger>
        </TabsList>

        <div className="space-y-4">
          {/* Input */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {isBuy ? 'You pay' : 'You sell'}
              </span>
              <span className="text-muted-foreground">
                Balance: {isBuy ? '—' : formatAmount(userTokenBalance)} {isBuy ? 'SOL' : token.ticker}
              </span>
            </div>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16 text-lg h-14"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                {isBuy ? 'SOL' : token.ticker}
              </span>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2">
            {quickAmounts.map((value) => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleQuickAmount(value)}
              >
                {isBuy ? `${value} SOL` : `${value}%`}
              </Button>
            ))}
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="bg-secondary p-2 rounded-full">
              <ArrowDown className="h-4 w-4" />
            </div>
          </div>

          {/* Output */}
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">
              You receive
            </span>
            <div className="bg-secondary rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">
                  {quoteLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    numericAmount > 0 ? formatAmount(outputAmount) : '0'
                  )}
                </span>
                <span className="text-muted-foreground font-medium">
                  {isBuy ? token.ticker : 'SOL'}
                </span>
              </div>
            </div>
          </div>

          {/* Price Impact Warning */}
          {priceImpact > 5 && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>High price impact: {priceImpact.toFixed(2)}%</span>
            </div>
          )}

          {/* Trade Info */}
          {numericAmount > 0 && quote && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price Impact</span>
                <span className={priceImpact > 5 ? 'text-destructive' : ''}>{priceImpact.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slippage</span>
                <span>{slippage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Route</span>
                <span className="text-primary">Jupiter Aggregator</span>
              </div>
            </div>
          )}

          {/* Slippage */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Slippage Tolerance</span>
              <span>{slippage}%</span>
            </div>
            <Slider
              value={[slippage]}
              onValueChange={([v]) => setSlippage(v)}
              min={0.5}
              max={20}
              step={0.5}
              className="w-full"
            />
          </div>

          {/* Action Button */}
          {!isAuthenticated ? (
            <Button className="w-full h-12" onClick={() => login()}>
              <Wallet className="h-4 w-4 mr-2" />
              Connect Wallet
            </Button>
          ) : (
            <Button
              className={`w-full h-12 font-bold ${isBuy ? 'bg-primary hover:bg-primary/90' : 'bg-destructive hover:bg-destructive/90'}`}
              onClick={handleTrade}
              disabled={buttonLoading || !numericAmount || quoteLoading || !quote || !isWalletReady}
            >
              {buttonLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : quoteLoading ? (
                'Getting quote...'
              ) : !quote && numericAmount > 0 ? (
                'No route found'
              ) : (
                `${isBuy ? 'Buy' : 'Sell'} ${token.ticker}`
              )}
            </Button>
          )}

          {/* Jupiter Link */}
          <div className="text-center">
            <a 
              href={`https://jup.ag/swap/SOL-${token.mint_address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              Trade on Jupiter <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Tabs>
    </Card>
  );
}
