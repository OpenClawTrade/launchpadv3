import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Loader2,
  ExternalLink,
  Wallet,
  AlertTriangle,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useWalletScan, useForceSellAll, type WalletHolding } from "@/hooks/useWalletScan";

interface WalletScanPanelProps {
  agentId: string;
  agentName: string;
}

function HoldingRow({ holding }: { holding: WalletHolding }) {
  const shortMint = `${holding.mint.slice(0, 6)}...${holding.mint.slice(-4)}`;
  const displayName = holding.tokenSymbol || holding.tokenName || shortMint;

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-border/50 bg-background/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="font-medium truncate flex items-center gap-2">
            {displayName}
            {holding.isTracked ? (
              <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">
                Tracked
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                Untracked
              </Badge>
            )}
            {holding.program === "token-2022" && (
              <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">
                T22
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <a
              href={`https://solscan.io/token/${holding.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground inline-flex items-center gap-1"
            >
              {shortMint}
              <ExternalLink className="h-3 w-3" />
            </a>
            <span>•</span>
            <span>{holding.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        {holding.estimatedValueSol !== null ? (
          <div className="font-medium">{holding.estimatedValueSol.toFixed(6)} SOL</div>
        ) : (
          <div className="text-muted-foreground text-sm">No quote</div>
        )}
      </div>
    </div>
  );
}

export function WalletScanPanel({ agentId, agentName }: WalletScanPanelProps) {
  const { scanData, isScanning, scanError, scan } = useWalletScan(agentId);
  const { isSelling, sellResult, sellAll } = useForceSellAll(agentId);
  const [showResults, setShowResults] = useState(false);

  const handleSellAll = async () => {
    try {
      await sellAll();
      setShowResults(true);
      // Re-scan after sell
      setTimeout(() => scan(), 3000);
    } catch {
      // error handled in hook
    }
  };

  return (
    <Card className="bg-card/50 border-amber-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-400" />
            On-Chain Wallet Holdings
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={scan}
              disabled={isScanning}
              className="gap-1"
            >
              {isScanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {isScanning ? "Scanning..." : "Scan Wallet"}
            </Button>

            {scanData && scanData.holdings.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isSelling}
                    className="gap-1"
                  >
                    {isSelling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {isSelling ? "Selling..." : "Sell All Tokens"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Sell All Tokens
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>
                        This will sell <strong>ALL {scanData.holdings.length} tokens</strong> in{" "}
                        <strong>{agentName}</strong>'s wallet and close all positions.
                      </p>
                      <p>
                        Estimated value:{" "}
                        <strong>{scanData.totalEstimatedValue.toFixed(6)} SOL</strong>
                      </p>
                      <p className="text-destructive">
                        This action cannot be undone. All limit orders will also be cancelled.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleSellAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, Sell Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {scanError && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive mb-4">
            {scanError}
          </div>
        )}

        {!scanData && !isScanning && !scanError && (
          <div className="text-center py-8 text-muted-foreground">
            Click "Scan Wallet" to see on-chain token holdings
          </div>
        )}

        {isScanning && (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Scanning wallet on-chain...
          </div>
        )}

        {scanData && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-secondary/30 text-center">
                <div className="text-xs text-muted-foreground">SOL Balance</div>
                <div className="font-bold">{scanData.solBalance.toFixed(4)}</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 text-center">
                <div className="text-xs text-muted-foreground">Tokens</div>
                <div className="font-bold">{scanData.totalTokens}</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 text-center">
                <div className="text-xs text-muted-foreground">Est. Value</div>
                <div className="font-bold">{scanData.totalEstimatedValue.toFixed(4)} SOL</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 text-center">
                <div className="text-xs text-muted-foreground">Untracked</div>
                <div className="font-bold text-amber-400">{scanData.untrackedTokens}</div>
              </div>
            </div>

            {/* Holdings list */}
            {scanData.holdings.length > 0 ? (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {scanData.holdings.map((h) => (
                    <HoldingRow key={h.mint} holding={h} />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No token holdings found — wallet is clean ✅
              </div>
            )}
          </div>
        )}

        {/* Sell results */}
        {showResults && sellResult && (
          <div className="mt-4 p-4 rounded-lg border border-border/50 bg-background/50">
            <h4 className="font-medium mb-3 text-sm">Sell Results</h4>
            <div className="space-y-2 text-sm">
              {sellResult.results?.map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {r.status === "sold" ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    <span>{r.token}</span>
                  </div>
                  <div className="text-right">
                    {r.status === "sold" ? (
                      <span className="text-green-400">{r.solReceived} SOL</span>
                    ) : (
                      <span className="text-red-400 text-xs">{r.error || r.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {sellResult.cancelledOrders > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Cancelled {sellResult.cancelledOrders} limit orders
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
