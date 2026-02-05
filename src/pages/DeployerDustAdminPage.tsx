import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Wallet, ArrowUpRight, Copy, CheckCircle2 } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

const ADMIN_PASSWORD = "tuna2024treasury"; // Same as treasury admin

interface DeployerWallet {
  id: string;
  wallet_address: string;
  token_mint: string | null;
  funded_sol: number;
  remaining_sol: number;
  reclaimed_at: string | null;
  created_at: string;
}

interface ScanResult {
  wallets: DeployerWallet[];
  recoverableWallets: number;
  totalRecoverable: number;
  scannedAt: string;
}

interface ReclaimResult {
  processed: number;
  reclaimed: number;
  totalRecovered: number;
  results: Array<{
    wallet_address: string;
    recovered_sol: number;
    signature: string | null;
    error: string | null;
  }>;
}

export default function DeployerDustAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isReclaiming, setIsReclaiming] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [reclaimResult, setReclaimResult] = useState<ReclaimResult | null>(null);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      toast({ title: "Access granted", description: "Welcome to Deployer Dust Recovery" });
    } else {
      toast({ title: "Access denied", description: "Invalid password", variant: "destructive" });
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setReclaimResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("deployer-dust-scan");
      
      if (error) throw error;
      
      setScanResult(data);
      toast({
        title: "Scan complete",
        description: `Found ${data.recoverableWallets} wallets with ${data.totalRecoverable.toFixed(4)} SOL recoverable`,
      });
    } catch (err) {
      toast({
        title: "Scan failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleReclaim = async () => {
    if (!scanResult || scanResult.totalRecoverable <= 0) {
      toast({ title: "Nothing to reclaim", variant: "destructive" });
      return;
    }

    setIsReclaiming(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("deployer-dust-reclaim");
      
      if (error) throw error;
      
      setReclaimResult(data);
      
      // Refresh scan after reclaim
      await handleScan();
      
      toast({
        title: "Reclaim complete",
        description: `Recovered ${data.totalRecovered.toFixed(4)} SOL from ${data.reclaimed} wallets`,
      });
    } catch (err) {
      toast({
        title: "Reclaim failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsReclaiming(false);
    }
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Deployer Dust Recovery</CardTitle>
            <CardDescription>Enter admin password to access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter password"
              />
            </div>
            <Button onClick={handleLogin} className="w-full">
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Deployer Dust Recovery</h1>
            <p className="text-muted-foreground">Recover SOL from fresh deployer wallets</p>
          </div>
          <Button variant="outline" onClick={() => setIsAuthenticated(false)}>
            Logout
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Wallets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scanResult?.wallets.length ?? "—"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Recoverable</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {scanResult?.recoverableWallets ?? "—"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total SOL</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">
                {scanResult ? `${scanResult.totalRecoverable.toFixed(4)} SOL` : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={handleScan} disabled={isScanning} className="gap-2">
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isScanning ? "Scanning..." : "Scan Balances"}
          </Button>
          <Button 
            onClick={handleReclaim} 
            disabled={isReclaiming || !scanResult || scanResult.totalRecoverable <= 0}
            variant="default"
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            {isReclaiming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wallet className="w-4 h-4" />
            )}
            {isReclaiming ? "Reclaiming..." : "Reclaim All"}
          </Button>
        </div>

        {/* Reclaim Results */}
        {reclaimResult && (
          <Card className="border-green-500/50">
            <CardHeader>
              <CardTitle className="text-green-500 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Reclaim Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-muted-foreground text-sm">Processed</p>
                  <p className="text-lg font-bold">{reclaimResult.processed}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Successful</p>
                  <p className="text-lg font-bold text-green-500">{reclaimResult.reclaimed}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Recovered</p>
                  <p className="text-lg font-bold text-amber-500">{reclaimResult.totalRecovered.toFixed(6)} SOL</p>
                </div>
              </div>
              {reclaimResult.results.filter(r => r.signature).slice(0, 5).map((r, i) => (
                <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>{shortenAddress(r.wallet_address)}</span>
                  <span>→</span>
                  <span className="text-green-500">+{r.recovered_sol.toFixed(6)} SOL</span>
                  <a 
                    href={`https://solscan.io/tx/${r.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Wallet Table */}
        {scanResult && scanResult.wallets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Deployer Wallets</CardTitle>
              <CardDescription>
                Last scanned: {new Date(scanResult.scannedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Token Mint</TableHead>
                    <TableHead className="text-right">Funded</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scanResult.wallets.map((wallet) => (
                    <TableRow key={wallet.id}>
                      <TableCell>
                        <button
                          onClick={() => copyToClipboard(wallet.wallet_address)}
                          className="font-mono text-xs hover:text-primary flex items-center gap-1"
                        >
                          {shortenAddress(wallet.wallet_address)}
                          <Copy className="w-3 h-3" />
                        </button>
                      </TableCell>
                      <TableCell>
                        {wallet.token_mint ? (
                          <a
                            href={`https://solscan.io/token/${wallet.token_mint}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            {shortenAddress(wallet.token_mint)}
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {wallet.funded_sol.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        <span className={wallet.remaining_sol > 0.001 ? "text-green-500" : "text-muted-foreground"}>
                          {wallet.remaining_sol.toFixed(6)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {wallet.reclaimed_at ? (
                          <Badge variant="secondary">Reclaimed</Badge>
                        ) : wallet.remaining_sol > 0.001 ? (
                          <Badge className="bg-green-500/20 text-green-500">Recoverable</Badge>
                        ) : (
                          <Badge variant="outline">Empty</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(wallet.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {!scanResult && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Click "Scan Balances" to discover deployer wallets with recoverable SOL
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
