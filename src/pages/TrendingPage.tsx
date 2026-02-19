import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { TrendingUp, Sparkles, ExternalLink, Clock, History, RefreshCw } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [narratives, setNarratives] = useState<TrendingNarrative[]>([]);
  const [narrativeHistory, setNarrativeHistory] = useState<NarrativeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("current");
  const [nextRotation, setNextRotation] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tokensResult, narrativesResult, historyResult] = await Promise.all([
        supabase.from("trending_tokens").select("*").order("rank", { ascending: true }),
        supabase.from("trending_narratives").select("*").order("popularity_score", { ascending: false }),
        supabase.from("narrative_history").select("*").order("snapshot_at", { ascending: false }).limit(50),
      ]);

      if (tokensResult.data) {
        setTokens(tokensResult.data as TrendingToken[]);
      }
      if (narrativesResult.data) {
        setNarratives(narrativesResult.data as TrendingNarrative[]);
        
        // Calculate next rotation time (every 30 minutes from the last active narrative change)
        const activeNarr = narrativesResult.data.find(n => n.is_active);
        if (activeNarr) {
          const lastAnalyzed = new Date(activeNarr.analyzed_at);
          const nextRotate = new Date(lastAnalyzed.getTime() + 30 * 60 * 1000);
          setNextRotation(nextRotate);
        }
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
      .on("postgres_changes", { event: "*", schema: "public", table: "narrative_history" }, () => {
        fetchData();
      })
      .subscribe();

    // Auto-refresh every 30 seconds for countdown accuracy
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, []);

  const activeNarrative = narratives.find(n => n.is_active);
  const lastSynced = tokens[0]?.synced_at ? new Date(tokens[0].synced_at) : null;

  // Group history by date
  const groupedHistory = narrativeHistory.reduce((acc, item) => {
    const date = new Date(item.snapshot_at).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(item);
    return acc;
  }, {} as Record<string, NarrativeHistory[]>);

  return (
    <div className="min-h-screen" style={{ background: "#141414" }}>
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[160px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />

        <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 pb-24">
        {/* Active Narrative Banner */}
        {activeNarrative && (
          <Card className="mb-4 sm:mb-8 border-primary/50 bg-gradient-to-r from-primary/10 via-transparent to-primary/5">
            <CardContent className="py-4 sm:py-6 px-3 sm:px-6">
              <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-full bg-primary/20">
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="flex-1 w-full">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h2 className="text-lg sm:text-xl font-bold">Current Narrative</h2>
                    <Badge variant="default" className="bg-primary text-primary-foreground text-xs">
                      Active
                    </Badge>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      • Rotates every 30 minutes
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-primary mb-2">{activeNarrative.narrative}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{activeNarrative.description}</p>
                  <div className="flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-4 text-sm">
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">{activeNarrative.token_count}</strong> tokens
                    </span>
                    {activeNarrative.example_tokens && (
                      <div className="flex flex-wrap gap-2">
                        {activeNarrative.example_tokens.slice(0, 3).map((token, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{token}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-3">
                    New tokens will be based on this narrative until the next rotation
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Current/History */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4 sm:mb-8">
          <TabsList className="grid w-full max-w-xs sm:max-w-md grid-cols-2">
            <TabsTrigger value="current" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Current </span>Narratives
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              History ({narrativeHistory.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-6">
            {/* Narratives Grid */}
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
                    No narratives analyzed yet. Waiting for data sync...
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
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            {/* Narrative History Timeline grouped by date */}
            {loading ? (
              <Card>
                <CardContent className="p-4 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : narrativeHistory.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No narrative history yet. History is recorded every 30 minutes.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedHistory).map(([date, items]) => (
                  <div key={date}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {date}
                    </h3>
                    <Card>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          {items.map((history, index) => (
                            <div 
                              key={history.id} 
                              className={`flex gap-4 ${index !== items.length - 1 ? "border-b border-border pb-4" : ""}`}
                            >
                              <div className="flex flex-col items-center">
                                <div className="w-3 h-3 rounded-full bg-primary" />
                                {index !== items.length - 1 && (
                                  <div className="w-0.5 h-full bg-border mt-1" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-semibold text-sm">{history.narrative}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(history.snapshot_at).toLocaleTimeString()}
                                  </span>
                                  <span className="text-xs text-orange-400">
                                    {formatDistanceToNow(new Date(history.snapshot_at), { addSuffix: true })}
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
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Trending Tokens */}
        <div>
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
            Top 50 Trending (DexScreener)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
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
                  No trending tokens yet. Waiting for data sync from DexScreener.
                </CardContent>
              </Card>
            ) : (
              tokens.map((token) => (
                <Card key={token.id} className="hover:bg-muted/50 transition-colors overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-start gap-0">
                      {/* Rank strip */}
                      <div className="w-7 flex-shrink-0 flex items-center justify-center py-3 text-xs font-bold text-muted-foreground border-r border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
                        {token.rank}
                      </div>
                      <div className="flex items-center gap-2.5 p-2.5 flex-1 min-w-0">
                        {token.image_url ? (
                          <img 
                            src={token.image_url} 
                            alt={token.name || token.symbol || "Token"} 
                            className="w-9 h-9 rounded-full bg-muted flex-shrink-0 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {(token.symbol || token.name || "?").charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-sm truncate leading-tight">
                              {token.name || token.symbol || "Unknown"}
                            </span>
                            {token.url && (
                              <a 
                                href={token.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary flex-shrink-0"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          {token.symbol && (
                            <span className="text-[11px] text-muted-foreground">${token.symbol}</span>
                          )}
                          {token.description && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">
                              {token.description}
                            </p>
                          )}
                          <Badge variant="outline" className="text-[9px] mt-1 px-1 py-0 h-4">
                            {token.chain_id}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default TrendingPage;
