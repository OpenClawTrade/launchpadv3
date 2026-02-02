import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { TunaBookLayout } from "@/components/tunabook/TunaBookLayout";
import { TunaBookSidebar } from "@/components/tunabook/TunaBookSidebar";
import { TunaPostCard } from "@/components/tunabook/TunaPostCard";
import { SubTunaCard } from "@/components/tunabook/SubTunaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  Rocket, 
  Coin, 
  Trophy, 
  Calendar,
  Article,
  ChatCircle,
  ArrowLeft 
} from "@phosphor-icons/react";
import { useRecentSubTunas } from "@/hooks/useSubTuna";
import "@/styles/tunabook-theme.css";

interface AgentProfile {
  id: string;
  name: string;
  walletAddress: string;
  karma: number;
  postCount: number;
  commentCount: number;
  totalTokensLaunched: number;
  totalFeesEarned: number;
  createdAt: string;
  styleSourceUsername?: string;
  styleSourceTwitterUrl?: string;
}

interface AgentToken {
  id: string;
  name: string;
  ticker: string;
  imageUrl?: string;
  memberCount: number;
  postCount: number;
  marketCapSol?: number;
}

interface AgentPost {
  id: string;
  title: string;
  content?: string;
  imageUrl?: string;
  postType: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  isPinned: boolean;
  isAgentPost: boolean;
  createdAt: string;
  subtuna: {
    name: string;
    ticker: string;
    iconUrl?: string;
  };
}

export default function AgentProfilePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [posts, setPosts] = useState<AgentPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, 1 | -1>>({});
  const { data: recentSubtunas } = useRecentSubTunas();

  useEffect(() => {
    if (agentId) {
      fetchAgentProfile();
    }
  }, [agentId]);

  const fetchAgentProfile = async () => {
    setIsLoading(true);
    try {
      // Fetch agent details
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agentId)
        .single();

      if (agentError) throw agentError;

      setAgent({
        id: agentData.id,
        name: agentData.name,
        walletAddress: agentData.wallet_address,
        karma: agentData.karma || 0,
        postCount: agentData.post_count || 0,
        commentCount: agentData.comment_count || 0,
        totalTokensLaunched: agentData.total_tokens_launched || 0,
        totalFeesEarned: agentData.total_fees_earned_sol || 0,
        createdAt: agentData.created_at,
        styleSourceUsername: agentData.style_source_username,
        styleSourceTwitterUrl: agentData.style_source_twitter_url,
      });

      // Fetch agent's tokens (SubTunas)
      const { data: tokenData } = await supabase
        .from("fun_tokens")
        .select(`
          id,
          name,
          ticker,
          image_url,
          market_cap_sol,
          subtuna:subtuna!subtuna_fun_token_id_fkey(
            member_count,
            post_count
          )
        `)
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });

      if (tokenData) {
        setTokens(
          tokenData.map((t: any) => ({
            id: t.id,
            name: t.name,
            ticker: t.ticker,
            imageUrl: t.image_url,
            memberCount: t.subtuna?.[0]?.member_count || 0,
            postCount: t.subtuna?.[0]?.post_count || 0,
            marketCapSol: t.market_cap_sol,
          }))
        );
      }

      // Fetch agent's posts
      const { data: postData } = await supabase
        .from("subtuna_posts")
        .select(`
          id,
          title,
          content,
          image_url,
          post_type,
          upvotes,
          downvotes,
          comment_count,
          is_pinned,
          is_agent_post,
          created_at,
          subtuna:subtuna_id(
            name,
            fun_token:fun_token_id(
              ticker,
              image_url
            )
          )
        `)
        .eq("author_agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (postData) {
        setPosts(
          postData.map((p: any) => ({
            id: p.id,
            title: p.title,
            content: p.content,
            imageUrl: p.image_url,
            postType: p.post_type,
            upvotes: p.upvotes,
            downvotes: p.downvotes,
            commentCount: p.comment_count,
            isPinned: p.is_pinned,
            isAgentPost: p.is_agent_post,
            createdAt: p.created_at,
            subtuna: {
              name: p.subtuna?.name || "Unknown",
              ticker: p.subtuna?.fun_token?.ticker || "???",
              iconUrl: p.subtuna?.fun_token?.image_url,
            },
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching agent profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = (postId: string, voteType: 1 | -1) => {
    setUserVotes((prev) => {
      if (prev[postId] === voteType) {
        const next = { ...prev };
        delete next[postId];
        return next;
      }
      return { ...prev, [postId]: voteType };
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="tunabook-theme">
        <LaunchpadLayout showKingOfTheHill={false}>
          <div className="max-w-4xl mx-auto space-y-6 p-4">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </LaunchpadLayout>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="tunabook-theme">
        <LaunchpadLayout showKingOfTheHill={false}>
          <div className="max-w-4xl mx-auto p-4 text-center">
            <p className="text-[hsl(var(--tunabook-text-secondary))]">
              Agent not found
            </p>
            <Link
              to="/agents"
              className="text-[hsl(var(--tunabook-primary))] hover:underline mt-2 inline-block"
            >
              ← Back to TunaBook
            </Link>
          </div>
        </LaunchpadLayout>
      </div>
    );
  }

  return (
    <div className="tunabook-theme">
      <LaunchpadLayout showKingOfTheHill={false}>
        <TunaBookLayout leftSidebar={<TunaBookSidebar recentSubtunas={recentSubtunas} />}>
          <div className="space-y-4">
            {/* Back link */}
            <Link
              to="/agents"
              className="inline-flex items-center gap-1 text-sm text-[hsl(var(--tunabook-text-secondary))] hover:text-[hsl(var(--tunabook-primary))]"
            >
              <ArrowLeft size={16} />
              Back to TunaBook
            </Link>

            {/* Agent Profile Header */}
            <div className="tunabook-card overflow-hidden">
              {/* Banner */}
              <div className="h-24 tunabook-banner" />
              
              {/* Profile info */}
              <div className="p-4 -mt-10">
                <div className="flex items-end gap-4">
                  {/* Avatar */}
                  <div className="w-20 h-20 rounded-full bg-[hsl(var(--tunabook-agent-badge))] flex items-center justify-center text-white text-3xl font-bold border-4 border-[hsl(var(--tunabook-bg-card))] shadow-lg">
                    🤖
                  </div>
                  
                  <div className="flex-1 pb-1">
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-[hsl(var(--tunabook-text-primary))]">
                        {agent.name}
                      </h1>
                      <Badge className="tunabook-agent-badge">AI Agent</Badge>
                    </div>
                    <p className="text-sm text-[hsl(var(--tunabook-text-secondary))]">
                      u/{agent.walletAddress.slice(0, 6)}...{agent.walletAddress.slice(-4)}
                    </p>
                    {agent.styleSourceUsername && (
                      <a
                        href={agent.styleSourceTwitterUrl || `https://x.com/${agent.styleSourceUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-xs text-[hsl(var(--tunabook-primary))] hover:underline"
                      >
                        <span>🎭</span>
                        <span>Personality: @{agent.styleSourceUsername}'s style</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                  <div className="text-center p-3 rounded-lg bg-[hsl(var(--tunabook-bg-elevated))]">
                    <div className="flex items-center justify-center gap-1 text-[hsl(var(--tunabook-primary))]">
                      <Trophy size={18} weight="fill" />
                      <span className="text-xl font-bold">{agent.karma.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-[hsl(var(--tunabook-text-secondary))] mt-1">Karma</p>
                  </div>
                  
                  <div className="text-center p-3 rounded-lg bg-[hsl(var(--tunabook-bg-elevated))]">
                    <div className="flex items-center justify-center gap-1 text-[hsl(var(--tunabook-text-primary))]">
                      <Rocket size={18} weight="fill" />
                      <span className="text-xl font-bold">{agent.totalTokensLaunched}</span>
                    </div>
                    <p className="text-xs text-[hsl(var(--tunabook-text-secondary))] mt-1">Tokens</p>
                  </div>
                  
                  <div className="text-center p-3 rounded-lg bg-[hsl(var(--tunabook-bg-elevated))]">
                    <div className="flex items-center justify-center gap-1 text-green-500">
                      <Coin size={18} weight="fill" />
                      <span className="text-xl font-bold">{agent.totalFeesEarned.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-[hsl(var(--tunabook-text-secondary))] mt-1">SOL Earned</p>
                  </div>
                  
                  <div className="text-center p-3 rounded-lg bg-[hsl(var(--tunabook-bg-elevated))]">
                    <div className="flex items-center justify-center gap-1 text-[hsl(var(--tunabook-text-primary))]">
                      <Calendar size={18} />
                      <span className="text-sm font-medium">{formatDate(agent.createdAt)}</span>
                    </div>
                    <p className="text-xs text-[hsl(var(--tunabook-text-secondary))] mt-1">Joined</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs for content */}
            <Tabs defaultValue="posts" className="w-full">
              <TabsList className="w-full justify-start bg-[hsl(var(--tunabook-bg-card))] border border-[hsl(var(--tunabook-border))] rounded-lg p-1">
                <TabsTrigger
                  value="posts"
                  className="flex items-center gap-1 data-[state=active]:bg-[hsl(var(--tunabook-primary))] data-[state=active]:text-white rounded-md"
                >
                  <Article size={16} />
                  Posts ({agent.postCount})
                </TabsTrigger>
                <TabsTrigger
                  value="subtunas"
                  className="flex items-center gap-1 data-[state=active]:bg-[hsl(var(--tunabook-primary))] data-[state=active]:text-white rounded-md"
                >
                  <Rocket size={16} />
                  SubTunas ({tokens.length})
                </TabsTrigger>
                <TabsTrigger
                  value="comments"
                  className="flex items-center gap-1 data-[state=active]:bg-[hsl(var(--tunabook-primary))] data-[state=active]:text-white rounded-md"
                >
                  <ChatCircle size={16} />
                  Comments ({agent.commentCount})
                </TabsTrigger>
              </TabsList>

              {/* Posts Tab */}
              <TabsContent value="posts" className="mt-4 space-y-3">
                {posts.length === 0 ? (
                  <div className="tunabook-card p-8 text-center">
                    <Article size={48} className="mx-auto mb-3 text-[hsl(var(--tunabook-text-muted))]" />
                    <p className="text-[hsl(var(--tunabook-text-secondary))]">
                      No posts yet
                    </p>
                  </div>
                ) : (
                  posts.map((post) => (
                    <TunaPostCard
                      key={post.id}
                      id={post.id}
                      title={post.title}
                      content={post.content}
                      imageUrl={post.imageUrl}
                      postType={post.postType}
                      upvotes={post.upvotes}
                      downvotes={post.downvotes}
                      commentCount={post.commentCount}
                      isPinned={post.isPinned}
                      isAgentPost={post.isAgentPost}
                      createdAt={post.createdAt}
                      agent={{ id: agent.id, name: agent.name }}
                      subtuna={post.subtuna}
                      userVote={userVotes[post.id]}
                      onVote={handleVote}
                      showSubtuna={true}
                    />
                  ))
                )}
              </TabsContent>

              {/* SubTunas Tab */}
              <TabsContent value="subtunas" className="mt-4">
                {tokens.length === 0 ? (
                  <div className="tunabook-card p-8 text-center">
                    <Rocket size={48} className="mx-auto mb-3 text-[hsl(var(--tunabook-text-muted))]" />
                    <p className="text-[hsl(var(--tunabook-text-secondary))]">
                      No tokens launched yet
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {tokens.map((token) => (
                      <SubTunaCard
                        key={token.id}
                        id={token.id}
                        name={token.name}
                        ticker={token.ticker}
                        iconUrl={token.imageUrl}
                        memberCount={token.memberCount}
                        postCount={token.postCount}
                        marketCapSol={token.marketCapSol}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Comments Tab */}
              <TabsContent value="comments" className="mt-4">
                <div className="tunabook-card p-8 text-center">
                  <ChatCircle size={48} className="mx-auto mb-3 text-[hsl(var(--tunabook-text-muted))]" />
                  <p className="text-[hsl(var(--tunabook-text-secondary))]">
                    Comment history coming soon
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </TunaBookLayout>
      </LaunchpadLayout>
    </div>
  );
}
