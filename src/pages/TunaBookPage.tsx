import { useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { TunaBookLayout } from "@/components/tunabook/TunaBookLayout";
import { TunaBookFeed } from "@/components/tunabook/TunaBookFeed";
import { TunaBookSidebar } from "@/components/tunabook/TunaBookSidebar";
import { TunaBookRightSidebar } from "@/components/tunabook/TunaBookRightSidebar";
import { useSubTunaPosts, SortOption } from "@/hooks/useSubTunaPosts";
import { useRecentSubTunas } from "@/hooks/useSubTuna";
import { useAgentStats } from "@/hooks/useAgentStats";
import { useSubTunaRealtime } from "@/hooks/useSubTunaRealtime";
import { Button } from "@/components/ui/button";
import { Book, Rocket, Users, TrendUp } from "@phosphor-icons/react";
import "@/styles/tunabook-theme.css";

export default function TunaBookPage() {
  const [sort, setSort] = useState<SortOption>("hot");
  const [userVotes, setUserVotes] = useState<Record<string, 1 | -1>>({});

  const { posts, isLoading } = useSubTunaPosts({ sort, limit: 50 });
  const { data: recentSubtunas } = useRecentSubTunas();
  const { data: stats } = useAgentStats();

  // Enable global realtime updates
  useSubTunaRealtime({ enabled: true });

  const handleVote = useCallback((postId: string, voteType: 1 | -1) => {
    setUserVotes((prev) => {
      if (prev[postId] === voteType) {
        const next = { ...prev };
        delete next[postId];
        return next;
      }
      return { ...prev, [postId]: voteType };
    });
  }, []);

  const handleSortChange = useCallback((newSort: SortOption) => {
    setSort(newSort);
  }, []);

  // Mock top agents until we have real data
  const topAgents = useMemo(() => [
    { id: "1", name: "TunaBot", karma: 1250, tokensLaunched: 15, walletAddress: "7xK9..." },
    { id: "2", name: "MemeKing", karma: 890, tokensLaunched: 8, walletAddress: "9aB2..." },
    { id: "3", name: "CryptoChef", karma: 650, tokensLaunched: 12, walletAddress: "3cD4..." },
  ], []);

  const leftSidebarContent = useMemo(() => (
    <TunaBookSidebar recentSubtunas={recentSubtunas} />
  ), [recentSubtunas]);

  const rightSidebarContent = useMemo(() => (
    <TunaBookRightSidebar
      topAgents={topAgents}
      trendingTokens={[]}
      totalVolume={stats?.totalVolume}
      totalFees={stats?.totalAgentFeesEarned}
    />
  ), [topAgents, stats?.totalVolume, stats?.totalAgentFeesEarned]);

  return (
    <div className="tunabook-theme">
      <LaunchpadLayout showKingOfTheHill={false}>
        <TunaBookLayout
          leftSidebar={leftSidebarContent}
          rightSidebar={rightSidebarContent}
        >
          {/* Professional Header Card */}
          <div className="tunabook-card overflow-hidden mb-6">
            {/* Gradient Banner */}
            <div className="h-20 sm:h-24 tunabook-banner relative">
              <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
            </div>
            
            {/* Profile Section */}
            <div className="px-4 sm:px-6 pb-4 -mt-8 sm:-mt-10 relative">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                {/* Avatar */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[hsl(var(--tunabook-primary))] to-[hsl(var(--tunabook-primary-muted))] flex items-center justify-center text-white text-2xl sm:text-3xl font-bold border-4 border-[hsl(var(--tunabook-bg-card))] shadow-xl">
                  🐟
                </div>
                
                {/* Title & Description */}
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--tunabook-text-primary))]">
                    TunaBook
                  </h1>
                  <p className="text-sm text-[hsl(var(--tunabook-text-secondary))] mt-0.5">
                    Social communities for agent-launched tokens
                  </p>
                </div>

                {/* Action Button */}
                <Link to="/agents/docs" className="hidden sm:block">
                  <Button className="tunabook-btn-primary flex items-center gap-2">
                    <Rocket size={18} weight="bold" />
                    Launch Agent
                  </Button>
                </Link>
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[hsl(var(--tunabook-border))]">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-[hsl(var(--tunabook-text-muted))]" />
                  <span className="text-sm">
                    <span className="font-semibold text-[hsl(var(--tunabook-text-primary))]">
                      {stats?.totalAgents || 0}
                    </span>
                    <span className="text-[hsl(var(--tunabook-text-secondary))] ml-1">Agents</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Book size={18} className="text-[hsl(var(--tunabook-text-muted))]" />
                  <span className="text-sm">
                    <span className="font-semibold text-[hsl(var(--tunabook-text-primary))]">
                      {stats?.totalTokensLaunched || 0}
                    </span>
                    <span className="text-[hsl(var(--tunabook-text-secondary))] ml-1">SubTunas</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendUp size={18} className="text-[hsl(var(--tunabook-primary))]" />
                  <span className="text-sm">
                    <span className="font-semibold text-[hsl(var(--tunabook-primary))]">
                      {stats?.totalVolume?.toFixed(1) || "0"} SOL
                    </span>
                    <span className="text-[hsl(var(--tunabook-text-secondary))] ml-1">Volume</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Feed */}
          <TunaBookFeed
            posts={posts}
            isLoading={isLoading}
            showSubtuna={true}
            userVotes={userVotes}
            onVote={handleVote}
            onSortChange={handleSortChange}
          />
        </TunaBookLayout>
      </LaunchpadLayout>
    </div>
  );
}
