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
import { useFunTokens } from "@/hooks/useFunTokens";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useFunFeeClaims, useFunFeeClaimsSummary, useFunDistributions } from "@/hooks/useFunFeeData";
import { useFunTopPerformers } from "@/hooks/useFunTopPerformers";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { SniperStatusPanel } from "@/components/admin/SniperStatusPanel";
import { TokenLauncher } from "@/components/launchpad/TokenLauncher";
import { StatsCards } from "@/components/launchpad/StatsCards";
import { TokenTable } from "@/components/launchpad/TokenTable";
import { TokenTickerBar } from "@/components/launchpad/TokenTickerBar";
import { KingOfTheHill } from "@/components/launchpad/KingOfTheHill";
import { SolPriceDisplay } from "@/components/layout/SolPriceDisplay";

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
} from "lucide-react";
import { XLogo } from "@phosphor-icons/react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const HEADER_LOGO_SRC = "/rift-logo.png?v=2";

interface LaunchResult {
  success: boolean;
  name?: string;
  ticker?: string;
  mintAddress?: string;
  imageUrl?: string;
  onChainSuccess?: boolean;
  solscanUrl?: string;
  tradeUrl?: string;
  message?: string;
  error?: string;
}

export default function FunLauncherPage() {
  const { toast } = useToast();
  const { solPrice } = useSolPrice();
  const isMobile = useIsMobile();
  const { tokens, isLoading: tokensLoading, refetch } = useFunTokens();

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

  // Launch result modal
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Admin check
  const [adminWallet] = useState("");
  const { isAdmin } = useIsAdmin(adminWallet || null);

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

            <Link to="/" className="gate-logo" aria-label="RIFT">
              <img
                src={HEADER_LOGO_SRC}
                alt="RIFT"
                className="h-8 w-8 rounded-lg object-cover"
                loading="eager"
              />
              <span className="text-lg font-bold">RIFT</span>
            </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2">
            <Link to="/trending">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-9 px-3 text-sm font-medium">
                Narratives
              </Button>
            </Link>
            <Link to="/api">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-9 px-3 text-sm font-medium">
                API
              </Button>
            </Link>
            <Link to="/governance">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-9 px-3 text-sm font-medium">
                Governance
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <a 
              href="https://x.com/Rift_privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/10 transition-colors"
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
                  <Link to="/trending" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <span className="text-primary-foreground text-sm font-medium">Narratives</span>
                  </Link>
                  <Link to="/api" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <span className="text-primary-foreground text-sm font-medium">API</span>
                  </Link>
                  <Link to="/governance" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <span className="text-primary-foreground text-sm font-medium">Governance</span>
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Ticker Bar */}
      <div className="mt-4">
        <TokenTickerBar />
      </div>

      {/* King of the Hill */}
      <div className="max-w-[1400px] mx-auto px-4 pt-6">
        <KingOfTheHill />
      </div>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {/* Stats Row */}
        <StatsCards
          totalTokens={tokens.length}
          totalClaimed={totalClaimed}
          totalPayouts={totalPayouts}
          solPrice={solPrice}
        />

        {/* Two Column Layout: Launcher + Content */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Token Launcher (Sticky on Desktop) */}
          <div className="lg:w-[360px] lg:flex-shrink-0">
            <div className="lg:sticky lg:top-20">
              <TokenLauncher onLaunchSuccess={handleLaunchSuccess} onShowResult={handleShowResult} />

              {/* Fee Info Card */}
              <Card className="gate-card mt-4">
                <div className="gate-card-body">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Fee Distribution</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Creator Share</span>
                      <span className="text-primary font-semibold">50%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Buybacks</span>
                      <span className="text-blue-500 font-semibold">30%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">System</span>
                      <span className="text-muted-foreground font-semibold">20%</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Admin Panel */}
              {isAdmin && <div className="mt-4"><SniperStatusPanel /></div>}
            </div>
          </div>

          {/* Right: Tabbed Content */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="tokens" className="w-full">
              <TabsList className="w-full bg-card border border-border p-1.5 mb-4 grid grid-cols-4 gap-2 rounded-xl">
                <TabsTrigger value="tokens" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs sm:text-sm rounded-lg px-2 py-2">
                  <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Tokens</span>
                </TabsTrigger>
                <TabsTrigger value="top" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs sm:text-sm rounded-lg px-2 py-2">
                  <Trophy className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Top</span>
                </TabsTrigger>
                <TabsTrigger value="claims" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs sm:text-sm rounded-lg px-2 py-2">
                  <Coins className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Claims</span>
                </TabsTrigger>
                <TabsTrigger value="creators" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs sm:text-sm rounded-lg px-2 py-2">
                  <Wallet className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Creators</span>
                </TabsTrigger>
              </TabsList>

              {/* Tokens Tab */}
              <TabsContent value="tokens">
                <TokenTable tokens={tokens} isLoading={tokensLoading} solPrice={solPrice} />
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
      </main>

      {/* Launch Result Modal */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="bg-[hsl(160,30%,6%)] border border-primary/30 rounded-2xl w-[92vw] max-w-md mx-auto p-0 overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.15)]">
          {/* Header with gradient */}
          <div className="relative px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4">
            <DialogHeader className="text-center">
              <DialogTitle className="flex items-center justify-center gap-2 text-lg sm:text-xl font-bold text-foreground">
                {launchResult?.success ? (
                  <>
                    <PartyPopper className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    Token Launched!
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
                    Launch Failed
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1 text-sm">
                {launchResult?.success
                  ? `${launchResult.name} ($${launchResult.ticker}) is now live on Solana!`
                  : launchResult?.error || "Something went wrong"}
              </DialogDescription>
            </DialogHeader>
          </div>

          {launchResult?.success && (
            <div className="px-4 sm:px-6 pb-5 sm:pb-6 space-y-4 sm:space-y-5">
              {/* Token Image with glow */}
              {launchResult.imageUrl && (
                <div className="flex justify-center -mt-1 sm:-mt-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl scale-110" />
                    <img 
                      src={launchResult.imageUrl} 
                      alt={launchResult.name} 
                      className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-full border-4 border-primary/40 shadow-lg object-cover" 
                    />
                  </div>
                </div>
              )}

              {/* Contract Address Card */}
              {launchResult.mintAddress && (
                <div className="p-3 sm:p-4 rounded-xl bg-[hsl(160,20%,10%)] border border-primary/20 overflow-hidden">
                  <p className="text-xs text-muted-foreground mb-1.5 sm:mb-2 font-medium">Contract Address</p>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <code className="flex-1 text-xs sm:text-sm font-mono text-foreground truncate min-w-0">
                      {launchResult.mintAddress}
                    </code>
                    <button 
                      onClick={() => copyToClipboard(launchResult.mintAddress!)} 
                      className="p-1.5 sm:p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20 shrink-0"
                    >
                      {copiedAddress === launchResult.mintAddress 
                        ? <CheckCircle className="h-4 w-4 text-primary" /> 
                        : <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1 sm:pt-2">
                {launchResult.solscanUrl && (
                  <a href={launchResult.solscanUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                    <Button 
                      variant="outline" 
                      className="w-full h-10 sm:h-11 bg-transparent border-primary/30 text-foreground hover:bg-primary/10 hover:border-primary/50 rounded-xl font-medium transition-all text-sm"
                    >
                      <ExternalLink className="h-4 w-4 mr-2 shrink-0" /> 
                      View on Solscan
                    </Button>
                  </a>
                )}
                {launchResult.tradeUrl && (
                  <a href={launchResult.tradeUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                    <Button className="w-full h-10 sm:h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/25 transition-all text-sm">
                      Trade Now
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Error state content */}
          {!launchResult?.success && launchResult?.error && (
            <div className="px-4 sm:px-6 pb-5 sm:pb-6">
              <div className="p-3 sm:p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{launchResult.error}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
