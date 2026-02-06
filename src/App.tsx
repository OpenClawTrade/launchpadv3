import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PrivyProviderWrapper } from "@/providers/PrivyProviderWrapper";
import { ChainProvider } from "@/contexts/ChainContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RuntimeConfigBootstrap } from "@/components/RuntimeConfigBootstrap";
import { EvmWalletProvider } from "@/providers/EvmWalletProvider";

// Critical: Load FunLauncherPage eagerly for instant home page
import FunLauncherPage from "./pages/FunLauncherPage";

// Lazy load other pages
const FunTokenDetailPage = lazy(() => import("./pages/FunTokenDetailPage"));
const TrendingPage = lazy(() => import("./pages/TrendingPage"));
const VanityAdminPage = lazy(() => import("./pages/VanityAdminPage"));
const LaunchpadTemplatePage = lazy(() => import("./pages/LaunchpadTemplatePage"));
const TwitterBotAdminPage = lazy(() => import("./pages/TwitterBotAdminPage"));
const InvestigateTokenPage = lazy(() => import("./pages/InvestigateTokenPage"));
const TreasuryAdminPage = lazy(() => import("./pages/TreasuryAdminPage"));
const TradePage = lazy(() => import("./pages/TradePage"));
const ApiDocsPage = lazy(() => import("./pages/ApiDocsPage"));
const ApiDashboardPage = lazy(() => import("./pages/ApiDashboardPage"));
const WidgetPage = lazy(() => import("./pages/WidgetPage"));
const TunaBookPage = lazy(() => import("./pages/TunaBookPage"));
const SubTunaPage = lazy(() => import("./pages/SubTunaPage"));
const TunaPostPage = lazy(() => import("./pages/TunaPostPage"));
const AgentDocsPage = lazy(() => import("./pages/AgentDocsPage"));
const AgentDashboardPage = lazy(() => import("./pages/AgentDashboardPage"));
const AgentLeaderboardPage = lazy(() => import("./pages/AgentLeaderboardPage"));
const AgentProfilePage = lazy(() => import("./pages/AgentProfilePage"));
const TunaBookAdminPage = lazy(() => import("./pages/TunaBookAdminPage"));
const AgentClaimPage = lazy(() => import("./pages/AgentClaimPage"));
const AgentLogsAdminPage = lazy(() => import("./pages/AgentLogsAdminPage"));
const PumpAgentsPage = lazy(() => import("./pages/PumpAgentsPage"));
const BagsAgentsPage = lazy(() => import("./pages/BagsAgentsPage"));
const TradingAgentsPage = lazy(() => import("./pages/TradingAgentsPage"));
const TradingAgentProfilePage = lazy(() => import("./pages/TradingAgentProfilePage"));
const InfluencerRepliesAdminPage = lazy(() => import("./pages/InfluencerRepliesAdminPage"));
const PromoMentionsAdminPage = lazy(() => import("./pages/PromoMentionsAdminPage"));
const DeployerDustAdminPage = lazy(() => import("./pages/DeployerDustAdminPage"));
const ColosseumAdminPage = lazy(() => import("./pages/ColosseumAdminPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Minimal loading spinner for route transitions
function RouteLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
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
    <PrivyProviderWrapper>
      <ChainProvider>
        <EvmWalletProvider>
          <TooltipProvider delayDuration={300}>
            <Toaster />
            <Sonner />
            <ErrorBoundary>
              <BrowserRouter>
                <Suspense fallback={<RouteLoader />}>
                  <Routes>
                    <Route path="/" element={<FunLauncherPage />} />
                    {/* Chain-specific launch routes */}
                    <Route path="/launch" element={<Navigate to="/launch/solana" replace />} />
                    <Route path="/launch/solana" element={<FunLauncherPage />} />
                    <Route path="/launch/base" element={<FunLauncherPage />} />
                    <Route path="/launch/ethereum" element={<FunLauncherPage />} />
                    <Route path="/launch/bnb" element={<FunLauncherPage />} />
                    <Route path="/launchpad/:mintAddress" element={<FunTokenDetailPage />} />
                    <Route path="/trending" element={<TrendingPage />} />
                    <Route path="/vanity-admin" element={<VanityAdminPage />} />
                    <Route path="/site" element={<LaunchpadTemplatePage />} />
                    <Route path="/admin/twitter" element={<TwitterBotAdminPage />} />
                    <Route path="/admin/treasury" element={<TreasuryAdminPage />} />
                    <Route path="/trade" element={<TradePage />} />
                    <Route path="/investigate-token" element={<InvestigateTokenPage />} />
                    <Route path="/api" element={<ApiDashboardPage />} />
                    <Route path="/api/docs" element={<ApiDocsPage />} />
                    <Route path="/widget/:type" element={<WidgetPage />} />
                    <Route path="/agents" element={<TunaBookPage />} />
                    <Route path="/t/:ticker" element={<SubTunaPage />} />
                    <Route path="/t/:ticker/post/:postId" element={<TunaPostPage />} />
                    <Route path="/agents/docs" element={<AgentDocsPage />} />
                    <Route path="/agents/dashboard" element={<AgentDashboardPage />} />
                    <Route path="/agents/leaderboard" element={<AgentLeaderboardPage />} />
                    <Route path="/agent/:agentId" element={<AgentProfilePage />} />
                    <Route path="/agents/claim" element={<AgentClaimPage />} />
                    <Route path="/agents/pump" element={<PumpAgentsPage />} />
                    <Route path="/agents/bags" element={<BagsAgentsPage />} />
                    <Route path="/agents/trading" element={<TradingAgentsPage />} />
                    <Route path="/agents/trading/:id" element={<TradingAgentProfilePage />} />
                    <Route path="/admin/tunabook" element={<TunaBookAdminPage />} />
                    <Route path="/admin/agent-logs" element={<AgentLogsAdminPage />} />
                    <Route path="/admin/influencer-replies" element={<InfluencerRepliesAdminPage />} />
                    <Route path="/admin/promo-mentions" element={<PromoMentionsAdminPage />} />
                    <Route path="/admin/deployer-dust" element={<DeployerDustAdminPage />} />
                    <Route path="/admin/colosseum" element={<ColosseumAdminPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </ErrorBoundary>
          </TooltipProvider>
        </EvmWalletProvider>
      </ChainProvider>
    </PrivyProviderWrapper>
  </QueryClientProvider>
);

export default App;
