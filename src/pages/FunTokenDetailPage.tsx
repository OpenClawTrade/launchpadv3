import { useParams, Link } from "react-router-dom";
import { useFunToken } from "@/hooks/useFunToken";
import { usePoolState } from "@/hooks/usePoolState";
import { useAuth } from "@/hooks/useAuth";
import { useSolPrice } from "@/hooks/useSolPrice";
import { TradePanelWithSwap } from "@/components/launchpad/TradePanelWithSwap";
import { UniversalTradePanel } from "@/components/launchpad/UniversalTradePanel";
import { EmbeddedWalletCard } from "@/components/launchpad/EmbeddedWalletCard";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { 
  ExternalLink, 
  Copy, 
  Share2, 
  Globe, 
  Twitter, 
  MessageCircle,
  RefreshCw,
  ArrowLeft,
  Users,
  Timer,
  Briefcase,
  Zap,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BagsBadge } from "@/components/clawbook/BagsBadge";
import { PumpBadge } from "@/components/clawbook/PumpBadge";
import { PhantomBadge } from "@/components/clawbook/PhantomBadge";

const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD = 85;

function formatTokenAmount(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  return amount.toFixed(2);
}

function formatSolAmount(amount: number): string {
  if (!amount || amount === 0) return "0.00";
  if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
  return amount.toFixed(4);
}

export default function FunTokenDetailPage() {
  const { mintAddress } = useParams<{ mintAddress: string }>();
  const { solanaAddress } = useAuth();
  const { solPrice } = useSolPrice();
  const { toast } = useToast();

  const { data: token, isLoading, refetch } = useFunToken(mintAddress || '');

  const { data: livePoolState, refetch: refetchPoolState } = usePoolState({
    mintAddress: token?.mint_address || '',
    enabled: !!token?.mint_address && token?.status === 'active',
    refetchInterval: 60000,
  });

  const formatUsd = (marketCapSol: number) => {
    const usdValue = Number(marketCapSol || 0) * Number(solPrice || 0);
    if (!Number.isFinite(usdValue) || usdValue <= 0) return "$0";
    if (usdValue >= 1_000_000) return `$${(usdValue / 1_000_000).toFixed(2)}M`;
    if (usdValue >= 1_000) return `$${(usdValue / 1_000).toFixed(1)}K`;
    return `$${usdValue.toFixed(0)}`;
  };

  const copyAddress = () => {
    const address = token?.mint_address || mintAddress;
    if (address) {
      navigator.clipboard.writeText(address);
      toast({ title: "Address copied!" });
    }
  };

  const shareToken = () => {
    if (navigator.share && token) {
      navigator.share({
        title: `${token.name} ($${token.ticker})`,
        text: `Check out ${token.name} on TUNA!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied!" });
    }
  };

  const handleRefresh = () => {
    refetch();
    refetchPoolState();
    toast({ title: "Refreshed" });
  };

  const bondingProgress = livePoolState?.bondingProgress ?? token?.bonding_progress ?? 0;
  const realSolReserves = (bondingProgress / 100) * GRADUATION_THRESHOLD;
  const isGraduated = token?.status === 'graduated';
  const isBonding = token?.status === 'active';
  const priceChange = (token as any)?.price_change_24h || 0;
  const isPriceUp = priceChange >= 0;

  if (isLoading) {
    return (
      <LaunchpadLayout>
        <div className="space-y-3 max-w-5xl mx-auto">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Skeleton className="lg:col-span-2 h-96 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </LaunchpadLayout>
    );
  }

  if (!token) {
    return (
      <LaunchpadLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-2xl font-bold">Token not found</h2>
          <p className="text-muted-foreground mt-2">This token doesn't exist or has been removed.</p>
          <Link to="/" className="mt-4">
            <Button>Back to Launchpad</Button>
          </Link>
        </div>
      </LaunchpadLayout>
    );
  }

  const tokenForTradePanel = {
    id: token.id,
    mint_address: token.mint_address || '',
    name: token.name,
    ticker: token.ticker,
    description: token.description,
    image_url: token.image_url,
    website_url: token.website_url || null,
    twitter_url: token.twitter_url || null,
    telegram_url: token.telegram_url || null,
    discord_url: token.discord_url || null,
    creator_wallet: token.creator_wallet,
    creator_id: null,
    dbc_pool_address: token.dbc_pool_address,
    damm_pool_address: null,
    virtual_sol_reserves: 30,
    virtual_token_reserves: TOTAL_SUPPLY,
    real_sol_reserves: realSolReserves,
    real_token_reserves: 0,
    total_supply: TOTAL_SUPPLY,
    bonding_curve_progress: bondingProgress,
    graduation_threshold_sol: GRADUATION_THRESHOLD,
    price_sol: token.price_sol || 0,
    market_cap_sol: token.market_cap_sol || 0,
    volume_24h_sol: token.volume_24h_sol || 0,
    status: isBonding ? 'bonding' : (isGraduated ? 'graduated' : 'failed') as 'bonding' | 'graduated' | 'failed',
    migration_status: 'pending',
    holder_count: token.holder_count || 0,
    created_at: token.created_at,
    updated_at: token.updated_at,
    graduated_at: null,
    profiles: null,
  };

  return (
    <LaunchpadLayout showKingOfTheHill={true}>
      <div className="max-w-5xl mx-auto space-y-0">

        {/* ── TOKEN HEADER BAR ── */}
        <div className="flex items-center gap-3 px-0 py-3 border-b border-border/40">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <Avatar className="h-9 w-9 rounded-lg border border-border/50 shrink-0">
            <AvatarImage src={token.image_url || undefined} />
            <AvatarFallback className="rounded-lg text-xs font-bold bg-primary/10 text-primary">
              {(token.ticker || '??').slice(0, 2)}
            </AvatarFallback>
          </Avatar>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-bold text-sm font-mono truncate">{token.name}</span>
            <span className="text-muted-foreground text-xs font-mono shrink-0">${token.ticker}</span>

            {isGraduated && (
              <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                🎓 GRADUATED
              </span>
            )}
            {isBonding && (
              <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/20">
                ⚡ BONDING
              </span>
            )}
            {(token as any).fee_mode === 'holder_rewards' && (
              <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                💎 REWARDS
              </span>
            )}
            {(token as any).launchpad_type === 'bags' && (
              <BagsBadge mintAddress={token.mint_address || undefined} size="sm" />
            )}
            {(token as any).launchpad_type === 'pumpfun' && (
              <PumpBadge mintAddress={token.mint_address || undefined} size="sm" />
            )}
            {(token as any).launchpad_type === 'phantom' && (
              <PhantomBadge mintAddress={token.mint_address || undefined} size="sm" />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyAddress} title="Copy address">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={shareToken} title="Share">
              <Share2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ── STATS RIBBON ── */}
        <div className="grid grid-cols-4 divide-x divide-border/40 border-b border-border/40 bg-card/30">
          <div className="px-4 py-3">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-0.5">Mkt Cap</p>
            <p className="text-sm font-bold font-mono">{formatUsd(token.market_cap_sol || 0)}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-0.5">24h Vol</p>
            <p className="text-sm font-bold font-mono">{formatSolAmount(token.volume_24h_sol || 0)} <span className="text-[10px] text-muted-foreground">SOL</span></p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-0.5">Holders</p>
            <p className="text-sm font-bold font-mono">{(token.holder_count || 0).toLocaleString()}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-0.5">Price</p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold font-mono">{(token.price_sol || 0).toFixed(8)}</p>
              {priceChange !== 0 && (
                <span className={`text-[10px] font-mono flex items-center gap-0.5 ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                  {isPriceUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {Math.abs(priceChange).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── BONDING CURVE BAR ── */}
        {isBonding && (
          <div className="px-4 py-3 border-b border-border/40 bg-card/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Bonding Curve</span>
                {livePoolState && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-red-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
                    LIVE
                  </span>
                )}
              </div>
              <span className="text-xs font-bold font-mono text-warning">{bondingProgress.toFixed(1)}%</span>
            </div>
            <Progress 
              value={bondingProgress} 
              className="h-1.5 bg-secondary"
              style={{ 
                '--progress-glow': bondingProgress > 80 ? '0 0 8px hsl(var(--warning) / 0.6)' : 'none'
              } as any}
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] font-mono text-muted-foreground">{realSolReserves.toFixed(2)} SOL raised</span>
              <span className="text-[10px] font-mono text-muted-foreground">Goal: {GRADUATION_THRESHOLD} SOL</span>
            </div>
          </div>
        )}

        {/* ── SOCIAL LINKS + META ── */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border/40">
          {token.creator_wallet ? (
            <span className="text-[10px] font-mono text-muted-foreground">
              by <span className="text-foreground/70">{token.creator_wallet.slice(0, 6)}...{token.creator_wallet.slice(-4)}</span>
            </span>
          ) : (
            <span className="text-[10px] font-mono text-muted-foreground">by <span className="text-foreground/70">Unknown</span></span>
          )}

          <span className="text-border/60 text-xs">·</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {formatDistanceToNow(new Date(token.created_at), { addSuffix: true })}
          </span>

          {token.description && (
            <>
              <span className="text-border/60 text-xs hidden sm:inline">·</span>
              <span className="text-[10px] text-muted-foreground line-clamp-1 hidden sm:inline max-w-xs">{token.description}</span>
            </>
          )}

          <div className="flex items-center gap-1 ml-auto">
            {token.website_url && (
              <a href={token.website_url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-mono gap-1">
                  <Globe className="h-3 w-3" />Website
                </Button>
              </a>
            )}
            {token.twitter_url && (
              <a href={token.twitter_url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-mono gap-1">
                  <Twitter className="h-3 w-3" />Twitter
                </Button>
              </a>
            )}
            {token.telegram_url && (
              <a href={token.telegram_url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-mono gap-1">
                  <MessageCircle className="h-3 w-3" />TG
                </Button>
              </a>
            )}
            {token.mint_address && (
              <a href={`https://solscan.io/token/${token.mint_address}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-mono gap-1">
                  <ExternalLink className="h-3 w-3" />Solscan
                </Button>
              </a>
            )}
            <a
              href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}?chain=sol`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" className="h-6 px-2 text-[10px] font-mono gap-1 bg-accent hover:bg-accent/80 text-accent-foreground border-0">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                Axiom
              </Button>
            </a>
            {(token as any).launchpad_type === 'bags' && token.mint_address && (
              <a href={`https://bags.fm/coin/${token.mint_address}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="h-6 px-2 text-[10px] font-mono gap-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border-0">
                  <Briefcase className="h-3 w-3" />bags.fm
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* ── MAIN TRADING SECTION ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-4">
          {/* Trade Panel — 2/3 */}
          <div className="lg:col-span-2">
            {isBonding && (
              <TradePanelWithSwap token={tokenForTradePanel} userBalance={0} />
            )}
            {isGraduated && token.mint_address && (
              <UniversalTradePanel
                token={{ mint_address: token.mint_address, ticker: token.ticker, name: token.name, decimals: 9 }}
                userTokenBalance={0}
              />
            )}
            {!isBonding && !isGraduated && (
              <div className="border border-border/40 rounded-lg p-8 text-center">
                <p className="text-muted-foreground text-sm font-mono">Trading not available</p>
                <p className="text-muted-foreground text-xs mt-1">This token's status: {token.status}</p>
              </div>
            )}
          </div>

          {/* Wallet Sidebar — 1/3 */}
          <div className="lg:col-span-1">
            <EmbeddedWalletCard />
          </div>
        </div>

        {/* ── HOLDER REWARDS INFO ── */}
        {(token as any).fee_mode === 'holder_rewards' && (
          <div className="border border-border/40 rounded-lg p-4 mt-4">
            <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-green-400" />
              Holder Rewards
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">ACTIVE</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-secondary/20 rounded-lg p-3 border border-border/30">
                <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-mono mb-1">
                  <Timer className="h-3 w-3" /> DISTRIBUTION
                </div>
                <div className="text-sm font-bold font-mono text-green-400">Every 5 min</div>
              </div>
              <div className="bg-secondary/20 rounded-lg p-3 border border-border/30">
                <div className="text-muted-foreground text-[10px] font-mono mb-1">MIN HOLDING</div>
                <div className="text-sm font-bold font-mono">0.3%</div>
                <div className="text-[10px] font-mono text-muted-foreground">of supply</div>
              </div>
            </div>
            <div className="space-y-1.5 text-xs font-mono text-muted-foreground">
              <p className="flex items-center gap-2"><span className="text-green-400">✓</span> Top 50 holders share 50% of trading fees</p>
              <p className="flex items-center gap-2"><span className="text-green-400">✓</span> Proportional to token balance</p>
              <p className="flex items-center gap-2"><span className="text-green-400">✓</span> Automatic SOL payouts every 5 minutes</p>
            </div>
          </div>
        )}

        {/* ── CONTRACT INFO ── */}
        {token.mint_address && (
          <div className="border border-border/40 rounded-lg p-3 mt-4 mb-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-mono">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground uppercase tracking-wider">Contract</span>
                <code className="text-foreground/80">{token.mint_address.slice(0, 8)}...{token.mint_address.slice(-8)}</code>
                <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Copy className="h-3 w-3" />
                </button>
                <a href={`https://solscan.io/token/${token.mint_address}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {token.dbc_pool_address && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground uppercase tracking-wider">Pool</span>
                  <code className="text-foreground/80">{token.dbc_pool_address.slice(0, 8)}...{token.dbc_pool_address.slice(-8)}</code>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground uppercase tracking-wider">Supply</span>
                <span className="text-foreground/80">{formatTokenAmount(TOTAL_SUPPLY)}</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </LaunchpadLayout>
  );
}
