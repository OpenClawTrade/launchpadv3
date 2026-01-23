import { useState, useEffect } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowClockwise, TwitterLogo, CheckCircle, XCircle, Clock, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

interface TwitterReply {
  id: string;
  tweet_id: string;
  tweet_author: string | null;
  tweet_text: string | null;
  reply_text: string;
  reply_id: string | null;
  created_at: string;
}

export default function TwitterBotAdminPage() {
  const { solanaAddress } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin(solanaAddress);
  const [replies, setReplies] = useState<TwitterReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<any>(null);

  const fetchReplies = async () => {
    try {
      // Use raw fetch since twitter_bot_replies isn't in generated types
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/twitter_bot_replies?select=*&order=created_at.desc&limit=100`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      const data = await response.json();
      setReplies(data || []);
    } catch (err) {
      console.error("Error fetching replies:", err);
      toast.error("Failed to fetch replies");
    } finally {
      setIsLoading(false);
    }
  };

  const triggerBot = async () => {
    setIsTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke("twitter-auto-reply");
      
      if (error) throw error;
      
      setLastRunResult(data);
      toast.success(`Bot run complete: ${data?.repliesSent || 0} replies sent`);
      
      // Refresh the list
      await fetchReplies();
    } catch (err) {
      console.error("Error triggering bot:", err);
      toast.error("Failed to trigger bot");
      setLastRunResult({ error: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsTriggering(false);
    }
  };

  useEffect(() => {
    fetchReplies();
  }, []);

  // Redirect non-admins
  if (!adminLoading && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const stats = {
    total: replies.length,
    today: replies.filter(r => 
      new Date(r.created_at).toDateString() === new Date().toDateString()
    ).length,
    successful: replies.filter(r => r.reply_id).length,
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f]">
      <AppHeader />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <TwitterLogo className="h-6 w-6 text-blue-400" weight="fill" />
              Twitter Bot Admin
            </h1>
            <p className="text-gray-400 mt-1">
              Monitor and manage automated Twitter replies
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReplies}
              disabled={isLoading}
              className="border-gray-700"
            >
              <ArrowClockwise className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={triggerBot}
              disabled={isTriggering}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isTriggering ? (
                <>
                  <ArrowClockwise className="h-4 w-4 mr-1 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <TwitterLogo className="h-4 w-4 mr-1" weight="fill" />
                  Trigger Bot Now
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-[#12121a] border-[#1a1a1f]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-gray-400">Total Replies</div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#12121a] border-[#1a1a1f]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-400">{stats.today}</div>
              <div className="text-sm text-gray-400">Today</div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#12121a] border-[#1a1a1f]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-400">{stats.successful}</div>
              <div className="text-sm text-gray-400">Successful Posts</div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#12121a] border-[#1a1a1f]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-400">15min</div>
              <div className="text-sm text-gray-400">Post Interval</div>
            </CardContent>
          </Card>
        </div>

        {/* Last Run Result */}
        {lastRunResult && (
          <Card className="bg-[#12121a] border-[#1a1a1f] mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">Last Manual Run</CardTitle>
            </CardHeader>
            <CardContent>
              {lastRunResult.error ? (
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="h-5 w-5" />
                  <span>{lastRunResult.error}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span>{lastRunResult.repliesSent} replies sent</span>
                  </div>
                  {lastRunResult.searchQuery && (
                    <div className="text-sm text-gray-400">
                      Search query: "{lastRunResult.searchQuery}"
                    </div>
                  )}
                  {lastRunResult.results && (
                    <div className="mt-2 space-y-1">
                      {lastRunResult.results.map((r: any, i: number) => (
                        <div key={i} className="text-xs flex items-center gap-2">
                          {r.success ? (
                            <CheckCircle className="h-3 w-3 text-green-400" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-400" />
                          )}
                          <span className="text-gray-500">Tweet {r.tweetId}</span>
                          {r.error && <span className="text-red-400">{r.error}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bot Configuration Info */}
        <Card className="bg-[#12121a] border-[#1a1a1f] mb-8">
          <CardHeader>
            <CardTitle className="text-white text-lg">Bot Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-gray-300">Runs every 15 minutes via cron</span>
            </div>
            <div className="flex items-center gap-2">
              <Warning className="h-4 w-4 text-yellow-400" />
              <span className="text-gray-300">Max 2 replies per run (rate limit protection)</span>
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Search queries: "crypto meme coin", "solana degen", "memecoin launch", "$SOL pump", "web3 meme"
            </div>
          </CardContent>
        </Card>

        {/* Replies List */}
        <Card className="bg-[#12121a] border-[#1a1a1f]">
          <CardHeader>
            <CardTitle className="text-white">Recent Replies</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : replies.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No replies yet. The bot will start posting when triggered.
              </div>
            ) : (
              <div className="space-y-4">
                {replies.map((reply) => (
                  <div 
                    key={reply.id}
                    className="p-4 bg-[#0d0d0f] rounded-lg border border-[#1a1a1f]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-blue-400 font-medium">
                            @{reply.tweet_author || "unknown"}
                          </span>
                          <span className="text-gray-600 text-xs">
                            {formatDate(reply.created_at)}
                          </span>
                          {reply.reply_id ? (
                            <Badge variant="outline" className="text-green-400 border-green-400/30 text-xs">
                              Posted
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                        
                        {reply.tweet_text && (
                          <div className="text-gray-400 text-sm mb-2 p-2 bg-[#1a1a1f] rounded">
                            {reply.tweet_text}
                          </div>
                        )}
                        
                        <div className="text-white text-sm">
                          <span className="text-gray-500">Reply: </span>
                          {reply.reply_text}
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0">
                        {reply.tweet_id && (
                          <a
                            href={`https://x.com/i/web/status/${reply.tweet_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs"
                          >
                            View →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
