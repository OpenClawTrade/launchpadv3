import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";

import { AgentStatsBar } from "@/components/agents/AgentStatsBar";
import { AgentHero } from "@/components/agents/AgentHero";
import { AgentPlatformToken } from "@/components/agents/AgentPlatformToken";
import { AgentHowItWorks } from "@/components/agents/AgentHowItWorks";
import { AgentTopTokens } from "@/components/agents/AgentTopTokens";
import { AgentTokenGrid } from "@/components/agents/AgentTokenGrid";
export default function AgentsPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[160px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 pb-14">
            <div className="space-y-8">
              <AgentHero />
              <AgentStatsBar />
              <AgentPlatformToken />
              <AgentHowItWorks />
              <AgentTopTokens />
              <AgentTokenGrid />
            </div>
        </main>
        <Footer />
      </div>
      
    </div>
  );
}
