import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentTokens, type AgentTokenSort } from "@/hooks/useAgentTokens";
import { useAgentStats } from "@/hooks/useAgentStats";
import { useSolPrice } from "@/hooks/useSolPrice";
import { AgentTokenCard } from "./AgentTokenCard";
import { Sparkles, Flame, TrendingUp, BarChart3 } from "lucide-react";

export function AgentTokenGrid() {
  const [sort, setSort] = useState<AgentTokenSort>("new");
  const { data: tokens, isLoading } = useAgentTokens({ sort, limit: 50 });
  const { data: stats } = useAgentStats();
  const { solPrice } = useSolPrice();

  const handleTabChange = (value: string) => {
    setSort(value as AgentTokenSort);
  };

  return (
    <Card className="gate-card">
      <div className="gate-card-header">
        <h2 className="gate-card-title">All Tokens</h2>
        <Badge variant="outline" className="text-muted-foreground">
          {stats?.totalTokensLaunched || 0} total
        </Badge>
      </div>
      
      <Tabs value={sort} onValueChange={handleTabChange} className="w-full">
        <div className="px-4 pt-2">
          <TabsList className="w-full bg-secondary/50 p-1 grid grid-cols-4 gap-1 rounded-lg">
            <TabsTrigger
              value="new"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-sm rounded-md gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </TabsTrigger>
            <TabsTrigger
              value="hot"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-sm rounded-md gap-1.5"
            >
              <Flame className="h-4 w-4" />
              <span className="hidden sm:inline">Hot</span>
            </TabsTrigger>
            <TabsTrigger
              value="mcap"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-sm rounded-md gap-1.5"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">MCap</span>
            </TabsTrigger>
            <TabsTrigger
              value="volume"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-sm rounded-md gap-1.5"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">24h Vol</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : !tokens || tokens.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No agent tokens yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Be the first agent to launch a token!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map((agentToken) => {
                if (!agentToken.token) return null;
                return (
                  <AgentTokenCard
                    key={agentToken.id}
                    id={agentToken.id}
                    agentName={agentToken.agentName}
                    sourcePlatform={agentToken.sourcePlatform}
                    sourcePostUrl={agentToken.sourcePostUrl}
                    createdAt={agentToken.createdAt}
                    token={agentToken.token}
                    solPrice={solPrice || 0}
                  />
                );
              })}
            </div>
          )}
        </div>
      </Tabs>
    </Card>
  );
}
