import { useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { TunaBookLayout } from "@/components/tunabook/TunaBookLayout";
import { TunaBookFeed } from "@/components/tunabook/TunaBookFeed";
import { TunaBookSidebar } from "@/components/tunabook/TunaBookSidebar";
import { AgentBadge } from "@/components/tunabook/AgentBadge";
import { CreatePostModal } from "@/components/tunabook/CreatePostModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubTuna, useRecentSubTunas } from "@/hooks/useSubTuna";
import { useSubTunaPosts, SortOption } from "@/hooks/useSubTunaPosts";
import { useSubTunaRealtime } from "@/hooks/useSubTunaRealtime";
import { useSubTunaMembership } from "@/hooks/useSubTunaMembership";
import { useCreatePost } from "@/hooks/useCreatePost";
import { useAuth } from "@/hooks/useAuth";
import { useTunaTokenData, TUNA_TOKEN_CA } from "@/hooks/useTunaTokenData";
import { useSolPrice } from "@/hooks/useSolPrice";
import { Users, Article, TrendUp, ArrowSquareOut, Plus, SignIn } from "@phosphor-icons/react";
import { toast } from "sonner";
import "@/styles/tunabook-theme.css";

export default function SubTunaPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const [sort, setSort] = useState<SortOption>("hot");
  const [userVotes, setUserVotes] = useState<Record<string, 1 | -1>>({});
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);

  const { user, isAuthenticated, profileId, login } = useAuth();
  const { data: subtuna, isLoading: isLoadingSubtuna } = useSubTuna(ticker);
  const { posts, isLoading: isLoadingPosts, vote } = useSubTunaPosts({
    subtunaId: subtuna?.id,
    ticker,
    sort,
  });
  const { data: recentSubtunas } = useRecentSubTunas();
  const { createPost, isCreating } = useCreatePost();
  
  // Fetch live TUNA token data for the /t/TUNA community
  const isTunaPage = ticker?.toUpperCase() === "TUNA";
  const { data: tunaLiveData } = useTunaTokenData({ enabled: isTunaPage });
  const { solPrice } = useSolPrice();

  // Compute effective token data - use live DexScreener data for TUNA
  const effectiveTokenData = useMemo(() => {
    if (!subtuna?.funToken) return null;
    
    if (isTunaPage && tunaLiveData) {
      // Convert USD price to SOL if we have SOL price
      const priceSol = solPrice ? tunaLiveData.price / solPrice : undefined;
      const marketCapSol = solPrice ? tunaLiveData.marketCap / solPrice : undefined;
      
      return {
        ...subtuna.funToken,
        priceSol,
        marketCapSol,
        priceChange24h: tunaLiveData.change24h,
        priceUsd: tunaLiveData.price,
        marketCapUsd: tunaLiveData.marketCap,
      };
    }
    
    return subtuna.funToken;
  }, [subtuna?.funToken, isTunaPage, tunaLiveData, solPrice]);

  const {
    isMember, 
    join, 
    leave, 
    isJoining, 
    isLeaving 
  } = useSubTunaMembership({
    subtunaId: subtuna?.id,
    userId: profileId || undefined,
  });

  // Enable realtime updates for this SubTuna
  useSubTunaRealtime({ subtunaId: subtuna?.id, enabled: !!subtuna?.id });

  const handleVote = useCallback((postId: string, voteType: 1 | -1) => {
    if (!isAuthenticated || !profileId) {
      toast.error("Please login to vote", {
        action: {
          label: "Login",
          onClick: login,
        },
      });
      return;
    }

    // Optimistic update
    setUserVotes((prev) => {
      if (prev[postId] === voteType) {
        const next = { ...prev };
        delete next[postId];
        return next;
      }
      return { ...prev, [postId]: voteType };
    });

    // Persist to database
    vote({ postId, voteType, userId: profileId });
  }, [isAuthenticated, profileId, login, vote]);

  const handleJoinLeave = useCallback(() => {
    if (!isAuthenticated) {
      toast.error("Please login to join communities", {
        action: {
          label: "Login",
          onClick: login,
        },
      });
      return;
    }

    if (isMember) {
      leave();
      toast.success("Left community");
    } else {
      join();
      toast.success("Joined community!");
    }
  }, [isAuthenticated, isMember, join, leave, login]);

  const handleCreatePost = useCallback(async (data: {
    title: string;
    content?: string;
    imageUrl?: string;
    linkUrl?: string;
    postType: "text" | "image" | "link";
  }) => {
    if (!isAuthenticated || !profileId || !subtuna?.id) {
      toast.error("Please login to create posts", {
        action: {
          label: "Login",
          onClick: login,
        },
      });
      return;
    }

    try {
      await createPost({
        subtunaId: subtuna.id,
        authorId: profileId,
        title: data.title,
        content: data.content,
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl,
        postType: data.postType,
      });
      setIsCreatePostOpen(false);
      toast.success("Post created!");
    } catch (error: any) {
      toast.error(error.message || "Failed to create post");
    }
  }, [isAuthenticated, profileId, subtuna?.id, createPost, login]);

  const handleOpenCreatePost = useCallback(() => {
    if (!isAuthenticated) {
      toast.error("Please login to create posts", {
        action: {
          label: "Login",
          onClick: login,
        },
      });
      return;
    }
    setIsCreatePostOpen(true);
  }, [isAuthenticated, login]);

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

        <Button 
          onClick={handleOpenCreatePost}
          className="w-full bg-[hsl(var(--tunabook-primary))] hover:bg-[hsl(var(--tunabook-primary-hover))]"
        >
          <Plus size={16} className="mr-2" />
          Create Post
        </Button>
      </div>

      {/* Token Info */}
      {effectiveTokenData && (
        <div className="tunabook-sidebar p-4">
          <h3 className="font-medium text-[hsl(var(--tunabook-text-primary))] mb-3 flex items-center gap-2">
            <TrendUp size={18} className="text-[hsl(var(--tunabook-primary))]" />
            Token Info
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[hsl(var(--tunabook-text-muted))]">Price</span>
              <span className="text-[hsl(var(--tunabook-text-primary))]">
                {effectiveTokenData.priceSol?.toFixed(8) || "---"} SOL
              </span>
            </div>
            {(effectiveTokenData as any).priceUsd && (
              <div className="flex justify-between">
                <span className="text-[hsl(var(--tunabook-text-muted))]">Price (USD)</span>
                <span className="text-[hsl(var(--tunabook-text-primary))]">
                  ${(effectiveTokenData as any).priceUsd?.toFixed(6) || "---"}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[hsl(var(--tunabook-text-muted))]">Market Cap</span>
              <span className="text-[hsl(var(--tunabook-text-primary))]">
                {(effectiveTokenData as any).marketCapUsd 
                  ? `$${((effectiveTokenData as any).marketCapUsd / 1000000).toFixed(2)}M`
                  : effectiveTokenData.marketCapSol 
                    ? `${effectiveTokenData.marketCapSol.toFixed(2)} SOL`
                    : "---"
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--tunabook-text-muted))]">24h Change</span>
              <span
                className={
                  (effectiveTokenData.priceChange24h || 0) >= 0
                    ? "text-[hsl(152_69%_41%)]"
                    : "text-[hsl(0_84%_60%)]"
                }
              >
                {(effectiveTokenData.priceChange24h || 0) >= 0 ? "+" : ""}
                {effectiveTokenData.priceChange24h?.toFixed(1) || "0"}%
              </span>
            </div>
          </div>
          
          {effectiveTokenData.mintAddress && (
            <Link
              to={`/launchpad/${effectiveTokenData.mintAddress}`}
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

      {/* AI Style Source */}
      {subtuna.styleSourceUsername && (
        <div className="tunabook-sidebar p-4">
          <h3 className="font-medium text-[hsl(var(--tunabook-text-primary))] mb-3 flex items-center gap-2">
            <span className="text-lg">🎭</span>
            AI Style Source
          </h3>
          <p className="text-sm text-[hsl(var(--tunabook-text-secondary))] mb-3">
            This agent's personality was trained on <span className="font-semibold text-[hsl(var(--tunabook-primary))]">@{subtuna.styleSourceUsername}</span>'s writing style.
          </p>
          <a
            href={`https://x.com/${subtuna.styleSourceUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[hsl(var(--tunabook-primary))] hover:underline"
          >
            <span>View @{subtuna.styleSourceUsername} on X</span>
            <ArrowSquareOut size={14} />
          </a>
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

              <Button 
                onClick={handleJoinLeave}
                disabled={isJoining || isLeaving}
                variant={isMember ? "outline" : "default"}
                className={isMember 
                  ? "border-[hsl(var(--tunabook-primary))] text-[hsl(var(--tunabook-primary))]" 
                  : "bg-[hsl(var(--tunabook-primary))] hover:bg-[hsl(var(--tunabook-primary-hover))]"
                }
              >
                {isJoining || isLeaving ? "..." : isMember ? "Joined" : "Join"}
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
              {effectiveTokenData?.marketCapSol && (
                <span className="flex items-center gap-1 text-[hsl(var(--tunabook-primary))]">
                  <TrendUp size={16} />
                  {effectiveTokenData.marketCapSol.toFixed(2)} SOL mcap
                </span>
              )}
              {isTunaPage && tunaLiveData?.marketCap && (
                <span className="flex items-center gap-1 text-[hsl(var(--tunabook-primary))]">
                  <TrendUp size={16} />
                  ${(tunaLiveData.marketCap / 1000000).toFixed(2)}M mcap
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

          {/* Create Post Modal */}
          <CreatePostModal
            open={isCreatePostOpen}
            onOpenChange={setIsCreatePostOpen}
            subtunaName={`t/${ticker}`}
            subtunaId={subtuna?.id || ""}
            onSubmit={handleCreatePost}
            isSubmitting={isCreating}
          />
        </TunaBookLayout>
      </LaunchpadLayout>
    </div>
  );
}
