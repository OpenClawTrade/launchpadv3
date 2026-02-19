import { useState, useCallback, useMemo } from "react";
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
import { SniperStatusPanel } from "@/components/admin/SniperStatusPanel";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronLeft, ChevronRight, PartyPopper, XCircle, ExternalLink, Copy, CheckCircle,
  Crown, Coins, Wallet, Trophy, BarChart3, Users, AlertCircle, Flame, Bot, Clock,
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
  { id: "promoted", label: "⭐ Promoted" },
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
      case "promoted": return tokens.filter(t => promotedTokenIds.has(t.id));
      default: return tokens;
    }
  }, [tokens, activeFilter, promotedTokenIds]);

  return (
    <div className="min-h-screen" style={{ background: "#141414" }}>
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
                <Flame className="h-3.5 w-3.5" style={{ color: "#4ade80" }} />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#888" }}>
                  Just Launched
                </span>
                <span style={{ color: "#444", fontSize: "10px" }}>— Last 24h</span>
              </div>

              {/* Horizontal scroll of Just Launched cards */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {justLaunchedLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-[150px] h-[195px] rounded-lg" style={{ background: "#1a1a1a" }}>
                      <Skeleton className="w-full h-full rounded-lg" style={{ background: "#2a2a2a" }} />
                    </div>
                  ))
                  : justLaunchedTokens.slice(0, 12).map(token => (
                    <Link
                      key={token.id}
                      to={token.agent_id || token.launchpad_type === 'pumpfun' || token.launchpad_type === 'bags'
                        ? `/t/${token.ticker}`
                        : `/launchpad/${token.mint_address || token.id}`}
                      className="flex-shrink-0 w-[150px] rounded-lg overflow-hidden group transition-all duration-150"
                      style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "#4ade80")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    >
                      {/* Image */}
                      <div className="relative w-full" style={{ paddingBottom: "65%" }}>
                        <div className="absolute inset-0">
                          {token.image_url ? (
                            <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ background: "#2a2a2a", color: "#4ade80" }}>
                              {token.ticker?.slice(0, 2)}
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }} />
                          <div className="absolute bottom-1 left-1.5">
                            <span className="text-[10px] font-bold font-mono text-white">
                              {formatUsd(token.market_cap_sol)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-1.5">
                        <div className="text-[11px] font-semibold text-white truncate">{token.name}</div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono" style={{ color: "#4ade80" }}>${token.ticker}</span>
                          <span className="text-[9px] font-mono" style={{ color: "#666" }}>{formatAge(token.created_at)}</span>
                        </div>
                        {(token as any).description && (
                          <p className="text-[9px] leading-tight mt-0.5 line-clamp-1" style={{ color: "#666" }}>{(token as any).description}</p>
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
                  <Crown className="h-3.5 w-3.5 text-yellow-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#888" }}>King of the Hill</span>
                  <span style={{ color: "#444", fontSize: "10px" }}>— Soon to Graduate</span>
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
                        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                        style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", minWidth: "200px" }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = "#4ade80")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
                      >
                        <span className="text-[10px] font-bold font-mono w-4 text-center flex-shrink-0" style={{ color: i === 0 ? "#facc15" : i === 1 ? "#cbd5e1" : "#f97316" }}>#{i + 1}</span>
                        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0" style={{ background: "#2a2a2a" }}>
                          {token.image_url ? <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-bold" style={{ color: "#4ade80" }}>{token.ticker?.slice(0, 2)}</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-white truncate">{token.name}</div>
                          <div className="text-[9px] font-mono" style={{ color: "#4ade80" }}>
                            ${marketCapUsd >= 1000 ? `${(marketCapUsd / 1000).toFixed(1)}K` : marketCapUsd.toFixed(0)}
                          </div>
                        </div>
                        <div className="flex-shrink-0 w-16">
                          <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "#2a2a2a" }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(token.bonding_progress ?? 0, 100)}%`, background: (token.bonding_progress ?? 0) >= 80 ? "#f97316" : "#4ade80" }} />
                          </div>
                          <span className="text-[8px] font-mono" style={{ color: "#666" }}>{(token.bonding_progress ?? 0).toFixed(0)}%</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter tabs */}
            <div className="px-4 pt-5">
              <div
                className="flex items-center gap-0 overflow-x-auto no-scrollbar"
                style={{ borderBottom: "1px solid #2a2a2a" }}
              >
                {FILTER_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className="px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px"
                    style={{
                      color: activeFilter === tab.id ? "#fff" : "#666",
                      borderBottomColor: activeFilter === tab.id ? "#4ade80" : "transparent",
                      background: "transparent",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
                {/* Online indicator */}
                <div className="ml-auto flex items-center gap-1.5 px-3 flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[11px] font-mono" style={{ color: "#666" }}>
                    <span className="text-white font-semibold">{onlineCount ?? '—'}</span> online
                  </span>
                </div>
              </div>
            </div>

            {/* Token Grid — 4 columns */}
            <div className="px-4 pt-4 pb-8">
              {tokensLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="rounded-lg overflow-hidden" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
                      <Skeleton className="w-full" style={{ paddingBottom: "62%", display: "block", background: "#2a2a2a" }} />
                      <div className="p-2.5 space-y-1">
                        <Skeleton className="h-3 w-3/4" style={{ background: "#2a2a2a" }} />
                        <Skeleton className="h-2.5 w-1/2" style={{ background: "#2a2a2a" }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="text-center py-20" style={{ color: "#666" }}>
                  <p className="text-lg font-semibold">No tokens found</p>
                  <p className="text-sm mt-1">Try a different filter</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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

            {/* Stats footer strip */}
            <div
              className="px-4 py-2.5 flex items-center gap-6 overflow-x-auto no-scrollbar"
              style={{ background: "#1a1a1a", borderTop: "1px solid #2a2a2a" }}
            >
              {[
                { label: "Tokens", value: String(agentStats?.totalTokensLaunched ?? totalCount) },
                { label: "Agents", value: String(agentStats?.totalAgents ?? 0) },
                { label: "Fees Claimed", value: `${formatSOL(totalClaimed)} SOL` },
                { label: "Agent Posts", value: String(agentStats?.totalAgentPosts ?? 0) },
                { label: "Payouts", value: `${formatSOL(agentStats?.totalAgentPayouts ?? 0)} SOL` },
              ].map((stat, i) => (
                <div key={stat.label} className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: "#555" }}>{stat.label}</span>
                  <span className="text-[12px] font-bold font-mono text-white">{stat.value}</span>
                </div>
              ))}
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
