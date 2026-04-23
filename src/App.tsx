import React, { Suspense } from "react";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
// Blockhash poller is started lazily in useFastSwap when trading is needed
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TradeSuccessPopup } from "@/components/TradeSuccessPopup";


import { GlobalTradeNotifier } from "@/components/GlobalTradeNotifier";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";

function LaunchpadRedirect() {
  const { mintAddress } = useParams();
  return <Navigate to={`/trade/${mintAddress}`} replace />;
}
import { PrivyProviderWrapper } from "@/providers/PrivyProviderWrapper";
import { ChainProvider, useChain } from "@/contexts/ChainContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RuntimeConfigBootstrap } from "@/components/RuntimeConfigBootstrap";
import { EvmWalletProvider } from "@/providers/EvmWalletProvider";
import { DomainRouter } from "@/components/DomainRouter";
import { MatrixModeProvider } from "@/contexts/MatrixModeContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { BtcWalletProvider } from "@/contexts/BtcWalletContext";
import { AdminPasswordGate } from "@/components/admin/AdminPasswordGate";

// Lazy load FunLauncherPage like all other pages to reduce build memory
const FunLauncherPage = lazyWithRetry(() => import("./pages/FunLauncherPage"));

// Lazy load other pages
const FunTokenDetailPage = lazyWithRetry(() => import("./pages/FunTokenDetailPage"));
const TrendingPage = lazyWithRetry(() => import("./pages/TrendingPage"));
const VanityAdminPage = lazyWithRetry(() => import("./pages/VanityAdminPage"));
const LaunchpadTemplatePage = lazyWithRetry(() => import("./pages/LaunchpadTemplatePage"));
const InvestigateTokenPage = lazyWithRetry(() => import("./pages/InvestigateTokenPage"));
const TradePage = lazyWithRetry(() => import("./pages/TradePage"));
const WidgetPage = lazyWithRetry(() => import("./pages/WidgetPage"));
const SaturnForumPage = lazyWithRetry(() => import("./pages/SaturnForumPage"));
const SaturnCommunityPage = lazyWithRetry(() => import("./pages/SaturnCommunityPage"));
const SaturnPostPage = lazyWithRetry(() => import("./pages/SaturnPostPage"));
const AgentDocsPage = lazyWithRetry(() => import("./pages/AgentDocsPage"));
const AgentDashboardPage = lazyWithRetry(() => import("./pages/AgentDashboardPage"));
const AgentLeaderboardPage = lazyWithRetry(() => import("./pages/AgentLeaderboardPage"));
const AgentProfilePage = lazyWithRetry(() => import("./pages/AgentProfilePage"));
const AgentConnectPage = lazyWithRetry(() => import("./pages/AgentConnectPage"));
const BagsAgentsPage = lazyWithRetry(() => import("./pages/BagsAgentsPage"));
const TradingAgentProfilePage = lazyWithRetry(() => import("./pages/TradingAgentProfilePage"));
const WhitepaperPage = lazyWithRetry(() => import("./pages/WhitepaperPage"));
const PopshibaDocsPage = lazyWithRetry(() => import("./pages/PopshibaDocsPage"));

const CareersPage = lazyWithRetry(() => import("./pages/CareersPage"));
const SaturnModePage = lazyWithRetry(() => import("./pages/SaturnModePage"));
const TunnelDistributePage = lazyWithRetry(() => import("./pages/TunnelDistributePage"));
const CompressedDistributePage = lazyWithRetry(() => import("./pages/CompressedDistributePage"));
const DecompressPage = lazyWithRetry(() => import("./pages/DecompressPage"));
const FunModePage = lazyWithRetry(() => import("./pages/FunModePage"));
const AdminPanelPage = lazyWithRetry(() => import("./pages/AdminPanelPage"));
const PublicDeployPage = lazyWithRetry(() => import("./pages/PublicDeployPage"));
const BondingDeployPage = lazyWithRetry(() => import("./pages/BondingDeployPage"));
const V4ProofPage = lazyWithRetry(() => import("./pages/V4ProofPage"));
const PopV4ListPage = lazyWithRetry(() => import("./pages/PopV4ListPage"));
const PopV4TokenDetailPage = lazyWithRetry(() => import("./pages/PopV4TokenDetailPage"));
const BrandingAdminPage = lazyWithRetry(() => import("./pages/BrandingAdminPage"));
const BrandAssetsPage = lazyWithRetry(() => import("./pages/BrandAssetsPage"));

const BannerMakerPage = lazyWithRetry(() => import("./pages/BannerMakerPage"));
const AlphaTrackerPage = lazyWithRetry(() => import("./pages/AlphaTrackerPage"));
const XTrackerPage = lazyWithRetry(() => import("./pages/XTrackerPage"));
const DiscoverPage = lazyWithRetry(() => import("./pages/DiscoverPage"));
const UserProfilePage = lazyWithRetry(() => import("./pages/UserProfilePage"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const PanelPage = lazyWithRetry(() => import("./pages/PanelPage"));
const MerchStorePage = lazyWithRetry(() => import("./pages/MerchStorePage"));
const LeveragePage = lazyWithRetry(() => import("./pages/LeveragePage"));
const DexListPage = lazyWithRetry(() => import("./pages/DexListPage"));
const ReferralRedirectPage = lazyWithRetry(() => import("./pages/ReferralRedirectPage"));
const WalletTrackerPage = lazyWithRetry(() => import("./pages/WalletTrackerPage"));
const CreateTokenPage = lazyWithRetry(() => import("./pages/CreateTokenPage"));
const SixtyNineListPage = lazyWithRetry(() => import("./pages/SixtyNineListPage"));
const AllTokensPage = lazyWithRetry(() => import("./pages/AllTokensPage"));
const RewardsPage = lazyWithRetry(() => import("./pages/RewardsPage"));
const MeteoritePage = lazyWithRetry(() => import("./pages/MeteoritePage"));
const PortfolioPage = lazyWithRetry(() => import("./pages/PortfolioPage"));
const BondingCurveLabPage = lazyWithRetry(() => import("./pages/BondingCurveLabPage"));
const BitcoinModePage = lazyWithRetry(() => import("./pages/BitcoinModePage"));
const BitcoinLaunchPage = lazyWithRetry(() => import("./pages/BitcoinLaunchPage"));
const BitcoinTokenDetailPage = lazyWithRetry(() => import("./pages/BitcoinTokenDetailPage"));
const BtcMemeLaunchPage = lazyWithRetry(() => import("./pages/BtcMemeLaunchPage"));
const BtcMemeDetailPage = lazyWithRetry(() => import("./pages/BtcMemeDetailPage"));
const V2BitcoinModePage = lazyWithRetry(() => import("./pages/V2BitcoinModePage"));
const V2BtcMemeLaunchPage = lazyWithRetry(() => import("./pages/V2BtcMemeLaunchPage"));
const V2BtcMemeDetailPage = lazyWithRetry(() => import("./pages/V2BtcMemeDetailPage"));
const TATWhitepaperPage = lazyWithRetry(() => import("./pages/TATWhitepaperPage"));
const PerpsPage = lazyWithRetry(() => import("./pages/PerpsPage"));
const SellAllPage = lazyWithRetry(() => import("./pages/SellAllPage"));
const ApePage = lazyWithRetry(() => import("./pages/ApePage"));

const HomePage = lazyWithRetry(() => import("./pages/HomePage"));
const PopshibaLaunchpadPage = lazyWithRetry(() => import("./pages/PopshibaLaunchpadPage"));
const LaunchNowPage = lazyWithRetry(() => import("./pages/LaunchNowPage"));
const PopshibaEarnings = lazyWithRetry(() => import("./pages/PopshibaEarnings"));
const PopshibaAlphaPage = lazyWithRetry(() => import("./pages/PopshibaAlphaPage"));
const PopshibaXTrackerPage = lazyWithRetry(() => import("./pages/PopshibaXTrackerPage"));
const BondingListPage = lazyWithRetry(() => import("./pages/BondingListPage"));
const BondingCreatePage = lazyWithRetry(() => import("./pages/BondingCreatePage"));
const BondingTokenDetailPage = lazyWithRetry(() => import("./pages/BondingTokenDetailPage"));
const BondingClaimPage = lazyWithRetry(() => import("./pages/BondingClaimPage"));
const BondingProfilePage = lazyWithRetry(() => import("./pages/BondingProfilePage"));

function RouteChainSync() {
  return null;
}

// `/` now serves the new Popshiba Launchpad (ported from popshiba-site/launch.html).
// The previous landing is preserved at `/preview-old` and will be re-enabled
// once the terminal/pulse pages are fully functional.
function DomainRoot() {
  return <Suspense fallback={<RouteLoader />}><PopshibaLaunchpadPage /></Suspense>;
}

// Minimal loading spinner for route transitions
function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center relative z-[1]">
      <div className="w-6 h-6 border-2 border-transparent border-t-primary rounded-full animate-spin" />
    </div>
  );
}

// Configure QueryClient with performance optimizations
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes - reduce refetches
      gcTime: 1000 * 60 * 10, // 10 minutes cache
      refetchOnWindowFocus: false, // Don't refetch on tab focus
      retry: 1, // Only retry once on failure
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RuntimeConfigBootstrap />
    <BrandingProvider>
    <PrivyProviderWrapper>
      <ChainProvider>
        <EvmWalletProvider>
          <BtcWalletProvider>
          <MatrixModeProvider>
          <TooltipProvider delayDuration={300}>
            <Toaster />
            <Sonner />
            <ErrorBoundary>
              <BrowserRouter>
              <RouteChainSync />
              <TradeSuccessPopup />
              
              
              <GlobalTradeNotifier />
                
                <DomainRouter />
                <Suspense fallback={<RouteLoader />}>
                   <div className="relative z-[1]">
                   <Routes>
                    <Route path="/" element={<DomainRoot />} />
                    <Route path="/launchnow" element={<AdminPasswordGate title="Launch Now (Admin)"><LaunchNowPage /></AdminPasswordGate>} />
                    {/* Backup: previous landing kept here while the launchpad-only era is live */}
                    <Route path="/preview-old" element={<Suspense fallback={<RouteLoader />}><HomePage /></Suspense>} />
                    <Route path="/tokens" element={<LaunchpadLayout><AllTokensPage /></LaunchpadLayout>} />
                    <Route path="/69" element={<SixtyNineListPage />} />
                    {/* /launchpad → / (the new home IS the launchpad) */}
                    <Route path="/launchpad" element={<Navigate to="/" replace />} />
                    <Route path="/launchpad/create" element={<Navigate to="/" replace />} />
                    <Route path="/terminal" element={<FunLauncherPage />} />
                    
                     {/* Chain-specific launch routes — deprecated, all launches happen from home */}
                     <Route path="/launch" element={<Navigate to="/" replace />} />
                     <Route path="/launch/:chain" element={<Navigate to="/" replace />} />
                    <Route path="/trade/:mintAddress" element={<LaunchpadLayout><FunTokenDetailPage /></LaunchpadLayout>} />
                    <Route path="/launchpad/:mintAddress" element={<LaunchpadLayout><LaunchpadRedirect /></LaunchpadLayout>} />
                    <Route path="/trending" element={<TrendingPage />} />
                    <Route path="/vanity-admin" element={<LaunchpadLayout><VanityAdminPage /></LaunchpadLayout>} />
                    <Route path="/site" element={<LaunchpadLayout><LaunchpadTemplatePage /></LaunchpadLayout>} />
                    <Route path="/admin" element={<AdminPanelPage />} />
                    <Route path="/deploy" element={<LaunchpadLayout><PublicDeployPage /></LaunchpadLayout>} />
                    <Route path="/bonding/deploy" element={<BondingDeployPage />} />
                    <Route path="/v4-proof" element={<V4ProofPage />} />
                    <Route path="/popv4" element={<PopV4ListPage />} />
                    <Route path="/popv4/:address" element={<PopV4TokenDetailPage />} />
                    <Route path="/admin/branding" element={<BrandingAdminPage />} />
                    <Route path="/admin/brand-assets" element={<BrandAssetsPage />} />
                    <Route path="/admin/twitter" element={<Navigate to="/admin?tab=xbots" replace />} />
                    <Route path="/admin/treasury" element={<Navigate to="/admin?tab=treasury" replace />} />
                    <Route path="/trade" element={<LaunchpadLayout><TradePage /></LaunchpadLayout>} />
                    <Route path="/ape" element={<ApePage />} />
                    <Route path="/ape/:address" element={<ApePage />} />
                    <Route path="/ape/:chain/:address" element={<ApePage />} />
                     <Route path="/alpha-tracker" element={<PopshibaAlphaPage />} />
                     <Route path="/alpha" element={<PopshibaAlphaPage />} />
                     <Route path="/x-tracker" element={<PopshibaXTrackerPage />} />
                     <Route path="/tracker" element={<PopshibaXTrackerPage />} />
                     <Route path="/x-tracker-classic" element={<LaunchpadLayout><XTrackerPage /></LaunchpadLayout>} />
                     <Route path="/discover" element={<LaunchpadLayout><DiscoverPage /></LaunchpadLayout>} />
                     <Route path="/profile/:identifier" element={<LaunchpadLayout><UserProfilePage /></LaunchpadLayout>} />
                    <Route path="/investigate-token" element={<InvestigateTokenPage />} />
                    <Route path="/widget/:type" element={<WidgetPage />} />
                    <Route path="/agents" element={<LaunchpadLayout><SaturnForumPage /></LaunchpadLayout>} />
                    <Route path="/t/:ticker" element={<LaunchpadLayout><SaturnCommunityPage /></LaunchpadLayout>} />
                    <Route path="/t/:ticker/post/:postId" element={<LaunchpadLayout><SaturnPostPage /></LaunchpadLayout>} />
                    <Route path="/agents/docs" element={<LaunchpadLayout><AgentDocsPage /></LaunchpadLayout>} />
                    <Route path="/agents/dashboard" element={<LaunchpadLayout><AgentDashboardPage /></LaunchpadLayout>} />
                    <Route path="/agents/leaderboard" element={<LaunchpadLayout><AgentLeaderboardPage /></LaunchpadLayout>} />
                    <Route path="/agent/:agentId" element={<LaunchpadLayout><AgentProfilePage /></LaunchpadLayout>} />
                    <Route path="/agents/claim" element={<Navigate to="/panel?tab=earnings" replace />} />
                    <Route path="/agents/connect" element={<LaunchpadLayout><AgentConnectPage /></LaunchpadLayout>} />
                    
                    <Route path="/agents/bags" element={<LaunchpadLayout><BagsAgentsPage /></LaunchpadLayout>} />
                    <Route path="/agents/trading" element={<Navigate to="/agents?tab=trading" replace />} />
                    <Route path="/trading-agents" element={<Navigate to="/agents?tab=trading" replace />} />
                    <Route path="/agents/trading/:id" element={<LaunchpadLayout><TradingAgentProfilePage /></LaunchpadLayout>} />
                    <Route path="/admin/clawbook" element={<Navigate to="/admin?tab=forum" replace />} />
                    <Route path="/admin/agent-logs" element={<Navigate to="/admin?tab=agent-logs" replace />} />
                    <Route path="/admin/influencer-replies" element={<Navigate to="/admin?tab=promo" replace />} />
                    <Route path="/admin/promo-mentions" element={<Navigate to="/admin?tab=promo" replace />} />
                    <Route path="/admin/deployer-dust" element={<Navigate to="/admin?tab=deployer" replace />} />
                    
                    <Route path="/partnerfees" element={<Navigate to="/admin?tab=partner-fees" replace />} />
                    <Route path="/whitepaper" element={<WhitepaperPage />} />
                    <Route path="/docs" element={<LaunchpadLayout><PopshibaDocsPage /></LaunchpadLayout>} />
                    
                     <Route path="/sdk" element={<Navigate to="/" replace />} />
                     <Route path="/opentuna" element={<Navigate to="/" replace />} />
                     <Route path="/api" element={<Navigate to="/" replace />} />
                     <Route path="/api/docs" element={<Navigate to="/" replace />} />
                    <Route path="/careers" element={<LaunchpadLayout><CareersPage /></LaunchpadLayout>} />
                    <Route path="/admin/x-bots" element={<Navigate to="/admin?tab=xbots" replace />} />
                    <Route path="/admin/follower-scan" element={<Navigate to="/admin?tab=follower-scan" replace />} />
                    <Route path="/claw" element={<LaunchpadLayout><SaturnModePage /></LaunchpadLayout>} />
                    <Route path="/claw/adminlaunch" element={<Navigate to="/admin?tab=saturn-launch" replace />} />
                    
                    <Route path="/admin/tunnel-distribute" element={<LaunchpadLayout><TunnelDistributePage /></LaunchpadLayout>} />
                    <Route path="/admin/compressed-distribute" element={<LaunchpadLayout><CompressedDistributePage /></LaunchpadLayout>} />
                    <Route path="/decompress" element={<LaunchpadLayout><DecompressPage /></LaunchpadLayout>} />
                     <Route path="/fun" element={<LaunchpadLayout><FunModePage /></LaunchpadLayout>} />
                     
                     <Route path="/panel" element={<PanelPage />} />
                     <Route path="/merch" element={<MerchStorePage />} />
                     <Route path="/leverage" element={<LeveragePage />} />
                     <Route path="/perps" element={<LaunchpadLayout><PerpsPage /></LaunchpadLayout>} />
                     <Route path="/perps/trade/:tokenAddress" element={<LaunchpadLayout><PerpsPage /></LaunchpadLayout>} />
                     <Route path="/meteorite" element={<LaunchpadLayout><MeteoritePage /></LaunchpadLayout>} />
                     <Route path="/dexlist" element={<LaunchpadLayout><DexListPage /></LaunchpadLayout>} />
                     <Route path="/banner-maker" element={<LaunchpadLayout><BannerMakerPage /></LaunchpadLayout>} />
                     <Route path="/portfolio" element={<LaunchpadLayout><PortfolioPage /></LaunchpadLayout>} />
                     <Route path="/earnings" element={<PopshibaEarnings />} />
                     <Route path="/punch" element={<Navigate to="/" replace />} />
                     <Route path="/punch-test" element={<Navigate to="/" replace />} />
                     <Route path="/link/:code" element={<ReferralRedirectPage />} />
                     <Route path="/wallet-tracker" element={<WalletTrackerPage />} />
                     <Route path="/rewards" element={<LaunchpadLayout><RewardsPage /></LaunchpadLayout>} />
                     <Route path="/lab/bonding-curve" element={<LaunchpadLayout><BondingCurveLabPage /></LaunchpadLayout>} />
                     <Route path="/bonding" element={<BondingListPage />} />
                     <Route path="/bonding/create" element={<BondingCreatePage />} />
                     <Route path="/bonding/token/:address" element={<BondingTokenDetailPage />} />
                     <Route path="/bonding/claim" element={<BondingClaimPage />} />
                     <Route path="/bonding/profile/:address" element={<BondingProfilePage />} />
                     <Route path="/btc" element={<LaunchpadLayout><V2BitcoinModePage /></LaunchpadLayout>} />
                     <Route path="/btc/meme/launch" element={<LaunchpadLayout><V2BtcMemeLaunchPage /></LaunchpadLayout>} />
                     <Route path="/btc/meme/:id" element={<LaunchpadLayout><V2BtcMemeDetailPage /></LaunchpadLayout>} />
                     <Route path="/btc/whitepaper" element={<LaunchpadLayout><TATWhitepaperPage /></LaunchpadLayout>} />
                     <Route path="/v2btc" element={<Navigate to="/btc" replace />} />
                     <Route path="/v2btc/meme/launch" element={<Navigate to="/btc/meme/launch" replace />} />
                     <Route path="/v2btc/meme/:id" element={<Navigate to="/btc" replace />} />
                     <Route path="/ai-collab" element={<Navigate to="/admin?tab=ai-collab" replace />} />
                     <Route path="/sellall" element={<LaunchpadLayout><SellAllPage /></LaunchpadLayout>} />
                     <Route path="*" element={<LaunchpadLayout><NotFound /></LaunchpadLayout>} />
                  </Routes>
                  </div>
                </Suspense>
              </BrowserRouter>
            </ErrorBoundary>
          </TooltipProvider>
          </MatrixModeProvider>
          </BtcWalletProvider>
        </EvmWalletProvider>
      </ChainProvider>
    </PrivyProviderWrapper>
    </BrandingProvider>
  </QueryClientProvider>
);

export default App;
