import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PrivyProviderWrapper } from "@/providers/PrivyProviderWrapper";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RuntimeConfigBootstrap } from "@/components/RuntimeConfigBootstrap";

// Critical: Load FunLauncherPage eagerly for instant home page
import FunLauncherPage from "./pages/FunLauncherPage";

// Lazy load other pages
const LaunchpadPage = lazy(() => import("./pages/LaunchpadPage"));
const LaunchTokenPage = lazy(() => import("./pages/LaunchTokenPage"));
const TokenDetailPage = lazy(() => import("./pages/TokenDetailPage"));
const EarningsPage = lazy(() => import("./pages/EarningsPage"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const TrendingPage = lazy(() => import("./pages/TrendingPage"));
const VanityGeneratorPage = lazy(() => import("./pages/VanityGeneratorPage"));
const ApiDashboardPage = lazy(() => import("./pages/ApiDashboardPage"));
const ApiBuilderPage = lazy(() => import("./pages/ApiBuilderPage"));
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
      <TooltipProvider delayDuration={300}>
        <Toaster />
        <Sonner />
        <ErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/" element={<FunLauncherPage />} />
                <Route path="/launchpad" element={<LaunchpadPage />} />
                <Route path="/launch" element={<LaunchTokenPage />} />
                <Route path="/launchpad/:mintAddress" element={<TokenDetailPage />} />
                <Route path="/earnings" element={<EarningsPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/trending" element={<TrendingPage />} />
                <Route path="/vanity" element={<VanityGeneratorPage />} />
                <Route path="/api" element={<ApiDashboardPage />} />
                <Route path="/api/builder" element={<ApiBuilderPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </PrivyProviderWrapper>
  </QueryClientProvider>
);

export default App;
