import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Coins, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MAIN_WALLET = "0x9FD5f2E480F43320E8F65072A739c941cb5b10B0";

interface SweepResult {
  success: boolean;
  processed?: number;
  results?: Array<{
    tokenAddress: string;
    collectHash?: string;
    tokenSweepHash?: string;
    tokenSent?: string;
    collectedWeth?: string;
    collectedToken?: string;
    platformTokenOwed?: string;
    skipped?: string;
    error?: string;
  }>;
  eth?: {
    wethBalanceBefore: string;
    creatorReserveWeth: string;
    sweepableWeth: string;
    unwrapHash?: string;
    ethSweepHash?: string;
    ethSent: string;
    mainWallet: string;
  };
  error?: string;
}

function fmtWei(v?: string, decimals = 18, frac = 6): string {
  if (!v) return "0";
  try {
    const n = BigInt(v);
    const base = 10n ** BigInt(decimals);
    const whole = n / base;
    const rem = n % base;
    const remStr = rem.toString().padStart(decimals, "0").slice(0, frac);
    return `${whole}.${remStr}`.replace(/\.?0+$/, "") || "0";
  } catch {
    return v;
  }
}

export function EthLpFeesPanel() {
  const [adminSecret, setAdminSecret] = useState(() => localStorage.getItem("admin_secret") || "");
  const [singleToken, setSingleToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SweepResult | null>(null);

  const run = async (tokenAddress?: string) => {
    if (!adminSecret) {
      toast.error("Enter admin secret first");
      return;
    }
    setLoading(true);
    setData(null);
    try {
      localStorage.setItem("admin_secret", adminSecret);
      const { data: res, error } = await supabase.functions.invoke("eth-claim-platform-fees", {
        body: tokenAddress ? { tokenAddress } : {},
        headers: { "x-admin-secret": adminSecret },
      });
      if (error) throw new Error(error.message);
      if (res?.error) throw new Error(res.error);
      setData(res as SweepResult);
      toast.success(`Swept ${res?.processed ?? 0} position(s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sweep failed";
      toast.error(msg);
      setData({ success: false, error: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Claim ETH LP Fees → Main Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs font-mono space-y-1">
            <div>
              <span className="text-muted-foreground">Source (LP holder):</span>{" "}
              <span>0x8F70…6906</span>
            </div>
            <div>
              <span className="text-muted-foreground">Destination (main wallet):</span>{" "}
              <a
                href={`https://etherscan.io/address/${MAIN_WALLET}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {MAIN_WALLET} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground pt-2">
              Collects fees on every PopShiba V3 LP, unwraps WETH → ETH, and sends the platform's
              50% share (ETH + meme tokens) to the main wallet. Creator shares stay reserved.
            </p>
          </div>

          <div>
            <Label className="text-xs">Admin secret</Label>
            <Input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="TWITTER_BOT_ADMIN_SECRET"
              className="font-mono text-xs"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
            <div>
              <Label className="text-xs">Single token (optional)</Label>
              <Input
                value={singleToken}
                onChange={(e) => setSingleToken(e.target.value.trim())}
                placeholder="0x… (leave blank to sweep ALL positions)"
                className="font-mono text-xs"
              />
            </div>
            <Button
              onClick={() => run(singleToken || undefined)}
              disabled={loading || !adminSecret}
              size="lg"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sweeping…</>
              ) : (
                <>Claim & Sweep</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.error && (
              <p className="text-sm text-destructive">{data.error}</p>
            )}
            {data.eth && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1 font-mono">
                <div>WETH balance: {fmtWei(data.eth.wethBalanceBefore)} ETH</div>
                <div>Creator reserve: {fmtWei(data.eth.creatorReserveWeth)} ETH</div>
                <div className="text-primary">
                  Swept to main wallet: {fmtWei(data.eth.ethSent)} ETH
                </div>
                {data.eth.unwrapHash && (
                  <div>
                    Unwrap:{" "}
                    <a className="text-primary hover:underline" href={`https://etherscan.io/tx/${data.eth.unwrapHash}`} target="_blank" rel="noopener noreferrer">
                      {data.eth.unwrapHash.slice(0, 10)}…
                    </a>
                  </div>
                )}
                {data.eth.ethSweepHash && (
                  <div>
                    ETH transfer:{" "}
                    <a className="text-primary hover:underline" href={`https://etherscan.io/tx/${data.eth.ethSweepHash}`} target="_blank" rel="noopener noreferrer">
                      {data.eth.ethSweepHash.slice(0, 10)}…
                    </a>
                  </div>
                )}
              </div>
            )}
            {data.results && data.results.length > 0 && (
              <div className="space-y-2">
                {data.results.map((r) => (
                  <div key={r.tokenAddress} className="rounded-md border border-border p-3 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between">
                      <a
                        href={`https://etherscan.io/token/${r.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {r.tokenAddress.slice(0, 8)}…{r.tokenAddress.slice(-6)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {r.error && <span className="text-destructive">{r.error}</span>}
                      {r.skipped && <span className="text-muted-foreground">{r.skipped}</span>}
                    </div>
                    {r.collectedWeth && r.collectedWeth !== "0" && (
                      <div>collected: {fmtWei(r.collectedWeth)} WETH + {fmtWei(r.collectedToken)} TOKEN</div>
                    )}
                    {r.tokenSent && r.tokenSent !== "0" && (
                      <div className="text-primary">→ token sent to main: {fmtWei(r.tokenSent)}</div>
                    )}
                    {r.collectHash && (
                      <a className="text-muted-foreground hover:text-primary" href={`https://etherscan.io/tx/${r.collectHash}`} target="_blank" rel="noopener noreferrer">
                        collect tx ↗
                      </a>
                    )}
                    {r.tokenSweepHash && (
                      <>{" · "}<a className="text-muted-foreground hover:text-primary" href={`https://etherscan.io/tx/${r.tokenSweepHash}`} target="_blank" rel="noopener noreferrer">
                        token sweep tx ↗
                      </a></>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
