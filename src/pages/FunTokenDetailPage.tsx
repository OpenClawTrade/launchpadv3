import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useFunToken } from "@/hooks/useFunToken";
import { usePoolState } from "@/hooks/usePoolState";
import { useAuth } from "@/hooks/useAuth";
import { useSolPrice } from "@/hooks/useSolPrice";
import { TradePanelWithSwap } from "@/components/launchpad/TradePanelWithSwap";
import { UniversalTradePanel } from "@/components/launchpad/UniversalTradePanel";
import { EmbeddedWalletCard } from "@/components/launchpad/EmbeddedWalletCard";
import { TokenComments } from "@/components/launchpad/TokenComments";
import { LightweightChart, type ChartMarker } from "@/components/launchpad/LightweightChart";
import { DexscreenerChart } from "@/components/launchpad/DexscreenerChart";
import { useBitqueryOHLC } from "@/hooks/useBitqueryOHLC";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import {
  ExternalLink, Copy, Share2, Globe, Twitter, MessageCircle,
  RefreshCw, ArrowLeft, Users, Briefcase, Zap, TrendingUp,
  TrendingDown, Shield, Lock, Activity, BarChart3, ChevronDown,
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
  const [chartInterval, setChartInterval] = useState<"1m" | "5m" | "15m" | "1h" | "4h" | "1d">("5m");
  const [chartType, setChartType] = useState<"candlestick" | "area">("candlestick");

  const { data: token, isLoading, refetch } = useFunToken(mintAddress || '');
  const { data: livePoolState, refetch: refetchPoolState } = usePoolState({
    mintAddress: token?.mint_address || '',
    enabled: !!token?.mint_address && token?.status === 'active',
    refetchInterval: 60000,
  });

  // Bitquery OHLC data
  const { data: bitqueryData } = useBitqueryOHLC(
    mintAddress || null,
    chartInterval
  );

  const chartData = useMemo(() => {
    if (!bitqueryData?.candles?.length) return [];
    if (chartType === "candlestick") return bitqueryData.candles;
    return bitqueryData.candles.map(c => ({ time: c.time, value: c.close }));
  }, [bitqueryData, chartType]);

  const chartMarkers = useMemo((): ChartMarker[] => {
    if (!bitqueryData?.migration) return [];
    return [{ time: bitqueryData.migration.time, label: bitqueryData.migration.label, color: "#F97316" }];
  }, [bitqueryData]);

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
        <div className="terminal-bg min-h-screen p-2">
          <div className="max-w-[1600px] mx-auto space-y-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
              <Skeleton className="lg:col-span-9 h-[70vh] rounded-lg" />
              <Skeleton className="hidden lg:block lg:col-span-3 h-[70vh] rounded-lg" />
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
          <h2 className="text-lg font-bold font-mono">Token not found</h2>
          <p className="text-muted-foreground mt-1 font-mono text-xs">This token doesn't exist or has been removed.</p>
          <Link to="/" className="mt-3">
            <Button className="btn-terminal-cta px-4 py-1.5 text-xs">Back to Terminal</Button>
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

  const stats = [
    { label: 'MCAP', value: formatUsd(token.market_cap_sol || 0), accent: true },
    { label: 'VOL 24H', value: `${formatSolAmount(token.volume_24h_sol || 0)} SOL` },
    { label: 'HOLDERS', value: (token.holder_count || 0).toLocaleString() },
    { label: 'PRICE', value: `${(token.price_sol || 0).toFixed(8)} SOL` },
    { label: 'SUPPLY', value: formatTokenAmount(TOTAL_SUPPLY) },
  ];

  return (
    <LaunchpadLayout>
      {/* Solid navy bg, no matrix bleed */}
      <div className="min-h-screen -m-4 p-2 md:p-3" style={{ backgroundColor: 'hsl(222 47% 7%)' }}>
        <div className="max-w-[1600px] mx-auto flex flex-col gap-1.5 lg:gap-1.5 pb-20 lg:pb-4">

          {/* ──── TOP BAR: Token identity + stats + actions ──── */}
          <div className="terminal-panel-flush flex items-center gap-2 px-3 py-2 md:py-1.5 rounded-lg">
            {/* Back */}
            <Link to="/" className="shrink-0">
              <Button variant="ghost" size="icon" className="h-9 w-9 md:h-7 md:w-7 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </Button>
            </Link>

            {/* Avatar + Name */}
            <Avatar className="h-9 w-9 md:h-8 md:w-8 rounded-lg border border-border/40 shrink-0">
              <AvatarImage src={token.image_url || undefined} className="object-cover" />
              <AvatarFallback className="rounded-lg text-[10px] font-bold bg-primary/10 text-primary font-mono">
                {(token.ticker || '??').slice(0, 2)}
              </AvatarFallback>
            </Avatar>

            <div className="flex items-center gap-1.5 min-w-0 shrink-0">
              <h1 className="text-sm md:text-sm font-bold font-mono tracking-tight truncate max-w-[120px] md:max-w-none">{token.name}</h1>
              <span className="text-xs md:text-[11px] font-mono text-muted-foreground">${token.ticker}</span>
              {isGraduated && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20">GRAD</span>
              )}
              {isBonding && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/20 flex items-center gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />LIVE
                </span>
              )}
            </div>

            {/* Inline stats — desktop only */}
            <div className="hidden md:flex items-center gap-3 ml-3 flex-1 min-w-0">
              {stats.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[9px] font-mono text-muted-foreground/70 uppercase">{s.label}</span>
                  <span className={`text-[11px] font-mono font-semibold ${s.accent ? 'terminal-stat-teal' : 'text-foreground/90'}`}>{s.value}</span>
                </div>
              ))}
              {priceChange !== 0 && (
                <span className={`text-[11px] font-mono flex items-center gap-0.5 ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                  {isPriceUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(priceChange).toFixed(1)}%
                </span>
              )}
            </div>

            {/* Creator — desktop only */}
            <div className="hidden lg:flex items-center gap-1.5 shrink-0">
              {token.launch_author ? (
                <a
                  href={`https://x.com/${token.launch_author}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  {twitterProfile?.profileImageUrl && (
                    <img src={twitterProfile.profileImageUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                  )}
                  @{token.launch_author}
                  {twitterProfile?.verified && (
                    <svg className="h-3 w-3 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                    </svg>
                  )}
                </a>
              ) : token.creator_wallet ? (
                <span className="text-[10px] font-mono text-muted-foreground">
                  {token.creator_wallet.slice(0, 4)}...{token.creator_wallet.slice(-4)}
                </span>
              ) : null}
            </div>

            {/* Trust pills — xl only */}
            <div className="hidden xl:flex items-center gap-1 shrink-0">
              <span className="text-[8px] font-mono px-1.5 py-px rounded bg-accent/10 text-accent-foreground border border-accent/20 flex items-center gap-0.5">
                <Shield className="h-2.5 w-2.5" /> NON-CUSTODIAL
              </span>
              <span className="text-[8px] font-mono px-1.5 py-px rounded bg-accent/10 text-accent-foreground border border-accent/20 flex items-center gap-0.5">
                <Lock className="h-2.5 w-2.5" /> MEV PROTECTED
              </span>
            </div>

            {/* Action buttons — show fewer on mobile */}
            <div className="flex items-center gap-0.5 shrink-0 ml-auto">
              <Button variant="ghost" size="icon" className="h-9 w-9 md:h-7 md:w-7 text-muted-foreground hover:text-foreground" onClick={handleRefresh}><RefreshCw className="h-4 w-4 md:h-3 md:w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 md:h-7 md:w-7 text-muted-foreground hover:text-foreground" onClick={copyAddress}><Copy className="h-4 w-4 md:h-3 md:w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 md:h-7 md:w-7 text-muted-foreground hover:text-foreground" onClick={shareToken}><Share2 className="h-4 w-4 md:h-3 md:w-3" /></Button>
              {/* Hide some links on mobile to reduce clutter */}
              <div className="hidden md:flex items-center gap-0.5">
                {token.website_url && <a href={token.website_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"><Globe className="h-3 w-3" /></Button></a>}
                {token.twitter_url && <a href={token.twitter_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"><Twitter className="h-3 w-3" /></Button></a>}
                {token.telegram_url && <a href={token.telegram_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"><MessageCircle className="h-3 w-3" /></Button></a>}
                {token.mint_address && <a href={`https://solscan.io/token/${token.mint_address}`} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /></Button></a>}
              </div>
              <a href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}?chain=sol`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="h-9 md:h-7 px-2.5 md:px-2 text-[10px] md:text-[9px] font-mono gap-0.5 bg-accent/15 hover:bg-accent/25 text-accent-foreground rounded">
                  <svg className="h-3 w-3 md:h-2.5 md:w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                  Axiom
                </Button>
              </a>
              {(token as any).launchpad_type === 'bags' && token.mint_address && (
                <a href={`https://bags.fm/coin/${token.mint_address}`} target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex">
                  <Button size="sm" className="h-7 px-2 text-[9px] font-mono gap-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded">
                    <Briefcase className="h-2.5 w-2.5" />bags
                  </Button>
                </a>
              )}
              <div className="hidden md:flex items-center gap-0.5">
                {(token as any).launchpad_type === 'bags' && <BagsBadge mintAddress={token.mint_address || undefined} size="sm" />}
                {(token as any).launchpad_type === 'pumpfun' && <PumpBadge mintAddress={token.mint_address || undefined} size="sm" />}
                {(token as any).launchpad_type === 'phantom' && <PhantomBadge mintAddress={token.mint_address || undefined} size="sm" />}
              </div>
            </div>
          </div>

          {/* ──── MOBILE: Stats row — larger fonts, 3-column grid ──── */}
          <div className="md:hidden grid grid-cols-3 gap-px terminal-panel-flush overflow-hidden rounded-lg" style={{ backgroundColor: 'hsl(222 30% 10%)' }}>
            {stats.slice(0, 3).map((s, i) => (
              <div key={i} className="px-3 py-2.5 text-center" style={{ backgroundColor: 'hsl(222 30% 8% / 0.9)' }}>
                <p className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-wider">{s.label}</p>
                <p className={`text-sm font-mono font-bold mt-0.5 ${s.accent ? 'terminal-stat-teal' : 'text-foreground'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ──── MOBILE: Price change row ──── */}
          {priceChange !== 0 && (
            <div className="md:hidden flex items-center justify-between px-4 py-2 terminal-panel-flush rounded-lg">
              <span className="text-xs font-mono text-muted-foreground">24h Change</span>
              <span className={`text-sm font-mono font-bold flex items-center gap-1 ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                {isPriceUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {isPriceUp ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
          )}

          {/* ──── BONDING PROGRESS — thicker on mobile ──── */}
          {isBonding && (
            <div className="terminal-panel-flush flex items-center gap-3 px-4 py-2.5 md:py-1.5 rounded-lg">
              <Zap className="h-4 w-4 md:h-3 md:w-3 terminal-stat-orange shrink-0" />
              <span className="text-[10px] md:text-[9px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">Bonding</span>
              {/* Thicker progress bar on mobile (h-3 vs h-1.5) */}
              <div className="flex-1 h-3 md:h-1.5 bg-secondary rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(bondingProgress, 100)}%`,
                    background: bondingProgress >= 80
                      ? 'linear-gradient(90deg, hsl(24 95% 53%), hsl(0 72% 55%))'
                      : 'linear-gradient(90deg, hsl(187 80% 53%), hsl(160 84% 39%))',
                    boxShadow: bondingProgress >= 80 ? '0 0 8px hsl(24 95% 53% / 0.4)' : '0 0 8px hsl(187 80% 53% / 0.25)',
                  }}
                />
                {/* Percentage overlay inside bar on mobile */}
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-white md:hidden drop-shadow-sm">
                  {bondingProgress.toFixed(1)}%
                </span>
              </div>
              <span className="text-xs md:text-[10px] font-mono font-bold terminal-stat-orange shrink-0 hidden md:inline">{bondingProgress.toFixed(1)}%</span>
              <span className="text-xs md:text-[9px] font-mono text-muted-foreground shrink-0">{realSolReserves.toFixed(1)}/{GRADUATION_THRESHOLD} SOL</span>
              {livePoolState && (
                <span className="flex items-center gap-1 text-[10px] md:text-[8px] font-mono text-red-400 shrink-0">
                  <span className="h-2 w-2 md:h-1 md:w-1 rounded-full bg-red-400 animate-pulse" />LIVE
                </span>
              )}
            </div>
          )}

          {/* ──── MOBILE TAB SWITCHER — larger touch targets ──── */}
          <div className="lg:hidden">
            <div className="grid grid-cols-3 gap-px terminal-panel-flush rounded-lg overflow-hidden">
              {(['trade', 'chart', 'comments'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMobileTab(tab)}
                  className={`py-3 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 min-h-[48px] ${
                    mobileTab === tab
                      ? 'bg-primary/10 text-primary font-bold border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground bg-card/20 active:bg-card/40'
                  }`}
                >
                  {tab === 'trade' && <Activity className="h-4 w-4" />}
                  {tab === 'chart' && <BarChart3 className="h-4 w-4" />}
                  {tab === 'comments' && <MessageCircle className="h-4 w-4" />}
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* ──── MAIN CONTENT: 2-column (chart+trade | sidebar) ──── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-1.5 flex-1">

            {/* LEFT: Chart + Trade (stacked) */}
            <div className={`lg:col-span-9 flex flex-col gap-2 lg:gap-1.5 ${mobileTab === 'comments' ? 'hidden lg:flex' : ''}`}>

              {/* Chart */}
              <div className={`terminal-panel-flush rounded-lg overflow-hidden flex-1 ${mobileTab === 'trade' ? 'hidden lg:block' : ''}`} style={{ backgroundColor: 'hsl(222 47% 7%)' }}>
                <DexscreenerChart
                  mintAddress={token.mint_address || mintAddress || ''}
                  height={380}
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
                  <div className="terminal-panel-flush rounded-lg p-6 md:p-4 text-center">
                    <p className="text-muted-foreground text-sm md:text-xs font-mono">Trading not available · Status: {token.status}</p>
                  </div>
                )}
              </div>

              {/* Mobile: wallet card below trade */}
              <div className="lg:hidden">
                {mobileTab === 'trade' && <EmbeddedWalletCard />}
              </div>
            </div>

            {/* RIGHT SIDEBAR: Token Info + Description + Comments + Wallet */}
            <div className={`lg:col-span-3 flex flex-col gap-2 lg:gap-1.5 ${mobileTab !== 'comments' ? 'hidden lg:flex' : ''}`}>

              {/* Token Details */}
              <div className="terminal-panel-flush rounded-lg p-4 md:p-2.5 space-y-2 md:space-y-1.5">
                <h3 className="text-[10px] md:text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70 flex items-center gap-1">
                  <Activity className="h-3 w-3 md:h-2.5 md:w-2.5" /> Token Details
                </h3>
                <div className="space-y-0">
                  {[
                    { label: 'Price', value: `${(token.price_sol || 0).toFixed(8)} SOL` },
                    { label: 'Market Cap', value: formatUsd(token.market_cap_sol || 0) },
                    { label: 'Volume 24h', value: `${formatSolAmount(token.volume_24h_sol || 0)} SOL` },
                    { label: 'Holders', value: (token.holder_count || 0).toLocaleString() },
                    { label: 'Supply', value: formatTokenAmount(TOTAL_SUPPLY) },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between text-xs md:text-[10px] font-mono py-2 md:py-1 border-b border-border/10 last:border-0">
                      <span className="text-muted-foreground/70">{row.label}</span>
                      <span className="text-foreground/85 font-medium">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contract */}
              {token.mint_address && (
                <div className="terminal-panel-flush rounded-lg p-4 md:p-2.5 space-y-1.5 md:space-y-1">
                  <h3 className="text-[10px] md:text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70">Contract</h3>
                  <div className="flex items-center gap-2 md:gap-1">
                    <code className="text-xs md:text-[9px] font-mono text-foreground/70 truncate flex-1">
                      {token.mint_address.slice(0, 10)}...{token.mint_address.slice(-4)}
                    </code>
                    <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-2 md:p-0 -m-2 md:m-0 min-h-[44px] md:min-h-0 flex items-center justify-center">
                      <Copy className="h-4 w-4 md:h-3 md:w-3" />
                    </button>
                  </div>
                  {token.dbc_pool_address && (
                    <div>
                      <span className="text-[9px] md:text-[8px] font-mono text-muted-foreground/60 uppercase">Pool</span>
                      <code className="text-xs md:text-[9px] font-mono text-foreground/70 truncate block">
                        {token.dbc_pool_address.slice(0, 10)}...{token.dbc_pool_address.slice(-4)}
                      </code>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {token.description && (
                <div className="terminal-panel-flush rounded-lg p-4 md:p-2.5">
                  <p className={`text-xs md:text-[10px] text-muted-foreground/80 font-mono leading-relaxed ${!showFullDesc ? 'line-clamp-2' : ''}`}>
                    {token.description}
                  </p>
                  {token.description.length > 100 && (
                    <button
                      onClick={() => setShowFullDesc(!showFullDesc)}
                      className="text-xs md:text-[9px] font-mono text-accent-foreground hover:underline mt-1 md:mt-0.5 flex items-center gap-0.5 min-h-[44px] md:min-h-0"
                    >
                      {showFullDesc ? <><ChevronUp className="h-3 w-3 md:h-2.5 md:w-2.5" /> Less</> : <><ChevronDown className="h-3 w-3 md:h-2.5 md:w-2.5" /> More</>}
                    </button>
                  )}
                </div>
              )}

              {/* Holder Rewards */}
              {(token as any).fee_mode === 'holder_rewards' && (
                <div className="terminal-panel-flush rounded-lg p-4 md:p-2.5 space-y-2 md:space-y-1.5">
                  <h3 className="text-[10px] md:text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70 flex items-center gap-1">
                    <Users className="h-3 w-3 md:h-2.5 md:w-2.5 text-green-400" /> Holder Rewards
                    <span className="text-[8px] md:text-[7px] px-1 py-px rounded bg-green-500/15 text-green-400 border border-green-500/20">ON</span>
                  </h3>
                  <div className="space-y-1 md:space-y-0.5 text-xs md:text-[9px] font-mono text-muted-foreground/80">
                    <p className="flex items-center gap-1"><span className="text-green-400">✓</span> Top 50 holders share 50% fees</p>
                    <p className="flex items-center gap-1"><span className="text-green-400">✓</span> Proportional to balance</p>
                    <p className="flex items-center gap-1"><span className="text-green-400">✓</span> Auto SOL payouts every 5 min</p>
                  </div>
                </div>
              )}

              {/* Discussion */}
              <div className="terminal-panel-flush rounded-lg p-4 md:p-2.5 flex-1 min-h-0 overflow-hidden flex flex-col">
                <h3 className="text-[10px] md:text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70 flex items-center gap-1 mb-2">
                  <MessageCircle className="h-3 w-3 md:h-2.5 md:w-2.5" /> Discussion
                </h3>
                <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
                  <TokenComments tokenId={token.id} />
                </div>
              </div>

              {/* Wallet (desktop) */}
              <div className="hidden lg:block">
                <EmbeddedWalletCard />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ──── MOBILE: Bottom-fixed quick action bar ──── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50" style={{ backgroundColor: 'hsl(222 30% 7% / 0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid hsl(222 20% 16%)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
        <div className="flex items-center gap-2 px-4 py-2.5">
          {/* Quick stats */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[10px] font-mono text-muted-foreground truncate">
              {(token.price_sol || 0).toFixed(6)} SOL
            </span>
            {priceChange !== 0 && (
              <span className={`text-[10px] font-mono font-bold ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                {isPriceUp ? '+' : ''}{priceChange.toFixed(1)}%
              </span>
            )}
          </div>
          {/* Quick trade buttons */}
          <button
            onClick={() => setMobileTab('trade')}
            className="font-mono text-xs font-bold px-5 py-2.5 rounded-lg min-h-[44px] transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, hsl(160 84% 39%), hsl(187 80% 45%))', color: 'white' }}
          >
            BUY
          </button>
          <button
            onClick={() => setMobileTab('trade')}
            className="font-mono text-xs font-bold px-5 py-2.5 rounded-lg min-h-[44px] transition-all active:scale-95"
            style={{ background: 'hsl(222 20% 16%)', color: 'hsl(0 72% 60%)', border: '1px solid hsl(0 72% 40% / 0.3)' }}
          >
            SELL
          </button>
        </div>
      </div>
    </LaunchpadLayout>
  );
}
