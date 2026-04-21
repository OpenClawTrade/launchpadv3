import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, AlertCircle, CheckCircle2, ExternalLink, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DeployResult {
  success: boolean;
  network?: string;
  deployer?: string;
  contracts?: { PopShibaToken: string; PopShibaCloneFactory: string; PopShibaFeeVault: string };
  tx_hashes?: string[];
  gasUsedEth?: string;
  message?: string;
  error?: string;
}

interface DryRun {
  dryRun: true;
  deployer: string;
  balance: string;
  nonce: number;
  ready: boolean;
  willDeploy: string[];
}

export function EthContractsDeployPanel() {
  const [busy, setBusy] = useState(false);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const checkReadiness = useCallback(async () => {
    setBusy(true); setErr(null); setDry(null);
    try {
      const { data, error } = await supabase.functions.invoke("eth-deploy-contracts", {
        body: { dryRun: true },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setDry(data as DryRun);
      toast.success("Deployer ready", { description: `${(data as DryRun).balance} on Ethereum mainnet` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Check failed";
      setErr(msg);
      toast.error("Readiness check failed", { description: msg });
    } finally { setBusy(false); }
  }, []);

  const deploy = useCallback(async () => {
    if (!confirm("Deploy PopShibaToken impl + CloneFactory + FeeVault to Ethereum mainnet?\n\nThis will spend ~$80–150 in gas. Cannot be undone.")) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("eth-deploy-contracts", {
        body: { dryRun: false },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as DeployResult);
      toast.success("✅ Contracts deployed", { description: "Etherscan verification running in background" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deployment failed";
      setErr(msg);
      toast.error("Deployment failed", { description: msg });
    } finally { setBusy(false); }
  }, []);

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          PopShiba Ethereum Contract Suite
        </CardTitle>
        <CardDescription>
          One-shot deploy: PopShibaToken (clone master) → PopShibaCloneFactory (EIP-1167) → PopShibaFeeVault.
          Auto-verified on Etherscan. ~90% gas saving on every future token launch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={checkReadiness} disabled={busy} variant="outline">
            {busy && !result ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
            Check Deployer
          </Button>
          <Button onClick={deploy} disabled={busy || !dry?.ready} variant="default">
            {busy && dry ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            Deploy to Mainnet
          </Button>
        </div>

        {dry && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5 font-mono">
            <div className="flex justify-between"><span className="text-muted-foreground">Deployer</span><span>{dry.deployer.slice(0, 8)}…{dry.deployer.slice(-6)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span>{dry.balance}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Nonce</span><span>{dry.nonce}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Will deploy</span><Badge variant="default">{dry.willDeploy.length} contracts</Badge></div>
          </div>
        )}

        {err && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs flex gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div><div className="font-semibold text-destructive">Error</div><div className="text-muted-foreground">{err}</div></div>
          </div>
        )}

        {result?.contracts && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs space-y-2 font-mono">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="font-semibold text-primary">Deployed</span>
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
          </div>
        )}

        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
          <div className="font-semibold text-warning mb-1">⚠ Bytecode build required</div>
          <div className="text-muted-foreground leading-relaxed">
            Solidity sources live in <code className="font-mono">contracts/popshiba/</code>. The deploy edge function
            requires precompiled bytecode artifacts. Run <code className="font-mono">forge build</code> locally and
            paste artifact JSON into <code className="font-mono">supabase/functions/eth-deploy-contracts/artifacts/</code>{" "}
            before clicking Deploy.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
