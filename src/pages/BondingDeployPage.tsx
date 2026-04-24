import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Rocket, CheckCircle2, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";

interface ExistingDeployment {
  id: string;
  factory_address: string;
  token_impl_address: string;
  curve_impl_address: string;
  event_bus_address: string;
  lp_locker_address: string;
  treasury_address: string;
  deployer: string;
  deployed_at: string;
  tx_hashes: string[];
}

interface DryRun {
  dryRun: true;
  deployer: string;
  balance: string;
  ready: boolean;
  existing: ExistingDeployment | null;
  canDeploy: boolean;
  treasury: string;
  immutables: { WETH9: string; UNI_V3_FACTORY: string; UNI_V3_POS_MGR: string };
}

interface DeployResult {
  success: boolean;
  contracts: Record<string, string>;
  tx_hashes: string[];
  gasUsedEth: string;
  deployer: string;
  message: string;
}

const SHORT = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";

export default function BondingDeployPage() {
  const [busy, setBusy] = useState(false);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<ExistingDeployment | null>(null);
  const [compileResult, setCompileResult] = useState<{ sources: number; compileMs: number; urls: Record<string, string> } | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("bonding_deployments")
      .select("*")
      .eq("network", "mainnet")
      .eq("is_active", true)
      .order("deployed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActive(data as ExistingDeployment | null);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const compile = useCallback(async () => {
    setBusy(true); setErr(null); setCompileResult(null);
    try {
      toast.info("Compiling 5 contracts (this fetches v4-core from GitHub, ~30-60s)…");
      const { data, error } = await supabase.functions.invoke("popv4-compile", { body: {} });
      if (error) throw new Error(error.message);
      const d = data as { success?: boolean; error?: string; sources: number; compileMs: number; urls: Record<string, string> };
      if (d.error) throw new Error(d.error);
      setCompileResult({ sources: d.sources, compileMs: d.compileMs, urls: d.urls });
      toast.success("Compiled", { description: `${Object.keys(d.urls).length} artifacts saved (${d.compileMs}ms)` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Compile failed";
      setErr(msg); toast.error("Compile failed", { description: msg });
    } finally { setBusy(false); }
  }, []);

  const check = useCallback(async () => {
    setBusy(true); setErr(null); setDry(null); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("popv4-deploy-factory", { body: { dryRun: true } });
      if (error) throw new Error(error.message);
      const d = data as DryRun & { error?: string };
      if (d.error) throw new Error(d.error);
      setDry(d);
      toast.success("Deployer checked", { description: `${d.balance} on Ethereum` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Check failed";
      setErr(msg); toast.error("Check failed", { description: msg });
    } finally { setBusy(false); }
  }, []);

  const deploy = useCallback(async (force = false) => {
    if (!confirm(force
      ? "Redeploy will create a NEW protocol. Existing bonding tokens will keep working but new launches will use the new addresses. Continue?"
      : "Deploy PopShiba bonding protocol to Ethereum mainnet (~0.05–0.10 ETH gas, 6 txs). Continue?"
    )) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("popv4-deploy-factory", { body: { force } });
      if (error) throw new Error(error.message);
      const d = data as DeployResult & { error?: string };
      if (d.error) throw new Error(d.error);
      setResult(d);
      toast.success("Deployed", { description: `Gas used: ${d.gasUsedEth} ETH` });
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deploy failed";
      setErr(msg); toast.error("Deploy failed", { description: msg });
    } finally { setBusy(false); }
  }, [refresh]);

  return (
    <div className="min-h-screen bg-pop-cream">
      <PopshibaTopNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="font-pop-display text-[28px] tracking-[-0.02em] text-pop-ink">
            Bonding Protocol Deployer
          </h1>
          <p className="text-[13px] text-pop-ink/70 mt-1">
            One-click deploy of the PopShiba-owned Unicurve fork (5 contracts, 6 txs).
            Same math: 1B supply, 1.06 ETH virtual, 3 ETH graduation, 1% fee, 50/50 split, V3 1% LP locked forever.
          </p>
        </div>

        {/* Active deployment */}
        {active && (
          <div className="border-2 border-pop-ink bg-white shadow-[5px_5px_0_hsl(var(--pop-ink))] p-5">
            <div className="flex items-center gap-2 text-[14px] font-bold text-pop-ink mb-3">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Active deployment
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] font-pop-mono">
              {[
                ["Factory", active.factory_address],
                ["Token Impl", active.token_impl_address],
                ["Curve Impl", active.curve_impl_address],
                ["Event Bus", active.event_bus_address],
                ["LP Locker", active.lp_locker_address],
                ["Treasury", active.treasury_address],
              ].map(([label, addr]) => (
                <div key={label} className="flex justify-between gap-2 border border-pop-ink/20 px-2 py-1.5 bg-pop-cream/40">
                  <span className="text-pop-ink/60">{label}</span>
                  <a href={`https://etherscan.io/address/${addr}`} target="_blank" rel="noreferrer"
                     className="text-pop-ink hover:underline inline-flex items-center gap-1">
                    {SHORT(addr)} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-pop-ink/60 mt-3 font-pop-mono">
              Deployed {new Date(active.deployed_at).toLocaleString()} · by {SHORT(active.deployer)}
            </div>
          </div>
        )}

        {/* Action panel */}
        <div className="border-2 border-pop-ink bg-white shadow-[5px_5px_0_hsl(var(--pop-ink))] p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={compile} disabled={busy}
              className="inline-flex items-center gap-2 font-bold text-[13px] px-4 py-2 border-2 border-pop-ink bg-white text-pop-ink hover:bg-pop-cream/40 disabled:opacity-60 transition-colors">
              {busy && !result && !dry ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              0. Compile Contracts
            </button>
            <button onClick={check} disabled={busy}
              className="inline-flex items-center gap-2 font-bold text-[13px] px-4 py-2 border-2 border-pop-ink bg-white text-pop-ink hover:bg-pop-cream/40 disabled:opacity-60 transition-colors">
              {busy && !result ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              1. Check Deployer
            </button>
            <button onClick={() => deploy(false)} disabled={busy || !dry?.ready || (active != null)}
              className="inline-flex items-center gap-2 font-bold text-[13px] px-4 py-2 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] disabled:opacity-60 disabled:cursor-not-allowed transition-all">
              <Rocket className="w-4 h-4" strokeWidth={3} />
              2. Deploy Bonding Protocol
            </button>
            {active && (
              <button onClick={() => deploy(true)} disabled={busy}
                className="inline-flex items-center gap-2 font-bold text-[13px] px-4 py-2 border-2 border-pop-ink bg-red-100 text-pop-ink hover:bg-red-200 disabled:opacity-60 transition-colors">
                Force Redeploy
              </button>
            )}
          </div>

          {compileResult && (
            <div className="text-[12px] font-pop-mono space-y-1 border-t-2 border-pop-ink/10 pt-3">
              <div className="font-bold text-pop-ink">✅ Compiled {Object.keys(compileResult.urls).length} artifacts ({compileResult.compileMs}ms, {compileResult.sources} source files)</div>
              {Object.entries(compileResult.urls).map(([name, url]) => (
                <div key={name} className="flex justify-between gap-2">
                  <span className="text-pop-ink/60">{name}</span>
                  <a href={url} target="_blank" rel="noreferrer" className="text-pop-ink hover:underline">view</a>
                </div>
              ))}
            </div>
          )}

          {dry && (
            <div className="text-[12px] font-pop-mono space-y-1 border-t-2 border-pop-ink/10 pt-3">
              <div>Deployer: <span className="text-pop-ink">{dry.deployer}</span></div>
              <div>Balance: <span className="text-pop-ink">{dry.balance}</span> {dry.ready ? "✅" : "⚠️ low"}</div>
              <div>Treasury: <span className="text-pop-ink">{dry.treasury}</span></div>
            </div>
          )}

          {err && (
            <div className="flex items-start gap-2 text-[12px] text-red-700 border-2 border-red-300 bg-red-50 p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {err}
            </div>
          )}

          {result && (
            <div className="border-2 border-green-600 bg-green-50 p-4 text-[12px] font-pop-mono space-y-2">
              <div className="font-bold text-green-800">{result.message}</div>
              <div>Gas used: {result.gasUsedEth} ETH</div>
              <div className="space-y-1">
                {Object.entries(result.contracts).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-pop-ink/60">{k}</span>
                    <a className="hover:underline" href={`https://etherscan.io/address/${v}`} target="_blank" rel="noreferrer">{v}</a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="text-[11px] text-pop-ink/50 font-pop-mono">
          Compiled with solc 0.8.26 (optimizer 200, viaIR). Source in <code>contracts/popshiba/bonding/</code>.
        </div>
      </main>
    </div>
  );
}
