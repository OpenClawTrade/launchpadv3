import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, AlertCircle, CheckCircle2, ExternalLink, Wallet, ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ExistingDeployment {
  id: string;
  vault_address: string;
  clone_factory_address: string;
  token_impl_address: string;
  launcher_address: string | null;
  deployed_at: string;
}

interface OwnershipStatus {
  factoryOwner: string | null;
  vaultOwner: string | null;
  factoryOk: boolean;
  vaultOk: boolean;
  bothOk: boolean;
}

interface DryRun {
  dryRun: true;
  deployer: string;
  balance: string;
  nonce: number;
  ready: boolean;
  willDeploy: string[];
  existingDeployment: ExistingDeployment | null;
  canPatchLauncher: boolean;
  ownership: OwnershipStatus | null;
  warning: string | null;
}

interface DeployResult {
  success: boolean;
  deployer?: string;
  contracts?: { PopShibaToken: string; PopShibaCloneFactory: string; PopShibaFeeVault: string };
  tx_hashes?: string[];
  gasUsedEth?: string;
  message?: string;
}

export function EthContractsDeployPanel() {
  const [busy, setBusy] = useState(false);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const checkReadiness = useCallback(async () => {
    setBusy(true); setErr(null); setDry(null); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("eth-deploy-contracts", {
        body: { dryRun: true },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setDry(data as DryRun);
      toast.success("Deployer checked", { description: `${(data as DryRun).balance} on Ethereum` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Check failed";
      setErr(msg); toast.error("Check failed", { description: msg });
    } finally { setBusy(false); }
  }, []);

  const deploy = useCallback(async (mode: "full" | "force" | "launcherOnly") => {
    const confirmMsg = mode === "force"
      ? "FORCE redeploy ALL 4 contracts?\n\nThis deactivates the current active deployment and spends gas (~$15–50). Cannot be undone."
      : mode === "launcherOnly"
      ? "Deploy ONLY the missing PopShibaLauncher?\n\nKeeps your existing 3 verified contracts untouched. Just adds the 4th (router) and wires it into the active row. Gas: ~$3–10."
      : "Deploy all 4 contracts to Ethereum mainnet?\n\nGas: ~$15–50. Cannot be undone.";
    if (!confirm(confirmMsg)) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("eth-deploy-contracts", {
        body: {
          dryRun: false,
          force: mode === "force",
          launcherOnly: mode === "launcherOnly",
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as DeployResult);
      toast.success("✅ Deployed", { description: (data as any)?.message || "Verification running in background" });
      checkReadiness();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deployment failed";
      setErr(msg); toast.error("Deploy failed", { description: msg });
    } finally { setBusy(false); }
  }, [checkReadiness]);

  const verifyNow = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("eth-verify-suite", {});
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const r = data as { allVerified: boolean; results: Record<string, { verified: boolean; error?: string; message?: string }> };
      if (r.allVerified) {
        toast.success("✅ All 3 contracts verified on Etherscan");
      } else {
        const failed = Object.entries(r.results).filter(([_, v]) => !v.verified).map(([k, v]) => `${k}: ${v.error || v.message}`).join("; ");
        toast.warning("Partial verification", { description: failed });
      }
      checkReadiness();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Verification failed";
      setErr(msg); toast.error("Verify failed", { description: msg });
    } finally { setBusy(false); }
  }, [checkReadiness]);

  const transferOwn = useCallback(async () => {
    const ok = confirm(
      "Hand over ownership of CloneFactory + FeeVault to the Launcher?\n\n" +
      "This is a ONE-TIME setup that lets ANY user wallet launch tokens directly. " +
      "Two transactions from the platform deployer wallet, ~$1 total gas. " +
      "Cannot be undone (Launcher has no transferOwnership exposed)."
    );
    if (!ok) return;
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("eth-deploy-contracts", {
        body: { transferOwnership: true },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const r = data as { success: boolean; txs: { contract: string; tx: string; alreadyTransferred?: boolean }[]; gasUsedEth: string; message: string };
      const fresh = r.txs.filter(t => !t.alreadyTransferred);
      toast.success("✅ Ownership transferred", {
        description: fresh.length ? `${fresh.length} tx · ${parseFloat(r.gasUsedEth).toFixed(5)} ETH gas` : "Already complete",
      });
      checkReadiness();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transfer failed";
      setErr(msg); toast.error("Transfer failed", { description: msg });
    } finally { setBusy(false); }
  }, [checkReadiness]);

  const hasActive = !!dry?.existingDeployment;
  const hasLauncher = !!dry?.existingDeployment?.launcher_address;
  const ownership = dry?.ownership ?? null;
  const ownershipReady = !!ownership?.bothOk;
  const needsTransfer = hasLauncher && ownership && !ownership.bothOk;

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          PopShiba Ethereum Contract Suite
        </CardTitle>
        <CardDescription>
          One-shot deploy: PopShibaToken (clone master) → CloneFactory (EIP-1167) → FeeVault.
          Compiles in-flight, deploys sequentially, auto-verifies on Etherscan.
          Duplicate-protected: refuses to redeploy if an active set exists. Typical gas cost: $1–50.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={checkReadiness} disabled={busy} variant="outline">
            {busy && !result ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
            Check Deployer
          </Button>
          {dry && !hasActive && (
            <Button onClick={() => deploy("full")} disabled={busy || !dry.ready} variant="default">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              Deploy All 4 to Mainnet
            </Button>
          )}
          {dry && hasActive && dry.canPatchLauncher && (
            <Button onClick={() => deploy("launcherOnly")} disabled={busy || !dry.ready} variant="default">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              Deploy Launcher Only (~$3–10)
            </Button>
          )}
          {dry && hasActive && (
            <>
              <Button onClick={verifyNow} disabled={busy} variant="secondary">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Verify on Etherscan
              </Button>
              {needsTransfer && (
                <Button onClick={transferOwn} disabled={busy} variant="default">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Hand Over Ownership to Launcher (~$1)
                </Button>
              )}
              <Button onClick={() => deploy("force")} disabled={busy} variant="destructive">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                Force Redeploy ALL 4
              </Button>
            </>
          )}
        </div>

        {dry && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5 font-mono">
            <div className="flex justify-between"><span className="text-muted-foreground">Deployer</span><span>{dry.deployer.slice(0, 8)}…{dry.deployer.slice(-6)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span>{dry.balance}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Nonce</span><span>{dry.nonce}</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Will deploy</span>
              <Badge variant={dry.willDeploy.length ? "default" : "outline"}>
                {dry.willDeploy.length ? `${dry.willDeploy.length} contracts` : "nothing (already deployed)"}
              </Badge>
            </div>
          </div>
        )}

        {hasActive && dry?.existingDeployment && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs space-y-2 font-mono">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-semibold text-primary">Active deployment on file</span>
              <Badge variant="outline" className="ml-auto">
                {new Date(dry.existingDeployment.deployed_at).toLocaleDateString()}
              </Badge>
            </div>
            {[
              ["PopShibaToken (impl)", dry.existingDeployment.token_impl_address],
              ["PopShibaCloneFactory", dry.existingDeployment.clone_factory_address],
              ["PopShibaFeeVault", dry.existingDeployment.vault_address],
              ["PopShibaLauncher", dry.existingDeployment.launcher_address],
            ].map(([name, addr]) => (
              <div key={name} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{name}</span>
                {addr ? (
                  <a href={`https://etherscan.io/address/${addr}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    {addr.slice(0, 8)}…{addr.slice(-6)} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">MISSING — deploy needed</Badge>
                )}
              </div>
            ))}
            {dry.canPatchLauncher ? (
              <div className="pt-1 text-[10px] text-destructive font-semibold">
                ⚠ Launcher missing. Click "Deploy Launcher Only" to add the 4th contract — your existing 3 stay untouched & verified.
              </div>
            ) : (
              <div className="pt-1 text-[10px] text-muted-foreground">
                All 4 contracts present. "Force Redeploy" replaces the entire set.
              </div>
            )}
          </div>
        )}

        {hasLauncher && ownership && (
          <div className={`rounded-md border p-3 text-xs space-y-2 font-mono ${
            ownershipReady ? "border-primary/40 bg-primary/5" : "border-destructive/50 bg-destructive/10"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className={`h-4 w-4 ${ownershipReady ? "text-primary" : "text-destructive"}`} />
              <span className={`font-semibold ${ownershipReady ? "text-primary" : "text-destructive"}`}>
                {ownershipReady ? "User-launch enabled" : "User-launch BLOCKED — ownership not transferred"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">CloneFactory.owner()</span>
              <span className={ownership.factoryOk ? "text-primary" : "text-destructive"}>
                {ownership.factoryOwner ? `${ownership.factoryOwner.slice(0, 8)}…${ownership.factoryOwner.slice(-6)}` : "?"}
                {ownership.factoryOk ? " ✅" : " ❌"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">FeeVault.owner()</span>
              <span className={ownership.vaultOk ? "text-primary" : "text-destructive"}>
                {ownership.vaultOwner ? `${ownership.vaultOwner.slice(0, 8)}…${ownership.vaultOwner.slice(-6)}` : "?"}
                {ownership.vaultOk ? " ✅" : " ❌"}
              </span>
            </div>
            {!ownershipReady && (
              <div className="pt-1 text-[10px] text-destructive font-semibold">
                ⚠ Both must equal the Launcher address. Click "Hand Over Ownership" to fix.
                Without this, every user launch reverts with NOT_OWNER.
              </div>
            )}
            {ownershipReady && (
              <div className="pt-1 text-[10px] text-muted-foreground">
                Any user wallet can call launcher.launch() and become the on-chain creator.
              </div>
            )}
          </div>
        )}

        {err && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs flex gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div><div className="font-semibold text-destructive">Error</div><div className="text-muted-foreground break-all">{err}</div></div>
          </div>
        )}

        {result?.contracts && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs space-y-2 font-mono">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="font-semibold text-primary">Just deployed</span>
              {result.gasUsedEth && <Badge variant="outline" className="ml-auto">{parseFloat(result.gasUsedEth).toFixed(4)} ETH gas</Badge>}
            </div>
            {Object.entries(result.contracts).map(([name, addr]) => (
              <div key={name} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{name}</span>
                <a href={`https://etherscan.io/address/${addr}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  {addr.slice(0, 8)}…{addr.slice(-6)} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
            {result.tx_hashes && (
              <div className="pt-1 border-t border-primary/20 mt-2 space-y-1">
                {result.tx_hashes.map((tx, i) => (
                  <a key={tx} href={`https://etherscan.io/tx/${tx}`} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-muted-foreground hover:text-primary truncate">
                    tx#{i + 1}: {tx}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
