import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
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
  const [holderMint, setHolderMint] = useState(() => localStorage.getItem("compressed-holder-mint") || "");

  const updateField = (key: string, setter: (v: string) => void) => (v: string) => {
    setter(v);
    localStorage.setItem(key, v);
  };
  const updateSourceKey = updateField("compressed-source-key", setSourceKey);
  const updateMint = updateField("compressed-mint", setMintAddress);
  const updateAmount = updateField("compressed-amount", setAmount);
  const updateDestinations = updateField("compressed-destinations", setDestinations);
  const updateHolderMint = updateField("compressed-holder-mint", setHolderMint);

  const [randomizeAmount, setRandomizeAmount] = useState(true);
  const [running, setRunning] = useState(false);
  const [fetchingHolders, setFetchingHolders] = useState(false);
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
      try { localStorage.setItem("compressed-logs", JSON.stringify(next.slice(-500))); } catch {}
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

  const callEdgeFunction = async (name: string, body: any) => {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      try {
        const errBody = await error.context?.json?.();
        if (errBody?.error) throw new Error(errBody.error);
      } catch {}
      throw new Error(error.message || "Edge function error");
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  // Fetch all holders from a token mint
  const fetchHolders = async () => {
    if (!holderMint.trim()) {
      addLog("Enter a token mint address to fetch holders", "error");
      return;
    }
    setFetchingHolders(true);
    addLog(`Fetching all holders for ${holderMint.trim()}...`);

    try {
      const data = await callEdgeFunction("fetch-token-holders", { mintAddress: holderMint.trim() });
      const holders: string[] = data.holders || [];
      addLog(`Found ${holders.length} unique holders (${data.pages} pages fetched)`, "success");

      if (holders.length > 0) {
        const newDest = holders.join("\n");
        updateDestinations(newDest);
        addLog(`Loaded ${holders.length} wallets into destination field`, "success");
      } else {
        addLog("No holders found for this token", "warn");
      }
    } catch (err: any) {
      addLog(`Error fetching holders: ${err.message}`, "error");
    }

    setFetchingHolders(false);
  };

  const startDistribution = async () => {
    const destList = destinations.trim().split("\n").map(d => d.trim()).filter(Boolean);
    if (!sourceKey || !mintAddress || !destList.length) {
      addLog("Missing required fields", "error");
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
      const poolResult = await callEdgeFunction("compressed-distribute", {
        sourcePrivateKey: sourceKey,
        mintAddress,
        destinations: destList.slice(0, 10), // only need a small batch for pool check
        amountPerWallet: parseFloat(amount),
        action: "check-pool",
      });
      poolResult.logs?.forEach((l: string) => addLog(l));
      if (poolResult.costSol > 0) {
        addLog(`Pool setup cost: ${poolResult.costSol.toFixed(6)} SOL`, "info");
      }

      // Step 2: Compress tokens from ATA
      addLog("Step 2/3: Compressing tokens from ATA...");
      const compressResult = await callEdgeFunction("compressed-distribute", {
        sourcePrivateKey: sourceKey,
        mintAddress,
        destinations: destList.slice(0, 10),
        amountPerWallet: parseFloat(amount),
        action: "compress",
      });
      compressResult.logs?.forEach((l: string) => addLog(l));
      addLog(`Compression cost: ${compressResult.costSol?.toFixed(6) || "0"} SOL`, "info");

      // Step 3: Distribute compressed tokens in batches with retry
      addLog(`Step 3/3: Distributing to ${destList.length} wallets...`);
      const BATCH_SIZE = 10;
      const MAX_RETRIES = 3;
      const allResults: DistResult[] = [];
      let totalSuccess = 0;
      let totalFailed = 0;
      let totalTxCount = 0;
      let totalCostSol = 0;

      // First pass
      let pendingWallets = [...destList];
      let retryRound = 0;

      while (pendingWallets.length > 0 && retryRound <= MAX_RETRIES) {
        if (retryRound > 0) {
          addLog(`\n🔄 Retry round ${retryRound}/${MAX_RETRIES} — ${pendingWallets.length} wallets remaining...`, "warn");
          // Small delay before retry
          await new Promise(r => setTimeout(r, 2000));
        }

        const failedThisRound: string[] = [];

        for (let i = 0; i < pendingWallets.length; i += BATCH_SIZE) {
          const batch = pendingWallets.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(pendingWallets.length / BATCH_SIZE);
          addLog(`${retryRound > 0 ? "[Retry] " : ""}Batch ${batchNum}/${totalBatches} (${batch.length} wallets)...`);

          try {
            // Generate per-wallet random amounts if enabled
            const baseAmount = parseFloat(amount);
            let perWalletAmounts: number[] | undefined;
            if (randomizeAmount) {
              perWalletAmounts = batch.map(() => {
                const randomOffset = Math.floor(Math.random() * 10) + 1; // 1-10
                return baseAmount + randomOffset;
              });
            }

            const distResult = await callEdgeFunction("compressed-distribute", {
              sourcePrivateKey: sourceKey,
              mintAddress,
              destinations: batch,
              amountPerWallet: baseAmount,
              perWalletAmounts,
              action: "distribute",
            });
            distResult.logs?.forEach((l: string) => addLog(l));

            if (distResult.results) {
              for (const r of distResult.results) {
                if (r.status === "success") {
                  totalSuccess++;
                  allResults.push(r);
                } else {
                  failedThisRound.push(r.destination);
                  // Only add to results on final retry
                  if (retryRound === MAX_RETRIES) {
                    totalFailed++;
                    allResults.push(r);
                  }
                }
              }
              persistResults(allResults);
            }
            if (distResult.stats) {
              totalCostSol += distResult.stats.totalCostSol || 0;
            }
            if (distResult.signatures) {
              totalTxCount += distResult.signatures.length;
            }
          } catch (batchErr: any) {
            addLog(`Batch ${batchNum} error: ${batchErr.message}`, "error");
            failedThisRound.push(...batch);
            if (retryRound === MAX_RETRIES) {
              totalFailed += batch.length;
              batch.forEach(d => allResults.push({ destination: d, status: "failed", error: batchErr.message }));
              persistResults(allResults);
            }
          }

          // Update running stats
          persistStats({
            total: destList.length,
            success: totalSuccess,
            failed: retryRound === MAX_RETRIES ? totalFailed : 0,
            pendingRetry: failedThisRound.length,
            totalTxCount,
            totalCostSol,
            costPerWallet: destList.length > 0 ? totalCostSol / destList.length : 0,
          });
        }

        pendingWallets = failedThisRound;
        retryRound++;
      }

      // Final stats
      const finalStats = {
        total: destList.length,
        success: totalSuccess,
        failed: totalFailed,
        totalTxCount,
        totalCostSol,
        costPerWallet: destList.length > 0 ? totalCostSol / destList.length : 0,
      };
      persistStats(finalStats);
      addLog(`\n✅ Distribution complete!`, "success");
      addLog(`Total: ${totalSuccess}/${destList.length} wallets success, ${totalFailed} failed`, totalFailed > 0 ? "warn" : "success");
      addLog(`Total transactions: ${totalTxCount}`, "success");
      addLog(`Total cost: ${totalCostSol.toFixed(6)} SOL`, "success");
    } catch (err: any) {
      addLog(`Error: ${err.message}`, "error");
    }

    setRunning(false);
  };

  // Retry only failed wallets from previous run
  const retryFailed = async () => {
    const failedWallets = results.filter(r => r.status === "failed").map(r => r.destination);
    if (!failedWallets.length) {
      addLog("No failed wallets to retry", "warn");
      return;
    }
    addLog(`Retrying ${failedWallets.length} failed wallets...`, "warn");
    // Set destinations to only failed wallets and restart
    updateDestinations(failedWallets.join("\n"));
    // Small delay for state to update
    await new Promise(r => setTimeout(r, 100));
    startDistribution();
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
  const failedCount = results.filter(r => r.status === "failed").length;
  const destCount = destinations.trim().split("\n").filter(Boolean).length;

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

        {/* Fetch Holders */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-bold text-orange-400 flex items-center gap-2">
            <Download className="h-4 w-4" /> Fetch Token Holders
          </h3>
          <p className="text-xs text-zinc-500">
            Enter a token mint address to fetch all holders and auto-populate destination wallets
          </p>
          <div className="flex gap-2">
            <input
              value={holderMint}
              onChange={e => updateHolderMint(e.target.value)}
              placeholder="Token mint address (e.g. NV2RYH954cTJ3ckFUpvfqaQXU4ARqqDH3562nFSpump)"
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-black border border-zinc-700 text-white font-mono"
              disabled={fetchingHolders || running}
            />
            <button
              onClick={fetchHolders}
              disabled={fetchingHolders || running || !holderMint.trim()}
              className="px-4 py-2 rounded-lg font-bold text-sm bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
              {fetchingHolders ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" /> Fetching...
                </>
              ) : (
                "Fetch Holders"
              )}
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Source Private Key (bs58)</label>
            <input value={sourceKey} onChange={e => updateSourceKey(e.target.value)} type="password"
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white" disabled={running} />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Token Mint Address (to distribute)</label>
            <input value={mintAddress} onChange={e => updateMint(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white font-mono" disabled={running} />
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Amount per wallet (token units)</label>
          <input value={amount} onChange={e => updateAmount(e.target.value)} type="number" step="0.000001"
            className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white" disabled={running} />
          <label className="flex items-center gap-2 mt-2 text-xs text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={randomizeAmount}
              onChange={e => setRandomizeAmount(e.target.checked)}
              className="accent-orange-500"
              disabled={running}
            />
            Randomize amount (±1-10 range around base) — each wallet gets a different amount
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-zinc-500">Destination Wallets (one per line)</label>
            <span className="text-xs text-zinc-600">{destCount} wallets</span>
          </div>
          <textarea value={destinations} onChange={e => updateDestinations(e.target.value)} rows={10}
            className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white font-mono"
            placeholder={"wallet1address\nwallet2address\nwallet3address"} disabled={running} />
        </div>

        <div className="flex gap-3 flex-wrap">
          <button onClick={startDistribution} disabled={running}
            className="px-6 py-2 rounded-lg font-bold bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-50">
            {running ? "Running..." : `Start Distribution${destCount > 0 ? ` (${destCount})` : ""}`}
          </button>
          {failedCount > 0 && !running && (
            <button onClick={retryFailed}
              className="px-4 py-2 rounded-lg font-bold text-sm bg-yellow-600 text-black hover:bg-yellow-500 flex items-center gap-2">
              <RefreshCw className="h-3 w-3" /> Retry {failedCount} Failed
            </button>
          )}
          <button onClick={() => { setLogs([]); localStorage.removeItem("compressed-logs"); persistResults([]); persistStats({ total: 0, success: 0, failed: 0, totalCostSol: 0, costPerWallet: 0 }); }}
            disabled={running}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-zinc-800 hover:border-zinc-600 disabled:opacity-50">
            Clear
          </button>
        </div>

        {/* Stats */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-zinc-500">Wallets</div>
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
              <div className="text-2xl font-bold text-blue-400">{stats.totalTxCount || 0}</div>
              <div className="text-xs text-zinc-500">Total Txs</div>
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
