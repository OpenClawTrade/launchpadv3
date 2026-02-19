import { useState } from "react";
import { LaunchTokenForm, WalletBalanceCard } from "@/components/launchpad";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { Rocket, Info, Zap } from "lucide-react";

export default function LaunchTokenPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[160px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">
          {/* Page Header */}
          <div className="mb-6 border-l-2 border-[#e84040] pl-4">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-[#e84040]" />
              <h1 className="font-mono text-sm text-[#e84040] uppercase tracking-widest">Create Token</h1>
            </div>
            <p className="font-mono text-xs text-[#555] mt-1 tracking-wide">Launch on Solana · Bonding curve · Instant trading</p>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            {/* Left: Form */}
            <div>
              <LaunchTokenForm />
            </div>

            {/* Right: Sticky Sidebar */}
            <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              <WalletBalanceCard minRequired={0.05} />

              {/* Platform Info Card */}
              <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3 border-l-2 border-[#e84040] pl-2">
                  <Info className="w-3 h-3 text-[#e84040]" />
                  <span className="font-mono text-[10px] text-[#e84040] uppercase tracking-widest">Platform Info</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#555] uppercase">Chain</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-mono text-xs text-white">Solana</span>
                    </div>
                  </div>
                  <div className="border-t border-[#1a1a1a]" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#555] uppercase">Platform Fee</span>
                    <span className="font-mono text-xs text-white">1%</span>
                  </div>
                  <div className="border-t border-[#1a1a1a]" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#555] uppercase">Creator Fee</span>
                    <span className="font-mono text-xs text-white">50% of trading fees</span>
                  </div>
                  <div className="border-t border-[#1a1a1a]" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#555] uppercase">Total Supply</span>
                    <span className="font-mono text-xs text-white">1,000,000,000</span>
                  </div>
                  <div className="border-t border-[#1a1a1a]" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#555] uppercase">Standard</span>
                    <span className="font-mono text-xs text-white">SPL Token</span>
                  </div>
                </div>
              </div>

              {/* Tip Card */}
              <div className="bg-[#0f0a00] border border-[#e84040]/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3 h-3 text-[#e84040]" />
                  <span className="font-mono text-[10px] text-[#e84040] uppercase tracking-widest">Pro Tip</span>
                </div>
                <p className="font-mono text-[11px] text-[#888] leading-relaxed">
                  We recommend ≥ <span className="text-[#e84040]">0.5 SOL</span> initial buy to avoid snipers and ensure healthy price discovery.
                </p>
              </div>

              {/* Launch steps */}
              <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                <div className="border-l-2 border-[#e84040] pl-2 mb-3">
                  <span className="font-mono text-[10px] text-[#e84040] uppercase tracking-widest">How It Works</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { n: "01", t: "Fill token details" },
                    { n: "02", t: "Set initial buy amount" },
                    { n: "03", t: "Verify & launch" },
                    { n: "04", t: "Token goes live instantly" },
                  ].map(({ n, t }) => (
                    <div key={n} className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[#e84040] w-5">{n}</span>
                      <span className="font-mono text-[11px] text-[#666]">{t}</span>
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
