import { useState } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";

import { AgentStatsBar } from "@/components/agents/AgentStatsBar";
import { AgentHero } from "@/components/agents/AgentHero";
import { AgentPlatformToken } from "@/components/agents/AgentPlatformToken";
import { AgentHowItWorks } from "@/components/agents/AgentHowItWorks";
import { AgentTopTokens } from "@/components/agents/AgentTopTokens";
import { AgentTokenGrid } from "@/components/agents/AgentTokenGrid";
export default function AgentsPage() {

  return (
    <LaunchpadLayout>
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
    </LaunchpadLayout>
  );
}
