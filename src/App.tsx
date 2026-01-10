import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PrivyProviderWrapper } from "@/providers/PrivyProviderWrapper";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Critical: Load Index page eagerly for instant home page
import Index from "./pages/Index";

// Lazy load all other pages - they'll be loaded on demand
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const BookmarksPage = lazy(() => import("./pages/BookmarksPage"));
const CommunitiesPage = lazy(() => import("./pages/CommunitiesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const PostDetailPage = lazy(() => import("./pages/PostDetailPage"));
const AIPage = lazy(() => import("./pages/AIPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const CookiesPage = lazy(() => import("./pages/CookiesPage"));
const AccessibilityPage = lazy(() => import("./pages/AccessibilityPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Launchpad pages
const LaunchpadPage = lazy(() => import("./pages/LaunchpadPage"));
const LaunchTokenPage = lazy(() => import("./pages/LaunchTokenPage"));
const TokenDetailPage = lazy(() => import("./pages/TokenDetailPage"));
const EarningsPage = lazy(() => import("./pages/EarningsPage"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const RoadmapPage = lazy(() => import("./pages/RoadmapPage"));
const PulsePage = lazy(() => import("./pages/PulsePage"));

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
    <PrivyProviderWrapper>
      <AuthProvider>
        <TooltipProvider delayDuration={300}>
          <Toaster />
          <Sonner />
          <ErrorBoundary>
            <BrowserRouter>
              <Suspense fallback={<RouteLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/explore" element={<ExplorePage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/messages" element={<MessagesPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/bookmarks" element={<BookmarksPage />} />
                  <Route path="/communities" element={<CommunitiesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/ai" element={<AIPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/cookies" element={<CookiesPage />} />
                  <Route path="/accessibility" element={<AccessibilityPage />} />
                  <Route path="/post/:postId" element={<PostDetailPage />} />
                  <Route path="/launchpad" element={<LaunchpadPage />} />
                  <Route path="/launch" element={<LaunchTokenPage />} />
                  <Route path="/launchpad/:mintAddress" element={<TokenDetailPage />} />
                  <Route path="/earnings" element={<EarningsPage />} />
                  <Route path="/portfolio" element={<PortfolioPage />} />
                  <Route path="/roadmap" element={<RoadmapPage />} />
                  <Route path="/pulse" element={<PulsePage />} />
                  <Route path="/:username" element={<UserProfilePage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </PrivyProviderWrapper>
  </QueryClientProvider>
);

export default App;