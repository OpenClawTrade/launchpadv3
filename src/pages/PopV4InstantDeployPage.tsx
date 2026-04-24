import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Rocket, CheckCircle2, ExternalLink, AlertCircle, Pickaxe } from "lucide-react";
import { toast } from "sonner";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";

/**
 * V4-Instant deploy + launch console.
 *
 * Three-step flow because of the CREATE2 hook permission bits:
 *   1. Dry-run deploy → returns predicted factory + initCodeHash.
 *   2. Mine salt    → returns salt + hookAddress.
 *   3. Real deploy  → submits both txs (hook via CREATE2, then factory).
 *
 * After deploy, the "Test Launch" panel lets you fire a real launch
 * end-to-end against mainnet using the deployer wallet.
 */

interface Deployment {
  id: string;
  hook_address: string;
  factory_address: string;
  treasury_address: string;
  hook_salt: string;
  deployer: string;
  deploy_tx_hashes: string[];
  deployed_at: string;
}

interface DryRun {
  dryRun: true;
  deployer: string;
  predictedFactory: string;
  treasury: string;
  poolManager: string;
  create2Deployer: string;
  hookInitCodeHash: string;
  nextStep: string;
}

interface MineResult {
  salt: string;
  hookAddress: string;
  iterations: number;
  elapsedMs: number;
}

interface DeployResult {
  success: boolean;
  hook: string;
  factory: string;
  treasury: string;
  txHashes: string[];
}

const SHORT = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";

export default function PopV4InstantDeployPage() {
  const [busy, setBusy] = useState(false);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [mined, setMined] = useState<MineResult | null>(null);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [active, setActive] = useState<Deployment | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("popv4instant_deployments")
      .select("*")
      .eq("network", "ethereum")
      .eq("is_active", true)
      .order("deployed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActive(data as Deployment | null);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function dryRun() {
    setBusy(true); setErr(null); setDry(null); setMined(null); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("popv4instant-deploy", { body: { dryRun: true } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setDry(data as DryRun);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function mineSalt() {
    if (!dry) return;
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("popv4instant-mine-salt", {
        body: { factory: dry.create2Deployer, initCodeHash: dry.hookInitCodeHash },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setMined(data as MineResult);
      toast.success(`Found salt in ${(data as MineResult).iterations.toLocaleString()} iter`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function realDeploy() {
    if (!mined) return;
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("popv4instant-deploy", {
        body: { salt: mined.salt, hookAddress: mined.hookAddress },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as DeployResult);
      toast.success("Hook + factory deployed");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PopshibaTopNav />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <header>
          <h1 className="text-3xl font-black tracking-tight">PopShiba V4-Instant</h1>
          <p className="text-muted-foreground mt-1">
            One-time singleton hook + factory deploy. After this, every launch is a single tx through the factory.
          </p>
        </header>

        {active ? (
          <div className="border-2 border-foreground p-5 bg-card">
            <div className="flex items-center gap-2 text-sm font-mono text-primary">
              <CheckCircle2 className="h-4 w-4" /> ACTIVE DEPLOYMENT
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 font-mono text-xs">
              <Row label="Hook" value={active.hook_address} link />
              <Row label="Factory" value={active.factory_address} link />
              <Row label="Treasury" value={active.treasury_address} link />
              <Row label="Deployer" value={active.deployer} link />
              <Row label="Salt" value={SHORT(active.hook_salt)} />
              <Row label="Deployed" value={new Date(active.deployed_at).toLocaleString()} />
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-foreground p-5 bg-muted/40 text-sm font-mono">
            No active deployment yet. Run the 3 steps below.
          </div>
        )}

        {/* Step 1 */}
        <Section step="1" title="Dry-run (predict factory + initCodeHash)">
          <button onClick={dryRun} disabled={busy} className="btn-primary">
            {busy && !dry ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run dry-run"}
          </button>
          {dry && (
            <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-xs">
              <Row label="Predicted factory" value={dry.predictedFactory} link />
              <Row label="Hook initCodeHash" value={SHORT(dry.hookInitCodeHash)} />
              <Row label="Treasury" value={dry.treasury} link />
              <Row label="Deployer" value={dry.deployer} link />
            </div>
          )}
        </Section>

        {/* Step 2 */}
        {dry && (
          <Section step="2" title="Mine CREATE2 salt for hook permission bits">
            <button onClick={mineSalt} disabled={busy} className="btn-primary">
              {busy && !mined ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pickaxe className="h-4 w-4 mr-1 inline" /> Mine salt (target 0x10C4)</>}
            </button>
            {mined && (
              <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-xs">
                <Row label="Mined hook" value={mined.hookAddress} link />
                <Row label="Salt" value={SHORT(mined.salt)} />
                <Row label="Iterations" value={mined.iterations.toLocaleString()} />
                <Row label="Elapsed" value={`${mined.elapsedMs} ms`} />
              </div>
            )}
          </Section>
        )}

        {/* Step 3 */}
        {mined && (
          <Section step="3" title="Real deploy (hook via CREATE2 + factory)">
            <button onClick={realDeploy} disabled={busy} className="btn-primary">
              {busy && !result ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Rocket className="h-4 w-4 mr-1 inline" /> Deploy to mainnet</>}
            </button>
            {result && (
              <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-xs">
                <Row label="Hook" value={result.hook} link />
                <Row label="Factory" value={result.factory} link />
                {result.txHashes.map((h, i) => (
                  <Row key={h} label={`Tx ${i + 1}`} value={h} link txLink />
                ))}
              </div>
            )}
          </Section>
        )}

        {err && (
          <div className="border-2 border-destructive p-4 bg-destructive/10 text-sm font-mono text-destructive flex gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="break-all">{err}</div>
          </div>
        )}

        {active && <TestLaunchPanel />}
      </div>

      <style>{`
        .btn-primary {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: 'Archivo Black', sans-serif;
          font-size: 13px; letter-spacing: 0.04em;
          padding: 10px 18px;
          border: 2px solid hsl(var(--foreground));
          background: hsl(var(--primary)); color: hsl(var(--primary-foreground));
          box-shadow: 3px 3px 0 hsl(var(--foreground));
          cursor: pointer;
        }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function Section(props: { step: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-foreground p-5 bg-card">
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-3">
        <span className="bg-foreground text-background px-2 py-0.5">STEP {props.step}</span>
        <span className="font-bold uppercase tracking-wider">{props.title}</span>
      </div>
      {props.children}
    </div>
  );
}

function Row({ label, value, link, txLink }: { label: string; value: string; link?: boolean; txLink?: boolean }) {
  const url = txLink
    ? `https://etherscan.io/tx/${value}`
    : `https://etherscan.io/address/${value}`;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground uppercase tracking-wider text-[10px] w-32 shrink-0">{label}</span>
      {link ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline inline-flex items-center gap-1">
          {value} <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="break-all">{value}</span>
      )}
    </div>
  );
}

function TestLaunchPanel() {
  const [name, setName] = useState("PopTest");
  const [symbol, setSymbol] = useState("POPT");
  const [initialBuyEth, setInitialBuyEth] = useState("0.001");
  const [preset, setPreset] = useState<"0.69" | "1" | "2" | "5" | "10">("0.69");
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<{ to: string; data: string; value: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function buildTx() {
    setBusy(true); setErr(null); setTx(null);
    try {
      const { data, error } = await supabase.functions.invoke("popv4instant-launch", {
        body: {
          creator: "0x9FD5f2E480F43320E8F65072A739c941cb5b10B0",
          name, symbol,
          initialBuyEth,
          targetMarketCapEth: Number(preset),
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setTx({ to: (data as any).to, data: (data as any).data, value: (data as any).value });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <div className="border-2 border-foreground p-5 bg-card">
      <div className="text-xs font-mono text-muted-foreground mb-3">
        <span className="bg-primary text-primary-foreground px-2 py-0.5 font-bold">TEST LAUNCH</span>
        <span className="ml-2 uppercase tracking-wider font-bold">Build a real launch tx (sign in MetaMask)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="text-xs font-mono">
          <div className="text-muted-foreground uppercase tracking-wider mb-1">Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-foreground bg-background px-2 py-1.5 font-mono text-sm" />
        </label>
        <label className="text-xs font-mono">
          <div className="text-muted-foreground uppercase tracking-wider mb-1">Symbol</div>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="w-full border-2 border-foreground bg-background px-2 py-1.5 font-mono text-sm" />
        </label>
        <label className="text-xs font-mono">
          <div className="text-muted-foreground uppercase tracking-wider mb-1">Initial buy (ETH)</div>
          <input value={initialBuyEth} onChange={(e) => setInitialBuyEth(e.target.value)} className="w-full border-2 border-foreground bg-background px-2 py-1.5 font-mono text-sm" />
        </label>
        <label className="text-xs font-mono">
          <div className="text-muted-foreground uppercase tracking-wider mb-1">Target market cap (ETH)</div>
          <select value={preset} onChange={(e) => setPreset(e.target.value as any)} className="w-full border-2 border-foreground bg-background px-2 py-1.5 font-mono text-sm">
            <option value="0.69">0.69 ETH</option>
            <option value="1">1 ETH</option>
            <option value="2">2 ETH</option>
            <option value="5">5 ETH</option>
            <option value="10">10 ETH</option>
          </select>
        </label>
      </div>
      <button onClick={buildTx} disabled={busy} className="btn-primary">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Build launch tx"}
      </button>
      {tx && (
        <div className="mt-3 grid grid-cols-1 gap-1 font-mono text-xs">
          <Row label="To (factory)" value={tx.to} link />
          <Row label="Value" value={tx.value} />
          <div className="text-muted-foreground uppercase tracking-wider text-[10px] mt-2">CALLDATA</div>
          <textarea readOnly value={tx.data} className="w-full h-24 border-2 border-foreground bg-background px-2 py-1.5 font-mono text-[10px] break-all" />
          <p className="text-muted-foreground mt-1">
            Paste these into MetaMask "Send" → custom data, or any tx-builder. The launch is a single payable call.
          </p>
        </div>
      )}
      {err && <div className="mt-3 text-sm font-mono text-destructive">{err}</div>}
    </div>
  );
}
