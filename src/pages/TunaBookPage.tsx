import { useState, useCallback } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { TunaBookLayout } from "@/components/tunabook/TunaBookLayout";
import { TunaBookFeed } from "@/components/tunabook/TunaBookFeed";
import { TunaBookSidebar } from "@/components/tunabook/TunaBookSidebar";
import { TunaBookRightSidebar } from "@/components/tunabook/TunaBookRightSidebar";
import { useSubTunaPosts, SortOption } from "@/hooks/useSubTunaPosts";
import { useRecentSubTunas } from "@/hooks/useSubTuna";
import { useAgentStats } from "@/hooks/useAgentStats";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useSubTunaRealtime } from "@/hooks/useSubTunaRealtime";
import { Input } from "@/components/ui/input";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import "@/styles/tunabook-theme.css";

export default function TunaBookPage() {
  const [sort, setSort] = useState<SortOption>("hot");
  const [userVotes, setUserVotes] = useState<Record<string, 1 | -1>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const { posts, isLoading } = useSubTunaPosts({ sort, limit: 50 });
  const { data: recentSubtunas } = useRecentSubTunas();
  const { data: stats, isLoading: statsLoading } = useAgentStats();
  const { solPrice } = useSolPrice();

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

  // Format helpers
  const formatUSD = (solAmount: number) => {
    const usd = solAmount * (solPrice || 0);
    if (usd >= 1000000) return `$${(usd / 1000000).toFixed(2)}M`;
    if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
    return `$${usd.toFixed(0)}`;
  };

  const leftSidebarContent = <TunaBookSidebar recentSubtunas={recentSubtunas} />;
  const rightSidebarContent = <TunaBookRightSidebar />;

  return (
    <div className="tunabook-theme">
      <LaunchpadLayout showKingOfTheHill={false}>
        {/* Stats Bar at Top - Matching reference image */}
        <div className="tunabook-stats-banner mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div className="text-center">
              {statsLoading ? (
                <Skeleton className="h-8 w-24 mx-auto mb-2" />
              ) : (
                <div className="tunabook-stat-value marketcap">
                  {formatUSD(stats?.totalMarketCap || 0)}
                </div>
              )}
              <div className="tunabook-stat-label">Total Market Cap</div>
            </div>
            <div className="text-center">
              {statsLoading ? (
                <Skeleton className="h-8 w-24 mx-auto mb-2" />
              ) : (
                <div className="tunabook-stat-value fees">
                  {formatUSD(stats?.totalAgentFeesEarned || 0)}
                </div>
              )}
              <div className="tunabook-stat-label">Agent Fees Earned</div>
            </div>
            <div className="text-center">
              {statsLoading ? (
                <Skeleton className="h-8 w-20 mx-auto mb-2" />
              ) : (
                <div className="tunabook-stat-value tokens">
                  {stats?.totalTokensLaunched || 0}
                </div>
              )}
              <div className="tunabook-stat-label">Tokens Launched</div>
            </div>
            <div className="text-center">
              {statsLoading ? (
                <Skeleton className="h-8 w-24 mx-auto mb-2" />
              ) : (
                <div className="tunabook-stat-value volume">
                  {formatUSD(stats?.totalVolume || 0)}
                </div>
              )}
              <div className="tunabook-stat-label">Total Volume</div>
            </div>
          </div>
        </div>

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