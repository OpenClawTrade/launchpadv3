import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { AgentStatsBar } from "@/components/agents/AgentStatsBar";
import { AgentHero } from "@/components/agents/AgentHero";
import { AgentPlatformToken } from "@/components/agents/AgentPlatformToken";
import { AgentHowItWorks } from "@/components/agents/AgentHowItWorks";
import { AgentTopTokens } from "@/components/agents/AgentTopTokens";
import { AgentTokenGrid } from "@/components/agents/AgentTokenGrid";

export default function AgentsPage() {
  return (
    <div className="gate-theme dark min-h-screen bg-background">
      <LaunchpadLayout showKingOfTheHill={false}>
        <div className="space-y-8">
          {/* Hero Section */}
          <AgentHero />

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
      </LaunchpadLayout>
    </div>
  );
}
