import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, AlertCircle, CheckCircle2, ExternalLink, Wallet, ShieldCheck } from "lucide-react";
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
  v2Ready?: boolean;
  v2CanDeploy?: boolean;
  v3Ready?: boolean;
  v3CanDeploy?: boolean;
  warning: string | null;
}

interface DeployResult {
  success: boolean;
  mode?: string;
  deployer?: string;
  contracts?: Record<string, string>;
  tx_hashes?: string[];
  gasUsedEth?: string;
  uncxLockFeeWei?: string | null;
  tfLockFeeWei?: string | null;
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

  const deploy = useCallback(async (mode: "full" | "force" | "launcherOnly" | "v2" | "v3") => {
    const confirmMsg = mode === "force"
      ? "FORCE redeploy ALL 4 contracts?\n\nThis deactivates the current active deployment and spends gas (~$15–50). Cannot be undone."
      : mode === "launcherOnly"
      ? "Deploy ONLY the missing PopShibaLauncher?\n\nKeeps your existing 3 verified contracts untouched. Just adds the 4th (router) and wires it into the active row. Gas: ~$3–10."
      : mode === "v2"
      ? "Deploy V2 (UNCX-locking) suite?\n\nDeploys PopShibaFeeVaultV2 + PopShibaLauncherV2, reuses existing Token impl + CloneFactory, sets the V2 row as active. New launches will lock LP in UNCX. Gas: ~$8–25."
      : mode === "v3"
      ? "Deploy V3 (Team Finance) suite?\n\nDeploys PopShibaFeeVaultV3 + PopShibaLauncherV3, reuses existing Token impl + CloneFactory, sets the V3 row as active. New launches can OPT-IN to Team Finance LP locking per-launch (cheap default = no lock). Gas: ~$8–25."
      : "Deploy all 4 contracts to Ethereum mainnet?\n\nGas: ~$15–50. Cannot be undone.";
    if (!confirm(confirmMsg)) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("eth-deploy-contracts", {
        body: {
          dryRun: false,
          force: mode === "force",
          launcherOnly: mode === "launcherOnly",
          v2: mode === "v2",
          v3: mode === "v3",
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

  const hasActive = !!dry?.existingDeployment;

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
              <Button
                onClick={() => deploy("v2")}
                disabled={busy || !dry.v2CanDeploy}
                variant="default"
                title={dry.v2Ready ? "Deploy UNCX-locking V2 suite" : "Paste V2 bytecode into v2_bytecode.ts first"}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Deploy V2 (UNCX Locking) {!dry.v2Ready && "— bytecode missing"}
              </Button>
              <Button
                onClick={() => deploy("v3")}
                disabled={busy || !dry.v3CanDeploy}
                variant="default"
                title={dry.v3Ready ? "Deploy Team Finance V3 suite (optional lock)" : "V3 bytecode missing"}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Deploy V3 (Team Finance — optional lock) {!dry.v3Ready && "— bytecode missing"}
              </Button>
              <Button onClick={() => deploy("force")} disabled={busy} variant="destructive">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                Force Redeploy ALL 4 (fixes user launches)
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


        {dry && hasActive && (
          <div className={`rounded-md border p-3 text-xs space-y-1 font-mono ${dry.v2Ready ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className={`h-4 w-4 ${dry.v2Ready ? "text-emerald-400" : "text-amber-400"}`} />
              <span className={`font-semibold ${dry.v2Ready ? "text-emerald-400" : "text-amber-400"}`}>
                V2 (UNCX LP Locking) {dry.v2Ready ? "ready to deploy" : "bytecode not pasted yet"}
              </span>
            </div>
            {!dry.v2Ready && (
              <p className="text-muted-foreground leading-relaxed pt-1">
                Compile <code className="text-foreground">contracts/popshiba/PopShibaFeeVaultV2.sol</code> and{" "}
                <code className="text-foreground">PopShibaLauncherV2.sol</code> (Solidity 0.8.20, optimizer 200 runs) and paste the runtime bytecode into{" "}
                <code className="text-foreground">supabase/functions/eth-deploy-contracts/v2_bytecode.ts</code>. Then come back here.
              </p>
            )}
            {dry.v2Ready && (
              <p className="text-muted-foreground leading-relaxed pt-1">
                Click <strong>Deploy V2 (UNCX Locking)</strong> above. Reuses the existing PopShibaToken impl + CloneFactory; deploys FeeVaultV2 + LauncherV2; sets V2 row as active. Tokens launched after this point will lock LP in UNCX V3 Locker.
              </p>
            )}
          </div>
        )}

        {dry && hasActive && (
          <div className={`rounded-md border p-3 text-xs space-y-1 font-mono ${dry.v3Ready ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className={`h-4 w-4 ${dry.v3Ready ? "text-emerald-400" : "text-amber-400"}`} />
              <span className={`font-semibold ${dry.v3Ready ? "text-emerald-400" : "text-amber-400"}`}>
                V3 (Team Finance — optional LP lock) {dry.v3Ready ? "ready to deploy" : "bytecode not pasted yet"}
              </span>
            </div>
            {dry.v3Ready ? (
              <p className="text-muted-foreground leading-relaxed pt-1">
                Click <strong>Deploy V3 (Team Finance)</strong> above. Reuses existing Token impl + CloneFactory; deploys FeeVaultV3 + LauncherV3; auto-wires <code className="text-foreground">setLauncher</code>; sets V3 as active. Per-launch the user picks whether to lock — default no-lock launches cost only gas; opting in adds the live Team Finance fee (~$150 in ETH) and registers the creator for 50% trading-fee claims.
              </p>
            ) : (
              <p className="text-muted-foreground leading-relaxed pt-1">
                Compile <code className="text-foreground">contracts/popshiba/PopShibaFeeVaultV3.sol</code> and <code className="text-foreground">PopShibaLauncherV3.sol</code> (Solidity 0.8.20, optimizer 200 runs, viaIR) and paste the runtime bytecode into <code className="text-foreground">supabase/functions/eth-deploy-contracts/v3_bytecode.ts</code>.
              </p>
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
