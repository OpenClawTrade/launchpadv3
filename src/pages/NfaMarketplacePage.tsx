import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useNfaMarketplace } from "@/hooks/useNfaMarketplace";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { Badge } from "@/components/ui/badge";
import { Fingerprint, ShoppingCart, ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function NfaMarketplacePage() {
  const { listings, floorPrice, totalListed, isLoading } = useNfaMarketplace();
  const { solanaAddress } = useAuth();
  const privyAvailable = usePrivyAvailable();
  const { signAndSendTransaction, isWalletReady } = useSolanaWalletWithPrivy();
  const queryClient = useQueryClient();
  const [buying, setBuying] = useState<string | null>(null);
  const [sort, setSort] = useState<"low" | "high" | "recent">("low");

  const sorted = [...listings].sort((a, b) => {
    if (sort === "low") return a.asking_price_sol - b.asking_price_sol;
    if (sort === "high") return b.asking_price_sol - a.asking_price_sol;
    return new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime();
  });

  const handleBuy = useCallback(async (listing: typeof listings[0]) => {
    if (!solanaAddress || !isWalletReady || !listing.mint) return;
    setBuying(listing.id);
    try {
      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const rpcUrl = (window as any).__RUNTIME_RPC_URL || import.meta.env.VITE_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      const fromPubkey = new PublicKey(solanaAddress);
      const toPubkey = new PublicKey(listing.seller_wallet);
      const transaction = new Transaction().add(
        SystemProgram.transfer({ fromPubkey, toPubkey, lamports: Math.floor(listing.asking_price_sol * LAMPORTS_PER_SOL) })
      );
      toast.info("Approve the transaction in your wallet...");
      const { signature, confirmed } = await signAndSendTransaction(transaction);
      if (!confirmed) { toast.error("Transaction not confirmed"); return; }
      toast.info("Payment confirmed! Transferring NFA...");
      const { data, error } = await supabase.functions.invoke("nfa-buy", {
        body: { buyerWallet: solanaAddress, listingId: listing.id, paymentSignature: signature },
      });
      if (error) throw new Error(error.message);
      const resp = data as any;
      if (resp?.error) throw new Error(resp.error);
      toast.success("🦞 NFA purchased!");
      queryClient.invalidateQueries({ queryKey: ["nfa-marketplace-listings"] });
      queryClient.invalidateQueries({ queryKey: ["nfa-my-mints"] });
      queryClient.invalidateQueries({ queryKey: ["nfa-collection-all"] });
    } catch (err: any) {
      if (err.message?.includes("User rejected") || err.message?.includes("cancelled")) toast.info("Transaction cancelled");
      else toast.error(err.message || "Purchase failed");
    } finally {
      setBuying(null);
    }
  }, [solanaAddress, isWalletReady, signAndSendTransaction, queryClient]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/10" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2818 40%, #0a1628 100%)" }}>
        <div className="max-w-5xl mx-auto px-4 py-10">
          <Link to="/nfa" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors mb-4">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Collection
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="h-6 w-6" style={{ color: "#4ade80" }} />
            <h1 className="text-2xl font-bold font-mono">NFA Marketplace</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Buy and sell Non-Fungible Agents</p>
          <div className="flex gap-4">
            {[
              { label: "Listed", value: totalListed.toString() },
              { label: "Floor", value: floorPrice ? `${floorPrice} SOL` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10">
                <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
                <p className="font-mono font-bold text-sm">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Sort */}
        <div className="flex gap-2 mb-6">
          {([
            { id: "low" as const, label: "Price: Low → High" },
            { id: "high" as const, label: "Price: High → Low" },
            { id: "recent" as const, label: "Recently Listed" },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sort === id ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white/70"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-20 text-muted-foreground" />
            <p className="text-muted-foreground">No NFAs listed for sale</p>
            <Link to="/nfa" className="text-xs mt-2 inline-block" style={{ color: "#4ade80" }}>View collection →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {sorted.map(listing => {
              const mint = listing.mint as any;
              const image = mint?.token_image_url || mint?.agent_image_url;
              const name = mint?.token_name || mint?.agent_name || `NFA #${mint?.slot_number || "?"}`;
              const isSelf = listing.seller_wallet === solanaAddress;

              return (
                <Link to={`/nfa/${listing.nfa_mint_id}`} key={listing.id} className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-200 group block">
                  <div className="aspect-square relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.08), rgba(34,197,94,0.03))" }}>
                    {image ? (
                      <img src={image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Fingerprint className="h-8 w-8 opacity-20" style={{ color: "#4ade80" }} />
                      </div>
                    )}
                    {mint?.slot_number && (
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/60 backdrop-blur-sm text-white">
                        #{mint.slot_number}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm truncate">{name}</p>
                    {mint?.token_ticker && <p className="text-[10px] text-muted-foreground font-mono">${mint.token_ticker}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-mono font-bold text-sm" style={{ color: "#4ade80" }}>{listing.asking_price_sol} SOL</span>
                      <span className="text-[9px] text-muted-foreground">{listing.seller_wallet.slice(0, 4)}...{listing.seller_wallet.slice(-4)}</span>
                    </div>
                    {privyAvailable && solanaAddress && !isSelf && (
                      <button
                        onClick={() => handleBuy(listing)}
                        disabled={buying === listing.id}
                        className="w-full mt-3 h-9 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)", color: "#000" }}
                      >
                        {buying === listing.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Buy</>}
                      </button>
                    )}
                    {isSelf && (
                      <p className="text-[10px] text-muted-foreground text-center mt-3">Your listing</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
