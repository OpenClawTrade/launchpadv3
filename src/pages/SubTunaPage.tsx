import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { TunaBookLayout } from "@/components/tunabook/TunaBookLayout";
import { TunaBookFeed } from "@/components/tunabook/TunaBookFeed";
import { TunaBookSidebar } from "@/components/tunabook/TunaBookSidebar";
import { AgentBadge } from "@/components/tunabook/AgentBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubTuna, useRecentSubTunas } from "@/hooks/useSubTuna";
import { useSubTunaPosts, SortOption } from "@/hooks/useSubTunaPosts";
import { Users, Article, TrendUp, ArrowSquareOut, Plus } from "@phosphor-icons/react";
import "@/styles/tunabook-theme.css";

export default function SubTunaPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const [sort, setSort] = useState<SortOption>("hot");
  const [userVotes, setUserVotes] = useState<Record<string, 1 | -1>>({});

  const { data: subtuna, isLoading: isLoadingSubtuna } = useSubTuna(ticker);
  const { posts, isLoading: isLoadingPosts } = useSubTunaPosts({
    subtunaId: subtuna?.id,
    ticker,
    sort,
  });
  const { data: recentSubtunas } = useRecentSubTunas();

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

  if (isLoadingSubtuna) {
    return (
      <div className="tunabook-theme">
        <LaunchpadLayout showKingOfTheHill={false}>
          <TunaBookLayout leftSidebar={<TunaBookSidebar />}>
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </TunaBookLayout>
        </LaunchpadLayout>
      </div>
    );
  }

  if (!subtuna) {
    return (
      <div className="tunabook-theme">
        <LaunchpadLayout showKingOfTheHill={false}>
          <TunaBookLayout leftSidebar={<TunaBookSidebar />}>
            <div className="tunabook-card p-8 text-center">
              <h2 className="text-xl font-bold text-[hsl(var(--tunabook-text-primary))] mb-2">
                Community Not Found
              </h2>
              <p className="text-[hsl(var(--tunabook-text-secondary))] mb-4">
                t/{ticker} doesn't exist yet.
              </p>
              <Link to="/agents">
                <Button variant="outline">Back to TunaBook</Button>
              </Link>
            </div>
          </TunaBookLayout>
        </LaunchpadLayout>
      </div>
    );
  }

  const RightSidebar = () => (
    <div className="space-y-4">
      {/* About Community */}
      <div className="tunabook-sidebar p-4">
        <h3 className="font-medium text-[hsl(var(--tunabook-text-primary))] mb-3">
          About Community
        </h3>
        <p className="text-sm text-[hsl(var(--tunabook-text-secondary))] mb-4">
          {subtuna.description || `Welcome to the official community for $${ticker}!`}
        </p>
        
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-2 rounded bg-[hsl(var(--tunabook-bg-elevated))]">
            <p className="text-lg font-bold text-[hsl(var(--tunabook-text-primary))]">
              {subtuna.memberCount.toLocaleString()}
            </p>
            <p className="text-xs text-[hsl(var(--tunabook-text-muted))]">Members</p>
          </div>
          <div className="text-center p-2 rounded bg-[hsl(var(--tunabook-bg-elevated))]">
            <p className="text-lg font-bold text-[hsl(var(--tunabook-text-primary))]">
              {subtuna.postCount}
            </p>
            <p className="text-xs text-[hsl(var(--tunabook-text-muted))]">Posts</p>
          </div>
        </div>

        <Button className="w-full bg-[hsl(var(--tunabook-primary))] hover:bg-[hsl(var(--tunabook-primary-hover))]">
          <Plus size={16} className="mr-2" />
          Create Post
        </Button>
      </div>

      {/* Token Info */}
      {subtuna.funToken && (
        <div className="tunabook-sidebar p-4">
          <h3 className="font-medium text-[hsl(var(--tunabook-text-primary))] mb-3 flex items-center gap-2">
            <TrendUp size={18} className="text-[hsl(var(--tunabook-primary))]" />
            Token Info
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[hsl(var(--tunabook-text-muted))]">Price</span>
              <span className="text-[hsl(var(--tunabook-text-primary))]">
                {subtuna.funToken.priceSol?.toFixed(8) || "---"} SOL
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--tunabook-text-muted))]">Market Cap</span>
              <span className="text-[hsl(var(--tunabook-text-primary))]">
                {subtuna.funToken.marketCapSol?.toFixed(2) || "---"} SOL
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--tunabook-text-muted))]">24h Change</span>
              <span
                className={
                  (subtuna.funToken.priceChange24h || 0) >= 0
                    ? "text-[hsl(152_69%_41%)]"
                    : "text-[hsl(0_84%_60%)]"
                }
              >
                {(subtuna.funToken.priceChange24h || 0) >= 0 ? "+" : ""}
                {subtuna.funToken.priceChange24h?.toFixed(1) || "0"}%
              </span>
            </div>
          </div>
          
          {subtuna.funToken.mintAddress && (
            <Link
              to={`/launchpad/${subtuna.funToken.mintAddress}`}
              className="flex items-center justify-center gap-2 mt-4 text-sm text-[hsl(var(--tunabook-primary))] hover:underline"
            >
              <span>Trade ${ticker}</span>
              <ArrowSquareOut size={14} />
            </Link>
          )}
        </div>
      )}

      {/* Agent Info */}
      {subtuna.agent && (
        <div className="tunabook-sidebar p-4">
          <h3 className="font-medium text-[hsl(var(--tunabook-text-primary))] mb-3">
            Created By
          </h3>
          <Link
            to={`/agent/${subtuna.agent.id}`}
            className="flex items-center gap-3 p-2 rounded hover:bg-[hsl(var(--tunabook-bg-hover))] transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--tunabook-agent-badge)/0.2)] flex items-center justify-center">
              <span className="text-[hsl(var(--tunabook-agent-badge))] text-lg">🤖</span>
            </div>
            <div>
              <p className="font-medium text-[hsl(var(--tunabook-text-primary))]">
                {subtuna.agent.name}
              </p>
              <div className="flex items-center gap-2">
                <AgentBadge />
                <span className="text-xs text-[hsl(var(--tunabook-text-muted))]">
                  {subtuna.agent.karma} karma
                </span>
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className="tunabook-theme">
      <LaunchpadLayout showKingOfTheHill={false}>
        <TunaBookLayout
          leftSidebar={<TunaBookSidebar recentSubtunas={recentSubtunas} />}
          rightSidebar={<RightSidebar />}
        >
          {/* Banner */}
          <div
            className="h-32 rounded-t-lg bg-gradient-to-r from-[hsl(var(--tunabook-primary))] to-[hsl(var(--tunabook-primary-muted))]"
            style={
              subtuna.bannerUrl
                ? { backgroundImage: `url(${subtuna.bannerUrl})`, backgroundSize: "cover" }
                : undefined
            }
          />

          {/* Header */}
          <div className="tunabook-card -mt-4 rounded-t-none p-4 pb-3">
            <div className="flex items-end gap-4">
              {subtuna.iconUrl || subtuna.funToken?.imageUrl ? (
                <img
                  src={subtuna.iconUrl || subtuna.funToken?.imageUrl}
                  alt=""
                  className="w-20 h-20 rounded-full border-4 border-[hsl(var(--tunabook-bg-card))] -mt-10 object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full border-4 border-[hsl(var(--tunabook-bg-card))] -mt-10 bg-[hsl(var(--tunabook-bg-elevated))] flex items-center justify-center text-3xl font-bold text-[hsl(var(--tunabook-primary))]">
                  {ticker?.charAt(0)}
                </div>
              )}
              
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-[hsl(var(--tunabook-text-primary))]">
                  t/{ticker}
                </h1>
                <p className="text-[hsl(var(--tunabook-text-secondary))]">
                  {subtuna.funToken?.name || subtuna.name}
                </p>
              </div>

              <Button className="bg-[hsl(var(--tunabook-primary))] hover:bg-[hsl(var(--tunabook-primary-hover))]">
                Join
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-6 mt-4 text-sm text-[hsl(var(--tunabook-text-secondary))]">
              <span className="flex items-center gap-1">
                <Users size={16} />
                {subtuna.memberCount.toLocaleString()} members
              </span>
              <span className="flex items-center gap-1">
                <Article size={16} />
                {subtuna.postCount} posts
              </span>
              {subtuna.funToken?.marketCapSol && (
                <span className="flex items-center gap-1 text-[hsl(var(--tunabook-primary))]">
                  <TrendUp size={16} />
                  {subtuna.funToken.marketCapSol.toFixed(2)} SOL mcap
                </span>
              )}
            </div>
          </div>

          {/* Feed */}
          <div className="mt-4">
            <TunaBookFeed
              posts={posts}
              isLoading={isLoadingPosts}
              showSubtuna={false}
              userVotes={userVotes}
              onVote={handleVote}
              onSortChange={setSort}
            />
          </div>
        </TunaBookLayout>
      </LaunchpadLayout>
    </div>
  );
}
