// Admin "Platform Fees (V3)" panel.
//
// - Lists every V3 LP position with: token name/ticker, uncollected (Uniswap),
//   platform-owed (vault), creator-owed (info), total unclaimed for platform.
// - Per-row "Collect" pulls Uniswap fees into the vault for that token.
// - Per-row "Sweep" sends the platform's share to MAIN_WALLET.
// - Top-bar "Sweep All" runs the full eth-claim-platform-fees flow.
// - Top-bar "Refresh" re-reads on-chain state.
//
// Open admin panel — no secret required.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Coins, ExternalLink, RefreshCw, Download, ArrowDownToLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MAIN_WALLET = "0x9FD5f2E480F43320E8F65072A739c941cb5b10B0";
const LP_HOLDER   = "0x8F70…6906";

interface Position {
  tokenAddress: string;
  lpTokenId: string;
  creatorWallet: string;
  meta: { name?: string; symbol?: string } | null;
  registered?: boolean;
  uncollectedWeth?: string;
  uncollectedToken?: string;
  lifetimeCollectedWeth?: string;
  platformOwedWeth?: string;
  platformPaidWeth?: string;
  creatorOwedWeth?: string;
  creatorPaidWeth?: string;
  totalUnclaimedWeth?: string;
  vaultError?: string;
  error?: string;
}

interface StatusResponse {
  success: boolean;
  vaultAddress: string | null;
  totals: {
    uncollectedWeth: string;
    platformOwedWeth: string;
    creatorOwedWeth: string;
    sweepableEth: string;
  };
  positions: Position[];
  error?: string;
}

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

function fmtWei(v?: string | null, frac = 6): string {
  if (!v) return "0";
  try {
    const n = BigInt(v);
    const base = 10n ** 18n;
    const whole = n / base;
    const rem = n % base;
    const remStr = rem.toString().padStart(18, "0").slice(0, frac);
    const trimmed = `${whole}.${remStr}`.replace(/0+$/, "").replace(/\.$/, "");
    return trimmed || "0";
  } catch {
    return v;
  }
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function EthLpFeesPanel() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [lastSweep, setLastSweep] = useState<SweepResult | null>(null);

  // Fetch ETH price for USD display (best-effort)
  useEffect(() => {
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")
      .then((r) => r.json())
      .then((d) => setEthPrice(d?.ethereum?.usd ?? 0))
      .catch(() => {});
  }, []);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke("eth-platform-fees-status", {
        body: {},
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setStatus(data as StatusResponse);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load status";
      toast.error(msg);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const collectOne = async (tokenAddress: string) => {
    setBusyToken(`collect:${tokenAddress}`);
    try {
      const { data, error } = await supabase.functions.invoke("eth-collect-fees", {
        body: { tokenAddress },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const r = data?.results?.[0];
      if (r?.skipped) toast.message("Nothing to collect", { description: r.reason });
      else if (r?.collectHash) toast.success(`Collected ${fmtWei(r.collectedThisCall)} WETH into vault`);
      else toast.success("Collect completed");
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Collect failed");
    } finally {
      setBusyToken(null);
    }
  };

  const sweepOne = async (tokenAddress: string) => {
    setBusyToken(`sweep:${tokenAddress}`);
    try {
      const { data, error } = await supabase.functions.invoke("eth-claim-platform-fees", {
        body: { tokenAddress },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setLastSweep(data as SweepResult);
      toast.success(`Swept ${fmtWei(data?.eth?.ethSent)} ETH to main wallet`);
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sweep failed");
    } finally {
      setBusyToken(null);
    }
  };

  const sweepAll = async () => {
    setBusyAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("eth-claim-platform-fees", {
        body: {},
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setLastSweep(data as SweepResult);
      toast.success(`Swept ${data?.processed ?? 0} position(s) — ${fmtWei(data?.eth?.ethSent)} ETH delivered`);
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch sweep failed");
    } finally {
      setBusyAll(false);
    }
  };

  const usd = (weiStr?: string) => {
    if (!weiStr || ethPrice <= 0) return "";
    try {
      const n = Number(BigInt(weiStr)) / 1e18;
      const v = n * ethPrice;
      return v >= 0.01 ? `≈ $${v.toFixed(2)}` : "< $0.01";
    } catch { return ""; }
  };

  const visiblePositions = useMemo(() => status?.positions ?? [], [status]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Platform Fees (V3) — claim &amp; sweep
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs font-mono space-y-1">
            <div><span className="text-muted-foreground">Vault:</span> {status?.vaultAddress ? (
              <a href={`https://etherscan.io/address/${status.vaultAddress}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                {shortAddr(status.vaultAddress)} <ExternalLink className="w-3 h-3" />
              </a>
            ) : "—"}</div>
            <div><span className="text-muted-foreground">Source LP holder:</span> {LP_HOLDER}</div>
            <div>
              <span className="text-muted-foreground">Destination main wallet:</span>{" "}
              <a href={`https://etherscan.io/address/${MAIN_WALLET}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                {MAIN_WALLET} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground pt-2">
              <strong>Collect</strong> pulls Uniswap V3 fees into <code>PopShibaFeeVaultV3</code> (50/50 split). <strong>Sweep</strong> withdraws the platform's share, unwraps WETH→ETH, sends to main wallet. Creator shares are reserved.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchStatus} disabled={loadingStatus} variant="secondary">
              {loadingStatus ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh status
            </Button>
            <Button onClick={sweepAll} disabled={busyAll || !status}>
              {busyAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowDownToLine className="w-4 h-4 mr-2" />}
              Sweep ALL → main wallet
            </Button>
          </div>

          {/* Totals strip */}
          {status?.totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <div className="text-muted-foreground uppercase text-[10px] tracking-wider">Uncollected (Uniswap)</div>
                <div className="font-mono mt-1">{fmtWei(status.totals.uncollectedWeth)} WETH</div>
                <div className="text-[10px] text-muted-foreground">{usd(status.totals.uncollectedWeth)}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <div className="text-muted-foreground uppercase text-[10px] tracking-wider">Platform owed (vault)</div>
                <div className="font-mono mt-1">{fmtWei(status.totals.platformOwedWeth)} WETH</div>
                <div className="text-[10px] text-muted-foreground">{usd(status.totals.platformOwedWeth)}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <div className="text-muted-foreground uppercase text-[10px] tracking-wider">Creator reserve (info)</div>
                <div className="font-mono mt-1">{fmtWei(status.totals.creatorOwedWeth)} WETH</div>
                <div className="text-[10px] text-muted-foreground">{usd(status.totals.creatorOwedWeth)}</div>
              </div>
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
                <div className="text-primary uppercase text-[10px] tracking-wider font-semibold">Sweep would deliver</div>
                <div className="font-mono mt-1 text-primary">{fmtWei(status.totals.sweepableEth)} ETH</div>
                <div className="text-[10px] text-muted-foreground">{usd(status.totals.sweepableEth)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-token table */}
      {status && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Per-token breakdown ({visiblePositions.length} {visiblePositions.length === 1 ? "position" : "positions"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visiblePositions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No V3 LP positions found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="text-left py-2 pr-3">Token</th>
                      <th className="text-right py-2 px-3">Uncollected (Uniswap)</th>
                      <th className="text-right py-2 px-3">Platform owed (vault)</th>
                      <th className="text-right py-2 px-3">Creator owed (info)</th>
                      <th className="text-right py-2 px-3">Total unclaimed</th>
                      <th className="text-right py-2 pl-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePositions.map((p) => {
                      const totalEmpty = (p.totalUnclaimedWeth ?? "0") === "0";
                      const uncollectedEmpty = (p.uncollectedWeth ?? "0") === "0";
                      const platOwedEmpty = (p.platformOwedWeth ?? "0") === "0";
                      const isCollecting = busyToken === `collect:${p.tokenAddress}`;
                      const isSweeping = busyToken === `sweep:${p.tokenAddress}`;
                      return (
                        <tr key={p.tokenAddress} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="py-2 pr-3">
                            <div className="flex flex-col">
                              <span className="font-semibold">
                                {p.meta?.symbol ?? "?"} <span className="text-muted-foreground font-normal">— {p.meta?.name ?? "Unknown"}</span>
                              </span>
                              <a href={`https://etherscan.io/token/${p.tokenAddress}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 w-fit">
                                {shortAddr(p.tokenAddress)} <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              {p.error && <span className="text-destructive text-[10px]">{p.error}</span>}
                              {p.vaultError && <Badge variant="outline" className="mt-1 text-[10px] w-fit">vault: {p.vaultError}</Badge>}
                              {p.registered === false && <Badge variant="outline" className="mt-1 text-[10px] w-fit">not registered in vault</Badge>}
                            </div>
                          </td>
                          <td className="text-right py-2 px-3 font-mono">
                            <div>{fmtWei(p.uncollectedWeth)} WETH</div>
                            <div className="text-[10px] text-muted-foreground">{usd(p.uncollectedWeth)}</div>
                          </td>
                          <td className="text-right py-2 px-3 font-mono">
                            <div>{fmtWei(p.platformOwedWeth)} WETH</div>
                            <div className="text-[10px] text-muted-foreground">{usd(p.platformOwedWeth)}</div>
                          </td>
                          <td className="text-right py-2 px-3 font-mono text-muted-foreground">
                            <div>{fmtWei(p.creatorOwedWeth)} WETH</div>
                            <div className="text-[10px]">{usd(p.creatorOwedWeth)}</div>
                          </td>
                          <td className="text-right py-2 px-3 font-mono">
                            <div className={totalEmpty ? "text-muted-foreground" : "text-primary font-semibold"}>
                              {fmtWei(p.totalUnclaimedWeth)} ETH
                            </div>
                            <div className="text-[10px] text-muted-foreground">{usd(p.totalUnclaimedWeth)}</div>
                          </td>
                          <td className="text-right py-2 pl-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm" variant="outline"
                                onClick={() => collectOne(p.tokenAddress)}
                                disabled={isCollecting || isSweeping || uncollectedEmpty}
                                title={uncollectedEmpty ? "Nothing to collect from Uniswap" : "Pull Uniswap fees into vault"}
                              >
                                {isCollecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                <span className="ml-1 hidden lg:inline">Collect</span>
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => sweepOne(p.tokenAddress)}
                                disabled={isSweeping || isCollecting || (platOwedEmpty && uncollectedEmpty) || !adminSecret}
                                title="Collect + sweep platform share to main wallet"
                              >
                                {isSweeping ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownToLine className="w-3 h-3" />}
                                <span className="ml-1 hidden lg:inline">Sweep</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Last sweep result */}
      {lastSweep && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Last sweep result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lastSweep.error && <p className="text-sm text-destructive">{lastSweep.error}</p>}
            {lastSweep.eth && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1 font-mono">
                <div>WETH balance: {fmtWei(lastSweep.eth.wethBalanceBefore)} ETH</div>
                <div>Creator reserve: {fmtWei(lastSweep.eth.creatorReserveWeth)} ETH</div>
                <div className="text-primary">Swept to main: {fmtWei(lastSweep.eth.ethSent)} ETH</div>
                {lastSweep.eth.unwrapHash && (
                  <div>Unwrap: <a className="text-primary hover:underline" href={`https://etherscan.io/tx/${lastSweep.eth.unwrapHash}`} target="_blank" rel="noopener noreferrer">{lastSweep.eth.unwrapHash.slice(0, 10)}…</a></div>
                )}
                {lastSweep.eth.ethSweepHash && (
                  <div>Transfer: <a className="text-primary hover:underline" href={`https://etherscan.io/tx/${lastSweep.eth.ethSweepHash}`} target="_blank" rel="noopener noreferrer">{lastSweep.eth.ethSweepHash.slice(0, 10)}…</a></div>
                )}
              </div>
            )}
            {lastSweep.results && lastSweep.results.length > 0 && (
              <div className="space-y-1 text-xs font-mono">
                {lastSweep.results.map((r) => (
                  <div key={r.tokenAddress} className="flex flex-wrap items-center gap-2 border-b border-border/50 py-1">
                    <span>{shortAddr(r.tokenAddress)}</span>
                    {r.skipped && <Badge variant="outline">{r.skipped}</Badge>}
                    {r.collectedWeth && r.collectedWeth !== "0" && <span className="text-muted-foreground">+{fmtWei(r.collectedWeth)} WETH</span>}
                    {r.tokenSent && r.tokenSent !== "0" && <span className="text-primary">→ {fmtWei(r.tokenSent)} token</span>}
                    {r.collectHash && <a className="text-muted-foreground hover:text-primary" href={`https://etherscan.io/tx/${r.collectHash}`} target="_blank" rel="noopener noreferrer">collect ↗</a>}
                    {r.tokenSweepHash && <a className="text-muted-foreground hover:text-primary" href={`https://etherscan.io/tx/${r.tokenSweepHash}`} target="_blank" rel="noopener noreferrer">sweep ↗</a>}
                    {r.error && <span className="text-destructive">{r.error}</span>}
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
