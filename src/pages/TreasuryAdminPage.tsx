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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Loader2,
  Search,
  Rocket
} from "lucide-react";
import { BaseDeployPanel } from "@/components/admin/BaseDeployPanel";

const VERCEL_API_URL = "https://tunalaunch.vercel.app";
const TREASURY_SECRET = "tuna-treasury-2024";
const ADMIN_PASSWORD = "tuna2024treasury";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
  lastCheckedAt?: string;
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
  const [isCheckingFees, setIsCheckingFees] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [feeCheckProgress, setFeeCheckProgress] = useState(0);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [allPoolAddresses, setAllPoolAddresses] = useState<string[]>([]);
  const [claimResults, setClaimResults] = useState<ClaimResult[]>([]);
  const [selectedPools, setSelectedPools] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Check stored auth
  useEffect(() => {
    const storedAuth = localStorage.getItem("treasury_admin_auth");
    if (storedAuth === "true") {
      setIsAuthenticated(true);
      loadCachedPools();
      loadClaimHistory();
    }
  }, []);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem("treasury_admin_auth", "true");
      loadCachedPools();
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

  const loadCachedPools = async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/treasury-scan-pools`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ mode: "get-cached" }),
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.success) {
        setPools(data.allPools || []);
        setSummary({
          totalPools: data.summary.totalPools,
          registeredCount: (data.allPools || []).filter((p: PoolInfo) => p.isRegistered).length,
          unregisteredCount: (data.allPools || []).filter((p: PoolInfo) => !p.isRegistered).length,
          claimablePoolCount: data.summary.claimablePoolCount,
          totalClaimableSol: data.summary.totalClaimableSol,
        });
      }
    } catch (err) {
      console.error("Failed to load cached pools:", err);
    }
  };

  const loadClaimHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("treasury_fee_claims")
        .select("*")
        .order("claimed_at", { ascending: false })
        .limit(50);

      if (!error) {
        setClaimResults(data || []);
      }
    } catch (err) {
      console.error("Failed to load claim history:", err);
    }
  };

  // Step 1: Scan for all pools
  const handleScan = async () => {
    setIsScanning(true);
    setScanProgress(10);

    try {
      toast({ title: "Scanning...", description: "Discovering DBC pools from transaction history" });

      const response = await fetch(`${SUPABASE_URL}/functions/v1/treasury-scan-pools`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ mode: "scan" }),
      });

      setScanProgress(50);

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setScanProgress(100);

      if (data.success) {
        setAllPoolAddresses(data.allPoolAddresses || []);
        toast({
          title: "Scan Complete",
          description: `Discovered ${data.summary.totalPoolsDiscovered} pools. Click "Check Fees" to find claimable fees.`,
        });
        
        // Immediately load cached data
        await loadCachedPools();
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

  // Step 2: Check fees for all pools in batches
  const handleCheckFees = async () => {
    const poolsToCheck = allPoolAddresses.length > 0 ? allPoolAddresses : pools.map(p => p.poolAddress);
    
    if (poolsToCheck.length === 0) {
      toast({ title: "No pools to check", description: "Run a scan first", variant: "destructive" });
      return;
    }

    setIsCheckingFees(true);
    setFeeCheckProgress(0);

    const BATCH_SIZE = 10;
    const totalBatches = Math.ceil(poolsToCheck.length / BATCH_SIZE);
    let checkedCount = 0;

    try {
      for (let i = 0; i < poolsToCheck.length; i += BATCH_SIZE) {
        const batch = poolsToCheck.slice(i, i + BATCH_SIZE);
        
        const response = await fetch(`${SUPABASE_URL}/functions/v1/treasury-scan-pools`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ mode: "check-fees", pools: batch }),
        });

        if (!response.ok) {
          console.warn(`Batch ${i / BATCH_SIZE + 1} failed`);
          continue;
        }

        checkedCount += batch.length;
        setFeeCheckProgress(Math.round((checkedCount / poolsToCheck.length) * 100));
      }

      // Reload cached data
      await loadCachedPools();
      
      toast({
        title: "Fee Check Complete",
        description: `Checked ${checkedCount} pools for claimable fees`,
      });
    } catch (err) {
      console.error("Fee check error:", err);
      toast({
        title: "Fee Check Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsCheckingFees(false);
      setFeeCheckProgress(100);
    }
  };

  const handleClaimAll = async () => {
    const poolsToClaim = pools.filter(
      (p) => selectedPools.has(p.poolAddress) && (p.claimableSol || 0) >= 0.001
    );

    if (poolsToClaim.length === 0) {
      toast({ title: "No pools selected", variant: "destructive" });
      return;
    }

    setIsClaiming(true);

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
        throw new Error(await response.text());
      }

      const data = await response.json();

      if (data.success) {
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
                claimableSol: 0, // Reset after claim
              };
            }
            return p;
          })
        );

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

  const selectAllClaimable = () => {
    const claimablePools = pools
      .filter((p) => (p.claimableSol || 0) >= 0.001)
      .map((p) => p.poolAddress);
    setSelectedPools(new Set(claimablePools));
  };

  const deselectAllPools = () => {
    setSelectedPools(new Set());
  };

  const exportCSV = () => {
    const headers = ["Pool Address", "Mint Address", "Token Name", "Registered", "Claimable SOL", "Last Checked"];
    const rows = pools.map((p) => [
      p.poolAddress,
      p.mintAddress || "",
      p.tokenName || "",
      p.isRegistered ? "Yes" : "No",
      (p.claimableSol || 0).toFixed(6),
      p.lastCheckedAt || "",
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

  const claimablePools = pools.filter((p) => (p.claimableSol || 0) >= 0.001);
  const totalClaimableSelected = pools
    .filter((p) => selectedPools.has(p.poolAddress))
    .reduce((sum, p) => sum + (p.claimableSol || 0), 0);

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
              Treasury Admin
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage fees and deployments
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        <Tabs defaultValue="fees" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="fees" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Fee Recovery
            </TabsTrigger>
            <TabsTrigger value="base-deploy" className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Base Deploy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="base-deploy" className="mt-6">
            <BaseDeployPanel />
          </TabsContent>

          <TabsContent value="fees" className="mt-6 space-y-6">
            {/* Summary Cards */}
            {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{summary.totalPools}</div>
                <p className="text-xs text-muted-foreground">Total Pools</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-primary">{summary.registeredCount}</div>
                <p className="text-xs text-muted-foreground">Registered</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-muted-foreground">{summary.unregisteredCount}</div>
                <p className="text-xs text-muted-foreground">Unregistered</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-primary">{claimablePools.length}</div>
                <p className="text-xs text-muted-foreground">With Claimable Fees</p>
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
          <Button onClick={handleScan} disabled={isScanning || isCheckingFees}>
            {isScanning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {isScanning ? "Scanning..." : "1. Scan Pools"}
          </Button>

          <Button onClick={handleCheckFees} disabled={isScanning || isCheckingFees || pools.length === 0} variant="secondary">
            {isCheckingFees ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            {isCheckingFees ? `Checking... ${feeCheckProgress}%` : "2. Check Fees"}
          </Button>

          {claimablePools.length > 0 && (
            <>
              <Button onClick={handleClaimAll} disabled={isClaiming || selectedPools.size === 0}>
                {isClaiming ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {isClaiming ? "Claiming..." : `3. Claim Selected (${selectedPools.size}) - ${totalClaimableSelected.toFixed(4)} SOL`}
              </Button>

              <Button variant="outline" onClick={selectAllClaimable}>
                Select All
              </Button>

              <Button variant="outline" onClick={deselectAllPools}>
                Deselect
              </Button>
            </>
          )}

          {pools.length > 0 && (
            <Button variant="outline" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>

        {/* Progress Bars */}
        {isScanning && (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Scanning transaction history...</span>
                  <span>{scanProgress}%</span>
                </div>
                <Progress value={scanProgress} />
              </div>
            </CardContent>
          </Card>
        )}

        {isCheckingFees && (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Checking claimable fees...</span>
                  <span>{feeCheckProgress}%</span>
                </div>
                <Progress value={feeCheckProgress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pools Table */}
        {pools.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Pools ({pools.length}) - Claimable: {claimablePools.length}
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
                      <TableHead className="text-right">Claimable SOL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pools.slice(0, 100).map((pool) => (
                      <TableRow key={pool.poolAddress} className={(pool.claimableSol || 0) >= 0.001 ? "bg-primary/5" : ""}>
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
                        <TableCell className="max-w-[200px] truncate">{pool.tokenName || "-"}</TableCell>
                        <TableCell>
                          {pool.isRegistered ? (
                            <Badge className="bg-primary text-primary-foreground">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {pool.registeredIn}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Unregistered
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {(pool.claimableSol || 0) >= 0.001 ? (
                            <span className="text-primary font-bold">{(pool.claimableSol || 0).toFixed(4)}</span>
                          ) : (
                            <span className="text-muted-foreground">{(pool.claimableSol || 0).toFixed(4)}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {pools.length > 100 && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Showing first 100 of {pools.length} pools. Export CSV to see all.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Claim History */}
        {claimResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Claims</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pool</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead className="text-right">Claimed SOL</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>TX</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claimResults.slice(0, 20).map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell className="font-mono text-xs">
                          {shortenAddress(claim.pool_address)}
                        </TableCell>
                        <TableCell>{claim.token_name || "-"}</TableCell>
                        <TableCell className="text-right font-mono text-primary">
                          {claim.claimed_sol.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(claim.claimed_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {claim.signature && (
                            <a
                              href={`https://solscan.io/tx/${claim.signature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
