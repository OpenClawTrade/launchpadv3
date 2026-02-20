import { useState, useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Wallet, Briefcase, DollarSign, Plus, Bot, Fingerprint, Rocket } from "lucide-react";
import clawLogo from "@/assets/claw-logo.png";

// Lazy tab content
const PanelPortfolioTab = lazy(() => import("@/components/panel/PanelPortfolioTab"));
const PanelEarningsTab = lazy(() => import("@/components/panel/PanelEarningsTab"));
const PanelNfaTab = lazy(() => import("@/components/panel/PanelNfaTab"));
const PanelAgentsTab = lazy(() => import("@/components/panel/PanelAgentsTab"));
const PanelMyLaunchesTab = lazy(() => import("@/components/panel/PanelMyLaunchesTab"));

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-transparent border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export default function PanelPage() {
  const { isAuthenticated, login, user, solanaAddress } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "nfas";

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="md:ml-[160px] flex flex-col min-h-screen">
          <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
            <img src={clawLogo} alt="Claw Mode" className="h-16 w-16 rounded-xl mb-6" />
            <h1 className="text-2xl font-bold mb-2 font-mono" style={{ color: "#4ade80" }}>
              CLAW MODE PANEL
            </h1>
            <p className="text-muted-foreground text-center mb-6 max-w-md text-sm">
              Connect your wallet to access your portfolio, earnings, NFAs, and trading agents — all in one place.
            </p>
            <Button
              onClick={() => login()}
              className="gap-2 font-mono"
              style={{ background: "#4ade80", color: "#000" }}
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="md:ml-[160px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />

        {/* Panel Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 mb-4">
            <img src={clawLogo} alt="Claw Mode" className="h-8 w-8 rounded-lg" />
            <div>
              <h1 className="text-lg font-bold font-mono" style={{ color: "#4ade80" }}>
                PANEL
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                {solanaAddress ? `${solanaAddress.slice(0, 6)}...${solanaAddress.slice(-4)}` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 flex-1">
          <Tabs value={activeTab} onValueChange={setTab}>
            <TabsList className="w-full bg-white/5 border border-white/10 mb-4">
              <TabsTrigger value="nfas" className="flex-1 gap-1.5 text-xs">
                <Fingerprint className="h-3.5 w-3.5" />
                NFAs
              </TabsTrigger>
              <TabsTrigger value="portfolio" className="flex-1 gap-1.5 text-xs">
                <Briefcase className="h-3.5 w-3.5" />
                Portfolio
              </TabsTrigger>
              <TabsTrigger value="earnings" className="flex-1 gap-1.5 text-xs">
                <DollarSign className="h-3.5 w-3.5" />
                Earnings
              </TabsTrigger>
              <TabsTrigger value="agents" className="flex-1 gap-1.5 text-xs">
                <Bot className="h-3.5 w-3.5" />
                Agents
              </TabsTrigger>
              <TabsTrigger value="launches" className="flex-1 gap-1.5 text-xs">
                <Rocket className="h-3.5 w-3.5" />
                Launches
              </TabsTrigger>
            </TabsList>

            <Suspense fallback={<TabLoader />}>
              <TabsContent value="nfas">
                <PanelNfaTab />
              </TabsContent>
              <TabsContent value="portfolio">
                <PanelPortfolioTab />
              </TabsContent>
              <TabsContent value="earnings">
                <PanelEarningsTab />
              </TabsContent>
              <TabsContent value="agents">
                <PanelAgentsTab />
              </TabsContent>
              <TabsContent value="launches">
                <PanelMyLaunchesTab />
              </TabsContent>
            </Suspense>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
