import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Search, Download, Users, BadgeCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ADMIN_PASSWORD = "tuna";
const AUTH_KEY = "follower-scan-auth";

interface FollowerRecord {
  id: string;
  target_username: string;
  twitter_user_id: string;
  username: string;
  display_name: string;
  profile_picture: string;
  description: string;
  follower_count: number;
  following_count: number;
  statuses_count: number;
  verification_type: string;
  is_blue_verified: boolean;
  is_gold_verified: boolean;
  location: string;
  scanned_at: string;
}

export default function FollowerScanPage() {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem(AUTH_KEY) === "true"
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [username, setUsername] = useState("openclaw");
  const [scanning, setScanning] = useState(false);
  const [followers, setFollowers] = useState<FollowerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      sessionStorage.setItem(AUTH_KEY, "true");
      setError("");
    } else {
      setError("Invalid password");
    }
  };

  const fetchFollowers = async (target?: string) => {
    setLoading(true);
    const t = (target || username).replace("@", "").toLowerCase();
    const { data, error } = await supabase
      .from("x_follower_scans")
      .select("*")
      .eq("target_username", t)
      .order("following_count", { ascending: false });

    if (error) {
      console.error("Error fetching followers:", error);
    } else {
      setFollowers((data as FollowerRecord[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authenticated) {
      fetchFollowers();
    }
  }, [authenticated]);

  const startScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-x-followers", {
        body: { username: username.replace("@", "").toLowerCase() },
      });

      if (error) {
        toast({ title: "Scan Error", description: error.message, variant: "destructive" });
      } else {
        setScanResult(data);
        toast({
          title: "Scan Complete",
          description: `Fetched ${data.totalFetched} followers (${data.blueCount} blue, ${data.goldCount} gold)`,
        });
        await fetchFollowers();
      }
    } catch (err: any) {
      toast({ title: "Scan Error", description: err.message, variant: "destructive" });
    }
    setScanning(false);
  };

  const blueFollowers = useMemo(
    () => followers.filter((f) => f.verification_type === "blue"),
    [followers]
  );
  const goldFollowers = useMemo(
    () => followers.filter((f) => f.verification_type === "gold"),
    [followers]
  );
  const unverifiedFollowers = useMemo(
    () => followers.filter((f) => f.verification_type === "unverified"),
    [followers]
  );

  const exportCSV = (data: FollowerRecord[], filename: string) => {
    const headers = "Username,Display Name,Followers,Following,Tweets,Verification,Location\n";
    const rows = data
      .map(
        (f) =>
          `${f.username},"${f.display_name}",${f.follower_count},${f.following_count},${f.statuses_count},${f.verification_type},"${f.location || ""}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto text-primary mb-2" />
            <CardTitle>Follower Scanner</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Admin Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">
                Access Scanner
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const FollowerTable = ({ data }: { data: FollowerRecord[] }) => (
    <div className="rounded-md border overflow-auto max-h-[600px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Display Name</TableHead>
            <TableHead className="text-right">Followers</TableHead>
            <TableHead className="text-right">Following</TableHead>
            <TableHead className="text-right">Tweets</TableHead>
            <TableHead>Location</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No followers found
              </TableCell>
            </TableRow>
          ) : (
            data.map((f) => (
              <TableRow key={f.id}>
                <TableCell>
                  {f.profile_picture ? (
                    <img
                      src={f.profile_picture}
                      alt=""
                      className="w-8 h-8 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted" />
                  )}
                </TableCell>
                <TableCell>
                  <a
                    href={`https://x.com/${f.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    @{f.username}
                  </a>
                </TableCell>
                <TableCell className="flex items-center gap-1">
                  {f.display_name}
                  {f.is_blue_verified && (
                    <BadgeCheck className="w-4 h-4 text-blue-500" />
                  )}
                  {f.is_gold_verified && (
                    <BadgeCheck className="w-4 h-4 text-yellow-500" />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {f.follower_count.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {f.following_count.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {f.statuses_count.toLocaleString()}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                  {f.location || "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Follower Scanner</h1>
            <p className="text-muted-foreground">
              Fetch, categorize & export X followers
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => exportCSV(followers, `${username}-all-followers`)}
            disabled={followers.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export All CSV
          </Button>
        </div>

        {/* Scan Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 space-y-2">
                <Label>X Username</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="openclaw"
                />
              </div>
              <Button onClick={startScan} disabled={scanning || !username}>
                {scanning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                {scanning ? "Scanning..." : "Start Scan"}
              </Button>
              <Button variant="outline" onClick={() => fetchFollowers()} disabled={loading}>
                Refresh Data
              </Button>
            </div>
            {scanResult && (
              <p className="text-sm text-muted-foreground mt-3">
                Last scan: {scanResult.totalFetched} total, {scanResult.pagesScanned} pages
                {scanResult.partial && " (partial — API error, data saved)"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{followers.length}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="w-4 h-4" /> Total
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-blue-500">
                {blueFollowers.length}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <BadgeCheck className="w-4 h-4 text-blue-500" /> Blue Verified
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-yellow-500">
                {goldFollowers.length}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <BadgeCheck className="w-4 h-4 text-yellow-500" /> Gold Verified
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">
                {unverifiedFollowers.length}
              </div>
              <div className="text-sm text-muted-foreground">Unverified</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All ({followers.length})</TabsTrigger>
              <TabsTrigger value="blue">Blue ({blueFollowers.length})</TabsTrigger>
              <TabsTrigger value="gold">Gold ({goldFollowers.length})</TabsTrigger>
              <TabsTrigger value="unverified">
                Unverified ({unverifiedFollowers.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all">
            <FollowerTable data={followers} />
          </TabsContent>
          <TabsContent value="blue">
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportCSV(blueFollowers, `${username}-blue-verified`)}
                disabled={blueFollowers.length === 0}
              >
                <Download className="w-3 h-3 mr-1" /> Export Blue
              </Button>
            </div>
            <FollowerTable data={blueFollowers} />
          </TabsContent>
          <TabsContent value="gold">
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportCSV(goldFollowers, `${username}-gold-verified`)}
                disabled={goldFollowers.length === 0}
              >
                <Download className="w-3 h-3 mr-1" /> Export Gold
              </Button>
            </div>
            <FollowerTable data={goldFollowers} />
          </TabsContent>
          <TabsContent value="unverified">
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  exportCSV(unverifiedFollowers, `${username}-unverified`)
                }
                disabled={unverifiedFollowers.length === 0}
              >
                <Download className="w-3 h-3 mr-1" /> Export Unverified
              </Button>
            </div>
            <FollowerTable data={unverifiedFollowers} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
