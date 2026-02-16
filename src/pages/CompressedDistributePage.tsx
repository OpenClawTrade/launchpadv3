import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download, RefreshCw, Copy, ExternalLink, Trash2, Wallet } from "lucide-react";
import WhaleScanner from "@/components/admin/WhaleScanner";
import { useNavigate } from "react-router-dom";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "@/hooks/use-toast";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import bs58 from "bs58";

const ADMIN_PASSWORD = "tuna";
const BATCH_SIZE = 20;
const HELIUS_PUBLIC_RPC = "https://mainnet.helius-rpc.com/?api-key=15319bf4-4506-4808-8780-5764b2338e1a";

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

// Resume tracking helpers
const SENT_WALLETS_KEY = "compressed-sent-wallets";
const getSentWallets = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(SENT_WALLETS_KEY) || "[]")); } catch { return new Set(); }
};
const persistSentWallets = (s: Set<string>) => {
  try { localStorage.setItem(SENT_WALLETS_KEY, JSON.stringify([...s])); } catch {}
};

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
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);
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
  const [sentWalletsCount, setSentWalletsCount] = useState(() => getSentWallets().size);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Derive source wallet public key from private key
  const sourceWalletAddress = useMemo(() => {
    if (!sourceKey.trim()) return null;
    try {
      const decoded = bs58.decode(sourceKey.trim());
      const kp = Keypair.fromSecretKey(decoded);
      return kp.publicKey.toBase58();
    } catch {
      return null;
    }
  }, [sourceKey]);

  // Fetch token balance when source key or mint changes
  const fetchTokenBalance = useCallback(async () => {
    if (!sourceWalletAddress || !mintAddress.trim()) {
      setTokenBalance(null);
      return;
    }
    setFetchingBalance(true);
    try {
      const connection = new Connection(HELIUS_PUBLIC_RPC, "confirmed");
      const mint = new PublicKey(mintAddress.trim());
      const owner = new PublicKey(sourceWalletAddress);
      const ata = await getAssociatedTokenAddress(mint, owner);
      const resp = await connection.getTokenAccountBalance(ata);
      setTokenBalance(resp.value.uiAmountString || "0");
    } catch {
      setTokenBalance("N/A");
    }
    setFetchingBalance(false);
  }, [sourceWalletAddress, mintAddress]);

  useEffect(() => {
    fetchTokenBalance();
  }, [fetchTokenBalance]);

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

  const fetchHolders = async () => {
    if (!holderMint.trim()) {
      addLog("Enter a token mint address to fetch holders", "error");
      return;
    }
    setFetchingHolders(true);
    addLog(`Fetching all holders for ${holderMint.trim()}...`);
    try {
      // Check cache first
      const cacheKey = `compressed-holders-${holderMint.trim()}`;
      const cached = localStorage.getItem(cacheKey);
      let holders: string[] = [];

      if (cached) {
        holders = JSON.parse(cached);
        addLog(`Loaded ${holders.length} holders from cache`, "success");
      } else {
        const data = await callEdgeFunction("fetch-token-holders", { mintAddress: holderMint.trim() });
        holders = data.holders || [];
        addLog(`Found ${holders.length} unique holders (${data.pages} pages fetched)`, "success");
        // Cache the results
        if (holders.length > 0) {
          try { localStorage.setItem(cacheKey, JSON.stringify(holders)); } catch {}
        }
      }

      if (holders.length > 0) {
        // Filter out already-sent wallets
        const sentWallets = getSentWallets();
        const filtered = holders.filter(h => !sentWallets.has(h));
        const newDest = filtered.join("\n");
        updateDestinations(newDest);
        addLog(`Loaded ${filtered.length} wallets into destination field (${holders.length - filtered.length} already sent, skipped)`, "success");
      } else {
        addLog("No holders found for this token", "warn");
      }
    } catch (err: any) {
      addLog(`Error fetching holders: ${err.message}`, "error");
    }
    setFetchingHolders(false);
  };

  const handleCopy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) toast({ title: "Copied!", description: text.slice(0, 20) + "..." });
  };

  const startDistribution = async (resumeMode = false) => {
    const allDests = destinations.trim().split("\n").map(d => d.trim()).filter(Boolean);
    if (!sourceKey || !mintAddress || !allDests.length) {
      addLog("Missing required fields", "error");
      return;
    }
    const invalid = allDests.filter(d => !isValidSolanaAddress(d));
    if (invalid.length) {
      invalid.forEach(a => addLog(`Invalid address: ${a}`, "error"));
      return;
    }

    // Resume: filter out already-sent wallets
    const sentWallets = resumeMode ? getSentWallets() : new Set<string>();
    const destList = resumeMode ? allDests.filter(d => !sentWallets.has(d)) : allDests;

    if (resumeMode && destList.length === 0) {
      addLog("All wallets already sent! Use Reset Progress to start fresh.", "success");
      return;
    }
    if (resumeMode) {
      addLog(`Resuming: ${sentWallets.size} already sent, ${destList.length} remaining`, "warn");
    }

    setRunning(true);
    if (!resumeMode) {
      setLogs([]); localStorage.removeItem("compressed-logs");
      persistResults([]);
      persistStats({ total: allDests.length, success: 0, failed: 0, totalCostSol: 0, costPerWallet: 0 });
      // Clear sent wallets on fresh start
      localStorage.removeItem(SENT_WALLETS_KEY);
      setSentWalletsCount(0);
    }

    try {
      // Step 1: Ensure token pool exists
      addLog("Step 1/3: Checking token pool...");
      const poolResult = await callEdgeFunction("compressed-distribute", {
        sourcePrivateKey: sourceKey,
        mintAddress,
        destinations: destList.slice(0, 10),
        amountPerWallet: parseFloat(amount),
        action: "check-pool",
      });
      poolResult.logs?.forEach((l: string) => addLog(l));
      if (poolResult.costSol > 0) addLog(`Pool setup cost: ${poolResult.costSol.toFixed(6)} SOL`, "info");

      // Step 2: Compress tokens
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

      // Step 3: Distribute in parallel batches
      addLog(`Step 3/3: Distributing to ${destList.length} wallets (batch size: ${BATCH_SIZE})...`);
      const MAX_RETRIES = 3;
      const allResults: DistResult[] = resumeMode ? [...results] : [];
      let totalSuccess = resumeMode ? sentWallets.size : 0;
      let totalFailed = 0;
      let totalTxCount = 0;
      let totalCostSol = 0;

      let pendingWallets = [...destList];
      let retryRound = 0;

      while (pendingWallets.length > 0 && retryRound <= MAX_RETRIES) {
        if (retryRound > 0) {
          addLog(`\n🔄 Retry round ${retryRound}/${MAX_RETRIES} — ${pendingWallets.length} wallets remaining...`, "warn");
          await new Promise(r => setTimeout(r, 2000));
        }

        const failedThisRound: string[] = [];

        for (let i = 0; i < pendingWallets.length; i += BATCH_SIZE) {
          const batch = pendingWallets.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(pendingWallets.length / BATCH_SIZE);
          addLog(`${retryRound > 0 ? "[Retry] " : ""}Batch ${batchNum}/${totalBatches} (${batch.length} wallets)...`);

          try {
            const baseAmount = parseFloat(amount);
            let perWalletAmounts: number[] | undefined;
            if (randomizeAmount) {
              perWalletAmounts = batch.map(() => baseAmount + Math.floor(Math.random() * 10) + 1);
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
                  // Track sent wallet for resume
                  sentWallets.add(r.destination);
                } else {
                  failedThisRound.push(r.destination);
                  if (retryRound === MAX_RETRIES) {
                    totalFailed++;
                    allResults.push(r);
                  }
                }
              }
              persistResults(allResults);
              persistSentWallets(sentWallets);
              setSentWalletsCount(sentWallets.size);
            }
            if (distResult.stats) totalCostSol += distResult.stats.totalCostSol || 0;
            if (distResult.signatures) totalTxCount += distResult.signatures.length;
          } catch (batchErr: any) {
            addLog(`Batch ${batchNum} error: ${batchErr.message}`, "error");
            failedThisRound.push(...batch);
            if (retryRound === MAX_RETRIES) {
              totalFailed += batch.length;
              batch.forEach(d => allResults.push({ destination: d, status: "failed", error: batchErr.message }));
              persistResults(allResults);
            }
          }

          persistStats({
            total: allDests.length,
            success: totalSuccess,
            failed: retryRound === MAX_RETRIES ? totalFailed : 0,
            pendingRetry: failedThisRound.length,
            totalTxCount,
            totalCostSol,
            costPerWallet: allDests.length > 0 ? totalCostSol / allDests.length : 0,
          });

          // Small delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < pendingWallets.length) {
            await new Promise(r => setTimeout(r, 500));
          }
        }

        pendingWallets = failedThisRound;
        retryRound++;
      }

      const finalStats = {
        total: allDests.length,
        success: totalSuccess,
        failed: totalFailed,
        totalTxCount,
        totalCostSol,
        costPerWallet: allDests.length > 0 ? totalCostSol / allDests.length : 0,
      };
      persistStats(finalStats);
      addLog(`\n✅ Distribution complete!`, "success");
      addLog(`Total: ${totalSuccess}/${allDests.length} wallets success, ${totalFailed} failed`, totalFailed > 0 ? "warn" : "success");
      addLog(`Total transactions: ${totalTxCount}`, "success");
      addLog(`Total cost: ${totalCostSol.toFixed(6)} SOL`, "success");
    } catch (err: any) {
      addLog(`Error: ${err.message}`, "error");
    }

    setRunning(false);
  };

  const retryFailed = async () => {
    const failedWallets = results.filter(r => r.status === "failed").map(r => r.destination);
    if (!failedWallets.length) {
      addLog("No failed wallets to retry", "warn");
      return;
    }
    addLog(`Retrying ${failedWallets.length} failed wallets...`, "warn");
    updateDestinations(failedWallets.join("\n"));
    await new Promise(r => setTimeout(r, 100));
    startDistribution();
  };

  const resetProgress = () => {
    localStorage.removeItem(SENT_WALLETS_KEY);
    setSentWalletsCount(0);
    addLog("Resume progress cleared. Next run will start fresh.", "info");
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

  // Single transfer state
  const [activeTab, setActiveTab] = useState<"batch" | "single">(() => (localStorage.getItem("compressed-tab") as any) || "batch");
  const [singleSourceKey, setSingleSourceKey] = useState(() => localStorage.getItem("single-source-key") || "");
  const [singleMint, setSingleMint] = useState(() => localStorage.getItem("single-mint") || "");
  const [singleDest, setSingleDest] = useState(() => localStorage.getItem("single-dest") || "");
  const [singleAmount, setSingleAmount] = useState(() => localStorage.getItem("single-amount") || "1");
  const [singleRunning, setSingleRunning] = useState(false);
  const [singleLogs, setSingleLogs] = useState<LogEntry[]>([]);
  const [singleResult, setSingleResult] = useState<DistResult | null>(null);

  const updateSingleField = (key: string, setter: (v: string) => void) => (v: string) => {
    setter(v);
    localStorage.setItem(key, v);
  };
  const updateSingleSourceKey = updateSingleField("single-source-key", setSingleSourceKey);
  const updateSingleMint = updateSingleField("single-mint", setSingleMint);
  const updateSingleDest = updateSingleField("single-dest", setSingleDest);
  const updateSingleAmount = updateSingleField("single-amount", setSingleAmount);

  const singleWalletAddress = useMemo(() => {
    if (!singleSourceKey.trim()) return null;
    try {
      const decoded = bs58.decode(singleSourceKey.trim());
      const kp = Keypair.fromSecretKey(decoded);
      return kp.publicKey.toBase58();
    } catch { return null; }
  }, [singleSourceKey]);

  const [singleBalance, setSingleBalance] = useState<string | null>(null);
  const [fetchingSingleBalance, setFetchingSingleBalance] = useState(false);

  const fetchSingleBalance = useCallback(async () => {
    if (!singleWalletAddress || !singleMint.trim()) { setSingleBalance(null); return; }
    setFetchingSingleBalance(true);
    try {
      const connection = new Connection(HELIUS_PUBLIC_RPC, "confirmed");
      const mint = new PublicKey(singleMint.trim());
      const owner = new PublicKey(singleWalletAddress);
      const ata = await getAssociatedTokenAddress(mint, owner);
      const resp = await connection.getTokenAccountBalance(ata);
      setSingleBalance(resp.value.uiAmountString || "0");
    } catch { setSingleBalance("N/A"); }
    setFetchingSingleBalance(false);
  }, [singleWalletAddress, singleMint]);

  useEffect(() => { fetchSingleBalance(); }, [fetchSingleBalance]);

  const addSingleLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString();
    setSingleLogs(prev => [...prev, { time, message, type }]);
  }, []);

  const startSingleTransfer = async () => {
    if (!singleSourceKey || !singleMint || !singleDest || !singleAmount) {
      addSingleLog("All fields are required", "error"); return;
    }
    if (!isValidSolanaAddress(singleDest.trim())) {
      addSingleLog("Invalid destination address", "error"); return;
    }
    setSingleRunning(true);
    setSingleLogs([]);
    setSingleResult(null);

    try {
      addSingleLog("Step 1/3: Checking token pool...");
      const poolResult = await callEdgeFunction("compressed-distribute", {
        sourcePrivateKey: singleSourceKey, mintAddress: singleMint,
        destinations: [singleDest.trim()], amountPerWallet: parseFloat(singleAmount), action: "check-pool",
      });
      poolResult.logs?.forEach((l: string) => addSingleLog(l));

      addSingleLog("Step 2/3: Compressing tokens...");
      const compressResult = await callEdgeFunction("compressed-distribute", {
        sourcePrivateKey: singleSourceKey, mintAddress: singleMint,
        destinations: [singleDest.trim()], amountPerWallet: parseFloat(singleAmount), action: "compress",
      });
      compressResult.logs?.forEach((l: string) => addSingleLog(l));

      addSingleLog("Step 3/3: Sending compressed transfer...");
      const distResult = await callEdgeFunction("compressed-distribute", {
        sourcePrivateKey: singleSourceKey, mintAddress: singleMint,
        destinations: [singleDest.trim()], amountPerWallet: parseFloat(singleAmount), action: "distribute",
      });
      distResult.logs?.forEach((l: string) => addSingleLog(l));

      if (distResult.results?.[0]) {
        setSingleResult(distResult.results[0]);
        if (distResult.results[0].status === "success") {
          addSingleLog(`✅ Transfer complete! Sig: ${distResult.results[0].signature}`, "success");
        } else {
          addSingleLog(`❌ Transfer failed: ${distResult.results[0].error}`, "error");
        }
      }
      if (distResult.stats) {
        addSingleLog(`Cost: ${distResult.stats.totalCostSol?.toFixed(6)} SOL`, "info");
      }
    } catch (err: any) {
      addSingleLog(`Error: ${err.message}`, "error");
    }
    setSingleRunning(false);
    fetchSingleBalance();
  };

  const logColor = { info: "text-zinc-400", success: "text-green-400", error: "text-red-400", warn: "text-yellow-400" };
  const failedCount = results.filter(r => r.status === "failed").length;
  const destCount = destinations.trim().split("\n").filter(Boolean).length;
  const hasResumeData = sentWalletsCount > 0 && sentWalletsCount < destCount;

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

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          <button
            onClick={() => { setActiveTab("batch"); localStorage.setItem("compressed-tab", "batch"); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-colors ${activeTab === "batch" ? "bg-orange-500 text-black" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            Batch Distribution
          </button>
          <button
            onClick={() => { setActiveTab("single"); localStorage.setItem("compressed-tab", "single"); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-colors ${activeTab === "single" ? "bg-orange-500 text-black" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            Single Transfer
          </button>
        </div>

        {activeTab === "single" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Source Private Key (bs58)</label>
                <input value={singleSourceKey} onChange={e => updateSingleSourceKey(e.target.value)} type="password"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white" disabled={singleRunning} />
                {singleWalletAddress && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs bg-zinc-900/50 border border-zinc-800 rounded-lg px-2 py-1.5">
                    <Wallet className="h-3 w-3 text-orange-400 shrink-0" />
                    <span className="text-zinc-400 font-mono break-all">{singleWalletAddress}</span>
                    <button onClick={() => handleCopy(singleWalletAddress)} className="text-zinc-600 hover:text-zinc-300 shrink-0"><Copy className="h-3 w-3" /></button>
                    <a href={`https://solscan.io/account/${singleWalletAddress}`} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-blue-400 shrink-0"><ExternalLink className="h-3 w-3" /></a>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Token Mint Address</label>
                <input value={singleMint} onChange={e => updateSingleMint(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white font-mono" disabled={singleRunning} />
                {singleMint && singleWalletAddress && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs bg-zinc-900/50 border border-zinc-800 rounded-lg px-2 py-1.5">
                    <span className="text-zinc-500">Balance:</span>
                    {fetchingSingleBalance ? <RefreshCw className="h-3 w-3 animate-spin text-zinc-500" /> : <span className="text-green-400 font-mono font-bold">{singleBalance ?? "—"}</span>}
                    <button onClick={fetchSingleBalance} className="text-zinc-600 hover:text-zinc-300 shrink-0 ml-auto"><RefreshCw className="h-3 w-3" /></button>
                    <button onClick={() => handleCopy(singleMint)} className="text-zinc-600 hover:text-zinc-300 shrink-0"><Copy className="h-3 w-3" /></button>
                    <a href={`https://solscan.io/token/${singleMint}`} target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-blue-400 shrink-0"><ExternalLink className="h-3 w-3" /></a>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Destination Wallet</label>
              <input value={singleDest} onChange={e => updateSingleDest(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white font-mono"
                placeholder="Recipient wallet address" disabled={singleRunning} />
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Amount (token units)</label>
              <input value={singleAmount} onChange={e => updateSingleAmount(e.target.value)} type="number" step="0.000001"
                className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white" disabled={singleRunning} />
            </div>

            <button onClick={startSingleTransfer} disabled={singleRunning}
              className="px-6 py-2 rounded-lg font-bold bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-50">
              {singleRunning ? "Sending..." : "Send Compressed Transfer"}
            </button>

            {singleResult && (
              <div className={`p-3 rounded-lg border text-sm ${singleResult.status === "success" ? "bg-green-900/20 border-green-800 text-green-400" : "bg-red-900/20 border-red-800 text-red-400"}`}>
                <div className="font-bold">{singleResult.status === "success" ? "✅ Success" : "❌ Failed"}</div>
                {singleResult.signature && (
                  <a href={`https://solscan.io/tx/${singleResult.signature}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-mono text-xs break-all">
                    {singleResult.signature}
                  </a>
                )}
                {singleResult.error && <div className="text-xs mt-1">{singleResult.error}</div>}
              </div>
            )}

            {singleLogs.length > 0 && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg">
                <div className="px-3 py-2 border-b border-zinc-800 text-xs font-bold text-zinc-400">Console</div>
                <div className="h-48 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
                  {singleLogs.map((log, i) => (
                    <div key={i} className={logColor[log.type]}>
                      <span className="text-zinc-600">[{log.time}]</span> {log.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
        <>

        {/* Resume banner */}
        {sentWalletsCount > 0 && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-yellow-300">
              📊 Progress: <strong>{sentWalletsCount}</strong> / {destCount} wallets sent
              {hasResumeData && ` — ${destCount - sentWalletsCount} remaining`}
            </span>
            <div className="flex gap-2">
              {hasResumeData && !running && (
                <button onClick={() => startDistribution(true)}
                  className="px-3 py-1 rounded text-xs font-bold bg-yellow-600 text-black hover:bg-yellow-500">
                  Resume
                </button>
              )}
              <button onClick={resetProgress} disabled={running}
                className="px-3 py-1 rounded text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 disabled:opacity-50 flex items-center gap-1">
                <Trash2 className="h-3 w-3" /> Reset Progress
              </button>
            </div>
          </div>
        )}

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
                <><RefreshCw className="h-3 w-3 animate-spin" /> Fetching...</>
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
            {sourceWalletAddress && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs bg-zinc-900/50 border border-zinc-800 rounded-lg px-2 py-1.5">
                <Wallet className="h-3 w-3 text-orange-400 shrink-0" />
                <span className="text-zinc-400 font-mono break-all">{sourceWalletAddress}</span>
                <button onClick={() => handleCopy(sourceWalletAddress)} className="text-zinc-600 hover:text-zinc-300 shrink-0" title="Copy address">
                  <Copy className="h-3 w-3" />
                </button>
                <a href={`https://solscan.io/account/${sourceWalletAddress}`} target="_blank" rel="noreferrer"
                  className="text-zinc-600 hover:text-blue-400 shrink-0" title="View on Solscan">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Token Mint Address (to distribute)</label>
            <input value={mintAddress} onChange={e => updateMint(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white font-mono" disabled={running} />
            {mintAddress && sourceWalletAddress && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs bg-zinc-900/50 border border-zinc-800 rounded-lg px-2 py-1.5">
                <span className="text-zinc-500">Balance:</span>
                {fetchingBalance ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-zinc-500" />
                ) : (
                  <span className="text-green-400 font-mono font-bold">{tokenBalance ?? "—"}</span>
                )}
                <button onClick={fetchTokenBalance} className="text-zinc-600 hover:text-zinc-300 shrink-0 ml-auto" title="Refresh balance">
                  <RefreshCw className="h-3 w-3" />
                </button>
                <button onClick={() => handleCopy(mintAddress)} className="text-zinc-600 hover:text-zinc-300 shrink-0" title="Copy mint">
                  <Copy className="h-3 w-3" />
                </button>
                <a href={`https://solscan.io/token/${mintAddress}`} target="_blank" rel="noreferrer"
                  className="text-zinc-600 hover:text-blue-400 shrink-0" title="View token on Solscan">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
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
          <button onClick={() => startDistribution(false)} disabled={running}
            className="px-6 py-2 rounded-lg font-bold bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-50">
            {running ? "Running..." : `Start Distribution${destCount > 0 ? ` (${destCount})` : ""}`}
          </button>
          {hasResumeData && !running && (
            <button onClick={() => startDistribution(true)}
              className="px-4 py-2 rounded-lg font-bold text-sm bg-yellow-600 text-black hover:bg-yellow-500 flex items-center gap-2">
              <RefreshCw className="h-3 w-3" /> Resume ({destCount - sentWalletsCount} left)
            </button>
          )}
          {failedCount > 0 && !running && (
            <button onClick={retryFailed}
              className="px-4 py-2 rounded-lg font-bold text-sm bg-red-600 text-white hover:bg-red-500 flex items-center gap-2">
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

        {/* Results Table — with copyable destinations & Solscan links */}
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
                    <td className="p-2 font-mono">
                      <div className="flex items-center gap-1">
                        <span className="break-all">{r.destination}</span>
                        <button onClick={() => handleCopy(r.destination)} className="text-zinc-600 hover:text-zinc-300 shrink-0" title="Copy address">
                          <Copy className="h-3 w-3" />
                        </button>
                        <a href={`https://solscan.io/account/${r.destination}`} target="_blank" rel="noreferrer"
                          className="text-zinc-600 hover:text-blue-400 shrink-0" title="View on Solscan">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
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
        <WhaleScanner />
        </>
        )}
      </div>
    </div>
  );
}
