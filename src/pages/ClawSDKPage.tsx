import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Fish, 
  Egg, 
  Dna, 
  WifiHigh, 
  Brain, 
  PuzzlePiece, 
  CurrencyCircleDollar, 
  BookOpen,
  House,
  Plug
} from "@phosphor-icons/react";
import { ClawSDKProvider } from "@/components/claw/ClawSDKContext";
import ClawSDKHub from "@/components/claw/ClawSDKHub";
import ClawSDKHatch from "@/components/claw/ClawSDKHatch";
import ClawSDKDNA from "@/components/claw/ClawSDKDNA";
import ClawSDKSonar from "@/components/claw/ClawSDKSonar";
import ClawSDKMemory from "@/components/claw/ClawSDKMemory";
import ClawSDKFins from "@/components/claw/ClawSDKFins";
import ClawSDKIntegrations from "@/components/claw/ClawSDKIntegrations";
import ClawSDKCurrent from "@/components/claw/ClawSDKCurrent";
import ClawSDKDocs from "@/components/claw/ClawSDKDocs";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";

const VALID_TABS = ['hub', 'hatch', 'dna', 'sonar', 'memory', 'fins', 'integrations', 'current', 'docs'];

function ClawSDKContent() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.slice(1);
    return VALID_TABS.includes(hash) ? hash : 'hub';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.history.replaceState(null, '', `#${value}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[160px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap mb-6 bg-card/50 border border-primary/20 rounded-xl p-1.5 gap-1 scrollbar-hide">
          <TabsTrigger 
            value="hub" 
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <House className="h-4 w-4 mr-2" weight="duotone" />
            Hub
          </TabsTrigger>
          <TabsTrigger 
            value="hatch" 
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Egg className="h-4 w-4 mr-2" weight="duotone" />
            Hatch
          </TabsTrigger>
          <TabsTrigger 
            value="dna" 
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Dna className="h-4 w-4 mr-2" weight="duotone" />
            DNA Lab
          </TabsTrigger>
          <TabsTrigger 
            value="sonar" 
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <WifiHigh className="h-4 w-4 mr-2" weight="duotone" />
            Sonar
          </TabsTrigger>
          <TabsTrigger 
            value="memory" 
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Brain className="h-4 w-4 mr-2" weight="duotone" />
            Memory
          </TabsTrigger>
          <TabsTrigger 
            value="fins" 
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <PuzzlePiece className="h-4 w-4 mr-2" weight="duotone" />
            Fins
          </TabsTrigger>
          <TabsTrigger 
            value="integrations" 
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Plug className="h-4 w-4 mr-2" weight="duotone" />
            Integrations
          </TabsTrigger>
          <TabsTrigger 
            value="current" 
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <CurrencyCircleDollar className="h-4 w-4 mr-2" weight="duotone" />
            Current
          </TabsTrigger>
          <TabsTrigger 
            value="docs" 
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <BookOpen className="h-4 w-4 mr-2" weight="duotone" />
            Docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hub" className="mt-0">
          <ClawSDKHub onNavigate={handleTabChange} />
        </TabsContent>
        <TabsContent value="hatch" className="mt-0">
          <ClawSDKHatch />
        </TabsContent>
        <TabsContent value="dna" className="mt-0">
          <ClawSDKDNA />
        </TabsContent>
        <TabsContent value="sonar" className="mt-0">
          <ClawSDKSonar />
        </TabsContent>
        <TabsContent value="memory" className="mt-0">
          <ClawSDKMemory />
        </TabsContent>
        <TabsContent value="fins" className="mt-0">
          <ClawSDKFins />
        </TabsContent>
        <TabsContent value="integrations" className="mt-0">
          <ClawSDKIntegrations />
        </TabsContent>
        <TabsContent value="current" className="mt-0">
          <ClawSDKCurrent />
        </TabsContent>
        <TabsContent value="docs" className="mt-0">
          <ClawSDKDocs />
        </TabsContent>
        </Tabs>

        <Footer />
      </div>
    </div>
  );
}

// Export wrapped with provider
export default function ClawSDKPage() {
  return (
    <ClawSDKProvider>
      <ClawSDKContent />
    </ClawSDKProvider>
  );
}
