import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, CheckCircle, XCircle, Clock, MessageSquare, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface InfluencerReply {
  id: string;
  influencer_username: string;
  tweet_id: string;
  tweet_text: string | null;
  tweet_type: string;
  reply_id: string | null;
  reply_text: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface ListConfig {
  id: string;
  list_id: string;
  list_name: string | null;
  is_active: boolean;
  max_replies_per_run: number;
  include_retweets: boolean;
  include_replies: boolean;
}

export default function InfluencerRepliesAdminPage() {
  const queryClient = useQueryClient();

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ["influencer-status"],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/influencer-list-reply?action=status`
      );
      if (!response.ok) throw new Error("Failed to fetch status");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: replies, isLoading: repliesLoading } = useQuery({
    queryKey: ["influencer-replies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_replies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as InfluencerReply[];
    },
    refetchInterval: 15000,
  });

  const { data: config } = useQuery({
    queryKey: ["influencer-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_list_config")
        .select("*")
        .single();
      if (error) throw error;
      return data as ListConfig;
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const { error } = await supabase
        .from("influencer_list_config")
        .update({ is_active: isActive })
        .eq("id", config?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencer-config"] });
      toast.success("Config updated");
    },
  });

  const triggerManualRun = async () => {
    toast.info("Triggering manual run...");
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/influencer-list-reply`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Processed ${data.processed || 0} tweets, ${data.successful || 0} successful`);
        refetchStatus();
        queryClient.invalidateQueries({ queryKey: ["influencer-replies"] });
      }
    } catch (err) {
      toast.error("Failed to trigger run");
    }
  };

  const successCount = replies?.filter(r => r.status === "sent").length || 0;
  const failedCount = replies?.filter(r => r.status === "failed").length || 0;
  const pendingCount = replies?.filter(r => r.status === "pending").length || 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Influencer Auto-Reply Monitor</h1>
            <p className="text-muted-foreground">Monitor automated replies to influencer tweets</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => refetchStatus()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={triggerManualRun} size="sm">
              <Zap className="h-4 w-4 mr-2" />
              Run Now
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{statusData?.repliesLastHour || 0}</p>
                  <p className="text-xs text-muted-foreground">Replies/Hour</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{successCount}</p>
                  <p className="text-xs text-muted-foreground">Successful</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{failedCount}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{replies?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Tracked</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Config Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Active</span>
                <Switch
                  checked={config?.is_active || false}
                  onCheckedChange={(checked) => toggleActiveMutation.mutate(checked)}
                />
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">List ID</span>
                <p className="font-mono text-xs mt-1">{config?.list_id || "N/A"}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Max Replies/Run</span>
                <p className="font-bold mt-1">{config?.max_replies_per_run || 4}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Include</span>
                <div className="flex gap-2 mt-1">
                  {config?.include_retweets && <Badge variant="secondary">Retweets</Badge>}
                  {config?.include_replies && <Badge variant="secondary">Replies</Badge>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Replies Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Replies</CardTitle>
          </CardHeader>
          <CardContent>
            {repliesLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {replies?.map((reply) => (
                  <div
                    key={reply.id}
                    className="p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <a
                            href={`https://x.com/${reply.influencer_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-primary hover:underline"
                          >
                            @{reply.influencer_username}
                          </a>
                          <Badge variant="outline" className="text-xs">
                            {reply.tweet_type}
                          </Badge>
                          <Badge
                            variant={
                              reply.status === "sent"
                                ? "default"
                                : reply.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {reply.status}
                          </Badge>
                        </div>
                        
                        {reply.tweet_text && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            <span className="font-medium">Tweet:</span> {reply.tweet_text}
                          </p>
                        )}
                        
                        {reply.reply_text && (
                          <p className="text-sm mb-2">
                            <span className="font-medium text-green-600">Reply:</span> {reply.reply_text}
                          </p>
                        )}
                        
                        {reply.error_message && (
                          <p className="text-sm text-red-500">
                            <span className="font-medium">Error:</span> {reply.error_message}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        <p>{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</p>
                        {reply.reply_id && (
                          <a
                            href={`https://x.com/i/status/${reply.reply_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            View Reply
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {(!replies || replies.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No replies tracked yet. Click "Run Now" to start.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
