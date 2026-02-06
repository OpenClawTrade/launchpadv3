import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, MessageSquare, Reply, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const COLOSSEUM_FORUM_BASE = "https://colosseum.com/agent-hackathon/forum";

export default function ColosseumAdminPage() {
  const { data: engagements, isLoading, refetch } = useQuery({
    queryKey: ["colosseum-engagements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colosseum_engagement_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: activity, refetch: refetchActivity } = useQuery({
    queryKey: ["colosseum-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colosseum_activity")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const successfulComments = engagements?.filter(e => e.engagement_type === "comment" && e.status === "success") || [];
  const failedComments = engagements?.filter(e => e.engagement_type === "comment" && e.status === "failed") || [];
  const successfulReplies = engagements?.filter(e => e.engagement_type === "reply" && e.status === "success") || [];
  const failedReplies = engagements?.filter(e => e.engagement_type === "reply" && e.status === "failed") || [];

  const triggerEngage = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("colosseum-auto-engage", {
        body: { action: "engage" },
      });
      if (error) throw error;
      console.log("Trigger result:", data);
      refetch();
      refetchActivity();
    } catch (err) {
      console.error("Failed to trigger engagement:", err);
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (status === "success") {
      return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>;
    } else if (status === "failed") {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    }
    return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Colosseum Engagement</h1>
            <p className="text-muted-foreground">Track all forum comments and replies (1 post per 5 min)</p>
          </div>
          <Button onClick={triggerEngage} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Trigger Engage Now
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-500">{successfulComments.length}</div>
              <p className="text-sm text-muted-foreground">Comments Posted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-500">{failedComments.length}</div>
              <p className="text-sm text-muted-foreground">Comments Failed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-500">{successfulReplies.length}</div>
              <p className="text-sm text-muted-foreground">Replies Sent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-500">{failedReplies.length}</div>
              <p className="text-sm text-muted-foreground">Replies Failed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{engagements?.length || 0}</div>
              <p className="text-sm text-muted-foreground">Total Attempts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{activity?.length || 0}</div>
              <p className="text-sm text-muted-foreground">Cron Runs</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Cron Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Cron Runs (Last 20)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activity?.map((run: any) => {
                const payload = run.payload as any;
                return (
                  <div
                    key={run.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {run.success ? (
                          <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>
                        ) : (
                          <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
                        )}
                        <span className="text-sm font-medium">{run.activity_type}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    
                    {payload && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                        <div className="bg-muted/50 p-2 rounded">
                          <span className="text-muted-foreground">Posts Found:</span>
                          <span className="ml-1 font-medium">{payload.totalPosts || 0}</span>
                        </div>
                        <div className="bg-muted/50 p-2 rounded">
                          <span className="text-muted-foreground">Eligible:</span>
                          <span className="ml-1 font-medium">{payload.eligiblePosts || 0}</span>
                        </div>
                        <div className="bg-green-500/10 p-2 rounded">
                          <span className="text-muted-foreground">Comments:</span>
                          <span className="ml-1 font-medium text-green-500">{payload.commentsPosted || 0}</span>
                        </div>
                        <div className="bg-green-500/10 p-2 rounded">
                          <span className="text-muted-foreground">Replies:</span>
                          <span className="ml-1 font-medium text-green-500">{payload.repliesPosted || 0}</span>
                        </div>
                        <div className="bg-muted/50 p-2 rounded">
                          <span className="text-muted-foreground">Skipped:</span>
                          <span className="ml-1 font-medium">{payload.skipped || 0}</span>
                        </div>
                      </div>
                    )}
                    
                    {payload?.rateLimited && (
                      <div className="flex items-center gap-2 text-amber-500 text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        Rate limited by Colosseum API
                      </div>
                    )}
                    
                    {run.error_message && (
                      <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                        {run.error_message}
                      </div>
                    )}
                    
                    {payload?.errors?.length > 0 && (
                      <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded max-h-20 overflow-y-auto">
                        {payload.errors.slice(0, 3).map((err: string, i: number) => (
                          <div key={i}>• {err}</div>
                        ))}
                        {payload.errors.length > 3 && (
                          <div className="text-muted-foreground">...and {payload.errors.length - 3} more</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* All Engagements Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              All Engagement Attempts (Last 100)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {engagements?.map((engagement: any) => (
                  <div
                    key={engagement.id}
                    className={`border rounded-lg p-4 space-y-2 ${
                      engagement.status === "failed" ? "border-red-500/50 bg-red-500/5" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(engagement.status)}
                        {engagement.engagement_type === "comment" ? (
                          <Badge variant="secondary">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Comment
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Reply className="w-3 h-3 mr-1" />
                            Reply
                          </Badge>
                        )}
                        <span className="font-medium text-foreground">
                          {engagement.target_project_name}
                        </span>
                        {engagement.http_status && (
                          <Badge variant="outline" className="text-xs">
                            HTTP {engagement.http_status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(engagement.created_at), { addSuffix: true })}
                        </span>
                        <a
                          href={`${COLOSSEUM_FORUM_BASE}/${engagement.target_post_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                      {engagement.comment_body}
                    </p>
                    
                    {engagement.error_message && (
                      <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded">
                        <strong>Error:</strong> {engagement.error_message}
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                      <span>Post ID: {engagement.target_post_id}</span>
                      {engagement.comment_id && <span>• Comment ID: {engagement.comment_id}</span>}
                    </div>
                  </div>
                ))}
                
                {engagements?.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    No engagement attempts yet. Click "Trigger Engage Now" to start.
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
