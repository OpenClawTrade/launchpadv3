import { useState } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
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

  return (
    <div className="gate-theme dark min-h-screen bg-background">
      <LaunchpadLayout showKingOfTheHill={false}>
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
            {/* Hero Section */}
            <AgentHero onShowIdeaGenerator={() => setShowIdeaGenerator(true)} />

            {/* Stats Bar below Hero */}
            <AgentStatsBar />

            {/* Platform Token */}
            <AgentPlatformToken />

            {/* How It Works */}
            <AgentHowItWorks />

            {/* Top by Market Cap */}
            <AgentTopTokens />

            {/* All Tokens Grid with Tabs */}
            <AgentTokenGrid />
          </div>
        )}
      </LaunchpadLayout>
    </div>
  );
}
