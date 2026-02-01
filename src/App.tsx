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
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </ChainProvider>
    </PrivyProviderWrapper>
  </QueryClientProvider>
);

export default App;
