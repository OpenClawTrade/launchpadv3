import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Trash2, CheckCircle, XCircle, ExternalLink, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WALLET = "EoKWXs7yrwTaGgKdtZbB9QFQDgPDm28Yr8EsjKcx2r6a";

interface Holding {
  mint: string;
  balance: number;
  rawAmount: string;
  decimals: number;
}

interface SellResult {
  mint: string;
  balance: number;
  status: string;
  via?: string;
  signature?: string;
  error?: string;
}

export default function SellAllPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selling, setSelling] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [results, setResults] = useState<SellResult[]>([]);

  const handleUnlock = () => {
    if (password.trim()) {
      localStorage.setItem("admin_panel_auth_v2", password);
      setUnlocked(true);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-sell-tokens", {
        body: { adminPassword: password, dryRun: true },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setHoldings(data.holdings || []);
      toast.success(`Found ${data.totalTokens} tokens`);
    } catch (err: any) {
      toast.error("Scan failed", { description: err.message });
    } finally {
      setScanning(false);
    }
  };

  const handleSellAll = async () => {
    setSelling(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-sell-tokens", {
        body: { adminPassword: password, dryRun: false, slippage: 2500 },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResults(data.results || []);
      const sold = data.sold || 0;
      const failed = data.failed || 0;
      if (sold > 0) toast.success(`Sold ${sold} token(s)`);
      if (failed > 0) toast.error(`${failed} token(s) failed`);
    } catch (err: any) {
      toast.error("Sell failed", { description: err.message });
    } finally {
      setSelling(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-card/50 border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-400" />
              Bulk Sell — Admin
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            />
            <Button onClick={handleUnlock} className="w-full" disabled={!password.trim()}>
              Unlock
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="bg-card/50 border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-lg">Bulk Sell All Tokens</CardTitle>
            <p className="text-sm text-muted-foreground font-mono">{WALLET}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={handleScan} disabled={scanning || selling} variant="outline" className="gap-1">
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {scanning ? "Scanning..." : "Scan Holdings"}
              </Button>
              {holdings.length > 0 && (
                <Button onClick={handleSellAll} disabled={selling || scanning} variant="destructive" className="gap-1">
                  {selling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {selling ? "Selling..." : `Sell All (${holdings.length})`}
                </Button>
              )}
            </div>

            {holdings.length > 0 && results.length === 0 && (
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-2">
                  {holdings.map((h) => (
                    <div key={h.mint} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border/50 bg-background/50">
                      <div className="min-w-0">
                        <a
                          href={`https://solscan.io/token/${h.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono hover:text-foreground text-muted-foreground inline-flex items-center gap-1"
                        >
                          {h.mint.slice(0, 8)}...{h.mint.slice(-4)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="text-sm font-medium">{h.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {results.length > 0 && (
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-2">
                  {results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border/50 bg-background/50">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.status === "sold" ? (
                          <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                        )}
                        <span className="text-sm font-mono truncate">{r.mint.slice(0, 8)}...{r.mint.slice(-4)}</span>
                        {r.via && <Badge variant="outline" className="text-[10px]">{r.via}</Badge>}
                      </div>
                      <div className="text-right text-sm shrink-0">
                        {r.status === "sold" ? (
                          <a
                            href={`https://solscan.io/tx/${r.signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-400 hover:underline inline-flex items-center gap-1"
                          >
                            Sold <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-red-400 text-xs">{r.error?.slice(0, 40) || "Failed"}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {!scanning && holdings.length === 0 && results.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Click "Scan Holdings" to see tokens</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
