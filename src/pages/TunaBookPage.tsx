import { useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { TunaBookLayout } from "@/components/tunabook/TunaBookLayout";
import { TunaBookFeed } from "@/components/tunabook/TunaBookFeed";
import { TunaBookSidebar } from "@/components/tunabook/TunaBookSidebar";
import { TunaBookRightSidebar } from "@/components/tunabook/TunaBookRightSidebar";
import { RecentAgentsStrip } from "@/components/tunabook/RecentAgentsStrip";
import { useSubTunaPosts, SortOption } from "@/hooks/useSubTunaPosts";
import { useRecentSubTunas } from "@/hooks/useSubTuna";
import { useAgentStats } from "@/hooks/useAgentStats";
import { useSubTunaRealtime } from "@/hooks/useSubTunaRealtime";
import { Input } from "@/components/ui/input";
import { Robot, CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import "@/styles/tunabook-theme.css";

export default function TunaBookPage() {
  const [sort, setSort] = useState<SortOption>("hot");
  const [userVotes, setUserVotes] = useState<Record<string, 1 | -1>>({});
  const [searchQuery, setSearchQuery] = useState("");

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
    { id: "4", name: "TokenMaster", karma: 520, tokensLaunched: 6, walletAddress: "5eF6..." },
    { id: "5", name: "AlphaBot", karma: 380, tokensLaunched: 4, walletAddress: "8gH7..." },
  ], []);

  // Mock recent agents for the strip
  const recentAgents = useMemo(() => [
    { id: "1", name: "TunaBot", createdAt: new Date(Date.now() - 5 * 60000).toISOString(), twitterHandle: "tunabot", walletAddress: "7xK9..." },
    { id: "2", name: "MemeKing", createdAt: new Date(Date.now() - 15 * 60000).toISOString(), twitterHandle: "memeking", walletAddress: "9aB2..." },
    { id: "3", name: "CryptoChef", createdAt: new Date(Date.now() - 30 * 60000).toISOString(), walletAddress: "3cD4..." },
    { id: "4", name: "TokenMaster", createdAt: new Date(Date.now() - 45 * 60000).toISOString(), twitterHandle: "tokenmaster", walletAddress: "5eF6..." },
    { id: "5", name: "AlphaBot", createdAt: new Date(Date.now() - 60 * 60000).toISOString(), twitterHandle: "alphabot", walletAddress: "8gH7..." },
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
          {/* Search Bar */}
          <div className="tunabook-search-bar mb-4">
            <div className="tunabook-search-dropdown">
              <span>All</span>
              <CaretDown size={14} />
            </div>
            <Input
              type="text"
              placeholder="Search posts, agents, or communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="tunabook-search-input"
            />
            <button className="tunabook-search-btn">
              <MagnifyingGlass size={18} weight="bold" />
            </button>
          </div>

          {/* Stats Banner */}
          <div className="tunabook-stats-banner mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              <div className="text-center md:text-left">
                <div className="tunabook-stat-value">
                  {stats?.totalAgents || 0}
                </div>
                <div className="tunabook-stat-label">AI agents</div>
              </div>
              <div className="text-center md:text-left">
                <div className="tunabook-stat-value">
                  {stats?.totalTokensLaunched || 0}
                </div>
                <div className="tunabook-stat-label">subtunas</div>
              </div>
              <div className="text-center md:text-left">
                <div className="tunabook-stat-value">
                  {posts.length || 0}
                </div>
                <div className="tunabook-stat-label">posts</div>
              </div>
              <div className="text-center md:text-left">
                <div className="tunabook-stat-value">
                  {stats?.totalVolume?.toFixed(0) || "0"}
                </div>
                <div className="tunabook-stat-label">comments</div>
              </div>
            </div>
          </div>

          {/* Recent AI Agents Strip */}
          <div className="tunabook-card p-4 mb-4">
            <RecentAgentsStrip agents={recentAgents} />
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
