import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Fingerprint, ArrowLeft, ExternalLink, Loader2, Tag, X,
  ShoppingCart, CheckCircle2, Copy, Users, Coins,
} from "lucide-react";
import { toast } from "sonner";

export default function NfaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { solanaAddress } = useAuth();
  const privyAvailable = usePrivyAvailable();
  const { signAndSendTransaction, isWalletReady } = useSolanaWalletWithPrivy();
  const queryClient = useQueryClient();

  const [listPrice, setListPrice] = useState("");
  const [showListInput, setShowListInput] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [buying, setBuying] = useState(false);

  const { data: nfa, isLoading } = useQuery({
    queryKey: ["nfa-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfa_mints")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) return null;
      return data as any;
    },
  });

  // Get active listing if any
  const { data: activeListing } = useQuery({
    queryKey: ["nfa-detail-listing", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("nfa_listings")
        .select("*")
        .eq("nfa_mint_id", id!)
        .eq("status", "active")
        .limit(1);
      return (data as any)?.[0] || null;
    },
  });

  const isOwner = nfa?.owner_wallet === solanaAddress;
  const image = nfa?.token_image_url || nfa?.agent_image_url;
  const name = nfa?.token_name || nfa?.agent_name || `NFA #${nfa?.slot_number}`;

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success("Copied!");
  };

  const handleList = async () => {
    const price = parseFloat(listPrice);
    if (!price || price <= 0 || !solanaAddress || !id) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfa-list", {
        body: { nfaMintId: id, sellerWallet: solanaAddress, askingPriceSol: price },
      });
      if (error) throw new Error(error.message);
      const resp = data as any;
      if (resp?.error) throw new Error(resp.error);
      toast.success("Listed for sale!");
      setShowListInput(false);
      setListPrice("");
      queryClient.invalidateQueries({ queryKey: ["nfa-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["nfa-detail-listing", id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to list");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelist = async () => {
    if (!solanaAddress || !activeListing) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfa-delist", {
        body: { listingId: activeListing.id, sellerWallet: solanaAddress },
      });
      if (error) throw new Error(error.message);
      const resp = data as any;
      if (resp?.error) throw new Error(resp.error);
      toast.success("Listing cancelled");
      queryClient.invalidateQueries({ queryKey: ["nfa-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["nfa-detail-listing", id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delist");
    } finally {
      setProcessing(false);
    }
  };

  const handleBuy = useCallback(async () => {
    if (!solanaAddress || !isWalletReady || !activeListing || !nfa) return;
    setBuying(true);
    try {
      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const rpcUrl = (window as any).__RUNTIME_RPC_URL || import.meta.env.VITE_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      const fromPubkey = new PublicKey(solanaAddress);
      const toPubkey = new PublicKey(activeListing.seller_wallet);
      const transaction = new Transaction().add(
        SystemProgram.transfer({ fromPubkey, toPubkey, lamports: Math.floor(activeListing.asking_price_sol * LAMPORTS_PER_SOL) })
      );
      toast.info("Approve the transaction in your wallet...");
      const { signature, confirmed } = await signAndSendTransaction(transaction);
      if (!confirmed) { toast.error("Transaction not confirmed"); return; }
      toast.info("Payment confirmed! Transferring NFA...");
      const { data, error } = await supabase.functions.invoke("nfa-buy", {
        body: { buyerWallet: solanaAddress, listingId: activeListing.id, paymentSignature: signature },
      });
      if (error) throw new Error(error.message);
      const resp = data as any;
      if (resp?.error) throw new Error(resp.error);
      toast.success("🦞 NFA purchased!");
      queryClient.invalidateQueries({ queryKey: ["nfa-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["nfa-detail-listing", id] });
      queryClient.invalidateQueries({ queryKey: ["nfa-collection-all"] });
    } catch (err: any) {
      if (err.message?.includes("User rejected") || err.message?.includes("cancelled")) toast.info("Transaction cancelled");
      else toast.error(err.message || "Purchase failed");
    } finally {
      setBuying(false);
    }
  }, [solanaAddress, isWalletReady, signAndSendTransaction, activeListing, nfa, id, queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!nfa) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Fingerprint className="h-12 w-12 opacity-20" style={{ color: "#4ade80" }} />
        <p className="text-muted-foreground">NFA not found</p>
        <Link to="/nfa" className="text-xs hover:underline" style={{ color: "#4ade80" }}>Back to collection</Link>
      </div>
    );
  }

  const shortAddr = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/10" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2818 40%, #0a1628 100%)" }}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to="/nfa" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors mb-4">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Collection
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Image */}
          <div className="rounded-2xl overflow-hidden border border-white/10 aspect-square" style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.08), rgba(34,197,94,0.03))" }}>
            {image ? (
              <img src={image} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Fingerprint className="h-16 w-16 opacity-20" style={{ color: "#4ade80" }} />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[10px] font-mono">#{nfa.slot_number}</Badge>
                {nfa.listed_for_sale && (
                  <Badge className="text-[10px]" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
                    Listed
                  </Badge>
                )}
                {isOwner && (
                  <Badge className="text-[10px]" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}>
                    You own this
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold font-mono">{name}</h1>
              {nfa.token_ticker && (
                <p className="text-sm text-muted-foreground font-mono mt-0.5">${nfa.token_ticker}</p>
              )}
            </div>

            {/* Price / Buy */}
            {activeListing && !isOwner && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-muted-foreground mb-1">Current Price</p>
                <p className="text-2xl font-mono font-bold" style={{ color: "#4ade80" }}>
                  {activeListing.asking_price_sol} SOL
                </p>
                {privyAvailable && solanaAddress && (
                  <button
                    onClick={handleBuy}
                    disabled={buying}
                    className="w-full mt-3 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)", color: "#000" }}
                  >
                    {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShoppingCart className="h-4 w-4" /> Buy Now</>}
                  </button>
                )}
              </div>
            )}

            {/* Owner Actions */}
            {isOwner && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Owner Actions</p>
                {nfa.listed_for_sale ? (
                  <div className="space-y-2">
                    <p className="text-sm">Listed for <span className="font-mono font-bold" style={{ color: "#4ade80" }}>{nfa.listing_price_sol} SOL</span></p>
                    <button
                      onClick={handleDelist}
                      disabled={processing}
                      className="w-full h-9 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/[0.06] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      Cancel Listing
                    </button>
                  </div>
                ) : showListInput ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={listPrice}
                      onChange={e => setListPrice(e.target.value)}
                      placeholder="Price in SOL"
                      className="bg-white/[0.04] border-white/10 text-sm flex-1"
                      step="0.1"
                      min="0.01"
                    />
                    <button
                      onClick={handleList}
                      disabled={processing || !listPrice}
                      className="h-9 px-4 rounded-lg text-xs font-bold disabled:opacity-50"
                      style={{ background: "#4ade80", color: "#000" }}
                    >
                      {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "List"}
                    </button>
                    <button onClick={() => { setShowListInput(false); setListPrice(""); }} className="h-9 px-2 rounded-lg text-xs border border-white/10">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowListInput(true)}
                    className="w-full h-9 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Tag className="h-3.5 w-3.5" /> List for Sale
                  </button>
                )}
              </div>
            )}

            {/* Info Grid */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              {[
                { label: "Owner", value: nfa.owner_wallet ? shortAddr(nfa.owner_wallet) : "—", copyable: nfa.owner_wallet },
                { label: "Minter", value: shortAddr(nfa.minter_wallet), copyable: nfa.minter_wallet },
                { label: "Status", value: nfa.status },
                { label: "Minted", value: new Date(nfa.created_at).toLocaleDateString() },
              ].map(({ label, value, copyable }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono">{value}</span>
                    {copyable && (
                      <button onClick={() => copyAddress(copyable)} className="text-muted-foreground hover:text-white transition-colors">
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* On-chain link */}
            {nfa.nfa_mint_address && (
              <a
                href={`https://solscan.io/token/${nfa.nfa_mint_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs hover:underline"
                style={{ color: "#4ade80" }}
              >
                View on Solscan <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
