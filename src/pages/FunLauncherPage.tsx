import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { TokenCard } from "@/components/launchpad/TokenCard";
import { TokenTickerBar } from "@/components/launchpad/TokenTickerBar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useFunTokensPaginated } from "@/hooks/useFunTokensPaginated";
import { useJustLaunched } from "@/hooks/useJustLaunched";
import { useKingOfTheHill } from "@/hooks/useKingOfTheHill";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useFunFeeClaims, useFunFeeClaimsSummary, useFunDistributions } from "@/hooks/useFunFeeData";
import { useFunTopPerformers } from "@/hooks/useFunTopPerformers";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAgentStats } from "@/hooks/useAgentStats";
import { useTokenPromotions } from "@/hooks/useTokenPromotions";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useChainRoute } from "@/hooks/useChainRoute";
import { useChain } from "@/contexts/ChainContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BaseLauncher } from "@/components/launchpad/BaseLauncher";
import { LaunchCountdown } from "@/components/LaunchCountdown";
import { PromoteModal } from "@/components/launchpad/PromoteModal";
import { CreateTokenModal } from "@/components/launchpad/CreateTokenModal";
import { SniperStatusPanel } from "@/components/admin/SniperStatusPanel";
import { TokenLauncher } from "@/components/launchpad/TokenLauncher";
import { Link, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronLeft, ChevronRight, PartyPopper, XCircle, ExternalLink, Copy, CheckCircle,
  Coins, Wallet, Trophy, BarChart3, Users, AlertCircle, Flame, Bot, Clock, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { FeeDistributionPie } from "@/components/launchpad/FeeDistributionPie";

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

const FILTER_TABS = [
  { id: "new", label: "🚀 New" },
  { id: "hot", label: "🔥 Hot" },
  { id: "top", label: "👑 Top" },
  { id: "agents", label: "🤖 Agents" },
  
] as const;

type FilterTab = typeof FILTER_TABS[number]["id"];

export default function FunLauncherPage() {
  const { toast } = useToast();
  const { solPrice } = useSolPrice();
  const { solanaAddress } = useAuth();
  const { tokens, totalCount, isLoading: tokensLoading, refetch } = useFunTokensPaginated(1, 100);
  const { tokens: justLaunchedTokens, isLoading: justLaunchedLoading } = useJustLaunched();
  const { tokens: kothTokens, isLoading: kothLoading } = useKingOfTheHill();
  const { chain, chainConfig, isSolana, isChainEnabled } = useChainRoute();
  const { setChain } = useChain();
  const [searchParams, setSearchParams] = useSearchParams();

  const [claimsPage, setClaimsPage] = useState(1);
  const [creatorFeesPage, setCreatorFeesPage] = useState(1);
  const pageSize = 15;

  const { data: claimsData, isLoading: claimsLoading } = useFunFeeClaims({ page: claimsPage, pageSize });
  const feeClaims = claimsData?.items ?? [];
  const claimsCount = claimsData?.count ?? 0;

  const { data: claimsSummary } = useFunFeeClaimsSummary();
  const { data: distributions = [] } = useFunDistributions();
  const { data: topPerformers = [], isLoading: topPerformersLoading } = useFunTopPerformers(10);
  const { data: agentStats } = useAgentStats();
  const { activePromotions, isTokenPromoted } = useTokenPromotions();
  const { onlineCount } = useVisitorTracking();

  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteTokenId, setPromoteTokenId] = useState<string | null>(null);
  const [promoteTokenName, setPromoteTokenName] = useState("");
  const [promoteTokenTicker, setPromoteTokenTicker] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("new");
  const [adminWallet] = useState("");
  const { isAdmin } = useIsAdmin(adminWallet || null);

  // Create token dialog — triggered by ?create=1 URL param
  const showCreateDialog = searchParams.get("create") === "1";
  const openCreateDialog = () => setSearchParams({ create: "1" });
  const closeCreateDialog = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("create");
    setSearchParams(newParams);
  };

  const totalClaimed = claimsSummary?.totalClaimedSol ?? 0;
  const totalPayouts = useMemo(() => distributions.reduce((sum, d) => sum + Number(d.amount_sol || 0), 0), [distributions]);
  const creatorDistributions = useMemo(() => distributions.filter((d) => d.distribution_type === "creator" && d.status === "completed"), [distributions]);
  const promotedTokenIds = new Set(activePromotions?.map(p => p.fun_token_id) || []);

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
    return amount > 0 ? amount.toFixed(5) : "0.00";
  };
  const formatUsd = (mcapSol: number | null | undefined) => {
    if (!mcapSol || !solPrice) return "$0";
    const usd = mcapSol * solPrice;
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
    return `$${usd.toFixed(0)}`;
  };
  const formatAge = (dt: string) => formatDistanceToNow(new Date(dt), { addSuffix: false })
    .replace("about ", "").replace(" hours", "h").replace(" hour", "h")
    .replace(" minutes", "m").replace(" minute", "m").replace(" days", "d").replace(" day", "d")
    .replace(" months", "mo").replace(" month", "mo");

  const handleLaunchSuccess = useCallback(() => refetch(), [refetch]);
  const handleShowResult = useCallback((result: LaunchResult) => {
    setLaunchResult(result);
    setShowResultModal(true);
  }, []);

  // Filter tokens for grid
  const filteredTokens = useMemo(() => {
    switch (activeFilter) {
      case "new": return [...tokens].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "hot": return [...tokens].filter(t => (t.bonding_progress ?? 0) >= 30).sort((a, b) => (b.bonding_progress ?? 0) - (a.bonding_progress ?? 0));
      case "top": return [...tokens].sort((a, b) => (b.market_cap_sol ?? 0) - (a.market_cap_sol ?? 0));
      case "agents": return tokens.filter(t => !!t.agent_id);
      
      default: return tokens;
    }
  }, [tokens, activeFilter, promotedTokenIds]);

  return (
    <div className="min-h-screen relative z-[1] overflow-x-hidden">
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      {/* Main content — offset by sidebar width on desktop */}
      <div className="md:ml-[160px] flex flex-col min-h-screen">
        {/* Top bar */}
        <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />

        {/* Ticker bar */}
        {isSolana && <TokenTickerBar />}

        {/* Chain Not Enabled Banner */}
        {!isChainEnabled && (
          <div className="px-4 py-3 flex items-center gap-3" style={{ background: "rgba(234,179,8,0.1)", borderBottom: "1px solid rgba(234,179,8,0.3)" }}>
            <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <p className="text-sm text-yellow-500">
              <span className="font-semibold">{chainConfig.name}</span> launch is coming soon! Switch to Solana to launch now.
            </p>
          </div>
        )}

        {/* Base Chain Launcher */}
        {chain === 'base' && (
          <div className="p-4"><BaseLauncher /></div>
        )}

        {/* Coming Soon for non-Solana, non-base */}
        {!isSolana && chain !== 'base' && (
          <div className="flex flex-col items-center justify-center flex-1 py-20 space-y-4">
            <AlertCircle className="h-12 w-12 text-primary" />
            <h2 className="text-xl font-bold text-white">{chainConfig.name} Coming Soon</h2>
            <p className="text-sm" style={{ color: "#888" }}>Switch to Solana to launch tokens now!</p>
            <Button onClick={() => setChain('solana')}>Switch to Solana</Button>
          </div>
        )}

        {isSolana && (
          <main className="flex-1">
            {/* Launch Countdown */}
            <div className="px-4 pt-3">
              <LaunchCountdown compact />
            </div>

            {/* Trending / Just Launched horizontal scroll */}
            <div className="px-4 pt-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Flame className="h-3.5 w-3.5 text-success" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Just Launched
                </span>
                <span className="text-[10px] text-muted-foreground/50">— Last 24h</span>
              </div>

              {/* Horizontal scroll of Just Launched cards */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {justLaunchedLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-[150px] h-[195px] rounded-xl bg-surface">
                      <Skeleton className="w-full h-full rounded-xl skeleton-shimmer" />
                    </div>
                  ))
                  : justLaunchedTokens.length === 0
                  ? (
                    <div className="flex items-center gap-2 py-4 px-3 rounded-xl bg-surface border border-border empty-state-fade">
                      <span className="text-[11px] text-muted-foreground">No new tokens in the last 48h — check back soon!</span>
                    </div>
                  )
                  : justLaunchedTokens.slice(0, 12).map(token => (
                    <Link
                      key={token.id}
                      to={token.agent_id || token.launchpad_type === 'pumpfun' || token.launchpad_type === 'bags'
                        ? `/t/${token.ticker}`
                        : `/launchpad/${token.mint_address || token.id}`}
                      className="flex-shrink-0 w-[150px] rounded-xl overflow-hidden group hover-lift bg-surface border border-border hover:border-success"
                    >
                      {/* Image */}
                      <div className="relative w-full" style={{ paddingBottom: "65%" }}>
                        <div className="absolute inset-0">
                          {token.image_url ? (
                            <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl font-bold bg-muted text-success">
                              {token.ticker?.slice(0, 2)}
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-1/2 pf-img-overlay" />
                          <div className="absolute bottom-1 left-1.5">
                            <span className="text-[10px] font-bold font-mono text-white">
                              {formatUsd(token.market_cap_sol)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-1.5">
                        <div className="text-[11px] font-semibold text-foreground truncate">{token.name}</div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono text-success">${token.ticker}</span>
                          <span className="text-[9px] font-mono text-muted-foreground">{formatAge(token.created_at)}</span>
                        </div>
                        {(token as any).description && (
                          <p className="text-[9px] leading-tight mt-0.5 line-clamp-1 text-muted-foreground">{(token as any).description}</p>
                        )}
                      </div>
                    </Link>
                  ))
                }
              </div>
            </div>

            {/* King of the Hill strip */}
            {kothTokens && kothTokens.length > 0 && (
              <div className="px-4 pt-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <img src="/claw-logo.png" alt="Claw" className="h-4 w-4 object-contain" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">King of the Claws</span>
                  <span className="text-[10px] text-muted-foreground/50">— Soon to Graduate</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {kothTokens.map((token, i) => {
                    const tradeUrl = (token.launchpad_type === 'pumpfun' || token.launchpad_type === 'bags' || token.agent_id || token.trading_agent_id)
                      ? `/t/${token.ticker}`
                      : `/launchpad/${token.mint_address || token.dbc_pool_address || token.id}`;
                    const marketCapUsd = (token.market_cap_sol ?? 0) * (solPrice || 0);
                    return (
                      <Link
                        key={token.id}
                        to={tradeUrl}
                        className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 rounded-xl hover-lift bg-surface border border-border hover:border-success"
                        style={{ minWidth: "200px" }}
                      >
                        <span className={`text-[10px] font-bold font-mono w-4 text-center flex-shrink-0 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : "text-orange-500"}`}>#{i + 1}</span>
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                          {token.image_url ? <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-success">{token.ticker?.slice(0, 2)}</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-foreground truncate">{token.name}</div>
                          <div className="text-[9px] font-mono text-success">
                            ${marketCapUsd >= 1000 ? `${(marketCapUsd / 1000).toFixed(1)}K` : marketCapUsd.toFixed(0)}
                          </div>
                        </div>
                        <div className="flex-shrink-0 w-16">
                          <div className="h-1 w-full rounded-pill overflow-hidden bg-muted">
                            <div className="h-full rounded-pill" style={{ width: `${Math.min(token.bonding_progress ?? 0, 100)}%`, background: (token.bonding_progress ?? 0) >= 80 ? "hsl(24 95% 53%)" : "hsl(160 84% 39%)" }} />
                          </div>
                          <span className="text-[8px] font-mono text-muted-foreground">{(token.bonding_progress ?? 0).toFixed(0)}%</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter tabs */}
            <div className="px-4 pt-5">
              <div className="flex items-center gap-0 overflow-x-auto no-scrollbar border-b border-border">
                {FILTER_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={`px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap transition-all duration-200 border-b-2 -mb-px ${
                      activeFilter === tab.id
                        ? "text-foreground border-success"
                        : "text-muted-foreground border-transparent hover:text-foreground/70"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1.5 px-3 flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-success pulse-dot" />
                  <span className="text-[11px] font-mono text-muted-foreground">
                    <span className="text-foreground font-semibold">{onlineCount ?? '—'}</span> online
                  </span>
                </div>
              </div>
            </div>

            {/* Token Grid */}
            <div className="px-4 pt-3 pb-16">
              {tokensLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="lt-card overflow-hidden">
                      <Skeleton className="w-full skeleton-shimmer" style={{ paddingBottom: "58%", display: "block" }} />
                      <div className="p-2.5 space-y-1.5">
                        <Skeleton className="h-3 w-3/4 skeleton-shimmer" />
                        <Skeleton className="h-2 w-1/2 skeleton-shimmer" />
                        <Skeleton className="h-2 w-full skeleton-shimmer" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="text-center py-20 empty-state-fade">
                  <div className="inline-block rounded-2xl px-10 py-8" style={{ background: "hsl(var(--surface) / 0.6)", border: "1px solid hsl(var(--border))" }}>
                    <div className="text-3xl mb-3">🦞</div>
                    <p className="text-sm font-semibold text-foreground">No tokens found</p>
                    <p className="text-[11px] mt-1 text-muted-foreground">Try a different filter or check back soon</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                  {filteredTokens.map(token => (
                    <TokenCard
                      key={token.id}
                      token={token}
                      solPrice={solPrice}
                      isPromoted={promotedTokenIds.has(token.id)}
                    />
                  ))}
                </div>
              )}
            </div>

          </main>
        )}
      </div>

      {/* Launch Result Modal */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="bg-card border border-primary/30 rounded-2xl !w-[calc(100vw-2rem)] !max-w-[420px] !left-1/2 !-translate-x-1/2 p-0 overflow-hidden">
          <div className="relative px-5 pt-6 pb-4">
            <DialogHeader className="text-center">
              <DialogTitle className="flex items-center justify-center gap-2 text-xl font-bold text-foreground">
                {launchResult?.success ? (
                  <><PartyPopper className="h-6 w-6 text-primary" />Token Launched!</>
                ) : (
                  <><XCircle className="h-6 w-6 text-destructive" />Launch Failed</>
                )}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-center">
                {launchResult?.success ? "Your token is now live on the blockchain" : launchResult?.error || "Something went wrong"}
              </DialogDescription>
            </DialogHeader>
          </div>
          {launchResult?.success && (
            <div className="px-5 pb-6 space-y-3">
              {launchResult.imageUrl && (
                <div className="flex justify-center">
                  <img src={launchResult.imageUrl} alt="Token" className="w-20 h-20 rounded-xl object-cover border border-border" />
                </div>
              )}
              <div className="text-center">
                <p className="font-bold text-foreground">{launchResult.name}</p>
                <p className="text-muted-foreground text-sm">${launchResult.ticker}</p>
              </div>
              {launchResult.mintAddress && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary">
                  <code className="text-xs font-mono text-foreground/80 flex-1 truncate">{launchResult.mintAddress}</code>
                  <button onClick={() => copyToClipboard(launchResult.mintAddress!)} className="text-muted-foreground hover:text-foreground transition-colors">
                    {copiedAddress === launchResult.mintAddress ? <CheckCircle className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                {launchResult.tradeUrl && (
                  <Button asChild className="flex-1">
                    <Link to={launchResult.tradeUrl}>View Token</Link>
                  </Button>
                )}
                {launchResult.solscanUrl && (
                  <Button asChild variant="outline" size="icon">
                    <a href={launchResult.solscanUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Token Modal */}
      <CreateTokenModal open={showCreateDialog} onClose={closeCreateDialog} />

      {/* Promote Modal */}
      {showPromoteModal && promoteTokenId && (
        <PromoteModal
          isOpen={showPromoteModal}
          onClose={() => setShowPromoteModal(false)}
          tokenId={promoteTokenId}
          tokenName={promoteTokenName}
          tokenTicker={promoteTokenTicker}
          promoterWallet={solanaAddress || ""}
        />
      )}
    </div>
  );
}
