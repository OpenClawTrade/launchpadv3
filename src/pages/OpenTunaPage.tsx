import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { 
  Fish, 
  Egg, 
  Dna, 
  WifiHigh, 
  Brain, 
  PuzzlePiece, 
  CurrencyCircleDollar, 
  BookOpen,
  House
} from "@phosphor-icons/react";
import OpenTunaHub from "@/components/opentuna/OpenTunaHub";
import OpenTunaHatch from "@/components/opentuna/OpenTunaHatch";
import OpenTunaDNA from "@/components/opentuna/OpenTunaDNA";
import OpenTunaSonar from "@/components/opentuna/OpenTunaSonar";
import OpenTunaMemory from "@/components/opentuna/OpenTunaMemory";
import OpenTunaFins from "@/components/opentuna/OpenTunaFins";
import OpenTunaCurrent from "@/components/opentuna/OpenTunaCurrent";
import OpenTunaDocs from "@/components/opentuna/OpenTunaDocs";

const VALID_TABS = ['hub', 'hatch', 'dna', 'sonar', 'memory', 'fins', 'current', 'docs'];

export default function OpenTunaPage() {
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
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto flex items-center h-16 px-4">
          <Link to="/" className="mr-4 p-2 rounded-lg hover:bg-cyan-500/10 transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <Fish className="h-7 w-7 text-cyan-500 mr-2" weight="duotone" />
          <h1 className="text-xl font-bold opentuna-gradient-text">OpenTuna</h1>
          <span className="ml-2 text-sm text-muted-foreground hidden sm:inline">
            Autonomous Agent OS
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-full border border-cyan-500/20">
              v1.0
            </span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="max-w-7xl mx-auto px-4 py-6">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap mb-6 bg-card/50 border border-cyan-500/20 rounded-xl p-1.5 gap-1 scrollbar-hide">
          <TabsTrigger 
            value="hub" 
            className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <House className="h-4 w-4 mr-2" weight="duotone" />
            Hub
          </TabsTrigger>
          <TabsTrigger 
            value="hatch" 
            className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Egg className="h-4 w-4 mr-2" weight="duotone" />
            Hatch
          </TabsTrigger>
          <TabsTrigger 
            value="dna" 
            className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Dna className="h-4 w-4 mr-2" weight="duotone" />
            DNA Lab
          </TabsTrigger>
          <TabsTrigger 
            value="sonar" 
            className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <WifiHigh className="h-4 w-4 mr-2" weight="duotone" />
            Sonar
          </TabsTrigger>
          <TabsTrigger 
            value="memory" 
            className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <Brain className="h-4 w-4 mr-2" weight="duotone" />
            Memory
          </TabsTrigger>
          <TabsTrigger 
            value="fins" 
            className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <PuzzlePiece className="h-4 w-4 mr-2" weight="duotone" />
            Fins
          </TabsTrigger>
          <TabsTrigger 
            value="current" 
            className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <CurrencyCircleDollar className="h-4 w-4 mr-2" weight="duotone" />
            Current
          </TabsTrigger>
          <TabsTrigger 
            value="docs" 
            className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 rounded-lg px-4 py-2 text-sm font-medium transition-all"
          >
            <BookOpen className="h-4 w-4 mr-2" weight="duotone" />
            Docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hub" className="mt-0">
          <OpenTunaHub onNavigate={handleTabChange} />
        </TabsContent>
        <TabsContent value="hatch" className="mt-0">
          <OpenTunaHatch />
        </TabsContent>
        <TabsContent value="dna" className="mt-0">
          <OpenTunaDNA />
        </TabsContent>
        <TabsContent value="sonar" className="mt-0">
          <OpenTunaSonar />
        </TabsContent>
        <TabsContent value="memory" className="mt-0">
          <OpenTunaMemory />
        </TabsContent>
        <TabsContent value="fins" className="mt-0">
          <OpenTunaFins />
        </TabsContent>
        <TabsContent value="current" className="mt-0">
          <OpenTunaCurrent />
        </TabsContent>
        <TabsContent value="docs" className="mt-0">
          <OpenTunaDocs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
