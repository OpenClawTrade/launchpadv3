import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Fingerprint, Loader2, Zap, Users, TrendingUp, Bot,
  CheckCircle2, ExternalLink, Globe, Coins,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const TREASURY_WALLET = "HSVmkUnmjD9YLJmgeHCRyL1isusKkU3xv4VwDaZJqRx";
const MINT_PRICE_SOL = 1.0;

interface NfaBatch {
  id: string;
  batch_number: number;
  total_slots: number;
  minted_count: number;
  status: string;
}

interface NfaMint {
  id: string;
  slot_number: number;
  minter_wallet: string;
  status: string;
  agent_name: string | null;
  agent_image_url: string | null;
  nfa_mint_address: string | null;
  created_at: string;
}

/* ───────── Mint Button (with wallet) ───────── */
function NfaMintWithWallet({ batch, solanaAddress }: { batch: NfaBatch | null | undefined; solanaAddress: string | null }) {
  const [minting, setMinting] = useState(false);
  const queryClient = useQueryClient();
  const { signAndSendTransaction, isWalletReady } = useSolanaWalletWithPrivy();

  const handleMint = useCallback(async () => {
    if (!solanaAddress || !batch || !isWalletReady) return;
    setMinting(true);
    try {
      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const rpcUrl = (window as any).__RUNTIME_RPC_URL || import.meta.env.VITE_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      const fromPubkey = new PublicKey(solanaAddress);
      const toPubkey = new PublicKey(TREASURY_WALLET);
      const transaction = new Transaction().add(
        SystemProgram.transfer({ fromPubkey, toPubkey, lamports: Math.floor(MINT_PRICE_SOL * LAMPORTS_PER_SOL) })
      );
      toast.info("Approve the transaction in your wallet...");
      const { signature, confirmed } = await signAndSendTransaction(transaction);
      if (!confirmed) { toast.error("Transaction not confirmed"); return; }
      toast.info("Payment confirmed! Registering your NFA...");
      const { data, error } = await supabase.functions.invoke("nfa-mint", {
        body: { minterWallet: solanaAddress, paymentSignature: signature },
      });
      if (error) { toast.error("Mint registration failed: " + error.message); return; }
      const responseData = data as any;
      if (responseData?.error) { toast.error(responseData.error); return; }
      toast.success(`🦞 NFA Slot #${responseData.mint?.slotNumber} minted!`);
      queryClient.invalidateQueries({ queryKey: ["nfa-batch-current"] });
      queryClient.invalidateQueries({ queryKey: ["nfa-my-mints"] });
    } catch (err: any) {
      if (err.message?.includes("User rejected") || err.message?.includes("cancelled")) toast.info("Transaction cancelled");
      else toast.error(err.message || "Mint failed");
    } finally { setMinting(false); }
  }, [solanaAddress, batch, isWalletReady, signAndSendTransaction, queryClient]);

  return (
    <button
      onClick={handleMint}
      disabled={minting || !batch || batch.status !== "open" || !solanaAddress || !isWalletReady}
      className="w-full h-14 rounded-xl font-bold font-mono text-base gap-2 flex items-center justify-center transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(74,222,128,0.3)] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
      style={{ background: "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)", color: "#000" }}
    >
      {minting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
        <>
          <Fingerprint className="h-5 w-5" />
          MINT NFA
          <span className="ml-2 px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: "rgba(0,0,0,0.2)" }}>1 SOL</span>
        </>
      )}
    </button>
  );
}

function NfaMintFallback() {
  return (
    <button disabled className="w-full h-14 rounded-xl font-bold font-mono text-base gap-2 flex items-center justify-center opacity-50" style={{ background: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)", color: "#000" }}>
      <Fingerprint className="h-5 w-5" />
      MINT NFA
      <span className="ml-2 px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: "rgba(0,0,0,0.2)" }}>1 SOL</span>
    </button>
  );
}

/* ───────── Sub-tab: How It Works (Timeline) ───────── */
function HowItWorksTimeline() {
  const steps = [
    { icon: Fingerprint, label: "Mint", desc: "Pay 1 SOL to reserve your NFA slot in the current batch" },
    { icon: Users, label: "Fill Batch", desc: "1,000 mints trigger the batch generation process" },
    { icon: Bot, label: "AI Generation", desc: "Each agent gets a unique personality, avatar & trading strategy" },
    { icon: Zap, label: "Token Launch", desc: "Agent's token launches on Meteora DBC with built-in fees" },
    { icon: TrendingUp, label: "Auto-Trading", desc: "Agent trades autonomously, earns & shares fees with holders" },
  ];
  return (
    <div className="relative pl-8 space-y-6 py-2">
      {/* Vertical line */}
      <div className="absolute left-[13px] top-4 bottom-4 w-px" style={{ background: "linear-gradient(to bottom, #4ade80, rgba(74,222,128,0.1))" }} />
      {steps.map(({ icon: Icon, label, desc }, i) => (
        <div key={i} className="relative flex items-start gap-4">
          {/* Dot */}
          <div className="absolute -left-8 top-1 h-[26px] w-[26px] rounded-full border-2 flex items-center justify-center" style={{ borderColor: "#4ade80", background: "rgba(74,222,128,0.1)" }}>
            <Icon className="h-3 w-3" style={{ color: "#4ade80" }} />
          </div>
          <div>
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────── Sub-tab: Fee Structure (Bars) ───────── */
function FeeStructureBars() {
  const fees = [
    { label: "NFA Minter", pct: 30, color: "#4ade80" },
    { label: "Top 500 Holders", pct: 30, color: "#22c55e" },
    { label: "Agent Capital", pct: 30, color: "#16a34a" },
    { label: "Platform", pct: 10, color: "#0d9488" },
  ];
  return (
    <div className="space-y-4 py-2">
      <p className="text-xs text-muted-foreground">2% swap fee distribution</p>
      {fees.map(({ label, pct, color }) => (
        <div key={label} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm">{label}</span>
            <span className="font-mono font-bold text-sm" style={{ color }}>{pct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground mt-4">
        Daily profit &gt; 10 SOL → 50% to holders, 50% to minter
      </p>
    </div>
  );
}

/* ───────── My NFAs Grid ───────── */
function MyNfasGrid({ mints }: { mints: NfaMint[] }) {
  if (mints.length === 0) {
    return (
      <div className="text-center py-12">
        <Fingerprint className="h-10 w-10 mx-auto mb-3 opacity-30" style={{ color: "#4ade80" }} />
        <p className="text-sm text-muted-foreground">No NFAs minted yet</p>
        <p className="text-xs text-muted-foreground mt-1">Mint your first NFA above to get started</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {mints.map((mint) => (
        <div
          key={mint.id}
          className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:scale-[1.02] hover:shadow-lg transition-all duration-200 cursor-pointer group"
        >
          {/* Image */}
          <div className="aspect-square relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.1), rgba(34,197,94,0.05))" }}>
            {mint.agent_image_url ? (
              <img src={mint.agent_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Fingerprint className="h-10 w-10 opacity-30" style={{ color: "#4ade80" }} />
              </div>
            )}
            {/* Slot badge */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-black/60 backdrop-blur-sm text-white">
              #{mint.slot_number}
            </div>
          </div>
          {/* Info */}
          <div className="p-3">
            <p className="font-medium text-sm truncate">{mint.agent_name || `NFA Slot #${mint.slot_number}`}</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-muted-foreground">{new Date(mint.created_at).toLocaleDateString()}</span>
              <Badge variant="outline" className="text-[10px] capitalize h-5 px-1.5">{mint.status}</Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════ Main Component ═══════════ */
export default function PanelNfaTab() {
  const { solanaAddress } = useAuth();
  const privyAvailable = usePrivyAvailable();
  const [subTab, setSubTab] = useState<"mynfas" | "howitworks" | "fees">("mynfas");

  const { data: batch } = useQuery({
    queryKey: ["nfa-batch-current"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nfa_batches").select("*").eq("status", "open").order("batch_number", { ascending: true }).limit(1).single();
      if (error) return null;
      return data as NfaBatch;
    },
  });

  const { data: myMints = [] } = useQuery({
    queryKey: ["nfa-my-mints", solanaAddress],
    enabled: !!solanaAddress,
    queryFn: async () => {
      const { data, error } = await supabase.from("nfa_mints").select("*").eq("minter_wallet", solanaAddress!).order("created_at", { ascending: false });
      if (error) return [];
      return data as NfaMint[];
    },
  });

  const progress = batch ? (batch.minted_count / batch.total_slots) * 100 : 0;
  const slotsRemaining = batch ? batch.total_slots - batch.minted_count : 0;

  return (
    <div className="max-w-3xl mx-auto pb-8 space-y-0">
      {/* ── Hero Banner ── */}
      <div className="relative rounded-2xl overflow-hidden mb-6" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2818 50%, #0a1628 100%)" }}>
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(74,222,128,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.3) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative px-6 py-8 flex flex-col items-center text-center">
          {/* Icon */}
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(74,222,128,0.3)]" style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)" }}>
            <Fingerprint className="h-8 w-8 text-black" />
          </div>
          {/* Title */}
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold font-mono tracking-tight">Non-Fungible Agents</h2>
            <CheckCircle2 className="h-4 w-4" style={{ color: "#4ade80" }} />
          </div>
          <p className="text-xs text-muted-foreground max-w-sm">
            The first NFA standard on Solana — autonomous trading agents that earn, trade & evolve
          </p>

          {/* Stats Row */}
          <div className="flex items-center gap-0 mt-6 rounded-xl bg-white/[0.06] backdrop-blur-sm border border-white/10 divide-x divide-white/10">
            {[
              { label: "Items", value: batch?.total_slots?.toLocaleString() ?? "1,000" },
              { label: "Minted", value: batch?.minted_count?.toLocaleString() ?? "0" },
              { label: "Floor", value: "1 SOL" },
            ].map(({ label, value }) => (
              <div key={label} className="px-5 py-3 text-center min-w-[80px]">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="font-mono font-bold text-sm mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Live Mint Section ── */}
      {batch && (
        <div className="relative rounded-2xl border border-white/10 p-5 mb-6" style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.04), rgba(0,0,0,0))" }}>
          {/* Inner glow border */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: "inset 0 0 30px rgba(74,222,128,0.05)" }} />
          
          <div className="relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {/* Pulsing dot */}
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#4ade80" }} />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "#4ade80" }} />
                </span>
                <Badge className="text-[10px] font-mono uppercase tracking-wider" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
                  Live Mint
                </Badge>
              </div>
              <Badge variant="outline" className="font-mono text-xs">Batch #{batch.batch_number}</Badge>
            </div>

            {/* Progress */}
            <div className="mb-3">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-bold font-mono">{batch.minted_count}<span className="text-sm text-muted-foreground font-normal"> / {batch.total_slots.toLocaleString()}</span></span>
                <span className="text-xs text-muted-foreground">{slotsRemaining} remaining</span>
              </div>
              {/* Custom progress bar with shimmer */}
              <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
                  style={{ width: `${Math.max(progress, 1)}%`, background: "linear-gradient(90deg, #4ade80, #22c55e, #16a34a)" }}
                >
                  {/* Shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" style={{ animation: "shimmer 2s infinite" }} />
                </div>
              </div>
            </div>

            {/* Mint Button */}
            {privyAvailable ? (
              <NfaMintWithWallet batch={batch} solanaAddress={solanaAddress} />
            ) : (
              <NfaMintFallback />
            )}
          </div>
        </div>
      )}

      {/* ── About + Details ── */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* About */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4" style={{ color: "#4ade80" }} />
            About
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Non-Fungible Agents (NFAs) are autonomous AI trading agents minted as unique digital assets on Solana.
            Each NFA has its own personality, avatar, and trading strategy. When a batch of 1,000 is filled,
            agents are generated and their tokens launch on Meteora DBC with built-in fee sharing.
          </p>
        </div>
        {/* Details */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Coins className="h-4 w-4" style={{ color: "#4ade80" }} />
            Details
          </h3>
          <div className="space-y-2.5">
            {[
              { k: "Chain", v: "Solana" },
              { k: "Token Standard", v: "Metaplex Core" },
              { k: "Mint Price", v: "1 SOL" },
              { k: "Batch Size", v: "1,000" },
              { k: "Swap Fee", v: "2%" },
            ].map(({ k, v }) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sub-Tabs ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {/* Tab header */}
        <div className="flex border-b border-white/10">
          {([
            { id: "mynfas" as const, label: `My NFAs${myMints.length > 0 ? ` (${myMints.length})` : ""}` },
            { id: "howitworks" as const, label: "How It Works" },
            { id: "fees" as const, label: "Fee Structure" },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className={`flex-1 text-xs font-medium py-3 px-4 transition-colors relative ${
                subTab === id ? "text-white" : "text-muted-foreground hover:text-white/70"
              }`}
            >
              {label}
              {subTab === id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#4ade80" }} />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4">
          {subTab === "mynfas" && <MyNfasGrid mints={myMints} />}
          {subTab === "howitworks" && <HowItWorksTimeline />}
          {subTab === "fees" && <FeeStructureBars />}
        </div>
      </div>
    </div>
  );
}
