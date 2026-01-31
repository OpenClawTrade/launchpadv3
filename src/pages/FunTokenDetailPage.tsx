import { useParams, Link } from "react-router-dom";
import { useFunToken } from "@/hooks/useFunToken";
import { usePoolState } from "@/hooks/usePoolState";
import { useAuth } from "@/hooks/useAuth";
import { useSolPrice } from "@/hooks/useSolPrice";
import { BondingCurveProgress } from "@/components/launchpad";
import { TradePanelWithSwap } from "@/components/launchpad/TradePanelWithSwap";
import { WalletSettingsModal } from "@/components/launchpad/WalletSettingsModal";
import { JupiterSwapWidget } from "@/components/launchpad/JupiterSwapWidget";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const HEADER_LOGO_SRC = "/tuna-logo.png";
const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD = 85;

function formatTokenAmount(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  return amount.toFixed(2);
}

function formatSolAmount(amount: number): string {
  if (!amount || amount === 0) return "0 SOL";
  if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K SOL`;
  return `${amount.toFixed(4)} SOL`;
}

export default function FunTokenDetailPage() {
  const { mintAddress } = useParams<{ mintAddress: string }>();
  const { solanaAddress } = useAuth();
  const { solPrice } = useSolPrice();
  const { toast } = useToast();

  const { data: token, isLoading, refetch } = useFunToken(mintAddress || '');

  // Live pool state for accurate bonding progress
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
        text: `Check out ${token.name} on RIFT!`,
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
    toast({ title: "Data refreshed!" });
  };

  // Use live pool state when available, fallback to database values
  const bondingProgress = livePoolState?.bondingProgress ?? token?.bonding_progress ?? 0;
  const realSolReserves = (bondingProgress / 100) * GRADUATION_THRESHOLD;
  const isGraduated = token?.status === 'graduated';
  const isBonding = token?.status === 'active';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-2xl font-bold">Token not found</h2>
          <p className="text-muted-foreground mt-2">This token doesn't exist or has been removed.</p>
          <Link to="/" className="mt-4">
            <Button>Back to Launchpad</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Build compatible token object for TradePanelWithSwap
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4 px-4 h-14">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            <img src={HEADER_LOGO_SRC} alt="TUNA" className="h-8 w-8 rounded-lg object-cover" />
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={token.image_url || undefined} />
              <AvatarFallback className="rounded-lg text-xs font-bold">
                {token.ticker.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-bold">{token.name}</h1>
              <span className="text-xs text-muted-foreground">${token.ticker}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <WalletSettingsModal walletAddress={solanaAddress || undefined} />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyAddress}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={shareToken}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {/* Token Info Card */}
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border-2 border-border mx-auto sm:mx-0">
              <AvatarImage src={token.image_url || undefined} />
              <AvatarFallback className="text-xl sm:text-2xl font-bold bg-primary/10 text-primary rounded-xl">
                {token.ticker.slice(0, 2)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold">{token.name}</h2>
                <Badge variant="secondary" className="text-xs">${token.ticker}</Badge>
                {isGraduated && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                    🎓 Graduated
                  </Badge>
                )}
                {isBonding && (
                  <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">
                    📈 Bonding
                  </Badge>
                )}
              </div>

              {/* Creator */}
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Created by <span className="font-medium text-foreground">
                  {token.creator_wallet.slice(0, 6)}...{token.creator_wallet.slice(-4)}
                </span>
              </p>

              {/* Description */}
              {token.description && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 line-clamp-2">
                  {token.description}
                </p>
              )}

              {/* Social Links */}
              <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mt-3 flex-wrap">
                {token.website_url && (
                  <a href={token.website_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="h-7 sm:h-8 gap-1 px-2 sm:px-3 text-xs">
                      <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span className="hidden sm:inline">Website</span>
                    </Button>
                  </a>
                )}
                {token.twitter_url && (
                  <a href={token.twitter_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="h-7 sm:h-8 w-7 sm:w-auto px-0 sm:px-2">
                      <Twitter className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </Button>
                  </a>
                )}
                {token.telegram_url && (
                  <a href={token.telegram_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="h-7 sm:h-8 w-7 sm:w-auto px-0 sm:px-2">
                      <MessageCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </Button>
                  </a>
                )}
                {token.mint_address && (
                  <a 
                    href={`https://solscan.io/token/${token.mint_address}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="h-7 sm:h-8 gap-1 px-2 sm:px-3 text-xs">
                      <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span className="hidden sm:inline">Solscan</span>
                    </Button>
                  </a>
                )}
                <a
                  href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}?chain=sol`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" className="h-7 sm:h-8 gap-1 px-2 sm:px-3 text-xs bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-0">
                    <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="hidden xs:inline">Axiom</span>
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Card className="p-2 sm:p-3 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Market Cap</p>
            <p className="text-sm sm:text-lg font-bold truncate">
              {formatUsd(token.market_cap_sol || 0)}
            </p>
          </Card>
          <Card className="p-2 sm:p-3 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">24h Volume</p>
            <p className="text-sm sm:text-lg font-bold truncate">
              {formatSolAmount(token.volume_24h_sol || 0)}
            </p>
          </Card>
          <Card className="p-2 sm:p-3 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Holders</p>
            <p className="text-sm sm:text-lg font-bold">
              {token.holder_count || 0}
            </p>
          </Card>
          <Card className="p-2 sm:p-3 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Price</p>
            <p className="text-sm sm:text-lg font-bold">
              {(token.price_sol || 0).toFixed(9)}
            </p>
          </Card>
        </div>

        {/* Bonding Curve Progress - Only for bonding tokens */}
        {isBonding && (
          <Card className="p-4">
            <BondingCurveProgress
              progress={bondingProgress}
              realSolReserves={realSolReserves}
              graduationThreshold={GRADUATION_THRESHOLD}
            />
            {livePoolState && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                🔴 Live from Meteora
              </p>
            )}
          </Card>
        )}

        {/* Trading Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            🚀 Trade {token.ticker}
          </h3>
          
          {/* For bonding tokens - use existing TradePanelWithSwap */}
          {isBonding && (
            <TradePanelWithSwap
              token={tokenForTradePanel}
              userBalance={0}
            />
          )}

          {/* For graduated tokens - show Jupiter Plugin */}
          {isGraduated && token.mint_address && (
            <JupiterSwapWidget 
              outputMint={token.mint_address}
              tokenName={token.name}
              tokenTicker={token.ticker}
            />
          )}
        </div>

        {/* Contract Info */}
        {token.mint_address && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Contract Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Token Address</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-secondary px-2 py-1 rounded">
                    {token.mint_address.slice(0, 8)}...{token.mint_address.slice(-8)}
                  </code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyAddress}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {token.dbc_pool_address && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pool Address</span>
                  <code className="text-xs bg-secondary px-2 py-1 rounded">
                    {token.dbc_pool_address.slice(0, 8)}...{token.dbc_pool_address.slice(-8)}
                  </code>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Supply</span>
                <span>{formatTokenAmount(TOTAL_SUPPLY)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDistanceToNow(new Date(token.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
