import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WalletData {
  timesSeen: number;
  totalVolumeSol: number;
  activityTypes: string[];
  sources: string[];
  lastSeen: string;
}

interface ScannerStats {
  totalSwaps: number;
  totalTransfers: number;
  totalVolume: number;
  creditsUsed: number;
  blocksScanned: number;
  uniqueAddresses: number;
  slotsBehind: number;
}

const LS_KEY = "whale-scanner-state";
const LS_ADDRS_KEY = "whale-scanner-addresses";

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function loadAddresses(): Record<string, WalletData> {
  try {
    const raw = localStorage.getItem(LS_ADDRS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

function saveState(state: any) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}

function saveAddresses(addrs: Record<string, WalletData>) {
  try { localStorage.setItem(LS_ADDRS_KEY, JSON.stringify(addrs)); } catch {}
}

export default function WhaleScanner() {
  const saved = loadState();

  const [isRunning, setIsRunning] = useState(false);
  const [minSol, setMinSol] = useState(() => saved?.minSol ?? 10);
  const [slotsPerCall, setSlotsPerCall] = useState(() => saved?.slotsPerCall ?? 5);
  const [startTime, setStartTime] = useState<number | null>(() => saved?.startTime ?? null);
  const [elapsed, setElapsed] = useState(0);
  const [addresses, setAddresses] = useState<Record<string, WalletData>>(loadAddresses);
  const [stats, setStats] = useState<ScannerStats>(() => saved?.stats ?? {
    totalSwaps: 0, totalTransfers: 0, totalVolume: 0, creditsUsed: 0, blocksScanned: 0, uniqueAddresses: 0, slotsBehind: 0,
  });
  const [scanLog, setScanLog] = useState<string[]>(() => saved?.scanLog?.slice(-100) ?? []);
  const [filter, setFilter] = useState("all");
  const [copied, setCopied] = useState(false);

  // Use refs for mutable state accessed in polling to avoid stale closures
  const lastSlotRef = useRef<number>(saved?.lastSlot ?? 0);
  const addressesRef = useRef<Record<string, WalletData>>(loadAddresses());
  const statsRef = useRef<ScannerStats>(stats);
  const isRunningRef = useRef(false);
  const pollingRef = useRef(false); // prevent overlapping polls
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const DURATION_MS = 30 * 60 * 1000;

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setScanLog(prev => [...prev, `[${time}] ${msg}`].slice(-200));
  }, []);

  // Persist non-address state
  useEffect(() => {
    saveState({ minSol, slotsPerCall, startTime, lastSlot: lastSlotRef.current, stats, scanLog: scanLog.slice(-100) });
  }, [minSol, slotsPerCall, startTime, stats, scanLog]);

  // Persist addresses separately (can be large)
  useEffect(() => {
    saveAddresses(addresses);
    addressesRef.current = addresses;
  }, [addresses]);

  // Sync stats ref
  useEffect(() => { statsRef.current = stats; }, [stats]);

  // Timer
  useEffect(() => {
    if (isRunning && startTime) {
      timerRef.current = setInterval(() => {
        const e = Date.now() - startTime;
        setElapsed(e);
        if (e >= DURATION_MS) stopScanner();
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning, startTime]);

  const poll = useCallback(async () => {
    if (!isRunningRef.current || pollingRef.current) return;
    pollingRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke("sol-whale-scanner", {
        body: { minSolAmount: minSol, fromSlot: lastSlotRef.current, slotsPerCall },
      });

      if (error) { addLog(`Error: ${error.message}`); pollingRef.current = false; return; }
      if (!data) { pollingRef.current = false; return; }
      if (data.error) { addLog(`RPC error: ${data.error}`); pollingRef.current = false; return; }
      if (data.waiting) { pollingRef.current = false; return; }

      // Update last scanned slot
      if (data.lastScannedSlot) lastSlotRef.current = data.lastScannedSlot;

      const wallets: any[] = data.wallets || [];
      const processed = data.slotsProcessed || 0;
      const qualified = data.qualifiedTxCount || 0;
      const totalTx = data.totalTxProcessed || 0;

      // Update stats
      setStats(prev => {
        const next = {
          ...prev,
          blocksScanned: prev.blocksScanned + processed,
          creditsUsed: prev.creditsUsed + (data.creditsUsed || 2),
          totalSwaps: prev.totalSwaps + wallets.filter((w: any) => w.type === "SWAP").length,
          totalTransfers: prev.totalTransfers + wallets.filter((w: any) => w.type === "TRANSFER" || w.type === "NATIVE_TRANSFER").length,
          totalVolume: prev.totalVolume + wallets.reduce((s: number, w: any) => s + (w.amountSol || 0), 0),
          slotsBehind: data.slotsBehind || 0,
        };
        return next;
      });

      // Merge addresses
      if (wallets.length > 0) {
        setAddresses(prev => {
          const next = { ...prev };
          for (const w of wallets) {
            if (!w.address) continue;
            const existing = next[w.address];
            if (existing) {
              existing.timesSeen += 1;
              existing.totalVolumeSol += w.amountSol || 0;
              if (!existing.activityTypes.includes(w.type)) existing.activityTypes.push(w.type);
              if (!existing.sources.includes(w.source)) existing.sources.push(w.source);
              existing.lastSeen = new Date().toLocaleTimeString();
            } else {
              next[w.address] = {
                timesSeen: 1,
                totalVolumeSol: w.amountSol || 0,
                activityTypes: [w.type],
                sources: [w.source],
                lastSeen: new Date().toLocaleTimeString(),
              };
            }
          }
          return next;
        });
      }

      // Update unique count
      setStats(prev => ({ ...prev, uniqueAddresses: Object.keys(addressesRef.current).length }));

      if (wallets.length > 0) {
        addLog(`Slots ${data.lastScannedSlot - processed + 1}→${data.lastScannedSlot}: ${wallets.length} whales from ${qualified}/${totalTx} txs | ${data.slotsBehind} behind`);
      } else if (processed > 0) {
        addLog(`Slots scanned: ${processed} | ${totalTx} txs | 0 whales | ${data.slotsBehind} behind`);
      }
    } catch (err: any) {
      addLog(`Poll error: ${err.message}`);
    }

    pollingRef.current = false;
  }, [minSol, slotsPerCall, addLog]);

  const startScanner = () => {
    const now = Date.now();
    setIsRunning(true);
    isRunningRef.current = true;
    setStartTime(now);
    setElapsed(0);
    addLog(`Scanner started (min ${minSol} SOL, ${slotsPerCall} slots/call, 30 min)`);
    poll(); // immediate first poll
    intervalRef.current = setInterval(poll, 2000); // poll every 2s for faster catch-up
  };

  const stopScanner = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    addLog(`Scanner stopped. ${Object.keys(addressesRef.current).length} unique addresses collected.`);
  };

  const clearData = () => {
    setAddresses({});
    addressesRef.current = {};
    setStats({ totalSwaps: 0, totalTransfers: 0, totalVolume: 0, creditsUsed: 0, blocksScanned: 0, uniqueAddresses: 0, slotsBehind: 0 });
    setScanLog([]);
    lastSlotRef.current = 0;
    setStartTime(null);
    setElapsed(0);
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_ADDRS_KEY);
  };

  const copyAllAddresses = () => {
    const allAddrs = Object.keys(addresses);
    navigator.clipboard.writeText(allAddrs.join("\n"));
    setCopied(true);
    addLog(`Copied ALL ${allAddrs.length} addresses to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCsv = () => {
    const rows = [["Address", "Times Seen", "Total SOL", "Activity Types", "Sources", "Last Seen"]];
    for (const [addr, d] of Object.entries(addresses)) {
      rows.push([addr, String(d.timesSeen), d.totalVolumeSol.toFixed(4), d.activityTypes.join(";"), d.sources.join(";"), d.lastSeen]);
    }
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `whale-scan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const copyAddressesOnly = () => {
    // Copy just addresses, one per line, no metadata - ready to paste into destination wallets
    const allAddrs = Object.keys(addresses);
    navigator.clipboard.writeText(allAddrs.join("\n"));
    setCopied(true);
    addLog(`Copied ${allAddrs.length} addresses (plain list)`);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const progressPct = Math.min((elapsed / DURATION_MS) * 100, 100);
  const uniqueCount = Object.keys(addresses).length;

  const sortedAddresses = Object.entries(addresses)
    .filter(([, d]) => {
      if (filter === "all") return true;
      return d.activityTypes.some(t => t.toUpperCase().includes(filter.toUpperCase()));
    })
    .sort((a, b) => b[1].totalVolumeSol - a[1].totalVolumeSol);

  return (
    <div className="space-y-4 border-t border-zinc-800 pt-6 mt-8">
      <h2 className="text-xl font-bold text-orange-400">🐋 Whale Activity Scanner</h2>
      <p className="text-xs text-zinc-500">
        Scans EVERY Solana slot sequentially — no transactions missed. Captures swaps (Jupiter, Raydex, Orca, Phantom, Axiom), bridges, native transfers, and all DeFi trades above threshold.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Min SOL</label>
          <input type="number" value={minSol} onChange={e => setMinSol(Number(e.target.value))}
            className="w-24 px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white"
            disabled={isRunning} min={1} step={1} />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Slots/Call</label>
          <input type="number" value={slotsPerCall} onChange={e => setSlotsPerCall(Number(e.target.value))}
            className="w-20 px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white"
            disabled={isRunning} min={1} max={20} step={1} />
        </div>
        <button onClick={isRunning ? stopScanner : startScanner}
          className={`px-5 py-2 rounded-lg font-bold text-sm ${isRunning ? "bg-red-600 text-white hover:bg-red-500" : "bg-orange-500 text-black hover:bg-orange-400"}`}>
          {isRunning ? "Stop Scanner" : "Start Scanner"}
        </button>
        <button onClick={clearData} disabled={isRunning}
          className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-zinc-800 hover:border-zinc-600 disabled:opacity-50">
          Clear
        </button>
      </div>

      {/* Copy/Export row */}
      <div className="flex flex-wrap gap-2">
        <button onClick={copyAddressesOnly} disabled={uniqueCount === 0}
          className={`px-4 py-2 rounded-lg text-sm font-bold border disabled:opacity-50 ${
            copied ? "bg-green-600 border-green-500 text-white" : "bg-orange-500/10 border-orange-500 text-orange-400 hover:bg-orange-500/20"
          }`}>
          {copied ? "✓ Copied!" : `📋 Copy All ${uniqueCount} Addresses`}
        </button>
        <button onClick={exportCsv} disabled={uniqueCount === 0}
          className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-zinc-800 hover:border-zinc-600 disabled:opacity-50">
          📥 Export CSV
        </button>
      </div>

      {/* Timer + slots behind indicator */}
      {(isRunning || elapsed > 0) && (
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>{formatTime(elapsed)} elapsed</span>
            <span>{stats.slotsBehind > 0 && <span className="text-yellow-400 mr-2">{stats.slotsBehind} slots behind</span>}{formatTime(Math.max(DURATION_MS - elapsed, 0))} remaining</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        {[
          { label: "Unique Addresses", value: uniqueCount, color: "text-white" },
          { label: "Swaps", value: stats.totalSwaps, color: "text-blue-400" },
          { label: "Transfers", value: stats.totalTransfers, color: "text-green-400" },
          { label: "Total SOL", value: stats.totalVolume.toFixed(1), color: "text-orange-400" },
          { label: "Slots Scanned", value: stats.blocksScanned, color: "text-zinc-300" },
          { label: "Slots Behind", value: stats.slotsBehind, color: stats.slotsBehind > 50 ? "text-red-400" : "text-green-400" },
          { label: "Credits", value: `~${stats.creditsUsed}`, color: "text-zinc-400" },
        ].map((s, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      {uniqueCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {["all", "SWAP", "TRANSFER", "UNKNOWN"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${filter === f ? "bg-orange-500/20 border-orange-500 text-orange-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
              {f === "all" ? `All (${uniqueCount})` : f}
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
              {sortedAddresses.slice(0, 1000).map(([addr, d], i) => (
                <tr key={addr} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="p-2 text-zinc-600">{i + 1}</td>
                  <td className="p-2 font-mono">
                    <a href={`https://solscan.io/account/${addr}`} target="_blank" rel="noreferrer"
                      className="text-blue-400 hover:underline">{addr.slice(0, 6)}...{addr.slice(-4)}</a>
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
                  <td className="p-2 text-zinc-500">{d.lastSeen}</td>
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
            <div key={i} className={l.includes("Error") || l.includes("error") ? "text-red-400" : l.includes("whales") ? "text-green-400" : "text-zinc-400"}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
