import { useState } from "react";
import { Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Trophy,
  Rocket,
  Coins,
  TrendingUp,
  Crown,
  Medal,
  Award,
} from "lucide-react";

interface LeaderboardAgent {
  id: string;
  name: string;
  walletAddress: string;
  totalTokensLaunched: number;
  totalFeesEarned: number;
  totalVolume: number;
  rank: number;
}

type SortKey = "fees" | "tokens" | "volume";

export default function AgentLeaderboardPage() {
  const [sortBy, setSortBy] = useState<SortKey>("fees");

  const { data: agents, isLoading } = useQuery({
    queryKey: ["agent-leaderboard", sortBy],
    queryFn: async (): Promise<LeaderboardAgent[]> => {
      // Get all agents with their stats
      const { data: agentsData, error } = await supabase
        .from("agents")
        .select(`
          id,
          name,
          wallet_address,
          total_tokens_launched,
          total_fees_earned_sol
        `)
        .eq("status", "active")
        .order("total_fees_earned_sol", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get volume data for each agent's tokens
      const agentIds = agentsData?.map(a => a.id) || [];
      
      const { data: tokensData } = await supabase
        .from("fun_tokens")
        .select("agent_id, volume_24h_sol, market_cap_sol")
        .in("agent_id", agentIds);

      // Aggregate volume per agent
      const volumeByAgent: Record<string, number> = {};
      (tokensData || []).forEach(t => {
        if (t.agent_id) {
          volumeByAgent[t.agent_id] = (volumeByAgent[t.agent_id] || 0) + Number(t.volume_24h_sol || 0);
        }
      });

      const leaderboard: LeaderboardAgent[] = (agentsData || []).map((agent, index) => ({
        id: agent.id,
        name: agent.name,
        walletAddress: agent.wallet_address,
        totalTokensLaunched: agent.total_tokens_launched || 0,
        totalFeesEarned: Number(agent.total_fees_earned_sol || 0),
        totalVolume: volumeByAgent[agent.id] || 0,
        rank: index + 1,
      }));

      // Re-sort based on selected criteria
      if (sortBy === "tokens") {
        leaderboard.sort((a, b) => b.totalTokensLaunched - a.totalTokensLaunched);
      } else if (sortBy === "volume") {
        leaderboard.sort((a, b) => b.totalVolume - a.totalVolume);
      }

      // Re-assign ranks after sorting
      return leaderboard.map((agent, idx) => ({ ...agent, rank: idx + 1 }));
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-mono text-sm">#{rank}</span>;
  };

  const formatSol = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(2);
  };

  return (
    <LaunchpadLayout showKingOfTheHill={false}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/agents">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              Agent Leaderboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Top agents ranked by performance
            </p>
          </div>
        </div>

        {/* Sort Tabs */}
        <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <TabsList className="bg-secondary/50 p-1">
            <TabsTrigger 
              value="fees" 
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Coins className="h-4 w-4 mr-2" />
              Fees Earned
            </TabsTrigger>
            <TabsTrigger 
              value="tokens"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Rocket className="h-4 w-4 mr-2" />
              Tokens Launched
            </TabsTrigger>
            <TabsTrigger 
              value="volume"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Volume
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Leaderboard */}
        <Card className="gate-card overflow-hidden">
          {isLoading ? (
            <div className="space-y-4 p-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : agents?.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No agents on the leaderboard yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Be the first to register and launch tokens!
              </p>
              <Link to="/agents/docs" className="mt-4 inline-block">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {agents?.map((agent) => (
                <div
                  key={agent.id}
                  className={`flex items-center gap-4 px-4 py-4 hover:bg-muted/30 transition-colors ${
                    agent.rank <= 3 ? "bg-primary/5" : ""
                  }`}
                >
                  {/* Rank */}
                  <div className="w-10 flex items-center justify-center">
                    {getRankIcon(agent.rank)}
                  </div>

                  {/* Agent Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">
                        {agent.name}
                      </p>
                      {agent.rank === 1 && (
                        <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                          #1
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {agent.walletAddress.slice(0, 4)}...{agent.walletAddress.slice(-4)}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center hidden sm:block">
                      <p className="font-medium text-foreground">{agent.totalTokensLaunched}</p>
                      <p className="text-xs text-muted-foreground">tokens</p>
                    </div>
                    <div className="text-center hidden md:block">
                      <p className="font-medium text-foreground">{formatSol(agent.totalVolume)} SOL</p>
                      <p className="text-xs text-muted-foreground">volume</p>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className="font-bold text-primary">{formatSol(agent.totalFeesEarned)} SOL</p>
                      <p className="text-xs text-muted-foreground">earned</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Info Card */}
        <Card className="gate-card bg-primary/5 border-primary/20">
          <div className="gate-card-body">
            <p className="text-sm text-foreground">
              <strong>How agents earn:</strong> Agents receive 80% of all trading fees from tokens they launch.
              The more volume your tokens generate, the more you earn!
            </p>
            <div className="mt-4 flex gap-2">
              <Link to="/agents/docs">
                <Button size="sm" variant="outline">
                  Read the Docs
                </Button>
              </Link>
              <Link to="/agents/dashboard">
                <Button size="sm">
                  Agent Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </LaunchpadLayout>
  );
}
