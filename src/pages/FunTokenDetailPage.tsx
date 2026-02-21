import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useFunToken } from "@/hooks/useFunToken";
import { usePoolState } from "@/hooks/usePoolState";
import { useAuth } from "@/hooks/useAuth";
import { useSolPrice } from "@/hooks/useSolPrice";
import { TradePanelWithSwap } from "@/components/launchpad/TradePanelWithSwap";
import { UniversalTradePanel } from "@/components/launchpad/UniversalTradePanel";
import { EmbeddedWalletCard } from "@/components/launchpad/EmbeddedWalletCard";
import { TokenComments } from "@/components/launchpad/TokenComments";
import { LightweightChart } from "@/components/launchpad/LightweightChart";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Shield,
  Lock,
  Activity,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTwitterProfile } from "@/hooks/useTwitterProfile";
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
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [mobileTab, setMobileTab] = useState<'trade' | 'chart' | 'comments'>('trade');

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
        text: `Check out ${token.name} on Claw Mode!`,
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

  const { data: twitterProfile } = useTwitterProfile(token?.launch_author);

  // Loading
  if (isLoading) {
    return (
      <LaunchpadLayout>
        <div className="terminal-bg min-h-screen p-4">
          <div className="max-w-7xl mx-auto space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Skeleton className="lg:col-span-3 h-96 rounded-xl" />
              <Skeleton className="lg:col-span-6 h-96 rounded-xl" />
              <Skeleton className="lg:col-span-3 h-96 rounded-xl" />
            </div>
          </div>
        </div>
      </LaunchpadLayout>
    );
  }

  // Not found
  if (!token) {
    return (
      <LaunchpadLayout>
        <div className="terminal-bg min-h-screen flex flex-col items-center justify-center py-20">
          <h2 className="text-2xl font-bold font-mono">Token not found</h2>
          <p className="text-muted-foreground mt-2 font-mono text-sm">This token doesn't exist or has been removed.</p>
          <Link to="/" className="mt-4">
            <Button className="btn-terminal-cta px-6 py-2">Back to Terminal</Button>
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
    <LaunchpadLayout>
      <div className="terminal-bg min-h-screen -m-4 p-4">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* ═══════════════════════════════════════════════ */}
          {/* HERO HEADER — Axiom-style gateway               */}
          {/* ═══════════════════════════════════════════════ */}
          <div className="terminal-panel p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
              {/* Back + Avatar + Name */}
              <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                <Link to="/">
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <Avatar className="h-14 w-14 md:h-[72px] md:w-[72px] rounded-xl border-2 border-border/50 shrink-0 shadow-lg">
                  <AvatarImage src={token.image_url || undefined} className="object-cover" />
                  <AvatarFallback className="rounded-xl text-lg font-bold bg-primary/10 text-primary font-mono">
                    {(token.ticker || '??').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl md:text-2xl font-bold font-mono tracking-tight truncate">{token.name}</h1>
                    <span className="text-sm md:text-base font-mono text-muted-foreground">${token.ticker}</span>
                    {isGraduated && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                        🎓 GRADUATED
                      </span>
                    )}
                    {isBonding && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/20 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>

                  {/* Creator attribution */}
                  <div className="flex items-center gap-2 mt-1">
                    {token.launch_author ? (
                      <div className="flex items-center gap-1.5">
                        {twitterProfile?.profileImageUrl && (
                          <img src={twitterProfile.profileImageUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                        )}
                        <span className="text-[11px] font-mono text-muted-foreground">by</span>
                        <a
                          href={`https://x.com/${token.launch_author}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-foreground/80 hover:text-primary transition-colors flex items-center gap-0.5"
                        >
                          @{token.launch_author}
                          {twitterProfile?.verified && (
                            <svg className="h-3.5 w-3.5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                            </svg>
                          )}
                        </a>
                      </div>
                    ) : token.creator_wallet ? (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        by <span className="text-foreground/70">{token.creator_wallet.slice(0, 6)}...{token.creator_wallet.slice(-4)}</span>
                      </span>
                    ) : null}
                    <span className="text-muted-foreground/40 text-xs">·</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {formatDistanceToNow(new Date(token.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Price + Trust pills + CTA */}
              <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                {/* Price large */}
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl md:text-3xl font-bold font-mono terminal-stat-teal teal-glow">
                    {formatUsd(token.market_cap_sol || 0)}
                  </span>
                  {priceChange !== 0 && (
                    <span className={`text-sm font-mono flex items-center gap-0.5 ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                      {isPriceUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {Math.abs(priceChange).toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* Trust pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="terminal-trust-pill">
                    <Shield className="h-3 w-3" /> Non-Custodial
                  </span>
                  <span className="terminal-trust-pill">
                    <Lock className="h-3 w-3" /> MEV Protected
                  </span>
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

                {/* Action icons */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleRefresh} title="Refresh">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={copyAddress} title="Copy address">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={shareToken} title="Share">
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  {token.website_url && (
                    <a href={token.website_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><Globe className="h-3.5 w-3.5" /></Button>
                    </a>
                  )}
                  {token.twitter_url && (
                    <a href={token.twitter_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><Twitter className="h-3.5 w-3.5" /></Button>
                    </a>
                  )}
                  {token.telegram_url && (
                    <a href={token.telegram_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><MessageCircle className="h-3.5 w-3.5" /></Button>
                    </a>
                  )}
                  {token.mint_address && (
                    <a href={`https://solscan.io/token/${token.mint_address}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></Button>
                    </a>
                  )}
                  <a href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}?chain=sol`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="h-8 px-3 text-[11px] font-mono gap-1 bg-accent hover:bg-accent/80 text-accent-foreground rounded-lg">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                      Axiom
                    </Button>
                  </a>
                  {(token as any).launchpad_type === 'bags' && token.mint_address && (
                    <a href={`https://bags.fm/coin/${token.mint_address}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="h-8 px-3 text-[11px] font-mono gap-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg">
                        <Briefcase className="h-3 w-3" />bags.fm
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════ */}
          {/* STATS RIBBON                                     */}
          {/* ═══════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border/20 terminal-panel overflow-hidden">
            {[
              { label: 'Market Cap', value: formatUsd(token.market_cap_sol || 0), accent: true },
              { label: '24h Volume', value: `${formatSolAmount(token.volume_24h_sol || 0)} SOL` },
              { label: 'Holders', value: (token.holder_count || 0).toLocaleString() },
              { label: 'Price (SOL)', value: (token.price_sol || 0).toFixed(8) },
              { label: 'Supply', value: formatTokenAmount(TOTAL_SUPPLY) },
            ].map((stat, i) => (
              <div key={i} className="px-4 py-3 bg-card/30">
                <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-mono mb-0.5">{stat.label}</p>
                <p className={`text-sm font-bold font-mono ${stat.accent ? 'terminal-stat-teal' : ''}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════ */}
          {/* BONDING CURVE PROGRESS                           */}
          {/* ═══════════════════════════════════════════════ */}
          {isBonding && (
            <div className="terminal-panel p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 terminal-stat-orange" />
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Bonding Progress</span>
                  {livePoolState && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-red-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold font-mono terminal-stat-orange">{bondingProgress.toFixed(1)}%</span>
              </div>
              <div className="relative h-2.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(bondingProgress, 100)}%`,
                    background: bondingProgress >= 80
                      ? 'linear-gradient(90deg, hsl(24 95% 53%), hsl(0 72% 55%))'
                      : 'linear-gradient(90deg, hsl(187 80% 53%), hsl(160 84% 39%))',
                    boxShadow: bondingProgress >= 80 ? '0 0 12px hsl(24 95% 53% / 0.5)' : '0 0 12px hsl(187 80% 53% / 0.3)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] font-mono text-muted-foreground">{realSolReserves.toFixed(2)} SOL raised</span>
                <span className="text-[10px] font-mono text-muted-foreground">Goal: {GRADUATION_THRESHOLD} SOL</span>
              </div>
            </div>
          )}

          {/* Description (collapsible) */}
          {token.description && (
            <div className="terminal-panel p-4">
              <p className={`text-sm text-muted-foreground font-mono leading-relaxed ${!showFullDesc ? 'line-clamp-2' : ''}`}>
                {token.description}
              </p>
              {token.description.length > 120 && (
                <button
                  onClick={() => setShowFullDesc(!showFullDesc)}
                  className="text-[11px] font-mono text-accent-foreground hover:underline mt-1 flex items-center gap-0.5"
                >
                  {showFullDesc ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Read more</>}
                </button>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════ */}
          {/* MOBILE TAB SWITCHER                              */}
          {/* ═══════════════════════════════════════════════ */}
          <div className="lg:hidden">
            <div className="grid grid-cols-3 gap-1 terminal-panel p-1">
              {(['trade', 'chart', 'comments'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMobileTab(tab)}
                  className={`py-2.5 text-xs font-mono uppercase tracking-widest rounded-lg transition-all ${
                    mobileTab === tab
                      ? 'bg-primary/15 text-primary font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'trade' && <Activity className="h-3.5 w-3.5 inline mr-1" />}
                  {tab === 'chart' && <BarChart3 className="h-3.5 w-3.5 inline mr-1" />}
                  {tab === 'comments' && <MessageCircle className="h-3.5 w-3.5 inline mr-1" />}
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════ */}
          {/* THREE-COLUMN DESKTOP LAYOUT                      */}
          {/* ═══════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

            {/* LEFT COLUMN — Token Info + Wallet (desktop) / Hidden on mobile */}
            <div className="hidden lg:block lg:col-span-3 space-y-4">
              {/* Token Info Card */}
              <div className="terminal-panel p-4 space-y-3">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5" /> Token Info
                </h3>
                <div className="space-y-2">
                  {[
                    { label: 'Price (SOL)', value: (token.price_sol || 0).toFixed(8) },
                    { label: 'Market Cap', value: formatUsd(token.market_cap_sol || 0) },
                    { label: '24h Volume', value: `${formatSolAmount(token.volume_24h_sol || 0)} SOL` },
                    { label: 'Holders', value: (token.holder_count || 0).toLocaleString() },
                    { label: 'Total Supply', value: formatTokenAmount(TOTAL_SUPPLY) },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between text-[11px] font-mono py-1.5 border-b border-border/20 last:border-0">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="text-foreground/90 font-medium">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contract Info */}
              {token.mint_address && (
                <div className="terminal-panel p-4 space-y-2">
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Contract</h3>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono text-foreground/80 truncate flex-1">
                      {token.mint_address.slice(0, 12)}...{token.mint_address.slice(-6)}
                    </code>
                    <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {token.dbc_pool_address && (
                    <>
                      <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground mt-2">Pool</h3>
                      <code className="text-[11px] font-mono text-foreground/80 truncate block">
                        {token.dbc_pool_address.slice(0, 12)}...{token.dbc_pool_address.slice(-6)}
                      </code>
                    </>
                  )}
                </div>
              )}

              {/* Holder Rewards */}
              {(token as any).fee_mode === 'holder_rewards' && (
                <div className="terminal-panel p-4 space-y-3">
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-green-400" /> Holder Rewards
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">ACTIVE</span>
                  </h3>
                  <div className="space-y-1.5 text-[11px] font-mono text-muted-foreground">
                    <p className="flex items-center gap-2"><span className="text-green-400">✓</span> Top 50 holders share 50% of fees</p>
                    <p className="flex items-center gap-2"><span className="text-green-400">✓</span> Proportional to token balance</p>
                    <p className="flex items-center gap-2"><span className="text-green-400">✓</span> Auto SOL payouts every 5 min</p>
                  </div>
                </div>
              )}

              {/* Wallet */}
              <EmbeddedWalletCard />
            </div>

            {/* CENTER COLUMN — Chart + Trade */}
            <div className={`lg:col-span-6 space-y-4 ${mobileTab !== 'trade' && mobileTab !== 'chart' ? 'hidden lg:block' : ''}`}>
              {/* Chart */}
              <div className={`terminal-panel p-0 overflow-hidden ${mobileTab === 'trade' ? 'hidden lg:block' : ''}`}>
                <div className="px-4 py-2.5 border-b border-border/20 flex items-center justify-between">
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="h-3.5 w-3.5" /> Price Chart
                  </h3>
                  <div className="flex items-center gap-1">
                    {['1H', '4H', '1D', '1W'].map(tf => (
                      <button key={tf} className="text-[10px] font-mono px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
                <LightweightChart
                  data={[]}
                  chartType="area"
                  height={360}
                  isPositive={isPriceUp}
                />
              </div>

              {/* Trade Panel */}
              <div className={`${mobileTab === 'chart' ? 'hidden lg:block' : ''}`}>
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
                  <div className="terminal-panel p-8 text-center">
                    <p className="text-muted-foreground text-sm font-mono">Trading not available</p>
                    <p className="text-muted-foreground text-xs font-mono mt-1">Status: {token.status}</p>
                  </div>
                )}
              </div>

              {/* Mobile: wallet card below trade */}
              <div className="lg:hidden">
                {mobileTab === 'trade' && <EmbeddedWalletCard />}
              </div>
            </div>

            {/* RIGHT COLUMN — Comments */}
            <div className={`lg:col-span-3 ${mobileTab !== 'comments' ? 'hidden lg:block' : ''}`}>
              <div className="terminal-panel p-4">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2 mb-4">
                  <MessageCircle className="h-3.5 w-3.5" /> Discussion
                </h3>
                <TokenComments tokenId={token.id} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </LaunchpadLayout>
  );
}
