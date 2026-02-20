import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentTokens, type AgentTokenSort } from "@/hooks/useAgentTokens";
import { useAgentStats } from "@/hooks/useAgentStats";
import { useSolPrice } from "@/hooks/useSolPrice";
import { AgentTokenCard } from "./AgentTokenCard";
import { Sparkles, Flame, TrendingUp, BarChart3, Briefcase, Zap, Fish } from "lucide-react";

type PlatformFilter = "all" | "meteora" | "pumpfun" | "bags";

export function AgentTokenGrid() {
  const [sort, setSort] = useState<AgentTokenSort>("new");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const { data: tokens, isLoading } = useAgentTokens({ sort, limit: 50 });
  const { data: stats } = useAgentStats();
  const { solPrice } = useSolPrice();

  // Filter tokens by platform
  const filteredTokens = useMemo(() => {
    if (!tokens || platformFilter === "all") return tokens;
    return tokens.filter((t) => t.token?.launchpadType === platformFilter);
  }, [tokens, platformFilter]);

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
      
      {/* Platform Filter Tabs */}
      <div className="px-4 pt-2">
        <div className="flex gap-1 p-1 bg-secondary/30 rounded-lg mb-3">
          <button
            onClick={() => setPlatformFilter("all")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              platformFilter === "all" 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setPlatformFilter("meteora")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
              platformFilter === "meteora" 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Fish className="h-3 w-3" />
            <span className="hidden sm:inline">Claw</span>
          </button>
          <button
            onClick={() => setPlatformFilter("pumpfun")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
              platformFilter === "pumpfun" 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="h-3 w-3" />
            <span className="hidden sm:inline">PUMP</span>
          </button>
          <button
            onClick={() => setPlatformFilter("bags")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
              platformFilter === "bags" 
                ? "bg-blue-500 text-white" 
                : "text-blue-400 hover:text-blue-300"
            }`}
          >
            <Briefcase className="h-3 w-3" />
            <span className="hidden sm:inline">Bags</span>
          </button>
        </div>
      </div>

      <Tabs value={sort} onValueChange={handleTabChange} className="w-full">
        <div className="px-4">
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
          ) : !filteredTokens || filteredTokens.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                {platformFilter === "all" ? "No agent tokens yet" : `No ${platformFilter} tokens yet`}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {platformFilter === "all" ? "Be the first agent to launch a token!" : "Try selecting a different platform."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTokens.map((agentToken) => {
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
