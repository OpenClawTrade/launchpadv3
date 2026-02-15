import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AddressData {
  address: string;
  timesSeen: number;
  totalVolumeSol: number;
  activityTypes: string[];
  sources: string[];
  lastSeen: string;
}

interface SessionData {
  id: string;
  status: string;
  minSol: number;
  lastSlot: number | null;
  startedAt: string;
  expiresAt: string;
  totalSlotsScanned: number;
  totalSwaps: number;
  totalTransfers: number;
  totalVolume: number;
  creditsUsed: number;
  errorCount: number;
  lastError: string | null;
  lastPollAt: string;
}

const LS_SESSION_KEY = "whale-scanner-session-id";

export default function WhaleScanner() {
  const [sessionId, setSessionId] = useState<string | null>(
    () => localStorage.getItem(LS_SESSION_KEY)
  );
  const [session, setSession] = useState<SessionData | null>(null);
  const [addresses, setAddresses] = useState<AddressData[]>([]);
  const [totalAddresses, setTotalAddresses] = useState(0);
  const [minSol, setMinSol] = useState(10);
  const [slotsPerCall, setSlotsPerCall] = useState(5);
  const [filter, setFilter] = useState("all");
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [scanLog, setScanLog] = useState<string[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatusRef = useRef<string>("");

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setScanLog(prev => [...prev, `[${time}] ${msg}`].slice(-200));
  }, []);

  const isActive = session?.status === "running";

  // Poll session status from DB
  const pollStatus = useCallback(async (sid: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("sol-whale-scanner", {
        body: { action: "status", sessionId: sid },
      });

      if (error || !data || data.error) {
        addLog(`Status error: ${error?.message || data?.error || "unknown"}`);
        return;
      }

      const s = data.session as SessionData;
      setSession(s);
      setAddresses(data.addresses || []);
      setTotalAddresses(data.totalAddresses || 0);

      // Auto-recovery: if running but heartbeat stale > 30s, re-trigger
      if (s.status === "running" && s.lastPollAt) {
        const staleMs = Date.now() - new Date(s.lastPollAt).getTime();
        if (staleMs > 30000) {
          addLog("⚠️ Scanner stalled, auto-restarting...");
          await supabase.functions.invoke("sol-whale-scanner", {
            body: { action: "continue", sessionId: sid },
          });
        }
      }

      // Log status changes
      if (s.status !== lastStatusRef.current) {
        lastStatusRef.current = s.status;
        if (s.status === "completed") addLog("✅ Scanner completed (30 min expired)");
        if (s.status === "failed") addLog("❌ Scanner failed after 10 consecutive errors");
        if (s.status === "stopped") addLog("⏹ Scanner stopped");
      }

      // If session ended, stop polling
      if (s.status !== "running") {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch (err: any) {
      addLog(`Poll error: ${err.message}`);
    }
  }, [addLog]);

  // Start polling when sessionId is set
  useEffect(() => {
    if (!sessionId) return;

    // Initial poll
    pollStatus(sessionId);

    // Poll every 3 seconds
    pollRef.current = setInterval(() => pollStatus(sessionId), 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, pollStatus]);

  const startScanner = async () => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("sol-whale-scanner", {
        body: { action: "start", minSol, slotsPerCall },
      });

      if (error || !data || data.error) {
        addLog(`Start error: ${error?.message || data?.error || "unknown"}`);
        setStarting(false);
        return;
      }

      const sid = data.sessionId;
      setSessionId(sid);
      localStorage.setItem(LS_SESSION_KEY, sid);
      lastStatusRef.current = "running";
      addLog(`🚀 Scanner started (min ${minSol} SOL, ${slotsPerCall} slots/call, runs on server)`);
    } catch (err: any) {
      addLog(`Start error: ${err.message}`);
    }
    setStarting(false);
  };

  const stopScanner = async () => {
    if (!sessionId) return;
    try {
      await supabase.functions.invoke("sol-whale-scanner", {
        body: { action: "stop", sessionId },
      });
      addLog("Stopping scanner...");
    } catch (err: any) {
      addLog(`Stop error: ${err.message}`);
    }
  };

  const restartScanner = async () => {
    // Start a new session picking up from where the last one left off
    addLog("Restarting scanner from last position...");
    await startScanner();
  };

  const clearData = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setSessionId(null);
    setSession(null);
    setAddresses([]);
    setTotalAddresses(0);
    setScanLog([]);
    localStorage.removeItem(LS_SESSION_KEY);
  };

  const copyAllAddresses = () => {
    const allAddrs = addresses.map(a => a.address);
    navigator.clipboard.writeText(allAddrs.join("\n"));
    setCopied(true);
    addLog(`Copied ${allAddrs.length} addresses to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCsv = () => {
    const rows = [["Address", "Times Seen", "Total SOL", "Activity Types", "Sources", "Last Seen"]];
    for (const d of addresses) {
      rows.push([d.address, String(d.timesSeen), d.totalVolumeSol.toFixed(4), d.activityTypes.join(";"), d.sources.join(";"), d.lastSeen]);
    }
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `whale-scan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const elapsed = session?.startedAt ? Date.now() - new Date(session.startedAt).getTime() : 0;
  const DURATION_MS = 30 * 60 * 1000;
  const progressPct = Math.min((elapsed / DURATION_MS) * 100, 100);
  const slotsBehind = session?.lastSlot ? 0 : 0; // computed from status

  const sortedAddresses = addresses
    .filter(d => {
      if (filter === "all") return true;
      return d.activityTypes.some(t => t.toUpperCase().includes(filter.toUpperCase()));
    })
    .sort((a, b) => b.totalVolumeSol - a.totalVolumeSol);

  return (
    <div className="space-y-4 border-t border-zinc-800 pt-6 mt-8">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-orange-400">🐋 Whale Activity Scanner</h2>
        {isActive && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-400">Running on server</span>
          </span>
        )}
        {session?.status === "failed" && (
          <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-xs font-medium text-red-400">
            Failed — will auto-restart
          </span>
        )}
        {session?.status === "completed" && (
          <span className="px-2.5 py-1 rounded-full bg-zinc-500/10 border border-zinc-500/30 text-xs font-medium text-zinc-400">
            Completed
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        Runs entirely on the server — close this tab and scanning continues. All addresses saved to database. Auto-restarts on failure.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Min SOL</label>
          <input type="number" value={minSol} onChange={e => setMinSol(Number(e.target.value))}
            className="w-24 px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white"
            disabled={isActive} min={1} step={1} />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Slots/Call</label>
          <input type="number" value={slotsPerCall} onChange={e => setSlotsPerCall(Number(e.target.value))}
            className="w-20 px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white"
            disabled={isActive} min={1} max={20} step={1} />
        </div>
        {isActive ? (
          <button onClick={stopScanner}
            className="px-5 py-2 rounded-lg font-bold text-sm bg-red-600 text-white hover:bg-red-500">
            Stop Scanner
          </button>
        ) : session?.status === "failed" ? (
          <button onClick={restartScanner} disabled={starting}
            className="px-5 py-2 rounded-lg font-bold text-sm bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50">
            {starting ? "Starting..." : "Restart Scanner"}
          </button>
        ) : (
          <button onClick={startScanner} disabled={starting}
            className="px-5 py-2 rounded-lg font-bold text-sm bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-50">
            {starting ? "Starting..." : "Start Scanner"}
          </button>
        )}
        <button onClick={clearData} disabled={isActive}
          className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-zinc-800 hover:border-zinc-600 disabled:opacity-50">
          Clear
        </button>
      </div>

      {/* Copy/Export row */}
      <div className="flex flex-wrap gap-2">
        <button onClick={copyAllAddresses} disabled={totalAddresses === 0}
          className={`px-4 py-2 rounded-lg text-sm font-bold border disabled:opacity-50 ${
            copied ? "bg-green-600 border-green-500 text-white" : "bg-orange-500/10 border-orange-500 text-orange-400 hover:bg-orange-500/20"
          }`}>
          {copied ? "✓ Copied!" : `📋 Copy All ${totalAddresses} Addresses`}
        </button>
        <button onClick={exportCsv} disabled={totalAddresses === 0}
          className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-zinc-800 hover:border-zinc-600 disabled:opacity-50">
          📥 Export CSV
        </button>
      </div>

      {/* Timer */}
      {session && (
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>{formatTime(elapsed)} elapsed</span>
            <span>
              {session.errorCount > 0 && <span className="text-yellow-400 mr-2">{session.errorCount} errors</span>}
              {isActive && <span>{formatTime(Math.max(DURATION_MS - elapsed, 0))} remaining</span>}
            </span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Stats */}
      {session && (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          {[
            { label: "Unique Addresses", value: totalAddresses, color: "text-white" },
            { label: "Swaps", value: session.totalSwaps, color: "text-blue-400" },
            { label: "Transfers", value: session.totalTransfers, color: "text-green-400" },
            { label: "Total SOL", value: Number(session.totalVolume).toFixed(1), color: "text-orange-400" },
            { label: "Slots Scanned", value: session.totalSlotsScanned, color: "text-zinc-300" },
            { label: "Errors", value: session.errorCount, color: session.errorCount > 0 ? "text-red-400" : "text-green-400" },
            { label: "Credits", value: `~${session.creditsUsed}`, color: "text-zinc-400" },
          ].map((s, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {totalAddresses > 0 && (
        <div className="flex flex-wrap gap-2">
          {["all", "SWAP", "TRANSFER", "UNKNOWN"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${filter === f ? "bg-orange-500/20 border-orange-500 text-orange-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
              {f === "all" ? `All (${totalAddresses})` : f}
            </button>
          ))}
        </div>
      )}

      {/* Address table */}
      {sortedAddresses.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-900 z-10">
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Address</th>
                <th className="p-2 text-right">Times</th>
                <th className="p-2 text-right">Total SOL</th>
                <th className="p-2 text-left">Types</th>
                <th className="p-2 text-left">Sources</th>
                <th className="p-2 text-left">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {sortedAddresses.slice(0, 1000).map((d, i) => (
                <tr key={d.address} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="p-2 text-zinc-600">{i + 1}</td>
                  <td className="p-2 font-mono">
                    <a href={`https://solscan.io/account/${d.address}`} target="_blank" rel="noreferrer"
                      className="text-blue-400 hover:underline">{d.address.slice(0, 6)}...{d.address.slice(-4)}</a>
                  </td>
                  <td className="p-2 text-right">{d.timesSeen}</td>
                  <td className="p-2 text-right text-orange-400">{d.totalVolumeSol.toFixed(2)}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {d.activityTypes.map(t => (
                        <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          t === "SWAP" ? "bg-blue-500/20 text-blue-400" :
                          t === "TRANSFER" || t === "NATIVE_TRANSFER" ? "bg-green-500/20 text-green-400" :
                          "bg-zinc-700 text-zinc-400"
                        }`}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {d.sources.map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-2 text-zinc-500">{new Date(d.lastSeen).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedAddresses.length > 1000 && (
            <div className="p-3 text-center text-xs text-zinc-500">
              Showing 1,000 of {sortedAddresses.length} addresses. Use "Copy All" or "Export CSV" to get the full list.
            </div>
          )}
        </div>
      )}

      {/* Console */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg">
        <div className="px-3 py-2 border-b border-zinc-800 text-xs font-bold text-zinc-400">Scanner Log</div>
        <div className="h-48 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
          {scanLog.map((l, i) => (
            <div key={i} className={l.includes("Error") || l.includes("error") || l.includes("❌") ? "text-red-400" : l.includes("✅") || l.includes("🚀") ? "text-green-400" : l.includes("⚠️") ? "text-yellow-400" : "text-zinc-400"}>{l}</div>
          ))}
          {scanLog.length === 0 && <div className="text-zinc-600">No logs yet. Start the scanner to begin.</div>}
        </div>
      </div>
    </div>
  );
}
