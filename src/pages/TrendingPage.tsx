import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, Sparkles, ExternalLink, Clock, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ai69xLogo from "@/assets/ai69x-logo.png";

interface TrendingToken {
  id: string;
  rank: number;
  token_address: string;
  chain_id: string;
  name: string | null;
  symbol: string | null;
  description: string | null;
  image_url: string | null;
  url: string | null;
  synced_at: string;
}

interface TrendingNarrative {
  id: string;
  narrative: string;
  description: string | null;
  token_count: number;
  example_tokens: string[] | null;
  popularity_score: number;
  is_active: boolean;
  analyzed_at: string;
}

interface NarrativeHistory {
  id: string;
  narrative: string;
  description: string | null;
  example_tokens: string[] | null;
  popularity_score: number | null;
  token_count: number | null;
  snapshot_at: string;
}

const TrendingPage = () => {
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [narratives, setNarratives] = useState<TrendingNarrative[]>([]);
  const [narrativeHistory, setNarrativeHistory] = useState<NarrativeHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tokensResult, narrativesResult, historyResult] = await Promise.all([
        supabase.from("trending_tokens").select("*").order("rank", { ascending: true }),
        supabase.from("trending_narratives").select("*").order("popularity_score", { ascending: false }),
        supabase.from("narrative_history").select("*").order("snapshot_at", { ascending: false }).limit(20),
      ]);

      if (tokensResult.data) {
        setTokens(tokensResult.data as TrendingToken[]);
      }
      if (narrativesResult.data) {
        setNarratives(narrativesResult.data as TrendingNarrative[]);
      }
      if (historyResult.data) {
        setNarrativeHistory(historyResult.data as NarrativeHistory[]);
      }
    } catch (error) {
      console.error("Error fetching trending data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel("trending-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "trending_tokens" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trending_narratives" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeNarrative = narratives.find(n => n.is_active);
  const lastSynced = tokens[0]?.synced_at ? new Date(tokens[0].synced_at) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <img src={ai69xLogo} alt="ai67x" className="h-8 w-8 rounded-full" />
              <span className="text-lg font-bold">ai67x</span>
            </Link>
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span>Trending Narratives</span>
            </div>
          </div>
          {lastSynced && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Auto-updates every 3 min • Last: {lastSynced.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Active Narrative Banner */}
        {activeNarrative && (
          <Card className="mb-8 border-primary/50 bg-gradient-to-r from-primary/10 via-transparent to-primary/5">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-primary/20">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-bold">Current Narrative</h2>
                    <Badge variant="default" className="bg-primary text-primary-foreground">
                      Active
                    </Badge>
                  </div>
                  <h3 className="text-2xl font-bold text-primary mb-2">{activeNarrative.narrative}</h3>
                  <p className="text-muted-foreground mb-3">{activeNarrative.description}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">{activeNarrative.token_count}</strong> tokens in this narrative
                    </span>
                    {activeNarrative.example_tokens && (
                      <div className="flex gap-2">
                        {activeNarrative.example_tokens.slice(0, 3).map((token, i) => (
                          <Badge key={i} variant="secondary">{token}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    New tokens created by ai67x will be based on this narrative until the next update
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Narratives Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Top Narratives
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))
            ) : narratives.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No narratives analyzed yet. Click "Sync Now" to fetch trending data.
                </CardContent>
              </Card>
            ) : (
              narratives.map((narrative) => (
                <Card 
                  key={narrative.id} 
                  className={narrative.is_active ? "border-primary" : ""}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold">{narrative.narrative}</h3>
                      {narrative.is_active && (
                        <Badge variant="default" className="text-xs">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{narrative.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{narrative.token_count} tokens</span>
                      <span className="text-muted-foreground">Score: {narrative.popularity_score}</span>
                    </div>
                    {narrative.example_tokens && narrative.example_tokens.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {narrative.example_tokens.slice(0, 3).map((token, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{token}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Narrative History Timeline */}
        {narrativeHistory.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <History className="h-5 w-5 text-orange-500" />
              Narrative History
            </h2>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {narrativeHistory.map((history, index) => (
                    <div 
                      key={history.id} 
                      className={`flex gap-4 ${index !== narrativeHistory.length - 1 ? "border-b border-border pb-4" : ""}`}
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        {index !== narrativeHistory.length - 1 && (
                          <div className="w-0.5 h-full bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{history.narrative}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(history.snapshot_at).toLocaleString()}
                          </span>
                        </div>
                        {history.description && (
                          <p className="text-sm text-muted-foreground mb-2">{history.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{history.token_count || 0} tokens</span>
                          <span>Score: {history.popularity_score || 0}</span>
                        </div>
                        {history.example_tokens && history.example_tokens.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {history.example_tokens.slice(0, 4).map((token, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{token}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Trending Tokens */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Top 50 Trending Tokens (DexScreener)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {loading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : tokens.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No trending tokens yet. Click "Sync Now" to fetch data from DexScreener.
                </CardContent>
              </Card>
            ) : (
              tokens.map((token) => (
                <Card key={token.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="absolute -top-1 -left-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {token.rank}
                        </div>
                        {token.image_url ? (
                          <img 
                            src={token.image_url} 
                            alt={token.name || token.symbol || "Token"} 
                            className="w-10 h-10 rounded-full bg-muted"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                            {(token.symbol || token.name || "?").charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-sm truncate">
                            {token.name || token.symbol || "Unknown"}
                          </span>
                          {token.url && (
                            <a 
                              href={token.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {token.symbol && token.name && (
                          <span className="text-xs text-muted-foreground">${token.symbol}</span>
                        )}
                        {token.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {token.description}
                          </p>
                        )}
                        <Badge variant="outline" className="text-[10px] mt-1">
                          {token.chain_id}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TrendingPage;
