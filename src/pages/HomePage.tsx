import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { MarqueeTicker } from "@/components/layout/MarqueeTicker";
import { Footer } from "@/components/layout/Footer";
import { PopshibaHero } from "@/components/home/PopshibaHero";
import { BarkLoudCloser } from "@/components/home/BarkLoudCloser";
import { PopshibaSectionHeader } from "@/components/home/PopshibaSectionHeader";
import { PopshibaPulse } from "@/components/home/PopshibaPulse";
import { PopshibaKingPanel } from "@/components/home/PopshibaKingPanel";
import { PopshibaXTracker } from "@/components/home/PopshibaXTracker";

const CONTAINER = "max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8";

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== "/") return;
    const createParam = new URLSearchParams(location.search).get("create");
    if (createParam === "1") navigate("/launchpad", { replace: true });
  }, [location.pathname, location.search, navigate]);

  return (
    <div className="bg-pop-orange min-h-screen font-pop-body text-pop-ink">
      <PopshibaTopNav />
      <MarqueeTicker />

      {/* HERO */}
      <PopshibaHero />

      {/* LIVE PULSE — orange bg, dark cards optional */}
      <section className="bg-pop-orange border-b-[3px] border-pop-ink py-14 sm:py-[70px]">
        <div className={CONTAINER}>
          <PopshibaSectionHeader
            eyebrow="// Live pulse — 3 stages, 1 feed"
            heading="New, [[bonding,]] migrated."
            sub="Every Popshiba token flows through three stages. Watch the whole pipeline live: fresh pairs, final-stretch bonders, and fully migrated winners."
          />
          <PopshibaPulse />

          {/* Just-launched ribbon */}
          <div className="mt-6 sm:mt-7 flex flex-wrap items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 bg-pop-ink text-pop-cream font-pop-mono text-[10px] sm:text-[11px] tracking-[0.15em] uppercase border-2 border-pop-ink shadow-[4px_4px_0_hsl(var(--pop-cream)),4px_4px_0_2px_hsl(var(--pop-ink))]">
            <span className="text-pop-orange font-bold">⚡ JUST LAUNCHED</span>
            <span className="opacity-70">— LAST 24 HOURS</span>
            <span className="ml-auto text-pop-orange font-bold cursor-pointer hover:underline">
              VIEW ALL →
            </span>
          </div>
        </div>
      </section>

      {/* KING OF THE HILL — cream bg */}
      <section className="bg-pop-cream border-b-[3px] border-pop-ink py-14 sm:py-20">
        <div className={CONTAINER}>
          <PopshibaSectionHeader
            eyebrow="// King of the hill"
            heading="Claim the [[throne.]]"
            sub="The loudest token on Popshiba sits on the throne. Top marketcap, top volume, top bark. Launch one, take it."
          />
          <PopshibaKingPanel />
        </div>
      </section>

      {/* X TRACKER — dark bg */}
      <section className="bg-pop-ink border-b-[3px] border-pop-orange py-14 sm:py-20">
        <div className={CONTAINER}>
          <PopshibaSectionHeader
            eyebrow="// X tracker"
            heading="Follow the loudest [[barks]] on X."
            sub="Top-wallet alpha, curated CT threads, and fresh calls — every post linked to a live tradeable token."
            variant="dark"
          />
          <PopshibaXTracker />
        </div>
      </section>

      {/* BIG CTA */}
      <BarkLoudCloser />

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
