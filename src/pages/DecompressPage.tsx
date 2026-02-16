import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Wallet, ArrowDown, Check, ExternalLink, Copy, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

interface CompressedBalance {
  mint: string;
  rawBalance: string;
  balance: number;
  decimals: number;
  accounts: number;
  tokenProgram: string;
}

// Light Protocol SDK modules loaded at runtime
interface LightSdk {
  createRpc: any;
  decompress: any;
}

export default function DecompressPage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [decompressing, setDecompressing] = useState<string | null>(null);
  const [balances, setBalances] = useState<CompressedBalance[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [signatures, setSignatures] = useState<string[]>([]);
  const [decompressedMints, setDecompressedMints] = useState<Set<string>>(new Set());
  const [sdkReady, setSdkReady] = useState(false);
  const sdkRef = useRef<LightSdk | null>(null);
  const { toast } = useToast();

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  // Preload Light Protocol SDKs on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stateless, compressedToken] = await Promise.all([
          import("https://esm.sh/@lightprotocol/stateless.js@0.21.0?no-dts&target=es2022&deps=@solana/web3.js@1.98.0" as any),
          import("https://esm.sh/@lightprotocol/compressed-token@0.21.0?no-dts&target=es2022&deps=@solana/web3.js@1.98.0" as any),
        ]);
        if (!cancelled) {
          sdkRef.current = {
            createRpc: stateless.createRpc,
            decompress: compressedToken.decompress,
          };
          setSdkReady(true);
        }
      } catch (e) {
        console.error("Failed to preload Light SDK", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const connectWallet = useCallback(async () => {
    try {
      const provider = (window as any).solana || (window as any).phantom?.solana;
      if (!provider) {
        toast({ title: "Wallet not found", description: "Please install Phantom or Solflare wallet", variant: "destructive" });
        return;
      }
      const resp = await provider.connect();
      const addr = resp.publicKey.toString();
      setWalletAddress(addr);
      setWalletConnected(true);
      addLog(`Connected: ${addr}`);
    } catch (e: any) {
      toast({ title: "Connection failed", description: e.message, variant: "destructive" });
    }
  }, [toast]);

  const disconnectWallet = useCallback(() => {
    try {
      const provider = (window as any).solana || (window as any).phantom?.solana;
      provider?.disconnect();
    } catch {}
    setWalletAddress("");
    setWalletConnected(false);
    setBalances([]);
    setLogs([]);
    setSignatures([]);
  }, []);

  const checkBalances = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setBalances([]);
    addLog("Checking compressed token balances...");

    try {
      const { data, error } = await supabase.functions.invoke("decompress-token", {
        body: { walletAddress, action: "check-balances" },
      });

      if (error) {
        const errMsg = typeof error === "object" && error.message ? error.message : String(error);
        throw new Error(errMsg);
      }
      if (!data?.success) throw new Error(data?.error || "Failed to check balances");

      setBalances(data.balances || []);
      addLog(`Found ${data.balances?.length || 0} compressed token(s)`);

      if (!data.balances?.length) {
        addLog("No compressed tokens found in this wallet.");
      } else {
        for (const b of data.balances) {
          addLog(`  • ${b.balance.toLocaleString()} tokens (mint: ${b.mint.slice(0, 8)}...)`);
        }
      }
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [walletAddress, toast]);

  const decompressToken = useCallback(async (balance: CompressedBalance) => {
    if (!walletAddress) return;
    if (!sdkRef.current) {
      toast({ title: "SDK still loading", description: "Please wait a moment and try again", variant: "destructive" });
      return;
    }

    setDecompressing(balance.mint);
    addLog(`Decompressing ${balance.balance.toLocaleString()} tokens (${balance.mint.slice(0, 8)}...)...`);

    try {
      // Step 1: Get RPC URL from edge function
      const { data, error } = await supabase.functions.invoke("decompress-token", {
        body: { walletAddress, mintAddress: balance.mint, action: "decompress" },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed to prepare decompress");
      }

      const rpcUrl = data.data.rpcUrl;
      if (!rpcUrl) throw new Error("RPC URL not available");

      // Step 2: Use preloaded SDK
      const { createRpc, decompress } = sdkRef.current;

      const connection = createRpc(rpcUrl, rpcUrl, rpcUrl);
      const mint = new PublicKey(balance.mint);
      const ownerPubkey = new PublicKey(walletAddress);
      const tokenProgramId = balance.tokenProgram === "token-2022" ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      const ata = await getAssociatedTokenAddress(mint, ownerPubkey, false, tokenProgramId);

      addLog("Fetching compressed accounts...");

      const provider = (window as any).solana || (window as any).phantom?.solana;
      if (!provider) throw new Error("Wallet not connected");

      // Step 3: Get compressed accounts
      const compressedAccounts = await connection.getCompressedTokenAccountsByOwner(ownerPubkey, { mint });
      const items = compressedAccounts.items || compressedAccounts || [];
      if (!items.length) throw new Error("No compressed accounts found");

      // Step 4: Process each compressed account
      let totalDecompressed = BigInt(0);
      const newSignatures: string[] = [...signatures];

      for (let i = 0; i < items.length; i++) {
        const account = items[i];
        const parsed = account.parsed || account;
        const amount = BigInt(parsed.amount?.toString?.() || "0");
        if (amount === BigInt(0)) continue;

        addLog(`Decompressing batch ${i + 1}/${items.length} (${Number(amount) / Math.pow(10, balance.decimals)} tokens)...`);

        try {
          // Step 3a: Ensure ATA exists before decompress
          addLog("Ensuring token account exists...");
          const ataIx = createAssociatedTokenAccountIdempotentInstruction(
            ownerPubkey, ata, ownerPubkey, mint, tokenProgramId
          );
          const ataTx = new Transaction().add(ataIx);
          const { blockhash: ataBlockhash, lastValidBlockHeight: ataHeight } = await connection.getLatestBlockhash("confirmed");
          ataTx.recentBlockhash = ataBlockhash;
          ataTx.feePayer = ownerPubkey;
          const { signature: ataSig } = await provider.signAndSendTransaction(ataTx);
          await connection.confirmTransaction({ signature: ataSig, blockhash: ataBlockhash, lastValidBlockHeight: ataHeight }, "confirmed");
          addLog("Token account ready.");

          // Proxy connection that intercepts sendTransaction to use wallet signing
          const proxyConnection = new Proxy(connection, {
            get(target: any, prop: string) {
              if (prop === 'sendTransaction' || prop === 'sendAndConfirmTransaction') {
                return async (tx: any, ...args: any[]) => {
                  if (!tx.recentBlockhash) {
                    const { blockhash } = await target.getLatestBlockhash("confirmed");
                    tx.recentBlockhash = blockhash;
                  }
                  tx.feePayer = ownerPubkey;

                  const { signature: sig } = await provider.signAndSendTransaction(tx);

                  const latestBlockhash = await target.getLatestBlockhash("confirmed");
                  await target.confirmTransaction({
                    signature: sig,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                  }, "confirmed");

                  return sig;
                };
              }
              return target[prop];
            }
          });

          // Dummy signer — signing is handled by the proxy
          const walletSigner = {
            publicKey: ownerPubkey,
            secretKey: new Uint8Array(64),
          };

          const sig = await decompress(
            proxyConnection,
            walletSigner,
            mint,
            amount,
            walletSigner,
            ata
          );

          addLog(`✓ Decompressed! Tx: ${sig?.slice?.(0, 16) || sig}...`);
          if (sig) newSignatures.push(String(sig));
          setSignatures([...newSignatures]);
          totalDecompressed += amount;
        } catch (e: any) {
          addLog(`✗ Batch ${i + 1} failed: ${e.message?.slice(0, 100)}`);
          if (e.message?.includes("reject") || e.message?.includes("User rejected")) {
            throw new Error("Transaction rejected by user");
          }
        }
      }

      const humanAmount = Number(totalDecompressed) / Math.pow(10, balance.decimals);

      if (totalDecompressed > BigInt(0)) {
        addLog(`\n✅ Done! Decompressed ${humanAmount.toLocaleString()} tokens`);
        addLog("Tokens should now appear in your wallet!");
        toast({ title: "Decompression complete!", description: `${humanAmount.toLocaleString()} tokens are now in your wallet` });
        setDecompressedMints(prev => new Set(prev).add(balance.mint));
      } else {
        addLog(`\n⚠️ No tokens were decompressed. Please try again.`);
        toast({ title: "No tokens decompressed", description: "All batches failed. Please try again.", variant: "destructive" });
      }
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
      toast({ title: "Decompress failed", description: e.message, variant: "destructive" });
    } finally {
      setDecompressing(null);
    }
  }, [walletAddress, toast, checkBalances, signatures]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Package className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-primary">Decompress Tokens</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Convert your ZK compressed tokens into regular SPL tokens so they appear in your wallet
          </p>
          {!sdkReady && (
            <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Preparing SDK...
            </div>
          )}
        </div>

        {/* Wallet Connection */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          {!walletConnected ? (
            <div className="text-center space-y-4">
              <Wallet className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Connect your wallet to check for compressed tokens</p>
              <Button onClick={connectWallet} size="lg" className="gap-2">
                <Wallet className="w-4 h-4" />
                Connect Phantom / Solflare
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-sm text-muted-foreground">Connected</span>
                </div>
                <Button variant="outline" size="sm" onClick={disconnectWallet}>
                  Disconnect
                </Button>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <code className="text-xs flex-1 truncate">{walletAddress}</code>
                <button onClick={() => copyToClipboard(walletAddress)} className="text-muted-foreground hover:text-foreground">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <Button
                onClick={checkBalances}
                disabled={loading}
                className="w-full gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                {loading ? "Scanning..." : "Check Compressed Balances"}
              </Button>
            </div>
          )}
        </div>

        {/* Or enter address manually */}
        {!walletConnected && (
          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <p className="text-sm text-muted-foreground mb-3">Or enter wallet address to check balances:</p>
            <div className="flex gap-2">
              <Input
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Enter Solana wallet address"
                className="text-xs"
              />
              <Button onClick={checkBalances} disabled={loading || !walletAddress} size="sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
              </Button>
            </div>
          </div>
        )}

        {/* Balances */}
        {balances.length > 0 && (
          <div className="space-y-3 mb-6">
            <h2 className="text-lg font-semibold">Compressed Tokens</h2>
            {balances.map((b) => (
              <div key={b.mint} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl font-bold">{b.balance.toLocaleString()}</span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{b.tokenProgram}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <code className="text-xs text-muted-foreground truncate">{b.mint}</code>
                      <button onClick={() => copyToClipboard(b.mint)} className="text-muted-foreground hover:text-foreground shrink-0">
                        <Copy className="w-3 h-3" />
                      </button>
                      <a
                        href={`https://solscan.io/token/${b.mint}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{b.accounts} compressed account(s) • {b.decimals} decimals</p>
                  </div>
                  {decompressedMints.has(b.mint) ? (
                    <div className="flex items-center gap-1.5 text-green-400 font-semibold text-sm shrink-0 px-3 py-2">
                      <Check className="w-4 h-4" />
                      Done
                    </div>
                  ) : (
                    <Button
                      onClick={() => decompressToken(b)}
                      disabled={!walletConnected || decompressing !== null || !sdkReady}
                      className="gap-2 shrink-0"
                    >
                      {decompressing === b.mint ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Decompressing...
                        </>
                      ) : (
                        <>
                          <ArrowDown className="w-4 h-4" />
                          Decompress
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {balances.length === 0 && walletAddress && !loading && logs.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6 mb-6 text-center">
            <Check className="w-8 h-8 mx-auto text-primary mb-2" />
            <p className="text-muted-foreground">No compressed tokens found in this wallet</p>
            <p className="text-xs text-muted-foreground mt-1">All tokens are already in regular SPL format</p>
          </div>
        )}

        {/* Signatures */}
        {signatures.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold mb-2">Transaction Signatures</h3>
            <div className="space-y-1">
              {signatures.map((sig, i) => (
                <div key={i} className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground truncate flex-1">{sig}</code>
                  <a
                    href={`https://solscan.io/tx/${sig}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs shrink-0"
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-2">Activity Log</h3>
            <div className="bg-muted/50 rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-0.5">
              {logs.map((log, i) => (
                <div key={i} className="text-muted-foreground">{log}</div>
              ))}
            </div>
          </div>
        )}

        {/* Help */}
        <div className="mt-8 text-center text-xs text-muted-foreground space-y-1">
          <p>ZK compressed tokens are stored in Merkle trees and don't appear in regular wallets.</p>
          <p>Decompressing converts them to standard SPL tokens visible in Phantom, Solflare, etc.</p>
        </div>
      </div>
    </div>
  );
}
