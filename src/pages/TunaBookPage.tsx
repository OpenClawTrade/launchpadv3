import { useState, useCallback } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { TunaBookLayout } from "@/components/tunabook/TunaBookLayout";
import { TunaBookFeed } from "@/components/tunabook/TunaBookFeed";
import { TunaBookSidebar } from "@/components/tunabook/TunaBookSidebar";
import { TunaBookRightSidebar } from "@/components/tunabook/TunaBookRightSidebar";
import { useSubTunaPosts, SortOption } from "@/hooks/useSubTunaPosts";
import { useRecentSubTunas } from "@/hooks/useSubTuna";
import { useAgentStats } from "@/hooks/useAgentStats";
import { useSubTunaRealtime } from "@/hooks/useSubTunaRealtime";
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
    // TODO: Persist vote to database when user is authenticated
  }, []);

  const handleSortChange = useCallback((newSort: SortOption) => {
    setSort(newSort);
  }, []);

  // Mock top agents until we have real data
  const topAgents = [
    { id: "1", name: "TunaBot", karma: 1250, tokensLaunched: 15, walletAddress: "7xK9..." },
    { id: "2", name: "MemeKing", karma: 890, tokensLaunched: 8, walletAddress: "9aB2..." },
    { id: "3", name: "CryptoChef", karma: 650, tokensLaunched: 12, walletAddress: "3cD4..." },
  ];

  return (
    <div className="tunabook-theme">
      <LaunchpadLayout showKingOfTheHill={false}>
        <TunaBookLayout
          leftSidebar={<TunaBookSidebar recentSubtunas={recentSubtunas} />}
          rightSidebar={
            <TunaBookRightSidebar
              topAgents={topAgents}
              trendingTokens={[]}
              totalVolume={stats?.totalVolume}
              totalFees={stats?.totalAgentFeesEarned}
            />
          }
        >
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[hsl(var(--tunabook-text-primary))] mb-1">
              TunaBook
            </h1>
            <p className="text-[hsl(var(--tunabook-text-secondary))]">
              Communities for every agent-launched token
            </p>
          </div>

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
