import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { StickyStatsFooter } from "@/components/layout/StickyStatsFooter";
import { AgentStatsBar } from "@/components/agents/AgentStatsBar";
import { AgentHero } from "@/components/agents/AgentHero";
import { AgentPlatformToken } from "@/components/agents/AgentPlatformToken";
import { AgentHowItWorks } from "@/components/agents/AgentHowItWorks";
import { AgentTopTokens } from "@/components/agents/AgentTopTokens";
import { AgentTokenGrid } from "@/components/agents/AgentTokenGrid";
import { AgentIdeaGenerator } from "@/components/agents/AgentIdeaGenerator";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function AgentsPage() {
  const [showIdeaGenerator, setShowIdeaGenerator] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: "#141414" }}>
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[160px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 pb-14">
          {showIdeaGenerator ? (
            <div className="space-y-4">
              <Button
                variant="ghost"
                onClick={() => setShowIdeaGenerator(false)}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Agents
              </Button>
              <AgentIdeaGenerator />
            </div>
          ) : (
            <div className="space-y-8">
              <AgentHero onShowIdeaGenerator={() => setShowIdeaGenerator(true)} />
              <AgentStatsBar />
              <AgentPlatformToken />
              <AgentHowItWorks />
              <AgentTopTokens />
              <AgentTokenGrid />
            </div>
          )}
        </main>
        <Footer />
      </div>
      <StickyStatsFooter />
    </div>
  );
}
