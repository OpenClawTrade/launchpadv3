import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import WhaleScanner from "@/components/admin/WhaleScanner";
import { useNavigate } from "react-router-dom";

const ADMIN_PASSWORD = "tuna";

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "success" | "error" | "warn";
}

interface DistResult {
  destination: string;
  status: string;
  signature?: string;
  error?: string;
}

export default function CompressedDistributePage() {
  const [authorized, setAuthorized] = useState(() => localStorage.getItem("compressed-auth") === "1");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const [sourceKey, setSourceKey] = useState(() => localStorage.getItem("compressed-source-key") || "");
  const [mintAddress, setMintAddress] = useState(() => localStorage.getItem("compressed-mint") || "");
  const [amount, setAmount] = useState(() => localStorage.getItem("compressed-amount") || "1");
  const [destinations, setDestinations] = useState(() => localStorage.getItem("compressed-destinations") || "");

  const updateField = (key: string, setter: (v: string) => void) => (v: string) => {
    setter(v);
    localStorage.setItem(key, v);
  };
  const updateSourceKey = updateField("compressed-source-key", setSourceKey);
  const updateMint = updateField("compressed-mint", setMintAddress);
  const updateAmount = updateField("compressed-amount", setAmount);
  const updateDestinations = updateField("compressed-destinations", setDestinations);

  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("compressed-logs") || "[]"); } catch { return []; }
  });
  const [results, setResults] = useState<DistResult[]>(() => {
    try { return JSON.parse(localStorage.getItem("compressed-results") || "[]"); } catch { return []; }
  });
  const [stats, setStats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("compressed-stats") || '{"total":0,"success":0,"failed":0,"totalCostSol":0,"costPerWallet":0}');
    } catch { return { total: 0, success: 0, failed: 0, totalCostSol: 0, costPerWallet: 0 }; }
  });
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => {
      const next = [...prev, { time, message, type }];
      try { localStorage.setItem("compressed-logs", JSON.stringify(next.slice(-200))); } catch {}
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      return next;
    });
  }, []);

  const persistResults = (r: DistResult[]) => {
    setResults(r);
    try { localStorage.setItem("compressed-results", JSON.stringify(r)); } catch {}
  };

  const persistStats = (s: typeof stats) => {
    setStats(s);
    try { localStorage.setItem("compressed-stats", JSON.stringify(s)); } catch {}
  };

  const isValidSolanaAddress = (addr: string): boolean => {
    if (addr.length < 32 || addr.length > 44) return false;
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr);
  };

  const callEdgeFunction = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("compressed-distribute", { body });
    if (error) {
      // Try parse error body
      try {
        const errBody = await error.context?.json?.();
        if (errBody?.error) throw new Error(errBody.error);
      } catch {}
      throw new Error(error.message || "Edge function error");
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const startDistribution = async () => {
    const destList = destinations.trim().split("\n").map(d => d.trim()).filter(Boolean);
    if (!sourceKey || !mintAddress || !destList.length) {
      addLog("Missing required fields", "error");
      return;
    }
    if (destList.length > 100) {
      addLog("Max 100 wallets allowed for testing", "error");
      return;
    }
    const invalid = destList.filter(d => !isValidSolanaAddress(d));
    if (invalid.length) {
      invalid.forEach(a => addLog(`Invalid address: ${a}`, "error"));
      return;
    }

    setRunning(true);
    setLogs([]); localStorage.removeItem("compressed-logs");
    persistResults([]);
    persistStats({ total: destList.length, success: 0, failed: 0, totalCostSol: 0, costPerWallet: 0 });

    try {
      // Step 1: Ensure token pool exists
      addLog("Step 1/3: Checking token pool...");
      const poolResult = await callEdgeFunction({
        sourcePrivateKey: sourceKey,
        mintAddress,
        destinations: destList,
        amountPerWallet: parseFloat(amount),
        action: "check-pool",
      });
      poolResult.logs?.forEach((l: string) => addLog(l));
      if (poolResult.costSol > 0) {
        addLog(`Pool setup cost: ${poolResult.costSol.toFixed(6)} SOL`, "info");
      }

      // Step 2: Compress tokens from ATA
      addLog("Step 2/3: Compressing tokens from ATA...");
      const compressResult = await callEdgeFunction({
        sourcePrivateKey: sourceKey,
        mintAddress,
        destinations: destList,
        amountPerWallet: parseFloat(amount),
        action: "compress",
      });
      compressResult.logs?.forEach((l: string) => addLog(l));
      addLog(`Compression cost: ${compressResult.costSol?.toFixed(6) || "0"} SOL`, "info");

      // Step 3: Distribute compressed tokens
      addLog("Step 3/3: Distributing compressed tokens...");
      const distResult = await callEdgeFunction({
        sourcePrivateKey: sourceKey,
        mintAddress,
        destinations: destList,
        amountPerWallet: parseFloat(amount),
        action: "distribute",
      });
      distResult.logs?.forEach((l: string) => addLog(l));

      if (distResult.results) {
        persistResults(distResult.results);
      }
      if (distResult.stats) {
        persistStats(distResult.stats);
        addLog(`Total cost: ${distResult.stats.totalCostSol?.toFixed(6)} SOL`, "success");
        addLog(`Cost per wallet: ${distResult.stats.costPerWallet?.toFixed(6)} SOL`, "success");
      }

      addLog("Distribution complete!", "success");
    } catch (err: any) {
      addLog(`Error: ${err.message}`, "error");
    }

    setRunning(false);
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="p-6 rounded-xl max-w-sm w-full bg-zinc-900 border border-zinc-800">
          <h2 className="text-lg font-bold mb-4 text-center text-orange-400">🔒 Compressed Token Admin</h2>
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && password === ADMIN_PASSWORD) {
                localStorage.setItem("compressed-auth", "1");
                setAuthorized(true);
              }
            }}
            className="w-full px-3 py-2 rounded-lg text-sm mb-3 bg-black border border-zinc-700 text-white"
          />
          <button
            onClick={() => {
              if (password === ADMIN_PASSWORD) {
                localStorage.setItem("compressed-auth", "1");
                setAuthorized(true);
              }
            }}
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

        <h1 className="text-2xl font-bold text-orange-400">Compressed Token Distribution</h1>
        <p className="text-xs text-zinc-500">
          Uses ZK Compression (Light Protocol) to distribute tokens without ATA rent costs (~99% cheaper)
        </p>

        {/* Form */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Source Private Key (bs58)</label>
            <input value={sourceKey} onChange={e => updateSourceKey(e.target.value)} type="password"
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white" disabled={running} />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Token Mint Address</label>
            <input value={mintAddress} onChange={e => updateMint(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white font-mono" disabled={running} />
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Amount per wallet (token units)</label>
          <input value={amount} onChange={e => updateAmount(e.target.value)} type="number" step="0.000001"
            className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white" disabled={running} />
        </div>

        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Destination Wallets (one per line, max 100)</label>
          <textarea value={destinations} onChange={e => updateDestinations(e.target.value)} rows={8}
            className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white font-mono"
            placeholder={"wallet1address\nwallet2address\nwallet3address"} disabled={running} />
        </div>

        <div className="flex gap-3">
          <button onClick={startDistribution} disabled={running}
            className="px-6 py-2 rounded-lg font-bold bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-50">
            {running ? "Running..." : "Start Distribution"}
          </button>
          <button onClick={() => { setLogs([]); localStorage.removeItem("compressed-logs"); persistResults([]); persistStats({ total: 0, success: 0, failed: 0, totalCostSol: 0, costPerWallet: 0 }); }}
            disabled={running}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-zinc-800 hover:border-zinc-600 disabled:opacity-50">
            Clear
          </button>
        </div>

        {/* Stats */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-zinc-500">Total</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.success}</div>
              <div className="text-xs text-zinc-500">Success</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
              <div className="text-xs text-zinc-500">Failed</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-400">{stats.totalCostSol?.toFixed(6)}</div>
              <div className="text-xs text-zinc-500">Total SOL</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-400">{stats.costPerWallet?.toFixed(6)}</div>
              <div className="text-xs text-zinc-500">SOL/Wallet</div>
            </div>
          </div>
        )}

        {/* Console */}
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

        {/* Results Table */}
        {results.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Destination</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Tx</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="p-2 text-zinc-500">{i + 1}</td>
                    <td className="p-2 font-mono">{r.destination.slice(0, 10)}...</td>
                    <td className="p-2">
                      <span className={r.status === "success" ? "text-green-400" : "text-red-400"}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-2 font-mono">
                      {r.signature ? (
                        <a href={`https://solscan.io/tx/${r.signature}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                          {r.signature.slice(0, 12)}...
                        </a>
                      ) : r.error ? (
                        <span className="text-red-400">{r.error.slice(0, 30)}</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Whale Scanner */}
        <WhaleScanner />
      </div>
    </div>
  );
}
