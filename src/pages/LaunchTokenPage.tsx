import { useState } from "react";
import { LaunchTokenForm, WalletBalanceCard } from "@/components/launchpad";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { useChain } from "@/contexts/ChainContext";
import { Rocket, Info, Zap } from "lucide-react";

export default function LaunchTokenPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { chain, chainConfig } = useChain();
  const isBnb = chain === 'bnb';

  return (
    <div className="min-h-screen bg-pop-cream overflow-x-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full">
          {/* Poster Header */}
          <div className="mb-8 bg-pop-orange pop-border pop-shadow rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-pop-ink text-pop-orange p-2 rounded-md pop-border">
                <Rocket className="w-5 h-5" strokeWidth={2.75} />
              </div>
              <h1 className="font-pop-display text-3xl md:text-4xl uppercase text-pop-ink tracking-tight leading-none">
                Create Token
              </h1>
            </div>
            <p className="font-pop-mono text-xs text-pop-ink/80 uppercase tracking-wider mt-3">
              Launch on {chainConfig.name} · {isBnb ? 'PancakeSwap V2 · Direct DEX' : 'Bonding curve · Instant trading'}
            </p>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            {/* Left: Form */}
            <div className="bg-pop-cream pop-border pop-shadow rounded-lg p-1">
              <LaunchTokenForm />
            </div>

            {/* Right: Sticky Sidebar */}
            <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
              <div className="bg-pop-cream pop-border pop-shadow rounded-lg">
                <WalletBalanceCard minRequired={isBnb ? 0.01 : 0.1} />
              </div>

              {/* Platform Info Card */}
              <div className="bg-pop-cream pop-border pop-shadow rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-pop-ink">
                  <Info className="w-4 h-4 text-pop-ink" strokeWidth={2.75} />
                  <span className="font-pop-display text-[11px] text-pop-ink uppercase tracking-widest">Platform Info</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-pop-mono text-[11px] text-pop-ink/70 uppercase">Chain</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-mint pop-border" />
                      <span className="font-pop-mono text-xs text-pop-ink font-bold">{chainConfig.name}</span>
                    </div>
                  </div>
                  <div className="border-t border-pop-ink/15" />
                  <div className="flex items-center justify-between">
                    <span className="font-pop-mono text-[11px] text-pop-ink/70 uppercase">Platform Fee</span>
                    <span className="font-pop-mono text-xs text-pop-ink font-bold">{isBnb ? '0.5%' : '1%'}</span>
                  </div>
                  <div className="border-t border-pop-ink/15" />
                  <div className="flex items-center justify-between">
                    <span className="font-pop-mono text-[11px] text-pop-ink/70 uppercase">Creator Fee</span>
                    <span className="font-pop-mono text-xs text-pop-ink font-bold text-right">{isBnb ? '80% fees' : '50% fees'}</span>
                  </div>
                  <div className="border-t border-pop-ink/15" />
                  <div className="flex items-center justify-between">
                    <span className="font-pop-mono text-[11px] text-pop-ink/70 uppercase">Supply</span>
                    <span className="font-pop-mono text-xs text-pop-ink font-bold">1,000,000,000</span>
                  </div>
                  <div className="border-t border-pop-ink/15" />
                  <div className="flex items-center justify-between">
                    <span className="font-pop-mono text-[11px] text-pop-ink/70 uppercase">Standard</span>
                    <span className="font-pop-mono text-xs text-pop-ink font-bold">{isBnb ? 'BEP-20' : 'SPL'}</span>
                  </div>
                </div>
              </div>

              {/* Tip Card */}
              <div className="bg-pop-orange pop-border pop-shadow rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-pop-ink" strokeWidth={2.75} />
                  <span className="font-pop-display text-[11px] text-pop-ink uppercase tracking-widest">Pro Tip</span>
                </div>
                <p className="font-pop-mono text-[11px] text-pop-ink leading-relaxed">
                  {isBnb ? (
                    <>We recommend ≥ <span className="font-bold underline decoration-2">0.1 BNB</span> seed liquidity for healthy price discovery on PancakeSwap.</>
                  ) : (
                    <>We recommend ≥ <span className="font-bold underline decoration-2">0.5 SOL</span> initial buy to avoid snipers and ensure healthy price discovery.</>
                  )}
                </p>
              </div>

              {/* Launch steps */}
              <div className="bg-pop-cream pop-border pop-shadow rounded-lg p-5">
                <div className="pb-2 mb-4 border-b-2 border-pop-ink">
                  <span className="font-pop-display text-[11px] text-pop-ink uppercase tracking-widest">How It Works</span>
                </div>
                <div className="space-y-2.5">
                  {(isBnb ? [
                    { n: "01", t: "Fill token details" },
                    { n: "02", t: "Set seed BNB amount" },
                    { n: "03", t: "Deploy to PancakeSwap" },
                    { n: "04", t: "Token goes live instantly" },
                  ] : [
                    { n: "01", t: "Fill token details" },
                    { n: "02", t: "Set initial buy amount" },
                    { n: "03", t: "Bitcoin genesis confirmation" },
                    { n: "04", t: "Token goes live on-chain" },
                  ]).map(({ n, t }) => (
                    <div key={n} className="flex items-center gap-3">
                      <span className="font-pop-display text-[11px] bg-pop-ink text-pop-orange px-1.5 py-0.5 rounded-sm">{n}</span>
                      <span className="font-pop-mono text-[11px] text-pop-ink">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
