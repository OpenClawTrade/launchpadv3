import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useNfaCollection } from "@/hooks/useNfaCollection";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Fingerprint, CheckCircle2, Users, Coins, TrendingUp, ExternalLink,
  ShoppingCart, Loader2, Sparkles, Upload, X, ArrowLeft, AlertTriangle,
  Bot, Zap, Shield, Tag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const TREASURY_WALLET = "HSVmkUnmjD9YLJmgeHCRyL1isusKkU3xv4VwDaZJqRx";
const MINT_PRICE_SOL = 1.0;

type MintStep = "customize" | "confirm" | "minting" | "done";

/* ───────── Inline Mint Flow ───────── */
function InlineMintFlow({ batch, solanaAddress }: { batch: any; solanaAddress: string }) {
  const [step, setStep] = useState<MintStep>("customize");
  const [tokenName, setTokenName] = useState("");
  const [tokenTicker, setTokenTicker] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<"ai" | "upload" | null>(null);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [mintResult, setMintResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { signAndSendTransaction, isWalletReady } = useSolanaWalletWithPrivy();

  const nameValid = tokenName.trim().length > 0 && tokenName.trim().length <= 32;
  const tickerValid = /^[A-Z0-9.]+$/.test(tokenTicker.toUpperCase()) && tokenTicker.trim().length > 0 && tokenTicker.trim().length <= 10;
  const canContinue = nameValid && tickerValid && !!imageUrl;

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfa-generate-image", {
        body: { tokenName: tokenName.trim(), tokenTicker: tokenTicker.trim().toUpperCase() },
      });
      if (error) throw new Error(error.message);
      const resp = data as any;
      if (resp?.error) throw new Error(resp.error);
      if (resp?.imageUrl) { setImageUrl(resp.imageUrl); setImageSource("ai"); toast.success("Image generated!"); }
    } catch (err: any) { toast.error(err.message || "Image generation failed"); }
    finally { setGenerating(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { toast.error("Only PNG, JPG, or WebP"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Max 2MB"); return; }
    setUploading(true);
    try {
      const fileName = `nfa/upload-${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("post-images").upload(fileName, file, { contentType: file.type });
      if (error) throw error;
      setImageUrl(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/post-images/${fileName}`);
      setImageSource("upload");
      toast.success("Uploaded!");
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleMint = async () => {
    if (!solanaAddress || !isWalletReady) return;
    setMinting(true); setStep("minting");
    try {
      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const rpcUrl = (window as any).__RUNTIME_RPC_URL || import.meta.env.VITE_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: new PublicKey(solanaAddress), toPubkey: new PublicKey(TREASURY_WALLET), lamports: Math.floor(MINT_PRICE_SOL * LAMPORTS_PER_SOL) })
      );
      toast.info("Approve the transaction in your wallet...");
      const { signature, confirmed } = await signAndSendTransaction(tx);
      if (!confirmed) { toast.error("Transaction not confirmed"); setStep("confirm"); setMinting(false); return; }
      toast.info("Payment confirmed! Minting on-chain...");
      const { data, error } = await supabase.functions.invoke("nfa-mint", {
        body: { minterWallet: solanaAddress, paymentSignature: signature, tokenName: tokenName.trim(), tokenTicker: tokenTicker.trim().toUpperCase(), tokenImageUrl: imageUrl },
      });
      if (error) { toast.error("Mint failed: " + error.message); setStep("confirm"); setMinting(false); return; }
      const resp = data as any;
      if (resp?.error) { toast.error(resp.error); setStep("confirm"); setMinting(false); return; }
      setMintResult(resp.mint);
      toast.success(`🦞 NFA #${resp.mint?.slotNumber} minted!`);
      queryClient.invalidateQueries({ queryKey: ["nfa-batch-current"] });
      queryClient.invalidateQueries({ queryKey: ["nfa-collection-all"] });
      setStep("done");
    } catch (err: any) {
      if (err.message?.includes("User rejected") || err.message?.includes("cancelled")) toast.info("Cancelled");
      else toast.error(err.message || "Mint failed");
      setStep("confirm");
    } finally { setMinting(false); }
  };

  const reset = () => { setStep("customize"); setTokenName(""); setTokenTicker(""); setImageUrl(null); setImageSource(null); setMintResult(null); };

  if (step === "minting") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-green-400" />
        <p className="font-medium text-sm">Minting your NFA on Solana...</p>
        <p className="text-xs text-muted-foreground">This may take a moment</p>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center py-12 space-y-5">
        <div className="h-14 w-14 rounded-full flex items-center justify-center bg-green-400/15">
          <CheckCircle2 className="h-8 w-8 text-green-400" />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-lg mb-1">NFA Minted!</h3>
          <p className="text-xs text-muted-foreground">Slot #{mintResult?.slotNumber} • Batch #{mintResult?.batchNumber}</p>
        </div>
        {/* Preview */}
        <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] w-48">
          <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-green-400/10 to-green-600/5">
            {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Fingerprint className="h-10 w-10 opacity-30 text-green-400" /></div>}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-black/60 backdrop-blur-sm text-white">#{mintResult?.slotNumber}</div>
          </div>
          <div className="p-3">
            <p className="font-medium text-sm truncate">{tokenName || "Unnamed"}</p>
            <p className="text-xs text-muted-foreground font-mono">${tokenTicker || "?"}</p>
          </div>
        </div>
        {mintResult?.nfaMintAddress && (
          <a href={`https://solscan.io/token/${mintResult.nfaMintAddress}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-green-400 hover:underline">
            View on Solscan <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <button onClick={reset} className="text-xs text-muted-foreground hover:text-white transition-colors">Mint another NFA</button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="space-y-5">
        <button onClick={() => setStep("customize")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="text-center">
          <h3 className="font-bold text-lg mb-2">Confirm & Mint</h3>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <AlertTriangle className="h-3 w-3" /> Metadata locked permanently after mint
          </div>
        </div>
        {/* Preview */}
        <div className="flex justify-center">
          <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] w-44">
            <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-green-400/10 to-green-600/5">
              {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Fingerprint className="h-10 w-10 opacity-30 text-green-400" /></div>}
            </div>
            <div className="p-2.5">
              <p className="font-medium text-xs truncate">{tokenName || "Unnamed"}</p>
              <p className="text-[10px] text-muted-foreground font-mono">${tokenTicker || "?"}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
          {[
            { k: "Token Name", v: tokenName.trim() },
            { k: "Ticker", v: `$${tokenTicker.toUpperCase()}` },
            { k: "Image", v: imageSource === "ai" ? "AI Generated" : "Uploaded" },
            { k: "Mint Price", v: "1 SOL" },
          ].map(({ k, v }) => (
            <div key={k} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-mono font-medium">{v}</span>
            </div>
          ))}
        </div>
        <button
          onClick={handleMint}
          disabled={minting || !isWalletReady}
          className="w-full h-14 rounded-xl font-bold font-mono text-base gap-2 flex items-center justify-center transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(74,222,128,0.3)] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)", color: "#000" }}
        >
          <Fingerprint className="h-5 w-5" /> MINT FOR 1 SOL
        </button>
      </div>
    );
  }

  // customize step
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Token Name</label>
            <Input
              value={tokenName}
              onChange={e => setTokenName(e.target.value)}
              placeholder="e.g. Neptune Agent"
              maxLength={32}
              className="bg-white/[0.04] border-white/10 text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{tokenName.length}/32</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ticker</label>
            <Input
              value={tokenTicker}
              onChange={e => setTokenTicker(e.target.value.replace(/[^A-Za-z0-9.]/g, "").toUpperCase())}
              placeholder="e.g. NEPTUNE"
              maxLength={10}
              className="bg-white/[0.04] border-white/10 text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{tokenTicker.length}/10</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Agent Image</label>
            <div className="flex gap-2">
              <button onClick={handleGenerateAI} disabled={generating || uploading} className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors disabled:opacity-50">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-green-400" />}
                Generate AI
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={generating || uploading} className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors disabled:opacity-50">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} />
            </div>
            {imageUrl && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                {imageSource === "ai" ? "AI-generated" : "Uploaded"}
                <button onClick={() => { setImageUrl(null); setImageSource(null); }} className="ml-auto hover:text-white"><X className="h-3 w-3" /></button>
              </div>
            )}
          </div>
        </div>
        {/* Preview */}
        <div className="flex flex-col items-center justify-center">
          <p className="text-[10px] text-muted-foreground mb-3 uppercase tracking-wider">Preview</p>
          <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] w-48">
            <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-green-400/10 to-green-600/5">
              {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Fingerprint className="h-10 w-10 opacity-30 text-green-400" /></div>}
            </div>
            <div className="p-3">
              <p className="font-medium text-sm truncate">{tokenName || "Unnamed Agent"}</p>
              <p className="text-xs text-muted-foreground font-mono">${tokenTicker || "TICKER"}</p>
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={() => setStep("confirm")}
        disabled={!canContinue}
        className="w-full h-12 rounded-xl font-bold font-mono text-sm flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed"
        style={{ background: canContinue ? "linear-gradient(135deg, #16a34a 0%, #15803d 50%, #166534 100%)" : "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)", color: "#000", opacity: canContinue ? 1 : 0.5 }}
      >
        {!nameValid && tokenName.length > 0 ? "Invalid name" : !tickerValid && tokenTicker.length > 0 ? "Invalid ticker" : !imageUrl ? "Upload or generate an image first" : "Continue to Payment"}
      </button>
    </div>
  );
}

/* ═══════════ Main NFA Page ═══════════ */
export default function NfaPage() {
  const { batch, collection, totalMinted, uniqueOwners, floorPrice, isLoading } = useNfaCollection();
  const { solanaAddress } = useAuth();
  const privyAvailable = usePrivyAvailable();
  const [tab, setTab] = useState<"mint" | "collection" | "activity">("mint");

  const progress = batch ? (batch.minted_count / batch.total_slots) * 100 : 0;
  const slotsRemaining = batch ? batch.total_slots - batch.minted_count : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2818 40%, #0a1628 100%)" }}>
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(rgba(74,222,128,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.3) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="relative max-w-5xl mx-auto px-4 py-16 flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(74,222,128,0.3)]" style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)" }}>
            <Fingerprint className="h-10 w-10 text-black" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-bold font-mono tracking-tight">Non-Fungible Agents</h1>
            <CheckCircle2 className="h-6 w-6 text-green-400" />
          </div>
          <p className="text-sm text-muted-foreground max-w-lg mb-8">
            1,000 autonomous AI trading agents minted as Metaplex Core NFTs on Solana. Each NFA earns, trades & evolves — the first of its kind.
          </p>

          {/* Stats */}
          <div className="flex items-center rounded-2xl bg-white/[0.06] backdrop-blur-sm border border-white/10 divide-x divide-white/10 overflow-x-auto">
            {[
              { label: "Items", value: "1,000" },
              { label: "Minted", value: totalMinted.toLocaleString() },
              { label: "Owners", value: uniqueOwners.toLocaleString() },
              { label: "Floor", value: floorPrice ? `${floorPrice} SOL` : "1 SOL" },
            ].map(({ label, value }) => (
              <div key={label} className="px-6 py-4 text-center min-w-[90px]">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="font-mono font-bold text-lg mt-1">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Batch Progress */}
      {batch && (
        <div className="max-w-5xl mx-auto px-4 -mt-4">
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-green-400" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
                </span>
                <span className="text-lg font-bold font-mono">{batch.minted_count}<span className="text-sm text-muted-foreground font-normal"> / {batch.total_slots.toLocaleString()}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{slotsRemaining} slots left</span>
                <Badge variant="outline" className="font-mono text-xs">Batch #{batch.batch_number}</Badge>
              </div>
            </div>
            <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 relative overflow-hidden" style={{ width: `${Math.max(progress, 1)}%`, background: "linear-gradient(90deg, #4ade80, #22c55e, #16a34a)" }}>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: "shimmer 2s infinite" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-1 border-b border-white/10 mb-6">
          {([
            { id: "mint" as const, label: "Mint NFA", icon: Fingerprint },
            { id: "collection" as const, label: `Collection${totalMinted > 0 ? ` (${totalMinted})` : ""}`, icon: Users },
            { id: "activity" as const, label: "Activity", icon: TrendingUp },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === id
                  ? "text-foreground border-green-400"
                  : "text-muted-foreground border-transparent hover:text-foreground/70"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
          <div className="flex-1" />
          <Link
            to="/nfa/marketplace"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <ShoppingCart className="h-3.5 w-3.5" /> Marketplace
          </Link>
        </div>

        {/* ── Mint Tab ── */}
        {tab === "mint" && (
          <div className="max-w-2xl mx-auto pb-12">
            {/* Value props */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              {[
                { icon: Bot, title: "Autonomous Trading", desc: "Each NFA runs its own AI trading strategy on-chain" },
                { icon: Coins, title: "Earn Fees", desc: "2% swap fees split between minter, holders & agent" },
                { icon: TrendingUp, title: "Profit Sharing", desc: "Daily profits > 10 SOL split 50/50 with holders" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                  <Icon className="h-5 w-5 mx-auto mb-2 text-green-400" />
                  <p className="text-xs font-medium mb-0.5">{title}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Mint Flow */}
            <div className="rounded-2xl border border-white/10 p-4 sm:p-6" style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.04), rgba(0,0,0,0))" }}>
              <div className="flex items-center gap-2 mb-5">
                <Fingerprint className="h-5 w-5 text-green-400" />
                <h2 className="font-bold text-sm font-mono">Customize & Mint Your NFA</h2>
                <span className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-green-400/15 text-green-400 border border-green-400/20">
                  1 SOL
                </span>
              </div>

              {privyAvailable && solanaAddress && batch?.status === "open" ? (
                <InlineMintFlow batch={batch} solanaAddress={solanaAddress} />
              ) : !batch || batch.status !== "open" ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No open batch available for minting</p>
                </div>
              ) : (
                <div className="text-center py-12 space-y-3">
                  <Fingerprint className="h-10 w-10 mx-auto opacity-30 text-green-400" />
                  <p className="text-sm font-medium">Connect your wallet to mint</p>
                  <p className="text-xs text-muted-foreground">Sign in with your Solana wallet to start minting NFAs</p>
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-400" /> How It Works
              </h3>
              <div className="relative pl-8 space-y-4">
                <div className="absolute left-[13px] top-2 bottom-2 w-px bg-gradient-to-b from-green-400 to-green-400/10" />
                {[
                  { label: "Customize", desc: "Choose your agent's name, ticker & image" },
                  { label: "Mint", desc: "Pay 1 SOL to permanently lock your agent on-chain" },
                  { label: "Fill Batch", desc: "1,000 mints trigger token generation" },
                  { label: "Token Launch", desc: "Each agent launches its own token on Meteora" },
                  { label: "Earn", desc: "Agent trades autonomously, you earn fees" },
                ].map(({ label, desc }, i) => (
                  <div key={i} className="relative flex items-start gap-3">
                    <div className="absolute -left-8 top-0.5 h-[22px] w-[22px] rounded-full border-2 border-green-400 bg-green-400/10 flex items-center justify-center text-[9px] font-mono font-bold text-green-400">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium text-xs">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Collection Tab ── */}
        {tab === "collection" && (
          <div className="pb-12">
            {collection.length === 0 ? (
              <div className="text-center py-16">
                <Fingerprint className="h-12 w-12 mx-auto mb-4 opacity-20 text-green-400" />
                <p className="text-muted-foreground mb-2">No NFAs minted yet</p>
                <button onClick={() => setTab("mint")} className="text-xs text-green-400 hover:underline">Be the first to mint →</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {collection.map(nfa => {
                  const image = nfa.token_image_url || nfa.agent_image_url;
                  const name = nfa.token_name || nfa.agent_name || `NFA #${nfa.slot_number}`;
                  return (
                    <Link to={`/nfa/${nfa.id}`} key={nfa.id} className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:scale-[1.02] transition-all duration-200 group block">
                      <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-green-400/[0.08] to-green-600/[0.03]">
                        {image ? (
                          <img src={image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Fingerprint className="h-8 w-8 opacity-20 text-green-400" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/60 backdrop-blur-sm text-white">
                          #{nfa.slot_number}
                        </div>
                        {nfa.listed_for_sale && nfa.listing_price_sol && (
                          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold backdrop-blur-sm bg-green-400/85 text-black">
                            {nfa.listing_price_sol} SOL
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="font-medium text-xs truncate">{name}</p>
                        {nfa.token_ticker && <p className="text-[10px] text-muted-foreground font-mono">${nfa.token_ticker}</p>}
                        <p className="text-[9px] text-muted-foreground mt-1 truncate font-mono">
                          {nfa.owner_wallet ? `${nfa.owner_wallet.slice(0, 4)}...${nfa.owner_wallet.slice(-4)}` : "—"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Activity Tab ── */}
        {tab === "activity" && (
          <div className="pb-12">
            {collection.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {collection.slice().reverse().slice(0, 20).map(nfa => (
                  <Link to={`/nfa/${nfa.id}`} key={nfa.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors block">
                    <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 bg-green-400/10">
                      {(nfa.token_image_url || nfa.agent_image_url) ? (
                        <img src={nfa.token_image_url || nfa.agent_image_url || ""} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Fingerprint className="h-4 w-4 opacity-30 text-green-400" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{nfa.token_name || `NFA #${nfa.slot_number}`}</p>
                      <p className="text-[10px] text-muted-foreground">Minted by {nfa.minter_wallet.slice(0, 4)}...{nfa.minter_wallet.slice(-4)}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(nfa.created_at).toLocaleDateString()}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
