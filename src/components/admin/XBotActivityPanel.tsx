import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, RefreshCw, Clock, CheckCircle, XCircle, Terminal, AlertTriangle, Info } from "lucide-react";
import type {
  XBotAccountWithRules,
  XBotAccountReply,
  XBotQueueItem,
  XBotAccountLog,
} from "@/hooks/useXBotAccounts";

interface XBotActivityPanelProps {
  account: XBotAccountWithRules | null;
  replies: XBotAccountReply[];
  queue: XBotQueueItem[];
  logs: XBotAccountLog[];
  onRefresh: () => void;
  loading?: boolean;
}

export function XBotActivityPanel({
  account,
  replies,
  queue,
  logs,
  onRefresh,
  loading,
}: XBotActivityPanelProps) {
  const [tab, setTab] = useState("replies");
  const [logLevelFilter, setLogLevelFilter] = useState<string>("all");

  const accountReplies = account
    ? replies.filter((r) => r.account_id === account.id)
    : replies;

  const accountQueue = account
    ? queue.filter((q) => q.account_id === account.id)
    : queue;

  const accountLogs = account
    ? logs.filter((l) => l.account_id === account.id)
    : logs;

  const filteredLogs = logLevelFilter === "all"
    ? accountLogs
    : accountLogs.filter((l) => l.level === logLevelFilter);

  const todayReplies = accountReplies.filter((r) => {
    const today = new Date();
    const replyDate = new Date(r.created_at);
    return (
      replyDate.getDate() === today.getDate() &&
      replyDate.getMonth() === today.getMonth() &&
      replyDate.getFullYear() === today.getFullYear()
    );
  });

  const successRate = accountReplies.length
    ? Math.round(
        (accountReplies.filter((r) => r.status === "success").length /
          accountReplies.length) *
          100
      )
    : 0;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="default">
            <CheckCircle className="w-3 h-3 mr-1" />
            Success
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLogLevelBadge = (level: string) => {
    switch (level) {
      case "error":
        return (
          <Badge variant="destructive" className="font-mono text-xs">
            ERR
          </Badge>
        );
      case "warn":
        return (
          <Badge variant="outline" className="font-mono text-xs border-amber-500 text-amber-600 dark:text-amber-400">
            WARN
          </Badge>
        );
      case "info":
      default:
        return (
          <Badge variant="secondary" className="font-mono text-xs">
            INFO
          </Badge>
        );
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case "error":
        return <XCircle className="w-3 h-3 text-destructive" />;
      case "warn":
        return <AlertTriangle className="w-3 h-3 text-amber-500" />;
      default:
        return <Info className="w-3 h-3 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          {account ? `Activity: ${account.name}` : "All Activity"}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{todayReplies.length}</div>
            <div className="text-sm text-muted-foreground">Replies Today</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{successRate}%</div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">
              {accountQueue.filter((q) => q.status === "pending").length}
            </div>
            <div className="text-sm text-muted-foreground">In Queue</div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="replies">Recent Replies</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="console" className="flex items-center gap-1">
              <Terminal className="w-3 h-3" />
              Console
            </TabsTrigger>
          </TabsList>

          <TabsContent value="replies">
            <ScrollArea className="h-[400px]">
              {accountReplies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No replies yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tweet</TableHead>
                      <TableHead>Reply</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountReplies.slice(0, 50).map((reply) => (
                      <TableRow key={reply.id}>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate text-sm">
                            @{reply.tweet_author}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {reply.tweet_text?.substring(0, 80)}...
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate text-sm">
                            {reply.reply_text?.substring(0, 80)}...
                          </div>
                          {reply.reply_id && (
                            <a
                              href={`https://twitter.com/i/status/${reply.reply_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary flex items-center gap-1"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(reply.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(reply.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="queue">
            <ScrollArea className="h-[400px]">
              {accountQueue.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Queue is empty
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tweet</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Queued</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountQueue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate text-sm">
                            {item.tweet_text?.substring(0, 80)}...
                          </div>
                          <a
                            href={`https://twitter.com/i/status/${item.tweet_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-1"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">@{item.tweet_author}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.follower_count?.toLocaleString()} followers
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.match_type}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(item.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="console">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <Select value={logLevelFilter} onValueChange={setLogLevelFilter}>
                <SelectTrigger className="w-[120px] h-8">
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-auto">
                {filteredLogs.length} entries
              </span>
            </div>
            <ScrollArea className="h-[370px] rounded-md border bg-muted/30">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No logs yet. Run a scan or reply to generate activity.
                </div>
              ) : (
                <div className="font-mono text-xs p-2 space-y-1">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`flex items-start gap-2 px-2 py-1 rounded ${
                        log.level === "error"
                          ? "bg-destructive/10"
                          : log.level === "warn"
                          ? "bg-amber-500/10"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <span className="text-muted-foreground whitespace-nowrap">
                        {formatTime(log.created_at)}
                      </span>
                      {getLogLevelBadge(log.level)}
                      <span className="flex-1">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
