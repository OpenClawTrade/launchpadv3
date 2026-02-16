import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePhantomWallet } from "@/hooks/usePhantomWallet";
import { useSolPrice } from "@/hooks/useSolPrice";
import { Connection, Transaction, VersionedTransaction, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import bs58 from "bs58";
import { debugLog } from "@/lib/debugLogger";
import { getRpcUrl } from "@/hooks/useSolanaWallet";
import {
  Rocket, Wallet, AlertTriangle, Loader2, PartyPopper, RefreshCw, Coins,
} from "lucide-react";

interface MemeToken {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
}

/** Send a raw transaction and confirm it with periodic rebroadcasts (standard Solana reliability pattern) */
async function sendAndConfirmWithRetry(
  connection: Connection,
  rawTx: Buffer | Uint8Array,
  blockhash: string,
  lastValidBlockHeight: number,
  label = "TX"
): Promise<string> {
  const signature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 0, // we handle retries ourselves
  });

  console.log(`[sendAndConfirmWithRetry] ${label} sent: ${signature}`);

  return new Promise<string>((resolve, reject) => {
    let done = false;

    const poll = async () => {
      while (!done) {
        await new Promise((r) => setTimeout(r, 2000));
        if (done) return;

        try {
          // Check current block height
          const currentHeight = await connection.getBlockHeight("confirmed");
          if (currentHeight > lastValidBlockHeight) {
            done = true;
            reject(new Error(`${label}: Transaction expired (block height exceeded)`));
            return;
          }

          // Check signature status
          const statuses = await connection.getSignatureStatuses([signature]);
          const status = statuses?.value?.[0];

          if (status?.err) {
            done = true;
            reject(new Error(`${label}: Transaction failed on-chain: ${JSON.stringify(status.err)}`));
            return;
          }

          if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
            done = true;
            resolve(signature);
            return;
          }

          // Re-broadcast (idempotent — same signature)
          console.log(`[sendAndConfirmWithRetry] ${label} re-sending...`);
          await connection.sendRawTransaction(rawTx, {
            skipPreflight: true,
            maxRetries: 0,
          }).catch(() => {}); // ignore re-send errors
        } catch (err) {
          console.warn(`[sendAndConfirmWithRetry] ${label} poll error:`, err);
          // continue polling
        }
      }
    };

    poll();
  });
}

const FUN_PRESETS = [
  { label: "💰 $30K Flex", emoji: "💰", supply: 1_000_000_000, lpTokens: 100_000, lpSol: 0.01, sendTokens: 20_000_000, desc: "Send 20M tokens → friend sees ~$30K" },
  { label: "🤑 $100K Baller", emoji: "🤑", supply: 1_000_000_000, lpTokens: 50_000, lpSol: 0.01, sendTokens: 20_000_000, desc: "Send 20M tokens → friend sees ~$100K" },
  { label: "🐳 $1M Whale", emoji: "🐳", supply: 1_000_000_000, lpTokens: 10_000, lpSol: 0.01, sendTokens: 50_000_000, desc: "Send 50M tokens → friend sees ~$1M+" },
];

export default function FunModePage() {
  const { toast } = useToast();
  const phantomWallet = usePhantomWallet();
  const { solPrice } = useSolPrice();

  const [funToken, setFunToken] = useState<MemeToken>({ name: "", ticker: "", description: "", imageUrl: "" });
  const [funImageFile, setFunImageFile] = useState<File | null>(null);
  const [funImagePreview, setFunImagePreview] = useState<string | null>(null);
  const [funTotalSupply, setFunTotalSupply] = useState(1_000_000_000);
  const [funLpSol, setFunLpSol] = useState(0.5);
  const [funLpTokens, setFunLpTokens] = useState(10_000_000);
  const [isFunLaunching, setIsFunLaunching] = useState(false);
  const [funRemovePoolAddress, setFunRemovePoolAddress] = useState(() => localStorage.getItem('fun_last_pool_address') || "");
  const [isRemovingFunLp, setIsRemovingFunLp] = useState(false);
  const [launchResult, setLaunchResult] = useState<{ mintAddress?: string; poolAddress?: string; solscanUrl?: string } | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const funImpliedPrice = funLpSol / funLpTokens;
  const funImpliedMarketCapSol = funImpliedPrice * funTotalSupply;
  const funImpliedMarketCapUsd = solPrice ? funImpliedMarketCapSol * solPrice : null;

  const uploadFunImageIfNeeded = useCallback(async (): Promise<string> => {
    if (!funImageFile) return funToken.imageUrl;
    const fileExt = funImageFile.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `token-images/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, funImageFile);
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
    return urlData.publicUrl;
  }, [funImageFile, funToken.imageUrl]);

  const handleFunImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setFunImageFile(file);
    setFunImagePreview(URL.createObjectURL(file));
  }, [toast]);

  const handleFunPresetClick = useCallback((preset: typeof FUN_PRESETS[0]) => {
    setFunTotalSupply(preset.supply);
    setFunLpTokens(preset.lpTokens);
    setFunLpSol(preset.lpSol);
    setSelectedPreset(preset.label);
    toast({ title: `${preset.emoji} Values set!`, description: preset.desc });
  }, [toast]);

  const handleFunLaunch = useCallback(async () => {
    if (!phantomWallet.isConnected || !phantomWallet.address) {
      toast({ title: "Wallet not connected", description: "Connect Phantom first", variant: "destructive" });
      return;
    }
    if (!funToken.name.trim() || !funToken.ticker.trim()) {
      toast({ title: "Missing token info", description: "Name and ticker required", variant: "destructive" });
      return;
    }
    if (!funImagePreview && !funToken.imageUrl) {
      toast({ title: "Image required", description: "Upload an image", variant: "destructive" });
      return;
    }

    setIsFunLaunching(true);
    toast({ title: "🎉 Preparing FUN Token...", description: "Creating zero-fee pool..." });

    try {
      const imageUrl = await uploadFunImageIfNeeded();
      const { url: rpcUrl } = getRpcUrl();
      const connection = new Connection(rpcUrl, "confirmed");

      const { data, error } = await supabase.functions.invoke("fun-mode-create", {
        body: {
          name: funToken.name.slice(0, 32),
          ticker: funToken.ticker.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10),
          description: funToken.description || "",
          imageUrl,
          phantomWallet: phantomWallet.address,
          totalSupply: funTotalSupply,
          lpTokenAmount: funLpTokens,
          lpSolAmount: funLpSol,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to prepare FUN transactions");

      const txBase64s: string[] = data.unsignedTransactions || [];
      if (txBase64s.length === 0) throw new Error("No transactions returned");

      const txIsVersioned: boolean[] = data.txIsVersioned || [];
      const txLabels: string[] = data.txLabels || ["Create Token", "Create Pool"];

      const deserializeAnyTx = (base64: string, idx: number): Transaction | VersionedTransaction => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        if (txIsVersioned[idx]) return VersionedTransaction.deserialize(bytes);
        try { return VersionedTransaction.deserialize(bytes); } catch { return Transaction.from(bytes); }
      };

      const ephemeralKeypairs: Map<string, Keypair> = new Map();
      if (data.ephemeralKeypairs) {
        for (const [pubkey, secretKeyB58] of Object.entries(data.ephemeralKeypairs)) {
          ephemeralKeypairs.set(pubkey, Keypair.fromSecretKey(bs58.decode(secretKeyB58 as string)));
        }
      }
      const txRequiredKeypairs: string[][] = data.txRequiredKeypairs || [];

      const signatures: string[] = [];
      for (let idx = 0; idx < txBase64s.length; idx++) {
        const tx = deserializeAnyTx(txBase64s[idx], idx);
        const txLabel = txLabels[idx] || `TX ${idx + 1}`;

        // Fetch fresh blockhash and set it on the TX BEFORE signing to prevent expiry
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        if (tx instanceof Transaction) {
          tx.recentBlockhash = blockhash;
        } else if (tx instanceof VersionedTransaction) {
          tx.message.recentBlockhash = blockhash;
        }

        toast({ title: `Signing ${txLabel}...`, description: `Step ${idx + 1} of ${txBase64s.length}` });

        const phantomSigned = await phantomWallet.signTransaction(tx as any);
        if (!phantomSigned) throw new Error(`${txLabel} cancelled`);

        const neededPubkeys = txRequiredKeypairs[idx] || [];
        if (phantomSigned instanceof Transaction) {
          const localSigners = neededPubkeys.map(pk => ephemeralKeypairs.get(pk)).filter((kp): kp is Keypair => !!kp);
          if (localSigners.length > 0) phantomSigned.partialSign(...localSigners);
        } else if (phantomSigned instanceof VersionedTransaction) {
          const localSigners = neededPubkeys.map(pk => ephemeralKeypairs.get(pk)).filter((kp): kp is Keypair => !!kp);
          if (localSigners.length > 0) phantomSigned.sign(localSigners);
        }

        const rawTx = (phantomSigned as any).serialize();
        toast({ title: `Sending ${txLabel}...`, description: "Broadcasting & confirming..." });
        const signature = await sendAndConfirmWithRetry(connection, rawTx, blockhash, lastValidBlockHeight, txLabel);
        signatures.push(signature);

        if (idx < txBase64s.length - 1) await new Promise(r => setTimeout(r, 2000));
      }

      // Phase 2: Record in DB
      try {
        await supabase.functions.invoke("fun-mode-create", {
          body: {
            name: funToken.name.slice(0, 32),
            ticker: funToken.ticker.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10),
            description: funToken.description || "",
            imageUrl,
            phantomWallet: phantomWallet.address,
            confirmed: true,
            mintAddress: data.mintAddress,
            poolAddress: data.poolAddress,
          },
        });
      } catch (recordErr) {
        debugLog("warn", "[FUN Launch] Token live but failed to record in DB", {
          message: recordErr instanceof Error ? recordErr.message : String(recordErr),
        });
      }

      toast({ title: "🎉 FUN Token Launched!", description: `${funToken.name} is live! Send tokens to your friend's wallet!` });

      setLaunchResult({
        mintAddress: data.mintAddress,
        poolAddress: data.poolAddress,
        solscanUrl: `https://solscan.io/token/${data.mintAddress}`,
      });

      if (data.poolAddress) {
        localStorage.setItem('fun_last_pool_address', data.poolAddress);
        setFunRemovePoolAddress(data.poolAddress);
      }

      setFunToken({ name: "", ticker: "", description: "", imageUrl: "" });
      setFunImageFile(null);
      setFunImagePreview(null);
    } catch (error: any) {
      toast({ title: "FUN Launch Failed", description: error.message || "Transaction failed", variant: "destructive" });
    } finally {
      setIsFunLaunching(false);
    }
  }, [phantomWallet, funToken, funImagePreview, funTotalSupply, funLpSol, funLpTokens, toast, uploadFunImageIfNeeded]);

  const handleRemoveFunLp = useCallback(async () => {
    if (!phantomWallet.isConnected || !phantomWallet.address) {
      toast({ title: "Wallet not connected", description: "Connect Phantom first", variant: "destructive" });
      return;
    }
    if (!funRemovePoolAddress.trim()) {
      toast({ title: "Pool address required", description: "Enter the pool address from your FUN launch", variant: "destructive" });
      return;
    }

    setIsRemovingFunLp(true);
    toast({ title: "🔄 Preparing LP removal...", description: "Building transaction..." });

    try {
      const { data, error } = await supabase.functions.invoke("fun-mode-remove-lp", {
        body: { poolAddress: funRemovePoolAddress.trim(), phantomWallet: phantomWallet.address },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to prepare remove LP transaction");

      const txBase64 = data.unsignedTransaction;
      if (!txBase64) throw new Error("No transaction returned");

      const bytes = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
      let tx: Transaction;
      try { tx = Transaction.from(bytes); } catch { throw new Error("Failed to deserialize transaction"); }

      // Fetch fresh blockhash and set it on the TX BEFORE signing to prevent expiry
      const { url: rpcUrl } = getRpcUrl();
      const connection = new Connection(rpcUrl, "confirmed");
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;

      toast({ title: "✍️ Sign in Phantom...", description: "Approve the LP removal transaction" });
      const signedTx = await phantomWallet.signTransaction(tx as any);
      if (!signedTx) throw new Error("Transaction signing cancelled");

      const rawTx = (signedTx as any).serialize();
      toast({ title: "⏳ Sending & Confirming...", description: "Broadcasting with retries..." });
      await sendAndConfirmWithRetry(connection, rawTx, blockhash, lastValidBlockHeight, "Remove LP");

      toast({ title: "✅ LP Removed!", description: "Your SOL is back in your wallet. The token is now untradeable." });
      localStorage.removeItem('fun_last_pool_address');
      setFunRemovePoolAddress("");
    } catch (error: any) {
      toast({ title: "Remove LP Failed", description: error.message || "Transaction failed", variant: "destructive" });
    } finally {
      setIsRemovingFunLp(false);
    }
  }, [phantomWallet, funRemovePoolAddress, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <Card className="p-6 space-y-5 border-primary/20">
          {/* Fun Header */}
          <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <PartyPopper className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold text-foreground">FUN Mode — Prank Your Friends 🎉</span>
              <PartyPopper className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Surprise a friend by sending them <strong>$1,000,000 worth of tokens</strong> (wink wink).
              Pick a preset below and launch!
            </p>
            <p className="text-xs text-muted-foreground mt-2 italic">
              This is FUN mode — not financial advice, just vibes. LP is not locked so you can pull it back anytime.
            </p>
          </div>

          {/* Preset Cards */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Quick Presets — click to auto-fill:</p>
            <div className="grid grid-cols-3 gap-2">
              {FUN_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handleFunPresetClick(preset)}
                  className={`p-3 rounded-lg border transition-all text-center ${
                    selectedPreset === preset.label
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border bg-secondary/50 hover:bg-primary/10 hover:border-primary/30"
                  }`}
                >
                  <div className="text-2xl">{preset.emoji}</div>
                  <div className="text-xs font-bold text-foreground">{preset.label.replace(preset.emoji + ' ', '')}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{preset.desc.split('→')[1]?.trim()}</div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              <strong>How it works:</strong> You put tiny SOL in pool with few tokens. Pool price = SOL ÷ tokens.
              Phantom multiplies that price by your friend's holdings. Boom — instant millionaire (on paper). 🤫
            </p>
          </div>

          {/* Cost breakdown */}
          <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">💸 Cost breakdown:</p>
            <p>• Token creation: ~0.004 SOL</p>
            <p>• Pool creation: ~0.05 SOL + your LP deposit ({funLpSol} SOL)</p>
            <p>• <strong>Total: ~{(0.054 + funLpSol).toFixed(3)} SOL</strong></p>
            <p className="mt-1 italic">Remove LP later to get your {funLpSol} SOL back!</p>
          </div>

          {/* Wallet Connection */}
          {!phantomWallet.isConnected ? (
            <Button onClick={phantomWallet.connect} disabled={phantomWallet.isConnecting} className="w-full">
              {phantomWallet.isConnecting ? "Connecting..." : <><Wallet className="h-4 w-4 mr-2" /> Connect Phantom</>}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-sm font-mono text-foreground">{phantomWallet.address?.slice(0, 4)}...{phantomWallet.address?.slice(-4)}</span>
                  {phantomWallet.balance !== null && <span className="text-xs text-muted-foreground">{phantomWallet.balance.toFixed(3)} SOL</span>}
                </div>
                <Button variant="ghost" size="sm" onClick={phantomWallet.disconnect} className="text-muted-foreground hover:text-foreground">
                  Disconnect
                </Button>
              </div>

              {/* Token Info */}
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {funImagePreview || funToken.imageUrl ? (
                    <img src={funImagePreview || funToken.imageUrl} alt="Token" className="w-full h-full object-cover" />
                  ) : (
                    <PartyPopper className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2 flex-1">
                  <Input
                    value={funToken.name}
                    onChange={(e) => setFunToken({ ...funToken, name: e.target.value.slice(0, 32) })}
                    placeholder="Token name"
                    maxLength={32}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-primary text-sm">$</span>
                    <Input
                      value={funToken.ticker}
                      onChange={(e) => setFunToken({ ...funToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })}
                      className="w-28 font-mono"
                      placeholder="TICKER"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              <Textarea
                value={funToken.description}
                onChange={(e) => setFunToken({ ...funToken, description: e.target.value })}
                placeholder="Description (optional)"
                maxLength={500}
              />

              <Input type="file" accept="image/*" onChange={handleFunImageChange} className="text-xs" />

              {/* Pool Configuration */}
              <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                <h4 className="text-xs font-semibold text-foreground">Pool Configuration</h4>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Total Supply</Label>
                  <Input
                    type="number"
                    value={funTotalSupply}
                    onChange={(e) => { setFunTotalSupply(Math.max(1000, Number(e.target.value) || 1_000_000_000)); setSelectedPreset(null); }}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">LP SOL</Label>
                    <span className="text-xs font-semibold text-primary">{funLpSol} SOL</span>
                  </div>
                  <Slider
                    value={[funLpSol * 100]}
                    onValueChange={(v) => { setFunLpSol(v[0] / 100); setSelectedPreset(null); }}
                    min={1}
                    max={500}
                    step={1}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0.01 SOL</span>
                    <span>5 SOL</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tokens in Pool</Label>
                  <Input
                    type="number"
                    value={funLpTokens}
                    onChange={(e) => { setFunLpTokens(Math.max(1, Math.min(funTotalSupply, Number(e.target.value) || 10_000_000))); setSelectedPreset(null); }}
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Remaining {(funTotalSupply - funLpTokens).toLocaleString()} tokens go to your wallet
                  </p>
                </div>
              </div>

              {/* Implied Values */}
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold">What your friend will see in Phantom 👀</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price per token</span>
                    <span className="text-primary font-mono">{funImpliedPrice.toExponential(4)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Implied Market Cap</span>
                    <span className="text-primary font-semibold">{funImpliedMarketCapSol.toFixed(2)} SOL</span>
                  </div>
                  {funImpliedMarketCapUsd !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Implied Market Cap (USD)</span>
                      <span className="text-primary font-bold">${funImpliedMarketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-1 mt-1">
                    <span className="text-muted-foreground">🤯 Your friend's reaction</span>
                    <span className="text-primary font-bold">
                      {funImpliedMarketCapUsd !== null
                        ? `~$${((funTotalSupply - funLpTokens) * funImpliedPrice * (solPrice || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : `${((funTotalSupply - funLpTokens) * funImpliedPrice).toFixed(2)} SOL`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">LP Locked</span>
                    <span className="text-warning font-semibold">❌ No</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trading Fees</span>
                    <span className="text-primary font-semibold">0%</span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center italic">
                💡 Pro tip: Send the tokens to your friend's wallet after launch. They'll open Phantom and see $$$ — priceless.
              </p>

              <Button
                onClick={handleFunLaunch}
                disabled={isFunLaunching || !funToken.name.trim() || !funToken.ticker.trim() || (!funImagePreview && !funToken.imageUrl) || (phantomWallet.balance !== null && phantomWallet.balance < funLpSol + 0.02)}
                className="w-full"
              >
                {isFunLaunching ? <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</> : <><PartyPopper className="h-4 w-4 mr-2" /> Launch FUN Token (~{(funLpSol + 0.02).toFixed(2)} SOL)</>}
              </Button>

              {phantomWallet.balance !== null && phantomWallet.balance < funLpSol + 0.02 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Insufficient balance. Need at least {(funLpSol + 0.02).toFixed(2)} SOL.
                </p>
              )}

              {/* Launch Result */}
              {launchResult && (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs space-y-1">
                  <p className="font-semibold text-foreground">🎉 Last Launch:</p>
                  {launchResult.mintAddress && <p className="font-mono text-muted-foreground break-all">Mint: {launchResult.mintAddress}</p>}
                  {launchResult.poolAddress && <p className="font-mono text-muted-foreground break-all">Pool: {launchResult.poolAddress}</p>}
                  {launchResult.solscanUrl && (
                    <a href={launchResult.solscanUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">View on Solscan →</a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Remove LP Section */}
          <details className="group">
            <summary className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              <RefreshCw className="h-4 w-4" />
              <span>Already launched? Remove your LP & get SOL back</span>
            </summary>
            <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30 space-y-3">
              <p className="text-xs text-muted-foreground">
                Paste the pool address from your FUN launch to remove all liquidity and get your SOL back.
                ⚠️ This makes the token untradeable.
              </p>

              {!phantomWallet.isConnected && (
                <Button onClick={phantomWallet.connect} disabled={phantomWallet.isConnecting} variant="outline" className="w-full">
                  {phantomWallet.isConnecting ? "Connecting..." : <><Wallet className="h-4 w-4 mr-2" /> Connect Phantom first</>}
                </Button>
              )}

              <Input
                placeholder="Pool address..."
                value={funRemovePoolAddress}
                onChange={(e) => setFunRemovePoolAddress(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                onClick={handleRemoveFunLp}
                disabled={isRemovingFunLp || !funRemovePoolAddress.trim() || !phantomWallet.isConnected}
                variant="outline"
                className="w-full"
              >
                {isRemovingFunLp
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Removing LP...</>
                  : <><RefreshCw className="h-4 w-4 mr-2" /> Remove LP & Get SOL Back</>
                }
              </Button>
            </div>
          </details>
        </Card>
      </div>
    </div>
  );
}
