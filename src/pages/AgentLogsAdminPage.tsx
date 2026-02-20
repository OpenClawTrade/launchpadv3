import { useState, useEffect, useCallback } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowClockwise,
  TwitterLogo,
  CheckCircle,
  XCircle,
  Warning,
  Rocket,
  Eye,
  MagnifyingGlass,
  Coins,
  UsersThree,
  Image as ImageIcon,
  Link as LinkIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface SocialPost {
  id: string;
  platform: string;
  post_id: string;
  post_author: string | null;
  post_url: string | null;
  raw_content: string | null;
  status: string;
  error_message: string | null;
  parsed_name: string | null;
  parsed_symbol: string | null;
  wallet_address: string;
  fun_token_id: string | null;
  created_at: string;
  processed_at: string | null;
}

interface TokenJob {
  id: string;
  name: string;
  ticker: string;
  creator_wallet: string;
  status: string;
  error_message: string | null;
  mint_address: string | null;
  dbc_pool_address: string | null;
  fun_token_id: string | null;
  created_at: string;
  completed_at: string | null;
}

interface FunToken {
  id: string;
  name: string;
  ticker: string;
  creator_wallet: string;
  mint_address: string | null;
  dbc_pool_address: string | null;
  agent_id: string | null;
  agent_name: string | null;
  created_at: string;
}

interface SubTunaRecord {
  id: string;
  name: string;
  ticker: string | null;
  description: string | null;
  icon_url: string | null;
  member_count: number;
  post_count: number;
  token_name: string | null;
  token_ticker: string | null;
  mint_address: string | null;
  created_at: string;
}

interface LaunchEvent {
  id: string;
  platform: string;
  post_id: string;
  post_author: string | null;
  stage: string;
  success: boolean;
  details: Record<string, any>;
  error_message: string | null;
  created_at: string;
}

export default function AgentLogsAdminPage() {
  const [activeTab, setActiveTab] = useState("diagnostics");
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [tokenJobs, setTokenJobs] = useState<TokenJob[]>([]);
  const [funTokens, setFunTokens] = useState<FunToken[]>([]);
  const [subTunas, setSubTunas] = useState<SubTunaRecord[]>([]);
  const [launchEvents, setLaunchEvents] = useState<LaunchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [selectedLaunchId, setSelectedLaunchId] = useState<string | null>(null);

  const fetchSocialPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("agent_social_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setSocialPosts(data || []);
    } catch (err) {
      console.error("Error fetching social posts:", err);
      toast.error("Failed to fetch social posts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTokenJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("fun_token_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setTokenJobs(data || []);
    } catch (err) {
      console.error("Error fetching token jobs:", err);
      toast.error("Failed to fetch token jobs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFunTokens = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("fun_tokens")
        .select(`
          id, name, ticker, creator_wallet, mint_address, dbc_pool_address, agent_id, created_at,
          agents:agent_id (name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setFunTokens((data || []).map((t: any) => ({
        ...t,
        agent_name: t.agents?.name || null,
      })));
    } catch (err) {
      console.error("Error fetching fun tokens:", err);
    }
  }, []);

  const fetchSubTunas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("subtuna")
        .select(`
          id, name, ticker, description, icon_url, member_count, post_count, created_at,
          fun_tokens:fun_token_id (name, ticker, mint_address)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setSubTunas((data || []).map((s: any) => ({
        ...s,
        token_name: s.fun_tokens?.name || null,
        token_ticker: s.fun_tokens?.ticker || null,
        mint_address: s.fun_tokens?.mint_address || null,
      })));
    } catch (err) {
      console.error("Error fetching subtunas:", err);
    }
  }, []);

  const fetchLaunchEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("x_launch_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setLaunchEvents((data || []) as LaunchEvent[]);
    } catch (err) {
      console.error("Error fetching launch events:", err);
    }
  }, []);

  const triggerScan = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "agent-scan-twitter",
        { body: {} }
      );

      if (error) throw error;

      toast.success(
        `Scan complete: ${data?.processed || 0} posts processed`
      );
      await fetchSocialPosts();
      await fetchLaunchEvents();
    } catch (err) {
      console.error("Error triggering scan:", err);
      toast.error("Failed to trigger scan");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAll = useCallback(() => {
    fetchSocialPosts();
    fetchTokenJobs();
    fetchFunTokens();
    fetchSubTunas();
    fetchLaunchEvents();
  }, [fetchSocialPosts, fetchTokenJobs, fetchFunTokens, fetchSubTunas, fetchLaunchEvents]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "launched":
        return (
          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="bg-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            failed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="bg-accent/20 text-accent-foreground border-accent/30">
            <Warning className="h-3 w-3 mr-1" />
            pending
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="bg-secondary/20 text-secondary-foreground border-secondary/30">
            <ArrowClockwise className="h-3 w-3 mr-1 animate-spin" />
            processing
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  // Group launch events by post_id
  const eventsByPost = launchEvents.reduce((acc, event) => {
    if (!acc[event.post_id]) {
      acc[event.post_id] = [];
    }
    acc[event.post_id].push(event);
    return acc;
  }, {} as Record<string, LaunchEvent[]>);

  const uniqueLaunchAttempts = Object.keys(eventsByPost).length;
  const successfulImageUploads = launchEvents.filter(e => e.stage === 'image_upload_ok' && e.success).length;
  const failedImageUploads = launchEvents.filter(e => e.stage === 'image_upload_failed' || (e.stage === 'image_missing' && !e.success)).length;

  const stats = {
    totalMentions: socialPosts.length,
    successfulLaunches: socialPosts.filter((p) => p.status === "launched")
      .length,
    failedParsing: socialPosts.filter((p) => p.status === "failed").length,
    pendingJobs: tokenJobs.filter((j) => j.status === "pending").length,
    completedJobs: tokenJobs.filter((j) => j.status === "completed").length,
    failedJobs: tokenJobs.filter((j) => j.status === "failed").length,
    totalTokens: funTokens.length,
    agentTokens: funTokens.filter((t) => t.agent_id).length,
    totalSubTunas: subTunas.length,
    launchAttempts: uniqueLaunchAttempts,
    imageUploadsOk: successfulImageUploads,
    imageUploadsFailed: failedImageUploads,
  };

  return (
    <LaunchpadLayout showKingOfTheHill={false}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MagnifyingGlass className="h-6 w-6 text-primary" />
              Agent Logs Monitor
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor X mentions and token launch jobs
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={isLoading}
            >
              <ArrowClockwise
                className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={triggerScan}
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90"
            >
              <TwitterLogo className="h-4 w-4 mr-1" weight="fill" />
              Scan Now
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <Card className="bg-card/50 border-border">
            <CardContent className="p-3">
              <div className="text-xl font-bold">{stats.totalMentions}</div>
              <div className="text-xs text-muted-foreground">Mentions</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-3">
              <div className="text-xl font-bold text-primary">
                {stats.successfulLaunches}
              </div>
              <div className="text-xs text-muted-foreground">Launched</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-3">
              <div className="text-xl font-bold text-destructive">
                {stats.failedParsing}
              </div>
              <div className="text-xs text-muted-foreground">Parse Fail</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-3">
              <div className="text-xl font-bold">{stats.totalTokens}</div>
              <div className="text-xs text-muted-foreground">Tokens</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-3">
              <div className="text-xl font-bold text-primary">
                {stats.agentTokens}
              </div>
              <div className="text-xs text-muted-foreground">By Agents</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-3">
              <div className="text-xl font-bold">{stats.totalSubTunas}</div>
              <div className="text-xs text-muted-foreground">SubTunas</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary/50 border border-border flex-wrap">
            <TabsTrigger value="diagnostics" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ImageIcon className="h-4 w-4" />
              Diagnostics ({stats.launchAttempts})
            </TabsTrigger>
            <TabsTrigger value="mentions" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TwitterLogo className="h-4 w-4" />
              Mentions ({socialPosts.length})
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Rocket className="h-4 w-4" />
              Jobs ({tokenJobs.length})
            </TabsTrigger>
            <TabsTrigger value="tokens" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Coins className="h-4 w-4" />
              Tokens ({funTokens.length})
            </TabsTrigger>
            <TabsTrigger value="subtunas" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <UsersThree className="h-4 w-4" />
              Communities ({subTunas.length})
            </TabsTrigger>
          </TabsList>

          {/* X Launch Diagnostics Tab */}
          <TabsContent value="diagnostics">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  X Launch Pipeline Diagnostics
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Stage-by-stage tracking for every X-triggered launch. See exactly where image uploads or token creation failed.
                </p>
              </CardHeader>
              <CardContent>
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-secondary/30 rounded p-3">
                    <div className="text-lg font-bold">{stats.launchAttempts}</div>
                    <div className="text-xs text-muted-foreground">Launch Attempts</div>
                  </div>
                  <div className="bg-primary/10 rounded p-3">
                    <div className="text-lg font-bold text-primary">{stats.imageUploadsOk}</div>
                    <div className="text-xs text-muted-foreground">Images Hosted</div>
                  </div>
                  <div className="bg-destructive/10 rounded p-3">
                    <div className="text-lg font-bold text-destructive">{stats.imageUploadsFailed}</div>
                    <div className="text-xs text-muted-foreground">Image Failures</div>
                  </div>
                </div>

                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Time</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {launchEvents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="text-muted-foreground">
                              No launch events yet. Events are logged when processing X mentions.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        launchEvents.map((event) => (
                          <TableRow key={event.id} className="border-border">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(event.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <TwitterLogo className="h-3 w-3 text-primary" />
                                <span className="text-sm">
                                  @{event.post_author || "unknown"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                event.stage.includes('ok') || event.stage === 'create_token_ok' || event.stage === 'reply_sent'
                                  ? "bg-primary/20 text-primary border-primary/30"
                                  : event.stage.includes('failed') || event.stage.includes('missing')
                                  ? "bg-destructive/20 text-destructive border-destructive/30"
                                  : "bg-secondary/50"
                              }>
                                {event.stage}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {event.success ? (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs max-w-[200px] space-y-1">
                                {event.details?.hosted_url && (
                                  <a
                                    href={event.details.hosted_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    <ImageIcon className="h-3 w-3" />
                                    View Image
                                  </a>
                                )}
                                {event.details?.raw_url && !event.details?.hosted_url && (
                                  <span className="text-muted-foreground truncate block">
                                    Raw: {event.details.raw_url.slice(0, 30)}...
                                  </span>
                                )}
                                {event.details?.mint_address && (
                                  <a
                                    href={`https://solscan.io/token/${event.details.mint_address}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    <LinkIcon className="h-3 w-3" />
                                    {event.details.mint_address.slice(0, 8)}...
                                  </a>
                                )}
                                {event.details?.byte_size && (
                                  <span className="text-muted-foreground">
                                    {(event.details.byte_size / 1024).toFixed(1)}KB
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {event.error_message && (
                                <span className="text-xs text-destructive max-w-[200px] truncate block">
                                  {event.error_message}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mentions">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-lg">
                  Recent !clawmode Mentions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Time</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Parsed Data</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {socialPosts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="text-muted-foreground">
                              No mentions found yet. Click "Scan Now" to fetch.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        socialPosts.map((post) => (
                          <TableRow key={post.id} className="border-border">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(post.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <TwitterLogo className="h-3 w-3 text-primary" />
                                <span className="text-sm">
                                  @{post.post_author || "unknown"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(post.status)}</TableCell>
                            <TableCell>
                              {post.parsed_name ? (
                                <div className="text-xs">
                                  <span className="font-medium">
                                    {post.parsed_name}
                                  </span>
                                  {post.parsed_symbol && (
                                    <span className="text-muted-foreground ml-1">
                                      (${post.parsed_symbol})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Not parsed
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {post.error_message && (
                                <span className="text-xs text-destructive max-w-[200px] truncate block">
                                  {post.error_message}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {post.post_url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    className="h-7 px-2"
                                  >
                                    <a
                                      href={post.post_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <TwitterLogo className="h-3 w-3" />
                                    </a>
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => setSelectedPost(post)}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-lg">Token Launch Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Time</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Mint Address</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tokenJobs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="text-muted-foreground">
                              No token jobs yet.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        tokenJobs.map((job) => (
                          <TableRow key={job.id} className="border-border">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(job.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{job.name}</div>
                              <div className="text-xs text-muted-foreground">
                                ${job.ticker}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-mono">
                                {job.creator_wallet ? (
                                  <>
                                    {job.creator_wallet.slice(0, 4)}...
                                    {job.creator_wallet.slice(-4)}
                                  </>
                                ) : (
                                  "-"
                                )}
                              </span>
                            </TableCell>
                            <TableCell>{getStatusBadge(job.status)}</TableCell>
                            <TableCell>
                              {job.mint_address ? (
                                <a
                                  href={`https://solscan.io/token/${job.mint_address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-mono text-primary hover:underline"
                                >
                                  {job.mint_address.slice(0, 4)}...
                                  {job.mint_address.slice(-4)}
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  -
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {job.error_message && (
                                <span className="text-xs text-destructive max-w-[200px] truncate block">
                                  {job.error_message}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tokens Created Tab */}
          <TabsContent value="tokens">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-lg">Tokens Created</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Time</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Mint Address</TableHead>
                        <TableHead>Pool</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {funTokens.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="text-muted-foreground">
                              No tokens created yet.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        funTokens.map((token) => (
                          <TableRow key={token.id} className="border-border">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(token.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{token.name}</div>
                              <div className="text-xs text-muted-foreground">
                                ${token.ticker}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-mono">
                                {token.creator_wallet ? (
                                  <>
                                    {token.creator_wallet.slice(0, 4)}...
                                    {token.creator_wallet.slice(-4)}
                                  </>
                                ) : (
                                  "-"
                                )}
                              </span>
                            </TableCell>
                            <TableCell>
                              {token.agent_name ? (
                                <Badge variant="outline" className="text-xs">
                                  {token.agent_name}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {token.mint_address ? (
                                <a
                                  href={`https://solscan.io/token/${token.mint_address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-mono text-primary hover:underline"
                                >
                                  {token.mint_address.slice(0, 4)}...
                                  {token.mint_address.slice(-4)}
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {token.dbc_pool_address ? (
                                <a
                                  href={`https://axiom.trade/meme/${token.dbc_pool_address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-mono text-primary hover:underline"
                                >
                                  View Pool
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SubTunas Tab */}
          <TabsContent value="subtunas">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-lg">SubTuna Communities</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Time</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Ticker</TableHead>
                        <TableHead>Token Link</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Posts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subTunas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="text-muted-foreground">
                              No SubTunas created yet.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        subTunas.map((subtuna) => (
                          <TableRow key={subtuna.id} className="border-border">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(subtuna.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {subtuna.icon_url && (
                                  <img
                                    src={subtuna.icon_url}
                                    alt=""
                                    className="h-6 w-6 rounded-full"
                                  />
                                )}
                                <a
                                  href={`/t/${subtuna.ticker || subtuna.name.replace("t/", "")}`}
                                  className="font-medium text-primary hover:underline"
                                >
                                  {subtuna.name}
                                </a>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-mono">
                                {subtuna.ticker || subtuna.token_ticker || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {subtuna.mint_address ? (
                                <a
                                  href={`https://solscan.io/token/${subtuna.mint_address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-mono text-primary hover:underline"
                                >
                                  {subtuna.mint_address.slice(0, 4)}...
                                  {subtuna.mint_address.slice(-4)}
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">System</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{subtuna.member_count}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{subtuna.post_count}</span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Detail Modal */}
        {selectedPost && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedPost(null)}
          >
            <Card
              className="max-w-2xl w-full max-h-[80vh] overflow-auto bg-card border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Post Details</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPost(null)}
                  >
                    ×
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Platform</div>
                    <div className="font-medium">{selectedPost.platform}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Status</div>
                    <div>{getStatusBadge(selectedPost.status)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Author</div>
                    <div className="font-medium">
                      @{selectedPost.post_author || "unknown"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Wallet</div>
                    <div className="font-mono text-xs">
                      {selectedPost.wallet_address}
                    </div>
                  </div>
                </div>

                {selectedPost.raw_content && (
                  <div>
                    <div className="text-muted-foreground text-sm mb-1">
                      Raw Content
                    </div>
                    <div className="bg-muted p-3 rounded text-sm">
                      {selectedPost.raw_content}
                    </div>
                  </div>
                )}

                {selectedPost.error_message && (
                  <div>
                    <div className="text-destructive text-sm mb-1">Error</div>
                    <div className="bg-destructive/10 border border-destructive/20 p-3 rounded text-sm text-destructive">
                      {selectedPost.error_message}
                    </div>
                  </div>
                )}

                {selectedPost.post_url && (
                  <Button asChild className="w-full">
                    <a
                      href={selectedPost.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <TwitterLogo className="h-4 w-4 mr-2" />
                      View on X
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </LaunchpadLayout>
  );
}
