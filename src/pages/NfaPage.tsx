import { useState } from "react";
import { useNfaCollection } from "@/hooks/useNfaCollection";
import { Badge } from "@/components/ui/badge";
import { Fingerprint, CheckCircle2, Globe, Users, Coins, TrendingUp, ExternalLink, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";

export default function NfaPage() {
  const { batch, collection, totalMinted, uniqueOwners, floorPrice, isLoading } = useNfaCollection();
  const [tab, setTab] = useState<"collection" | "activity">("collection");

  const progress = batch ? (batch.minted_count / batch.total_slots) * 100 : 0;

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
            <CheckCircle2 className="h-6 w-6" style={{ color: "#4ade80" }} />
          </div>
          <p className="text-sm text-muted-foreground max-w-lg mb-8">
            1,000 autonomous AI trading agents minted as Metaplex Core NFTs on Solana. Each NFA earns, trades & evolves — the first of its kind.
          </p>

          {/* Stats */}
          <div className="flex items-center rounded-2xl bg-white/[0.06] backdrop-blur-sm border border-white/10 divide-x divide-white/10">
            {[
              { label: "Items", value: "1,000" },
              { label: "Minted", value: totalMinted.toLocaleString() },
              { label: "Owners", value: uniqueOwners.toLocaleString() },
              { label: "Floor", value: floorPrice ? `${floorPrice} SOL` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="px-6 py-4 text-center min-w-[90px]">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="font-mono font-bold text-lg mt-1">{value}</p>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex gap-3 mt-8">
            <Link
              to="/panel?tab=nfa"
              className="h-12 px-6 rounded-xl font-bold font-mono text-sm flex items-center gap-2 transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)", color: "#000" }}
            >
              <Fingerprint className="h-4 w-4" /> Mint NFA
              <span className="ml-1 px-2 py-0.5 rounded-md text-[10px]" style={{ background: "rgba(0,0,0,0.2)" }}>1 SOL</span>
            </Link>
            <Link
              to="/nfa/marketplace"
              className="h-12 px-6 rounded-xl font-medium text-sm flex items-center gap-2 border border-white/10 hover:bg-white/[0.06] transition-colors"
            >
              <ShoppingCart className="h-4 w-4" /> Marketplace
            </Link>
          </div>
        </div>
      </div>

      {/* Progress */}
      {batch && (
        <div className="max-w-5xl mx-auto px-4 -mt-4">
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-lg font-bold font-mono">{batch.minted_count}<span className="text-sm text-muted-foreground font-normal"> / {batch.total_slots.toLocaleString()}</span></span>
              <Badge variant="outline" className="font-mono text-xs">Batch #{batch.batch_number}</Badge>
            </div>
            <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(progress, 1)}%`, background: "linear-gradient(90deg, #4ade80, #22c55e, #16a34a)" }} />
            </div>
          </div>
        </div>
      )}

      {/* Collection Grid */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold font-mono">Collection</h2>
          <div className="flex gap-2">
            {(["collection", "activity"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white/70"}`}
              >
                {t === "collection" ? "All NFAs" : "Activity"}
              </button>
            ))}
          </div>
        </div>

        {tab === "collection" && (
          collection.length === 0 ? (
            <div className="text-center py-16">
              <Fingerprint className="h-12 w-12 mx-auto mb-4 opacity-20" style={{ color: "#4ade80" }} />
              <p className="text-muted-foreground">No NFAs minted yet. Be the first!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {collection.map(nfa => {
                const image = nfa.token_image_url || nfa.agent_image_url;
                const name = nfa.token_name || nfa.agent_name || `NFA #${nfa.slot_number}`;
                return (
                  <Link to={`/nfa/${nfa.id}`} key={nfa.id} className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:scale-[1.02] transition-all duration-200 group block">
                    <div className="aspect-square relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.08), rgba(34,197,94,0.03))" }}>
                      {image ? (
                        <img src={image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Fingerprint className="h-8 w-8 opacity-20" style={{ color: "#4ade80" }} />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/60 backdrop-blur-sm text-white">
                        #{nfa.slot_number}
                      </div>
                      {nfa.listed_for_sale && nfa.listing_price_sol && (
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold backdrop-blur-sm" style={{ background: "rgba(74,222,128,0.85)", color: "#000" }}>
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
          )
        )}

        {tab === "activity" && (
          <div className="space-y-3">
            {collection.slice().reverse().slice(0, 20).map(nfa => (
              <div key={nfa.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03]">
                <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0" style={{ background: "rgba(74,222,128,0.1)" }}>
                  {(nfa.token_image_url || nfa.agent_image_url) ? (
                    <img src={nfa.token_image_url || nfa.agent_image_url || ""} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Fingerprint className="h-4 w-4 opacity-30" style={{ color: "#4ade80" }} /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{nfa.token_name || `NFA #${nfa.slot_number}`}</p>
                  <p className="text-[10px] text-muted-foreground">Minted by {nfa.minter_wallet.slice(0, 4)}...{nfa.minter_wallet.slice(-4)}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(nfa.created_at).toLocaleDateString()}</span>
              </div>
            ))}
            {collection.length === 0 && <p className="text-center text-muted-foreground py-8">No activity yet</p>}
          </div>
        )}
      </div>
    </div>
  );
}
