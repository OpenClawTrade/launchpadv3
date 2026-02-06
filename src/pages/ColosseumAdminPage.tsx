import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, MessageSquare, Reply, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Colosseum AI Agent Hackathon forum URL structure
const COLOSSEUM_FORUM_BASE = "https://agents.colosseum.com/hackathon/ai-agents/forum";

export default function ColosseumAdminPage() {
  const { data: engagements, isLoading, refetch } = useQuery({
    queryKey: ["colosseum-engagements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colosseum_engagement_log")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: activity } = useQuery({
    queryKey: ["colosseum-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colosseum_activity")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  const comments = engagements?.filter(e => e.engagement_type === "comment") || [];
  const replies = engagements?.filter(e => e.engagement_type === "reply") || [];

  const triggerEngage = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("colosseum-auto-engage", {
        body: { action: "engage" },
      });
      if (error) throw error;
      refetch();
    } catch (err) {
      console.error("Failed to trigger engagement:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Colosseum Engagement</h1>
            <p className="text-muted-foreground">Track all forum comments and replies</p>
          </div>
          <Button onClick={triggerEngage} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Trigger Engage Now
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{comments.length}</div>
              <p className="text-sm text-muted-foreground">Comments Posted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{replies.length}</div>
              <p className="text-sm text-muted-foreground">Replies Sent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{engagements?.length || 0}</div>
              <p className="text-sm text-muted-foreground">Total Engagements</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{activity?.length || 0}</div>
              <p className="text-sm text-muted-foreground">Cron Runs</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              All Engagements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-4">
                {engagements?.map((engagement) => (
                  <div
                    key={engagement.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
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
                    <div className="text-xs text-muted-foreground">
                      Post ID: {engagement.target_post_id} • Comment ID: {engagement.comment_id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cron Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Cron Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activity?.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={run.success ? "default" : "destructive"}>
                      {run.success ? "Success" : "Failed"}
                    </Badge>
                    <span className="text-sm">{run.activity_type}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
