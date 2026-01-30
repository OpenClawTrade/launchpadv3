import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Wallet, 
  RefreshCw, 
  Download, 
  Play, 
  CheckCircle2, 
  AlertCircle,
  Lock,
  ExternalLink,
  Loader2
} from "lucide-react";

const VERCEL_API_URL = "https://trenchespost.vercel.app";
const TREASURY_SECRET = "trenches-treasury-2024";
const ADMIN_PASSWORD = "trenches2024treasury";

interface PoolInfo {
  poolAddress: string;
  mintAddress?: string;
  tokenName?: string;
  isRegistered: boolean;
  registeredIn?: string;
  claimableSol?: number;
  claimedSol?: number;
  signature?: string;
  error?: string;
  skipped?: boolean;
}

interface ScanSummary {
  totalPools: number;
  registeredCount: number;
  unregisteredCount: number;
  claimablePoolCount: number;
  totalClaimableSol: number;
}

interface ClaimResult {
  id: string;
  pool_address: string;
  mint_address?: string;
  token_name?: string;
  claimed_sol: number;
  signature?: string;
  claimed_at: string;
  is_registered: boolean;
}

export default function TreasuryAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimProgress, setClaimProgress] = useState(0);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [claimResults, setClaimResults] = useState<ClaimResult[]>([]);
  const [selectedPools, setSelectedPools] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Check stored auth
  useEffect(() => {
    const storedAuth = localStorage.getItem("treasury_admin_auth");
    if (storedAuth === "true") {
      setIsAuthenticated(true);
      loadClaimHistory();
    }
  }, []);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem("treasury_admin_auth", "true");
      loadClaimHistory();
      toast({ title: "Authenticated", description: "Welcome to Treasury Admin" });
    } else {
      toast({ title: "Invalid password", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("treasury_admin_auth");
    setPools([]);
    setSummary(null);
  };

  const loadClaimHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("treasury_fee_claims")
        .select("*")
        .order("claimed_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading claim history:", error);
        return;
      }

      setClaimResults(data || []);
    } catch (err) {
      console.error("Failed to load claim history:", err);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setPools([]);
    setSummary(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/treasury-scan-pools`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();

      if (data.success) {
        setSummary(data.summary);
        setPools(data.pools || []);
        // Select all pools with claimable fees by default
        const claimablePools = (data.pools || [])
          .filter((p: PoolInfo) => (p.claimableSol || 0) >= 0.001)
          .map((p: PoolInfo) => p.poolAddress);
        setSelectedPools(new Set(claimablePools));
        
        toast({
          title: "Scan Complete",
          description: `Found ${data.summary.claimablePoolCount} pools with ${data.summary.totalClaimableSol.toFixed(4)} SOL claimable`,
        });
      } else {
        throw new Error(data.error || "Scan failed");
      }
    } catch (err) {
      console.error("Scan error:", err);
      toast({
        title: "Scan Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleClaimAll = async () => {
    const poolsToClaim = pools.filter(
      (p) => selectedPools.has(p.poolAddress) && (p.claimableSol || 0) >= 0.001
    );

    if (poolsToClaim.length === 0) {
      toast({ title: "No pools to claim", variant: "destructive" });
      return;
    }

    setIsClaiming(true);
    setClaimProgress(0);

    try {
      const response = await fetch(`${VERCEL_API_URL}/api/treasury/claim-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-treasury-secret": TREASURY_SECRET,
        },
        body: JSON.stringify({
          poolAddresses: poolsToClaim.map((p) => p.poolAddress),
          dryRun: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();

      if (data.success) {
        // Update pool states with claim results
        const resultMap = new Map<string, PoolInfo>(
          (data.results as PoolInfo[]).map((r) => [r.poolAddress, r])
        );

        setPools((prev) =>
          prev.map((p) => {
            const result = resultMap.get(p.poolAddress);
            if (result) {
              return {
                ...p,
                claimedSol: result.claimedSol,
                signature: result.signature,
                error: result.error,
              };
            }
            return p;
          })
        );

        // Reload claim history
        await loadClaimHistory();

        toast({
          title: "Claims Complete",
          description: `Claimed ${data.summary.totalClaimedSol.toFixed(4)} SOL from ${data.summary.successful} pools`,
        });
      } else {
        throw new Error(data.error || "Claim failed");
      }
    } catch (err) {
      console.error("Claim error:", err);
      toast({
        title: "Claim Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
      setClaimProgress(100);
    }
  };

  const togglePoolSelection = (poolAddress: string) => {
    setSelectedPools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(poolAddress)) {
        newSet.delete(poolAddress);
      } else {
        newSet.add(poolAddress);
      }
      return newSet;
    });
  };

  const selectAllPools = () => {
    const claimablePools = pools
      .filter((p) => (p.claimableSol || 0) >= 0.001)
      .map((p) => p.poolAddress);
    setSelectedPools(new Set(claimablePools));
  };

  const deselectAllPools = () => {
    setSelectedPools(new Set());
  };

  const exportCSV = () => {
    const headers = ["Pool Address", "Token Name", "Registered", "Claimable SOL", "Claimed SOL", "Signature"];
    const rows = pools.map((p) => [
      p.poolAddress,
      p.tokenName || "",
      p.isRegistered ? "Yes" : "No",
      (p.claimableSol || 0).toFixed(6),
      (p.claimedSol || 0).toFixed(6),
      p.signature || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `treasury-pools-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
            <CardTitle>Treasury Admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter admin password"
              />
            </div>
            <Button className="w-full" onClick={handleLogin}>
              <Lock className="w-4 h-4 mr-2" />
              Unlock
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="w-6 h-6" />
              Treasury Fee Recovery
            </h1>
            <p className="text-sm text-muted-foreground">
              Discover and claim fees from all deployer pools
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{summary.totalPools}</div>
                <p className="text-xs text-muted-foreground">Total Pools</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-primary">
                  {summary.registeredCount}
                </div>
                <p className="text-xs text-muted-foreground">Registered</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-muted-foreground">
                  {summary.unregisteredCount}
                </div>
                <p className="text-xs text-muted-foreground">Unregistered</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-primary">
                  {summary.totalClaimableSol.toFixed(4)} SOL
                </div>
                <p className="text-xs text-muted-foreground">Total Claimable</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleScan} disabled={isScanning}>
            {isScanning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {isScanning ? "Scanning..." : "Scan All Pools"}
          </Button>

          {pools.length > 0 && (
            <>
              <Button
                variant="default"
                onClick={handleClaimAll}
                disabled={isClaiming || selectedPools.size === 0}
              >
                {isClaiming ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {isClaiming
                  ? "Claiming..."
                  : `Claim Selected (${selectedPools.size})`}
              </Button>

              <Button variant="outline" onClick={selectAllPools}>
                Select All
              </Button>

              <Button variant="outline" onClick={deselectAllPools}>
                Deselect All
              </Button>

              <Button variant="outline" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </>
          )}
        </div>

        {/* Claim Progress */}
        {isClaiming && (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing claims...</span>
                  <span>{claimProgress}%</span>
                </div>
                <Progress value={claimProgress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pools Table */}
        {pools.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Claimable Pools ({pools.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Pool</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Claimable</TableHead>
                      <TableHead className="text-right">Claimed</TableHead>
                      <TableHead>TX</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pools.map((pool) => (
                      <TableRow key={pool.poolAddress}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedPools.has(pool.poolAddress)}
                            onChange={() => togglePoolSelection(pool.poolAddress)}
                            disabled={(pool.claimableSol || 0) < 0.001}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <a
                            href={`https://solscan.io/account/${pool.poolAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline flex items-center gap-1"
                          >
                            {shortenAddress(pool.poolAddress)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </TableCell>
                        <TableCell>{pool.tokenName || "-"}</TableCell>
                        <TableCell>
                          {pool.isRegistered ? (
                            <Badge className="bg-primary text-primary-foreground">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Registered
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Unregistered
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {(pool.claimableSol || 0).toFixed(6)} SOL
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {pool.claimedSol
                            ? `${pool.claimedSol.toFixed(6)} SOL`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {pool.signature ? (
                            <a
                              href={`https://solscan.io/tx/${pool.signature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs"
                            >
                              View TX
                            </a>
                          ) : pool.error ? (
                            <span className="text-destructive text-xs">
                              {pool.error.substring(0, 20)}...
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Claim History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Claims</CardTitle>
          </CardHeader>
          <CardContent>
            {claimResults.length === 0 ? (
              <p className="text-muted-foreground text-sm">No claims yet</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Pool</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Claimed</TableHead>
                      <TableHead>TX</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claimResults.map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell className="text-xs">
                          {new Date(claim.claimed_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {shortenAddress(claim.pool_address)}
                        </TableCell>
                        <TableCell>{claim.token_name || "-"}</TableCell>
                        <TableCell>
                          {claim.is_registered ? (
                            <Badge className="bg-primary text-primary-foreground text-xs">
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              No
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(claim.claimed_sol).toFixed(6)} SOL
                        </TableCell>
                        <TableCell>
                          {claim.signature ? (
                            <a
                              href={`https://solscan.io/tx/${claim.signature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs"
                            >
                              View
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
