import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Fingerprint, Loader2, Zap, Users, TrendingUp, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const TREASURY_WALLET = "HSVmkUnmkjD9YLJmgeHCRyL1isusKkU3xv4VwDaZJqRx";
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

function NfaMintWithWallet({ batch, solanaAddress }: { batch: NfaBatch | null | undefined; solanaAddress: string | null }) {
  const [minting, setMinting] = useState(false);
  const queryClient = useQueryClient();
  const { signAndSendTransaction, isWalletReady } = useSolanaWalletWithPrivy();

  const handleMint = useCallback(async () => {
    if (!solanaAddress || !batch || !isWalletReady) return;
    setMinting(true);

    try {
      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import("@solana/web3.js");

      const rpcUrl = (window as any).__RUNTIME_RPC_URL ||
        import.meta.env.VITE_HELIUS_RPC_URL ||
        "https://api.mainnet-beta.solana.com";

      const connection = new Connection(rpcUrl, "confirmed");
      const fromPubkey = new PublicKey(solanaAddress);
      const toPubkey = new PublicKey(TREASURY_WALLET);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(MINT_PRICE_SOL * LAMPORTS_PER_SOL),
        })
      );

      toast.info("Approve the transaction in your wallet...");

      const { signature, confirmed } = await signAndSendTransaction(transaction);

      if (!confirmed) {
        toast.error("Transaction not confirmed");
        return;
      }

      toast.info("Payment confirmed! Registering your NFA...");

      // Call the nfa-mint edge function
      const { data, error } = await supabase.functions.invoke("nfa-mint", {
        body: { minterWallet: solanaAddress, paymentSignature: signature },
      });

      if (error) {
        toast.error("Mint registration failed: " + error.message);
        return;
      }

      const responseData = data as any;
      if (responseData?.error) {
        toast.error(responseData.error);
        return;
      }

      toast.success(`🦞 NFA Slot #${responseData.mint?.slotNumber} minted! Batch ${responseData.mint?.mintedCount}/${responseData.mint?.totalSlots}`);
      queryClient.invalidateQueries({ queryKey: ["nfa-batch-current"] });
      queryClient.invalidateQueries({ queryKey: ["nfa-my-mints"] });
    } catch (err: any) {
      if (err.message?.includes("User rejected") || err.message?.includes("cancelled")) {
        toast.info("Transaction cancelled");
      } else {
        toast.error(err.message || "Mint failed");
      }
    } finally {
      setMinting(false);
    }
  }, [solanaAddress, batch, isWalletReady, signAndSendTransaction, queryClient]);

  return (
    <Button
      onClick={handleMint}
      disabled={minting || !batch || batch.status !== "open" || !solanaAddress || !isWalletReady}
      className="w-full h-12 text-base font-bold font-mono gap-2"
      style={{ background: "#4ade80", color: "#000" }}
    >
      {minting ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          <Fingerprint className="h-5 w-5" />
          MINT NFA — 1 SOL
        </>
      )}
    </Button>
  );
}

// Fallback button when Privy is not available
function NfaMintFallback({ batch, solanaAddress }: { batch: NfaBatch | null | undefined; solanaAddress: string | null }) {
  return (
    <Button
      disabled
      className="w-full h-12 text-base font-bold font-mono gap-2"
      style={{ background: "#4ade80", color: "#000" }}
    >
      <Fingerprint className="h-5 w-5" />
      MINT NFA — 1 SOL
    </Button>
  );
}

export default function PanelNfaTab() {
  const { solanaAddress } = useAuth();
  const privyAvailable = usePrivyAvailable();

  // Fetch current batch
  const { data: batch } = useQuery({
    queryKey: ["nfa-batch-current"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfa_batches")
        .select("*")
        .eq("status", "open")
        .order("batch_number", { ascending: true })
        .limit(1)
        .single();
      if (error) return null;
      return data as NfaBatch;
    },
  });

  // Fetch user's mints
  const { data: myMints = [] } = useQuery({
    queryKey: ["nfa-my-mints", solanaAddress],
    enabled: !!solanaAddress,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfa_mints")
        .select("*")
        .eq("minter_wallet", solanaAddress!)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data as NfaMint[];
    },
  });

  const progress = batch ? (batch.minted_count / batch.total_slots) * 100 : 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      {/* Hero */}
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl mb-4" style={{ background: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)" }}>
          <Fingerprint className="h-8 w-8 text-black" />
        </div>
        <h2 className="text-xl font-bold font-mono mb-1" style={{ color: "#4ade80" }}>
          NON-FUNGIBLE AGENTS
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The first NFA standard on Solana. Mint an autonomous trading agent that earns fees, trades, and evolves.
        </p>
      </div>

      {/* Batch Progress */}
      {batch && (
        <Card className="p-4 bg-white/5 border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                Batch #{batch.batch_number}
              </Badge>
              <Badge className="text-xs" style={{ background: "#4ade80", color: "#000" }}>
                {batch.status.toUpperCase()}
              </Badge>
            </div>
            <span className="text-sm font-mono font-bold">
              {batch.minted_count}/{batch.total_slots}
            </span>
          </div>
          <Progress value={progress} className="h-3 mb-3" />
          <p className="text-xs text-muted-foreground text-center">
            {batch.total_slots - batch.minted_count} slots remaining • 1 SOL per mint
          </p>
        </Card>
      )}

      {/* Mint Button */}
      {privyAvailable ? (
        <NfaMintWithWallet batch={batch} solanaAddress={solanaAddress} />
      ) : (
        <NfaMintFallback batch={batch} solanaAddress={solanaAddress} />
      )}

      {/* How It Works */}
      <Card className="p-4 bg-white/5 border-white/10">
        <h3 className="font-semibold text-sm mb-3">How It Works</h3>
        <div className="space-y-3">
          {[
            { icon: Fingerprint, label: "Mint", desc: "Pay 1 SOL to reserve your NFA slot" },
            { icon: Users, label: "Fill Batch", desc: "1,000 mints trigger batch generation" },
            { icon: Bot, label: "AI Generation", desc: "Each agent gets unique personality, avatar & strategy" },
            { icon: Zap, label: "Token Launch", desc: "Agent's token launches on Meteora DBC" },
            { icon: TrendingUp, label: "Auto-Trading", desc: "Agent trades autonomously, earns & shares fees" },
          ].map(({ icon: Icon, label, desc }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-md shrink-0" style={{ background: "rgba(74, 222, 128, 0.15)" }}>
                <Icon className="h-3.5 w-3.5" style={{ color: "#4ade80" }} />
              </div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Fee Structure */}
      <Card className="p-4 bg-white/5 border-white/10">
        <h3 className="font-semibold text-sm mb-3">Fee Distribution (2% swap fee)</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "NFA Minter", pct: "30%" },
            { label: "Top 500 Holders", pct: "30%" },
            { label: "Agent Capital", pct: "30%" },
            { label: "Platform", pct: "10%" },
          ].map(({ label, pct }) => (
            <div key={label} className="p-2 rounded-md text-center" style={{ background: "rgba(74, 222, 128, 0.08)", border: "1px solid rgba(74, 222, 128, 0.15)" }}>
              <p className="text-lg font-bold font-mono" style={{ color: "#4ade80" }}>{pct}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Daily profit &gt; 10 SOL → 50% to holders, 50% to minter
        </p>
      </Card>

      {/* My NFAs */}
      {myMints.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">My NFAs ({myMints.length})</h3>
          {myMints.map((mint) => (
            <Card key={mint.id} className="p-3 flex items-center gap-3 bg-white/[0.02] border-white/10">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(74, 222, 128, 0.15)" }}>
                {mint.agent_image_url ? (
                  <img src={mint.agent_image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <Fingerprint className="h-5 w-5" style={{ color: "#4ade80" }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {mint.agent_name || `NFA Slot #${mint.slot_number}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(mint.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline" className="text-xs capitalize">
                {mint.status}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
