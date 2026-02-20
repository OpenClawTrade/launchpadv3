import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ADMIN_PASSWORD = "claw";

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "success" | "error" | "warn";
}

interface TunnelPair {
  tunnel1: { publicKey: string; secretKey: string };
  tunnel2: { publicKey: string; secretKey: string };
}

interface HopResult {
  destination: string;
  tunnel1: { publicKey: string; secretKey: string };
  tunnel2: { publicKey: string; secretKey: string };
  status: "funded" | "hop1_done" | "success" | "failed";
  fundingSig?: string;
  hop1Sig?: string;
  hop2Sig?: string;
  error?: string;
}

export default function TunnelDistributePage() {
  const [authorized, setAuthorized] = useState(() => localStorage.getItem("tunnel-auth") === "1");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const [sourceKey, setSourceKey] = useState(() => localStorage.getItem("tunnel-source-key") || "");
  const [amount, setAmount] = useState(() => localStorage.getItem("tunnel-amount") || "0.005");
  const [destinations, setDestinations] = useState(() => localStorage.getItem("tunnel-destinations") || "");

  // Persist form values
  const updateSourceKey = (v: string) => { setSourceKey(v); localStorage.setItem("tunnel-source-key", v); };
  const updateAmount = (v: string) => { setAmount(v); localStorage.setItem("tunnel-amount", v); };
  const updateDestinations = (v: string) => { setDestinations(v); localStorage.setItem("tunnel-destinations", v); };

  const [running, setRunning] = useState(() => localStorage.getItem("tunnel-running") === "1");
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("tunnel-logs") || "[]"); } catch { return []; }
  });
  const [hops, setHops] = useState<HopResult[]>(() => {
    try { return JSON.parse(localStorage.getItem("tunnel-hops") || "[]"); } catch { return []; }
  });
  const [stats, setStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tunnel-stats") || '{"total":0,"processed":0,"failed":0}'); } catch { return { total: 0, processed: 0, failed: 0 }; }
  });
  const abortRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => {
      const next = [...prev, { time, message, type }];
      try { localStorage.setItem("tunnel-logs", JSON.stringify(next.slice(-200))); } catch {}
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      return next;
    });
  }, []);

  const persistHops = (h: HopResult[]) => {
    setHops(h);
    try { localStorage.setItem("tunnel-hops", JSON.stringify(h)); } catch {}
  };

  const persistStats = (s: typeof stats) => {
    setStats(s);
    try { localStorage.setItem("tunnel-stats", JSON.stringify(s)); } catch {}
  };

  const persistRunning = (r: boolean) => {
    setRunning(r);
    localStorage.setItem("tunnel-running", r ? "1" : "0");
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const isValidSolanaAddress = (addr: string): boolean => {
    try {
      if (addr.length < 32 || addr.length > 44) return false;
      const validChars = /^[1-9A-HJ-NP-Za-km-z]+$/;
      return validChars.test(addr);
    } catch { return false; }
  };

  const startDistribution = async () => {
    const destList = destinations.trim().split("\n").map(d => d.trim()).filter(Boolean);
    if (!sourceKey || !destList.length) {
      addLog("Missing fields", "error");
      return;
    }

    const invalidAddrs = destList.filter(d => !isValidSolanaAddress(d));
    if (invalidAddrs.length > 0) {
      invalidAddrs.forEach(a => addLog(`Invalid address: ${a}`, "error"));
      addLog(`${invalidAddrs.length} invalid address(es) found. Fix them and retry.`, "error");
      return;
    }

    persistRunning(true);
    abortRef.current = false;
    setLogs([]); localStorage.removeItem("tunnel-logs");
    persistHops([]);
    persistStats({ total: destList.length, processed: 0, failed: 0 });

    addLog(`Starting distribution to ${destList.length} wallets, ${amount} SOL each`);
    addLog("Each wallet gets 2 fresh tunnel keypairs (source → t1 → t2 → dest)");

    // Step 1: Generate tunnels and fund tunnel1s from source
    addLog("Generating tunnel pairs and funding tunnel1s from source...");
    try {
      const { data, error } = await supabase.functions.invoke("tunnel-distribute", {
        body: {
          sourcePrivateKey: sourceKey,
          destinations: destList,
          amountPerWallet: parseFloat(amount),
        },
      });

      if (error || data?.error) {
        addLog(`Failed to initialize: ${data?.error || error?.message}`, "error");
        persistRunning(false);
        return;
      }

      const { hops: hopData, fundingSignatures } = data;

      const hopList: HopResult[] = hopData.map((h: any) => ({
        destination: h.destination,
        tunnel1: h.tunnel1,
        tunnel2: h.tunnel2,
        status: "funded" as const,
        fundingSig: h.fundingSig,
      }));
      persistHops(hopList);

      addLog(`${hopList.length} tunnel pairs created and funded`, "success");
      fundingSignatures.forEach((sig: string) => {
        addLog(`Funded: https://solscan.io/tx/${sig}`, "info");
      });

      // Step 2: For each destination, do 2 hops with delays
      const baseLamports = Math.round(parseFloat(amount) * 1_000_000_000);
      let processed = 0;
      let failed = 0;

      for (let i = 0; i < hopList.length; i++) {
        if (abortRef.current) {
          addLog("Aborted by user", "warn");
          break;
        }

        const hop = hopList[i];

        // Random delay between destinations (30s - 2 min)
        if (i > 0) {
          const delayMs = (30 + Math.random() * 90) * 1000;
          const delaySec = (delayMs / 1000).toFixed(0);
          addLog(`Waiting ${delaySec}s before next destination...`, "info");
          const chunks = Math.ceil(delayMs / 5000);
          for (let c = 0; c < chunks; c++) {
            if (abortRef.current) break;
            await sleep(Math.min(5000, delayMs - c * 5000));
          }
          if (abortRef.current) { addLog("Aborted by user", "warn"); break; }
        }

        addLog(`[${i + 1}/${hopList.length}] Hop 1: Tunnel1 → Tunnel2 for ${hop.destination.slice(0, 8)}...`);

        try {
          // Hop 1: tunnel1 → tunnel2 (send all, draining tunnel1)
          const { data: hop1Data, error: hop1Error } = await supabase.functions.invoke("tunnel-send", {
            body: {
              tunnelPrivateKey: hop.tunnel1.secretKey,
              destination: hop.tunnel2.publicKey,
              sendAll: true,
            },
          });

          if (hop1Error || hop1Data?.error) {
            throw new Error(`Hop1: ${hop1Data?.error || hop1Error?.message}`);
          }

          hop.hop1Sig = hop1Data.signature;
          hop.status = "hop1_done";
          persistHops([...hopList]);
          addLog(`  ✓ Hop 1 done (${(hop1Data.lamportsSent / 1_000_000_000).toFixed(6)} SOL): ${hop1Data.signature.slice(0, 16)}...`, "success");

          // Random delay between hop1 and hop2 (15-120 seconds)
          const interHopDelay = (15 + Math.random() * 105) * 1000;
          addLog(`  Waiting ${(interHopDelay / 1000).toFixed(0)}s before hop 2...`, "info");
          await sleep(interHopDelay);

          if (abortRef.current) { addLog("Aborted by user", "warn"); break; }

          // Hop 2: tunnel2 → destination (send all, draining tunnel2)
          addLog(`[${i + 1}/${hopList.length}] Hop 2: Tunnel2 → ${hop.destination.slice(0, 8)}...`);
          const { data: hop2Data, error: hop2Error } = await supabase.functions.invoke("tunnel-send", {
            body: {
              tunnelPrivateKey: hop.tunnel2.secretKey,
              destination: hop.destination,
              sendAll: true,
            },
          });

          if (hop2Error || hop2Data?.error) {
            throw new Error(`Hop2: ${hop2Data?.error || hop2Error?.message}`);
          }

          hop.hop2Sig = hop2Data.signature;
          hop.status = "success";
          processed++;
          addLog(`  ✓ Hop 2 done: ${hop2Data.signature.slice(0, 16)}...`, "success");
          addLog(`  Final: https://solscan.io/tx/${hop2Data.signature}`, "info");
        } catch (err: any) {
          hop.status = "failed";
          hop.error = err.message;
          failed++;
          addLog(`✗ Failed ${hop.destination.slice(0, 8)}...: ${err.message}`, "error");
        }

        persistHops([...hopList]);
        persistStats({ total: destList.length, processed, failed });
      }

      // Update run in DB
      if (data.runId) {
        await supabase.from("tunnel_distribution_runs").update({
          status: abortRef.current ? "aborted" : failed === hopList.length ? "failed" : "completed",
          hops: hopList as any,
          completed_at: new Date().toISOString(),
        }).eq("id", data.runId);
      }

      addLog(`Distribution complete. ${processed} success, ${failed} failed.`, processed > 0 ? "success" : "error");
    } catch (err: any) {
      addLog(`Fatal error: ${err.message}`, "error");
    }

    persistRunning(false);
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="p-6 rounded-xl max-w-sm w-full bg-zinc-900 border border-zinc-800">
          <h2 className="text-lg font-bold mb-4 text-center text-orange-400">🔒 Tunnel Admin</h2>
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && password === ADMIN_PASSWORD) { localStorage.setItem("tunnel-auth", "1"); setAuthorized(true); } }}
            className="w-full px-3 py-2 rounded-lg text-sm mb-3 bg-black border border-zinc-700 text-white"
          />
          <button
            onClick={() => { if (password === ADMIN_PASSWORD) { localStorage.setItem("tunnel-auth", "1"); setAuthorized(true); } }}
            className="w-full py-2 rounded-lg text-sm font-bold bg-orange-500 text-black hover:bg-orange-400"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  const logColor = { info: "text-zinc-400", success: "text-green-400", error: "text-red-400", warn: "text-yellow-400" };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-orange-400">Tunnel Distribution</h1>
        <p className="text-xs text-zinc-500">Each wallet gets 2 fresh tunnels: Source → T1 → T2 → Destination</p>

        {/* Config inputs */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Source Private Key (bs58)</label>
            <input value={sourceKey} onChange={e => updateSourceKey(e.target.value)} type="password"
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white" disabled={running} />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">SOL per wallet</label>
            <input value={amount} onChange={e => updateAmount(e.target.value)} type="number" step="0.001"
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white" disabled={running} />
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Destination Wallets (one per line)</label>
          <textarea value={destinations} onChange={e => updateDestinations(e.target.value)} rows={8}
            className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white font-mono"
            placeholder={"wallet1address\nwallet2address\nwallet3address"} disabled={running} />
        </div>

        <div className="flex gap-3">
          <button onClick={startDistribution} disabled={running}
            className="px-6 py-2 rounded-lg font-bold bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-50">
            {running ? "Running..." : "Start Distribution"}
          </button>
          {running && (
            <button onClick={() => { abortRef.current = true; }}
              className="px-6 py-2 rounded-lg font-bold bg-red-600 text-white hover:bg-red-500">
              Abort
            </button>
          )}
        </div>

        {/* Stats */}
        {stats.total > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-zinc-500">Total</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.processed}</div>
              <div className="text-xs text-zinc-500">Success</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
              <div className="text-xs text-zinc-500">Failed</div>
            </div>
          </div>
        )}

        {/* Console Logs */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg">
          <div className="px-3 py-2 border-b border-zinc-800 text-xs font-bold text-zinc-400">Console</div>
          <div className="h-64 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
            {logs.map((log, i) => (
              <div key={i} className={logColor[log.type]}>
                <span className="text-zinc-600">[{log.time}]</span> {log.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Hop Results Table */}
        {hops.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Destination</th>
                  <th className="p-2 text-left">T1</th>
                  <th className="p-2 text-left">T2</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Final Tx</th>
                </tr>
              </thead>
              <tbody>
                {hops.map((hop, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="p-2 text-zinc-500">{i + 1}</td>
                    <td className="p-2 font-mono">{hop.destination.slice(0, 10)}...</td>
                    <td className="p-2 font-mono text-zinc-500">{hop.tunnel1.publicKey.slice(0, 8)}...</td>
                    <td className="p-2 font-mono text-zinc-500">{hop.tunnel2.publicKey.slice(0, 8)}...</td>
                    <td className="p-2">
                      <span className={
                        hop.status === "success" ? "text-green-400" :
                        hop.status === "failed" ? "text-red-400" :
                        hop.status === "hop1_done" ? "text-yellow-400" :
                        "text-zinc-500"
                      }>
                        {hop.status}
                      </span>
                    </td>
                    <td className="p-2 font-mono">
                      {hop.hop2Sig ? (
                        <a href={`https://solscan.io/tx/${hop.hop2Sig}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                          {hop.hop2Sig.slice(0, 12)}...
                        </a>
                      ) : hop.error ? <span className="text-red-400">{hop.error.slice(0, 30)}</span> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
