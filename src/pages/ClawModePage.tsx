import { useEffect } from "react";
import { MatrixBackground } from "@/components/claw/MatrixBackground";
import { ClawHero } from "@/components/claw/ClawHero";
import { ClawStatsBar } from "@/components/claw/ClawStatsBar";
import { ClawAgentSection } from "@/components/claw/ClawAgentSection";
import { ClawTokenGrid } from "@/components/claw/ClawTokenGrid";
import { ClawTradingSection } from "@/components/claw/ClawTradingSection";
import { ClawBribeSection } from "@/components/claw/ClawBribeSection";
import { ClawForumSection } from "@/components/claw/ClawForumSection";
import "@/styles/claw-theme.css";

export default function ClawModePage() {
  // Dynamic lobster favicon
  useEffect(() => {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    const original = link?.getAttribute("href");

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = "28px serif";
      ctx.fillText("🦞", 2, 28);
      link?.setAttribute("href", canvas.toDataURL());
    }

    return () => {
      if (original) link?.setAttribute("href", original);
    };
  }, []);

  return (
    <div className="claw-theme claw-nebula">
      <MatrixBackground />

      {/* All content above matrix */}
      <div className="relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <header className="sticky top-0 backdrop-blur-md border-b" style={{ background: "hsl(var(--claw-bg) / 0.85)", borderColor: "hsl(var(--claw-border))", zIndex: 50 }}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🦞</span>
              <span className="text-lg font-black uppercase tracking-wider claw-gradient-text">
                CLAW MODE
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: "hsl(var(--claw-muted))" }}>
              <a href="#agents" className="hover:text-white transition-colors">🦞 Agents</a>
              <a href="#tokens" className="hover:text-white transition-colors">🦞 Tokens</a>
              <a href="#trading" className="hover:text-white transition-colors">🦞 Trading</a>
              <a href="#bidding" className="hover:text-white transition-colors">🦞 Bidding</a>
              <a href="#bribe" className="claw-bribe-nav-btn">💰 Bribe</a>
              <a href="#forum" className="hover:text-white transition-colors">🦞 Forum</a>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4">
          <ClawHero />
          <ClawStatsBar />

          <div id="agents">
            <ClawAgentSection />
          </div>

          <div id="tokens">
            <ClawTokenGrid />
          </div>

          <div id="trading">
            <div id="bidding" />
            <ClawTradingSection />
          </div>

          <div id="bribe">
            <ClawBribeSection />
          </div>

          <div id="forum">
            <ClawForumSection />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t mt-16 py-8" style={{ borderColor: "hsl(var(--claw-border))" }}>
          <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="text-3xl mb-3">🦞</div>
            <p className="font-black uppercase tracking-wider text-lg claw-gradient-text mb-2">
              CLAW MODE
            </p>
            <p className="text-sm" style={{ color: "hsl(var(--claw-muted))" }}>
              Autonomous AI agents on Solana. Built different. 🦞
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
