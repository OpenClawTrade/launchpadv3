import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ADMIN_PASSWORD = "tuna";

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "success" | "error" | "warn";
}

interface TunnelInfo {
  publicKey: string;
  secretKey: string;
}

interface HopResult {
  tunnel: number;
  destination: string;
  status: "pending" | "success" | "failed";
  signature?: string;
  error?: string;
}

export default function TunnelDistributePage() {
  const [authorized, setAuthorized] = useState(() => sessionStorage.getItem("tunnel-auth") === "1");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const [sourceKey, setSourceKey] = useState("");
  const [amount, setAmount] = useState("0.005");
  const [destinations, setDestinations] = useState("");
  

  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tunnels, setTunnels] = useState<TunnelInfo[]>([]);
  const [hops, setHops] = useState<HopResult[]>([]);
  const [stats, setStats] = useState({ total: 0, processed: 0, failed: 0 });
  const abortRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => {
      const next = [...prev, { time, message, type }];
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      return next;
    });
  }, []);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const startDistribution = async () => {
    const destList = destinations.trim().split("\n").map(d => d.trim()).filter(Boolean);
    if (!sourceKey || !destList.length) {
      addLog("Missing fields", "error");
      return;
    }

    setRunning(true);
    abortRef.current = false;
    setLogs([]);
    setTunnels([]);
    setHops([]);
    setStats({ total: destList.length, processed: 0, failed: 0 });

    addLog(`Starting distribution to ${destList.length} wallets, ${amount} SOL each`);

    // Step 1: Call tunnel-distribute to generate tunnels and fund them
    addLog("Generating tunnel wallets and funding from source...");
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
        setRunning(false);
        return;
      }

      const { tunnels: tunnelKeys, assignments, fundingSignatures } = data;
      setTunnels(tunnelKeys);

      tunnelKeys.forEach((t: TunnelInfo, i: number) => {
        addLog(`Tunnel ${i + 1}: ${t.publicKey}`, "info");
      });

      fundingSignatures.forEach((sig: string) => {
        addLog(`Tunnel funded: https://solscan.io/tx/${sig}`, "success");
      });

      // Initialize hops
      const hopList: HopResult[] = assignments.map((a: any) => ({
        tunnel: a.tunnel,
        destination: a.destination,
        status: "pending" as const,
      }));
      setHops(hopList);

      // Step 2: Send from tunnels to destinations with delays
      const lamports = Math.round(parseFloat(amount) * 1_000_000_000);
      let processed = 0;
      let failed = 0;

      for (let i = 0; i < hopList.length; i++) {
        if (abortRef.current) {
          addLog("Aborted by user", "warn");
          break;
        }

        const hop = hopList[i];
        const tunnelKey = tunnelKeys[hop.tunnel].secretKey;

        // Random delay 1-5 minutes between sends (5-10 min total per dest with 2 tunnels)
        if (i > 0) {
          const delayMs = (60 + Math.random() * 240) * 1000; // 1-5 min
          const delayMin = (delayMs / 60000).toFixed(1);
          addLog(`Waiting ${delayMin} min before next send...`, "info");
          
          // Wait in chunks so we can check abort
          const chunks = Math.ceil(delayMs / 5000);
          for (let c = 0; c < chunks; c++) {
            if (abortRef.current) break;
            await sleep(Math.min(5000, delayMs - c * 5000));
          }
          if (abortRef.current) {
            addLog("Aborted by user", "warn");
            break;
          }
        }

        addLog(`[${i + 1}/${hopList.length}] Sending to ${hop.destination.slice(0, 8)}... via Tunnel ${hop.tunnel + 1}`);

        try {
          const { data: sendData, error: sendError } = await supabase.functions.invoke("tunnel-send", {
            body: {
              tunnelPrivateKey: tunnelKey,
              destination: hop.destination,
              lamports,
            },
          });

          if (sendError || sendData?.error) {
            throw new Error(sendData?.error || sendError?.message);
          }

          hop.status = "success";
          hop.signature = sendData.signature;
          processed++;
          addLog(`✓ Sent to ${hop.destination.slice(0, 8)}... sig: ${sendData.signature.slice(0, 16)}...`, "success");
          addLog(`  https://solscan.io/tx/${sendData.signature}`, "info");
        } catch (err: any) {
          hop.status = "failed";
          hop.error = err.message;
          failed++;
          addLog(`✗ Failed ${hop.destination.slice(0, 8)}...: ${err.message}`, "error");
        }

        setHops([...hopList]);
        setStats({ total: destList.length, processed, failed });
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

    setRunning(false);
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
            onKeyDown={e => { if (e.key === "Enter" && password === ADMIN_PASSWORD) { sessionStorage.setItem("tunnel-auth", "1"); setAuthorized(true); } }}
            className="w-full px-3 py-2 rounded-lg text-sm mb-3 bg-black border border-zinc-700 text-white"
          />
          <button
            onClick={() => { if (password === ADMIN_PASSWORD) { sessionStorage.setItem("tunnel-auth", "1"); setAuthorized(true); } }}
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

        {/* Config inputs */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Source Private Key (bs58)</label>
            <input value={sourceKey} onChange={e => setSourceKey(e.target.value)} type="password"
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white" disabled={running} />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">SOL per wallet</label>
            <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.001"
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white" disabled={running} />
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Destination Wallets (one per line)</label>
          <textarea value={destinations} onChange={e => setDestinations(e.target.value)} rows={8}
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

        {/* Tunnel Keys Table */}
        {tunnels.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-sm font-bold text-orange-400 mb-3">🔑 Tunnel Wallet Keys (save these!)</h3>
            <div className="space-y-3">
              {tunnels.map((t, i) => (
                <div key={i} className="text-xs font-mono">
                  <div className="text-zinc-400">Tunnel {i + 1} Public: <span className="text-white">{t.publicKey}</span></div>
                  <div className="text-zinc-400">Tunnel {i + 1} Secret: <span className="text-yellow-300 break-all">{t.secretKey}</span></div>
                </div>
              ))}
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
                  <th className="p-2 text-left">Tunnel</th>
                  <th className="p-2 text-left">Destination</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Signature</th>
                </tr>
              </thead>
              <tbody>
                {hops.map((hop, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="p-2 text-zinc-500">{i + 1}</td>
                    <td className="p-2">{hop.tunnel + 1}</td>
                    <td className="p-2 font-mono">{hop.destination.slice(0, 12)}...</td>
                    <td className="p-2">
                      <span className={hop.status === "success" ? "text-green-400" : hop.status === "failed" ? "text-red-400" : "text-zinc-500"}>
                        {hop.status}
                      </span>
                    </td>
                    <td className="p-2 font-mono">
                      {hop.signature ? (
                        <a href={`https://solscan.io/tx/${hop.signature}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                          {hop.signature.slice(0, 12)}...
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
