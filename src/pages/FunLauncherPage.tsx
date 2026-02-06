import { useState, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useFunTokensPaginated } from "@/hooks/useFunTokensPaginated";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useFunFeeClaims, useFunFeeClaimsSummary, useFunDistributions } from "@/hooks/useFunFeeData";
import { useFunTopPerformers } from "@/hooks/useFunTopPerformers";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAgentStats } from "@/hooks/useAgentStats";
import { useTokenPromotions } from "@/hooks/useTokenPromotions";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useChainRoute } from "@/hooks/useChainRoute";
import { useChain } from "@/contexts/ChainContext";
import { SniperStatusPanel } from "@/components/admin/SniperStatusPanel";
import { TokenLauncher } from "@/components/launchpad/TokenLauncher";
import { StatsCards } from "@/components/launchpad/StatsCards";
import { TokenTable } from "@/components/launchpad/TokenTable";
import { TokenTickerBar } from "@/components/launchpad/TokenTickerBar";
import { KingOfTheHill } from "@/components/launchpad/KingOfTheHill";
import { JustLaunched } from "@/components/launchpad/JustLaunched";
import { FeeDistributionPie } from "@/components/launchpad/FeeDistributionPie";
import { SolPriceDisplay } from "@/components/layout/SolPriceDisplay";
import { ChainSwitcher } from "@/components/launchpad/ChainSwitcher";
import { PromoteButton } from "@/components/launchpad/PromoteButton";
import { PromoteModal } from "@/components/launchpad/PromoteModal";
import { BaseLauncher } from "@/components/launchpad/BaseLauncher";

import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Trophy,
  Coins,
  Wallet,
  ExternalLink,
  Copy,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Users,
  PartyPopper,
  Menu,
  XCircle,
  Megaphone,
  Crown,
  AlertCircle,
  FileText,
} from "lucide-react";
import { XLogo } from "@phosphor-icons/react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const HEADER_LOGO_SRC = "/tuna-logo.png";

interface LaunchResult {
  success: boolean;
  name?: string;
  ticker?: string;
  mintAddress?: string;
  imageUrl?: string;
  tokenId?: string;
  onChainSuccess?: boolean;
  solscanUrl?: string;
  tradeUrl?: string;
  message?: string;
  error?: string;
}

export default function FunLauncherPage() {
  const { toast } = useToast();
  const { solPrice } = useSolPrice();
  const { solanaAddress } = useAuth();
  const isMobile = useIsMobile();
  const { tokens, totalCount, isLoading: tokensLoading, refetch } = useFunTokensPaginated(1, 100);
  const { chain, chainConfig, isSolana, isChainEnabled } = useChainRoute();
  const { setChain } = useChain();

  // Pagination states
  const [claimsPage, setClaimsPage] = useState(1);
  const [creatorFeesPage, setCreatorFeesPage] = useState(1);
  const pageSize = 15;

  // Data hooks
  const { data: claimsData, isLoading: claimsLoading } = useFunFeeClaims({ page: claimsPage, pageSize });
  const feeClaims = claimsData?.items ?? [];
  const claimsCount = claimsData?.count ?? 0;

  const { data: claimsSummary } = useFunFeeClaimsSummary();
  const { data: distributions = [] } = useFunDistributions();
  const { data: topPerformers = [], isLoading: topPerformersLoading } = useFunTopPerformers(10);
  const { data: agentStats } = useAgentStats();

  // Launch result modal
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Promote modal state
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteTokenId, setPromoteTokenId] = useState<string | null>(null);
  const [promoteTokenName, setPromoteTokenName] = useState("");
  const [promoteTokenTicker, setPromoteTokenTicker] = useState("");

  // Admin check
  const [adminWallet] = useState("");
  const { isAdmin } = useIsAdmin(adminWallet || null);
  
  // Promotions data
  const { activePromotions, isTokenPromoted, getTokenPromotion } = useTokenPromotions();
  
  // Visitor tracking
  const { onlineCount } = useVisitorTracking();

  // Computed values
  const totalClaimed = claimsSummary?.totalClaimedSol ?? 0;
  const totalPayouts = useMemo(() => distributions.reduce((sum, d) => sum + Number(d.amount_sol || 0), 0), [distributions]);

  const creatorDistributions = useMemo(() => {
    return distributions.filter((d) => d.distribution_type === "creator" && d.status === "completed");
  }, [distributions]);

  // Helpers
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    toast({ title: "Copied!", description: "Address copied to clipboard" });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const shortenAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

  const formatSOL = (amount: number) => {
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    if (amount >= 1) return amount.toFixed(2);
    if (amount >= 0.01) return amount.toFixed(4);
    if (amount > 0) return amount.toFixed(5); // Show up to 5 decimals for tiny amounts
    return "0.00";
  };

  const handleLaunchSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleShowResult = useCallback((result: LaunchResult) => {
    setLaunchResult(result);
    setShowResultModal(true);
  }, []);

  return (
    <div className="gate-theme dark min-h-screen">
      {/* Header */}
      <header className="gate-header">
        <div className="gate-header-inner">
          <div className="flex items-center gap-3">
            <Link to="/" className="gate-logo" aria-label="TUNA">
              <img
                src={HEADER_LOGO_SRC}
                alt="TUNA"
                className="h-8 w-8 rounded-lg object-cover"
                loading="eager"
              />
              <span className="text-lg font-bold">TUNA</span>
            </Link>
            
            {/* Chain Switcher */}
            <div className="hidden sm:block">
              <ChainSwitcher />
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2">
            <Link to="/trade">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-9 px-3 text-sm font-medium">
                Trade
              </Button>
            </Link>
            <Link to="/trending">
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg h-9 px-3 text-sm font-medium">
                Trending Narratives
              </Button>
            </Link>
            <Link to="/api">
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg h-9 px-3 text-sm font-medium">
                API
              </Button>
            </Link>
            <Link to="/agents">
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-lg h-9 px-3 text-sm font-medium">
                TUNA Agents
              </Button>
            </Link>
            <Link to="/agents/trading">
              <Button size="sm" className="gold-pulse-btn font-bold rounded-lg h-9 px-3 text-sm">
                <TrendingUp className="h-4 w-4 mr-1.5" />
                Trading Agents
              </Button>
            </Link>
            
            {/* Visitors Online */}
            <div className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-secondary/50 border border-border">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{onlineCount ?? '—'}</span> Online
              </span>
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <a 
              href="/TUNA_WHITEPAPER.md"
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-cyan-500/10 transition-colors"
              title="Read Whitepaper"
            >
              <FileText className="h-4 w-4 text-cyan-400 hover:text-cyan-300" />
            </a>
            <a 
              href="https://x.com/buildtuna" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-secondary transition-colors"
              title="Follow us on X"
            >
              <XLogo className="h-4 w-4 text-muted-foreground hover:text-foreground" weight="fill" />
            </a>
            <SolPriceDisplay />
            
            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="sm" className="gate-btn-ghost h-10 w-10">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-card border-border">
                <nav className="flex flex-col gap-2 mt-8">
                  {/* Mobile Chain Switcher */}
                  <div className="px-4 py-2 border-b border-border mb-2">
                    <p className="text-xs text-muted-foreground mb-2">Select Chain</p>
                    <ChainSwitcher variant="default" />
                  </div>
                  
                  <Link to="/trade" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <span className="text-primary-foreground text-sm font-medium">Trade</span>
                  </Link>
                  <Link to="/trending" className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <span className="text-foreground text-sm font-medium">Trending Narratives</span>
                  </Link>
                  <Link to="/api" className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <span className="text-foreground text-sm font-medium">API</span>
                  </Link>
                  <Link to="/agents" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <span className="text-white text-sm font-medium">TUNA Agents</span>
                  </Link>
                  <Link to="/agents/trading" className="flex items-center gap-2 px-4 py-2.5 rounded-lg gold-pulse-btn transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-bold">Trading Agents</span>
                  </Link>
                  <a 
                    href="/TUNA_WHITEPAPER.md"
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <FileText className="h-4 w-4 text-cyan-400" />
                    <span className="text-foreground text-sm font-medium">Whitepaper</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                  </a>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Chain Not Enabled Banner */}
      {!isChainEnabled && (
        <div className="bg-warning/10 border-b border-warning/30 px-4 py-3">
          <div className="max-w-[1400px] mx-auto flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
            <p className="text-sm text-warning">
              <span className="font-semibold">{chainConfig.name}</span> launch is coming soon! Check back later or switch to Solana to launch now.
            </p>
          </div>
        </div>
      )}

      {/* Ticker Bar - only show for Solana */}
      {isSolana && (
        <div className="mt-4">
          <TokenTickerBar />
        </div>
      )}

      {/* King of the Hill - only show for Solana */}
      {isSolana && (
        <div className="max-w-[1400px] mx-auto px-4 pt-6">
          <KingOfTheHill />
        </div>
      )}

      {/* Just Launched - only show for Solana */}
      {isSolana && (
        <div className="max-w-[1400px] mx-auto px-4 pt-4">
          <JustLaunched />
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {/* Base Chain Launcher */}
        {chain === 'base' && (
          <BaseLauncher />
        )}

        {/* Coming Soon State for other non-Solana chains (not Base) */}
        {!isSolana && chain !== 'base' && (
          <div className="text-center py-16 space-y-4">
            <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
              <AlertCircle className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">{chainConfig.name} Coming Soon</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              We're working on bringing token launches to {chainConfig.name}. Switch to Solana to launch tokens now!
            </p>
            <Button 
              onClick={() => setChain('solana')}
              className="mt-4"
            >
              Switch to Solana
            </Button>
          </div>
        )}

        {/* Stats Row - only show for Solana */}
        {isSolana && (
          <StatsCards
            totalTokens={agentStats?.totalTokensLaunched ?? totalCount}
            totalAgents={agentStats?.totalAgents ?? 0}
            totalClaimed={totalClaimed}
            totalAgentPosts={agentStats?.totalAgentPosts ?? 0}
            totalAgentPayouts={agentStats?.totalAgentPayouts ?? 0}
            solPrice={solPrice}
          />
        )}

        {/* Two Column Layout: Launcher + Content - only show for Solana */}
        {isSolana && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Token Launcher (Sticky on Desktop) */}
          <div className="lg:w-[360px] lg:flex-shrink-0">
            <div className="lg:sticky lg:top-20">
              <TokenLauncher onLaunchSuccess={handleLaunchSuccess} onShowResult={handleShowResult} />

              {/* Fee Info Card */}
              <Card className="gate-card mt-4">
                <div className="gate-card-body">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Fee Distribution</h3>
                  <FeeDistributionPie />
                </div>
              </Card>

              {/* Admin Panel */}
              {isAdmin && <div className="mt-4"><SniperStatusPanel /></div>}
            </div>
          </div>

          {/* Right: Tabbed Content */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="tokens" className="w-full">
              <TabsList className="w-full bg-card border border-border p-1.5 mb-4 grid grid-cols-5 gap-1 sm:gap-2 rounded-xl">
                <TabsTrigger value="tokens" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs sm:text-sm rounded-lg px-1 sm:px-2 py-2">
                  <BarChart3 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Tokens</span>
                </TabsTrigger>
                <TabsTrigger value="promoted" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs sm:text-sm rounded-lg px-1 sm:px-2 py-2">
                  <Crown className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Promoted</span>
                </TabsTrigger>
                <TabsTrigger value="top" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs sm:text-sm rounded-lg px-1 sm:px-2 py-2">
                  <Trophy className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Top</span>
                </TabsTrigger>
                <TabsTrigger value="claims" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs sm:text-sm rounded-lg px-1 sm:px-2 py-2">
                  <Coins className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Claims</span>
                </TabsTrigger>
                <TabsTrigger value="creators" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs sm:text-sm rounded-lg px-1 sm:px-2 py-2">
                  <Wallet className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Creators</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tokens">
                <TokenTable 
                  solPrice={solPrice}
                  promotedTokenIds={new Set(activePromotions?.map(p => p.fun_token_id) || [])}
                  onPromote={(tokenId, name, ticker) => {
                    setPromoteTokenId(tokenId);
                    setPromoteTokenName(name);
                    setPromoteTokenTicker(ticker);
                    setShowPromoteModal(true);
                  }}
                />
              </TabsContent>

              {/* Promoted Tokens Tab */}
              <TabsContent value="promoted">
                <Card className="gate-card">
                  <div className="gate-card-header">
                    <h2 className="gate-card-title">
                      <Crown className="h-5 w-5 text-warning" />
                      Promoted Tokens
                    </h2>
                    <Badge className="bg-warning/20 text-warning border-warning/30">
                      {activePromotions?.length || 0} active
                    </Badge>
                  </div>
                  {!activePromotions || activePromotions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Crown className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No promoted tokens yet</p>
                      <p className="text-sm mt-1">Promote your token to appear here!</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {activePromotions.map((promo) => {
                        const token = tokens.find(t => t.id === promo.fun_token_id);
                        if (!token) return null;
                        const expiresAt = new Date(promo.expires_at!);
                        const hoursRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));
                        
                        return (
                          <Link
                            key={promo.id}
                            to={`/launchpad/${token.mint_address}`}
                            className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors ring-2 ring-warning/30 ring-inset"
                          >
                            <div className="gate-token-avatar ring-2 ring-warning">
                              {token.image_url ? (
                                <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-secondary flex items-center justify-center text-xs font-bold">
                                  {token.ticker?.slice(0, 2)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate">{token.name}</span>
                                <Badge className="bg-warning/20 text-warning text-xs">PROMOTED</Badge>
                              </div>
                              <span className="text-sm text-muted-foreground">${token.ticker}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-medium text-warning">{hoursRemaining}h left</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Top Performers Tab */}
              <TabsContent value="top">
                <Card className="gate-card">
                  <div className="gate-card-header">
                    <h2 className="gate-card-title">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      Top Performers (24h)
                    </h2>
                  </div>
                  <div className="gate-table-wrapper">
                    <table className="gate-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Token</th>
                          <th>Price</th>
                          <th>24h Change</th>
                          <th>Volume</th>
                          <th>Market Cap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topPerformersLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i}>
                              <td><Skeleton className="h-4 w-6" /></td>
                              <td><Skeleton className="h-4 w-24" /></td>
                              <td><Skeleton className="h-4 w-16" /></td>
                              <td><Skeleton className="h-4 w-12" /></td>
                              <td><Skeleton className="h-4 w-16" /></td>
                              <td><Skeleton className="h-4 w-16" /></td>
                            </tr>
                          ))
                        ) : topPerformers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-muted-foreground">
                              No top performers yet
                            </td>
                          </tr>
                        ) : (
                          topPerformers.map((token, index) => (
                            <tr key={token.id}>
                              <td className="font-medium text-muted-foreground">{index + 1}</td>
                              <td>
                                <Link to={`/launchpad/${token.mint_address}`} className="gate-token-row">
                                  <div className="gate-token-avatar">
                                    {token.image_url ? (
                                      <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-secondary flex items-center justify-center text-xs font-bold">
                                        {token.ticker?.slice(0, 2)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="gate-token-info">
                                    <span className="gate-token-name">{token.name}</span>
                                    <span className="gate-token-ticker">${token.ticker}</span>
                                  </div>
                                </Link>
                              </td>
                              <td className="font-medium">-</td>
                              <td>
                                <span className="flex items-center gap-1 font-medium gate-price-up">
                                  <TrendingUp className="h-3 w-3" />
                                  {token.claim_count} claims
                                </span>
                              </td>
                              <td>{formatSOL(token.total_fees_24h)} SOL</td>
                              <td>-</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>

              {/* Claims Tab */}
              <TabsContent value="claims">
                <Card className="gate-card">
                  <div className="gate-card-header">
                    <h2 className="gate-card-title">
                      <Coins className="h-5 w-5 text-primary" />
                      Fee Claims
                    </h2>
                    <span className="text-sm text-muted-foreground">{claimsCount} total</span>
                  </div>
                  <div className="gate-table-wrapper">
                    <table className="gate-table">
                      <thead>
                        <tr>
                          <th>Token</th>
                          <th>Pool</th>
                          <th>Amount</th>
                          <th>Time</th>
                          <th>TX</th>
                        </tr>
                      </thead>
                      <tbody>
                        {claimsLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i}>
                              <td><Skeleton className="h-4 w-24" /></td>
                              <td><Skeleton className="h-4 w-16" /></td>
                              <td><Skeleton className="h-4 w-16" /></td>
                              <td><Skeleton className="h-4 w-16" /></td>
                              <td><Skeleton className="h-4 w-12" /></td>
                            </tr>
                          ))
                        ) : feeClaims.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-12 text-muted-foreground">
                              No fee claims yet
                            </td>
                          </tr>
                        ) : (
                          feeClaims.map((claim) => (
                            <tr key={claim.id}>
                              <td>
                                <div className="gate-token-row">
                                  <div className="gate-token-avatar">
                                    {claim.fun_token?.image_url ? (
                                      <img src={claim.fun_token.image_url} alt={claim.fun_token.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-secondary flex items-center justify-center text-xs">
                                        {claim.fun_token?.ticker?.slice(0, 2)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="gate-token-info">
                                    <span className="gate-token-name">{claim.fun_token?.name || "Unknown"}</span>
                                    <span className="gate-token-ticker">${claim.fun_token?.ticker}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {shortenAddress(claim.pool_address)}
                                </span>
                              </td>
                              <td className="text-primary font-semibold">+{formatSOL(claim.claimed_sol ?? 0)} SOL</td>
                              <td className="text-muted-foreground text-sm">
                                {claim.claimed_at ? formatDistanceToNow(new Date(claim.claimed_at), { addSuffix: true }) : "-"}
                              </td>
                              <td>
                                {claim.signature ? (
                                  <a
                                    href={`https://solscan.io/tx/${claim.signature}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="gate-link text-xs"
                                  >
                                    View <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {Math.ceil(claimsCount / pageSize) > 1 && (
                    <div className="gate-pagination">
                      <span className="gate-pagination-info">Page {claimsPage} of {Math.ceil(claimsCount / pageSize)}</span>
                      <div className="gate-pagination-buttons">
                        <button onClick={() => setClaimsPage((p) => Math.max(1, p - 1))} disabled={claimsPage === 1} className="gate-page-btn">
                          <ChevronLeft className="h-4 w-4" /> Prev
                        </button>
                        <button onClick={() => setClaimsPage((p) => p + 1)} disabled={claimsPage >= Math.ceil(claimsCount / pageSize)} className="gate-page-btn">
                          Next <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>


              {/* Creators Tab */}
              <TabsContent value="creators">
                <Card className="gate-card">
                  <div className="gate-card-header">
                    <h2 className="gate-card-title">
                      <Wallet className="h-5 w-5 text-primary" />
                      Creator Payouts
                    </h2>
                  </div>
                  <div className="gate-table-wrapper">
                    <table className="gate-table">
                      <thead>
                        <tr>
                          <th>Token</th>
                          <th>Creator</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Time</th>
                          <th>TX</th>
                        </tr>
                      </thead>
                      <tbody>
                        {creatorDistributions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-muted-foreground">
                              No creator payouts yet
                            </td>
                          </tr>
                        ) : (
                          creatorDistributions.slice((creatorFeesPage - 1) * pageSize, creatorFeesPage * pageSize).map((dist) => (
                            <tr key={dist.id}>
                              <td>
                                <div className="gate-token-row">
                                  <div className="gate-token-avatar">
                                    {dist.fun_token?.image_url ? (
                                      <img src={dist.fun_token.image_url} alt={dist.fun_token.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-secondary flex items-center justify-center text-xs">
                                        {dist.fun_token?.ticker?.slice(0, 2)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="gate-token-info">
                                    <span className="gate-token-name">{dist.fun_token?.name || "Unknown"}</span>
                                    <span className="gate-token-ticker">${dist.fun_token?.ticker}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-muted-foreground">{shortenAddress(dist.creator_wallet)}</span>
                                  <button onClick={() => copyToClipboard(dist.creator_wallet)} className="gate-copy-btn">
                                    {copiedAddress === dist.creator_wallet ? <CheckCircle className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                                  </button>
                                </div>
                              </td>
                              <td className="text-primary font-semibold">+{formatSOL(Number(dist.amount_sol))} SOL</td>
                              <td>
                                <Badge className={dist.status === "completed" ? "gate-badge-success" : "gate-badge-warning"}>
                                  {dist.status}
                                </Badge>
                              </td>
                              <td className="text-muted-foreground text-sm">
                                {dist.created_at ? formatDistanceToNow(new Date(dist.created_at), { addSuffix: true }) : "-"}
                              </td>
                              <td>
                                {dist.signature ? (
                                  <a href={`https://solscan.io/tx/${dist.signature}`} target="_blank" rel="noopener noreferrer" className="gate-link text-xs">
                                    View <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {Math.ceil(creatorDistributions.length / pageSize) > 1 && (
                    <div className="gate-pagination">
                      <span className="gate-pagination-info">Page {creatorFeesPage} of {Math.ceil(creatorDistributions.length / pageSize)}</span>
                      <div className="gate-pagination-buttons">
                        <button onClick={() => setCreatorFeesPage((p) => Math.max(1, p - 1))} disabled={creatorFeesPage === 1} className="gate-page-btn">
                          <ChevronLeft className="h-4 w-4" /> Prev
                        </button>
                        <button onClick={() => setCreatorFeesPage((p) => p + 1)} disabled={creatorFeesPage >= Math.ceil(creatorDistributions.length / pageSize)} className="gate-page-btn">
                          Next <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        )}
      </main>

      {/* Launch Result Modal */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="bg-[hsl(160,30%,6%)] border border-primary/30 rounded-2xl !w-[calc(100vw-2rem)] !max-w-[420px] !left-1/2 !-translate-x-1/2 p-0 overflow-visible shadow-[0_0_60px_rgba(16,185,129,0.15)]">
          {/* Header */}
          <div className="relative px-5 pt-6 pb-4">
            <DialogHeader className="text-center">
              <DialogTitle className="flex items-center justify-center gap-2 text-xl font-bold text-foreground">
                {launchResult?.success ? (
                  <>
                    <PartyPopper className="h-6 w-6 text-primary" />
                    Token Launched!
                  </>
                ) : (
                  <>
                    <XCircle className="h-6 w-6 text-destructive" />
                    Launch Failed
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-2 text-sm">
                {launchResult?.success
                  ? `${launchResult.name} ($${launchResult.ticker}) is now live on Solana!`
                  : launchResult?.error || "Something went wrong"}
              </DialogDescription>
            </DialogHeader>
          </div>

          {launchResult?.success && (
            <div className="px-5 pb-6 space-y-5">
              {/* Token Info Card */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[hsl(160,20%,10%)] border border-primary/20">
                {launchResult.imageUrl && (
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-primary/20 rounded-xl blur-md" />
                    <img 
                      src={launchResult.imageUrl} 
                      alt={launchResult.name} 
                      className="relative w-16 h-16 rounded-xl border-2 border-primary/40 shadow-lg object-cover" 
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-lg text-foreground truncate">{launchResult.name}</p>
                  <p className="text-primary font-mono text-sm">${launchResult.ticker}</p>
                </div>
              </div>

              {/* Contract Address Card */}
              {launchResult.mintAddress && (
                <div className="p-4 rounded-xl bg-[hsl(160,20%,10%)] border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Contract Address</p>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 text-sm font-mono text-foreground break-all leading-relaxed">
                      {launchResult.mintAddress}
                    </code>
                    <button 
                      onClick={() => copyToClipboard(launchResult.mintAddress!)} 
                      className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20 shrink-0"
                    >
                      {copiedAddress === launchResult.mintAddress 
                        ? <CheckCircle className="h-4 w-4 text-primary" /> 
                        : <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons - Stack on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {launchResult.solscanUrl && (
                  <a href={launchResult.solscanUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button 
                      variant="outline" 
                      className="w-full h-11 bg-transparent border-primary/30 text-foreground hover:bg-primary/10 hover:border-primary/50 rounded-xl font-medium transition-all"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" /> 
                      Solscan
                    </Button>
                  </a>
                )}
                {launchResult.tradeUrl && (
                  <a href={launchResult.tradeUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/25 transition-all">
                      Trade Now
                    </Button>
                  </a>
                )}
                {launchResult.tokenId && (
                  <Button 
                    onClick={() => {
                      setPromoteTokenId(launchResult.tokenId!);
                      setPromoteTokenName(launchResult.name || "");
                      setPromoteTokenTicker(launchResult.ticker || "");
                      setShowResultModal(false);
                      setShowPromoteModal(true);
                    }}
                    className="w-full h-11 bg-warning hover:bg-warning/90 text-warning-foreground rounded-xl font-semibold transition-all"
                  >
                    <Megaphone className="h-4 w-4 mr-2" />
                    Promote
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Error state content */}
          {!launchResult?.success && launchResult?.error && (
            <div className="px-5 pb-6">
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive break-words">{launchResult.error}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Promote Modal */}
      {promoteTokenId && (
        <PromoteModal
          isOpen={showPromoteModal}
          onClose={() => {
            setShowPromoteModal(false);
            setPromoteTokenId(null);
          }}
          tokenId={promoteTokenId}
          tokenName={promoteTokenName}
          tokenTicker={promoteTokenTicker}
          promoterWallet={solanaAddress || ""}
        />
      )}
    </div>
  );
}
