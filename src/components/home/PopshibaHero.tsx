import { Link } from "react-router-dom";
import { Zap, Shield, ArrowUpRight, CircleDot, Rocket } from "lucide-react";

const FEATURES = [
  { icon: Zap, label: "Fastest Execution" },
  { icon: Shield, label: "Secure Trading" },
  { icon: ArrowUpRight, label: "Referral System" },
  { icon: CircleDot, label: "Agents Staking" },
];

const TRENDING = [
  { sym: "PUNK", chg: "+1500%" },
  { sym: "LAIKA", chg: "+113%" },
  { sym: "UNC", chg: "+62%" },
  { sym: "GENESIS", chg: "+24%" },
  { sym: "WOOF", chg: "+9%" },
];

/** Wireframe label like `[ HERO / H1 ]` overlaid on a dashed outline. */
function WireFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative outline outline-[1.5px] outline-dashed outline-pop-ink/35 -outline-offset-[1.5px] p-6 sm:p-10">
      <span className="absolute -top-2.5 left-3 font-pop-mono text-[9px] tracking-[0.15em] uppercase text-pop-ink/55 bg-pop-orange px-1.5">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Dark terminal mockup — POPSHIBA.TERM with chart + buy/sell footer. */
function TerminalMockup() {
  return (
    <div className="bg-[#171310] border-2 border-pop-ink shadow-[6px_6px_0_hsl(var(--pop-orange))] text-pop-cream font-pop-mono w-full max-w-[560px]">
      {/* title bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2b2218] bg-[#231c16]">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 bg-[#3a1f14] border border-[#5c3a2a]" />
          <span className="w-2.5 h-2.5 bg-[#3a1f14] border border-[#5c3a2a]" />
          <span className="w-2.5 h-2.5 bg-[#3a1f14] border border-[#5c3a2a]" />
        </span>
        <span className="text-[11px] tracking-[0.08em] text-pop-cream/85">
          POPSHIBA.TERM / $POPSHIBA
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-[#5ce68e]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5ce68e] animate-pulse" /> LIVE
        </span>
      </div>

      {/* header strip */}
      <div className="flex items-start justify-between px-5 pt-4">
        <div>
          <div className="text-pop-orange text-[15px] font-bold leading-tight">
            $POPSHIBA / WETH
          </div>
          <div className="text-[10px] tracking-[0.1em] text-pop-cream/55 mt-1">
            UNISWAP V3 · ETH
          </div>
        </div>
        <div className="text-right">
          <div className="text-pop-cream text-[20px] font-bold leading-none">
            $0.00042 <span className="text-[#5ce68e] text-[14px] ml-1">+142.8%</span>
          </div>
          <div className="text-[10px] text-pop-cream/55 mt-1">
            MC $4.2M · LP $820K
          </div>
        </div>
      </div>

      {/* chart placeholder — pseudo candlesticks */}
      <div className="relative h-[200px] mx-5 my-4 border-t border-b border-dashed border-[#2b2218]">
        <svg viewBox="0 0 360 180" className="w-full h-full" preserveAspectRatio="none">
          {/* horizontal grid */}
          {[40, 80, 120, 160].map((y) => (
            <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="#2b2218" strokeWidth="1" strokeDasharray="3,3" />
          ))}
          {/* candles — ascending */}
          {[
            [10, 130, 145, 120, 110],
            [30, 120, 140, 115, 105],
            [50, 110, 125, 105, 95],
            [70, 105, 120, 100, 90],
            [90, 100, 115, 95, 88],
            [110, 95, 110, 90, 80],
            [130, 88, 100, 85, 75],
            [150, 80, 95, 78, 70],
            [170, 75, 88, 72, 65],
            [190, 68, 80, 65, 58],
            [210, 60, 72, 58, 50],
            [230, 55, 68, 50, 45],
            [250, 50, 60, 45, 38],
            [270, 45, 55, 40, 32],
            [290, 38, 50, 35, 28],
            [310, 32, 45, 30, 25],
            [330, 28, 40, 25, 20],
            [350, 22, 35, 20, 15],
          ].map(([x, o, h, c, l], i) => {
            const top = Math.min(o, c);
            const height = Math.abs(o - c) || 2;
            return (
              <g key={i}>
                <line x1={x} y1={l} x2={x} y2={h} stroke="#f5a524" strokeWidth="1" />
                <rect x={x - 4} y={top} width="8" height={height} fill="#f5a524" />
              </g>
            );
          })}
          {/* price labels */}
          <text x="350" y="44" textAnchor="end" fill="#a49a8a" fontSize="9" fontFamily="monospace">0.00048</text>
          <text x="350" y="124" textAnchor="end" fill="#a49a8a" fontSize="9" fontFamily="monospace">0.00040</text>
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-pop-cream/45 px-1">
          <span>09:00</span><span>11:00</span><span>13:00</span><span>15:00</span><span>17:00</span><span>NOW</span>
        </div>
      </div>

      {/* action footer */}
      <div className="grid grid-cols-2 gap-1.5 p-3 bg-[#0e0b08] border-t border-[#2b2218]">
        <button className="bg-[#5ce68e] text-pop-ink py-2.5 font-bold text-[11px] tracking-[0.12em] hover:bg-[#4dd17e] transition-colors">
          SNIPE BUY
        </button>
        <button className="bg-[#e8605a] text-pop-cream py-2.5 font-bold text-[11px] tracking-[0.12em] hover:bg-[#d4554f] transition-colors">
          SELL ALL
        </button>
      </div>
    </div>
  );
}

export function PopshibaHero() {
  return (
    <section className="relative bg-pop-orange text-pop-ink overflow-hidden">
      {/* dotted pattern */}
      <div
        className="absolute inset-0 opacity-[0.18] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--pop-ink)) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-7 py-12 lg:py-16">
        <WireFrame label="[ hero / h1 ]">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] gap-10 lg:gap-12 items-center">
            {/* LEFT */}
            <div>
              {/* eyebrow pill */}
              <div className="inline-flex items-center gap-2 bg-pop-ink text-pop-cream px-4 py-2 rounded-full mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-pop-orange" />
                <span className="font-pop-mono text-[10px] tracking-[0.18em] uppercase">
                  The loudest barking launchpad · trading terminal
                </span>
              </div>

              {/* POPSHIBA wordmark */}
              <h1 className="font-pop-display text-pop-ink leading-[0.88] tracking-[-0.04em] text-[4.5rem] sm:text-[7rem] lg:text-[8.5rem] mb-6">
                POPSHIBA
              </h1>

              {/* subhead */}
              <p className="text-pop-ink/85 text-[16px] sm:text-[18px] max-w-[520px] mb-8 leading-snug">
                Fastest Ethereum trading terminal. Next-generation launchpad. One interface. Zero limits.
              </p>

              {/* CTAs */}
              <div className="flex items-center gap-3 flex-wrap mb-8">
                <Link
                  to="/trade"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-transparent border-2 border-pop-ink text-pop-ink font-bold text-[14px] shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_hsl(var(--pop-ink))] transition-all"
                >
                  ◆ Open Terminal →
                </Link>
                <Link
                  to="/launch"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-pop-ink text-pop-cream border-2 border-pop-ink font-bold text-[14px] shadow-[3px_3px_0_hsl(var(--pop-cream))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-cream))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_hsl(var(--pop-cream))] transition-all"
                >
                  <Rocket className="w-4 h-4" /> Launch Token
                </Link>
              </div>

              {/* feature strip */}
              <div className="flex items-center gap-x-6 gap-y-2 flex-wrap mb-6">
                {FEATURES.map((f) => (
                  <span key={f.label} className="inline-flex items-center gap-2">
                    <span className="w-7 h-7 bg-pop-ink text-pop-orange flex items-center justify-center">
                      <f.icon className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="font-pop-mono text-[10px] tracking-[0.14em] uppercase font-bold">
                      {f.label}
                    </span>
                  </span>
                ))}
              </div>

              {/* trending pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-3 py-1.5 bg-pop-ink text-pop-cream font-pop-mono text-[10px] tracking-[0.14em] uppercase font-bold border-2 border-pop-ink">
                  Trending
                </span>
                {TRENDING.map((t) => (
                  <span
                    key={t.sym}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pop-cream border-2 border-pop-ink font-pop-mono text-[10px] tracking-[0.1em] uppercase font-bold shadow-[2px_2px_0_hsl(var(--pop-ink))]"
                  >
                    <span className="text-pop-ink">{t.sym}</span>
                    <span className="text-[#1a8a4a]">{t.chg}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* RIGHT — terminal mockup */}
            <div className="flex justify-center lg:justify-end">
              <TerminalMockup />
            </div>
          </div>
        </WireFrame>
      </div>
    </section>
  );
}
