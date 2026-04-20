import { Link } from "react-router-dom";
import { Rocket } from "lucide-react";

const FEATURES = [
  { glyph: "⚡", label: "Fastest execution" },
  { glyph: "🛡", label: "Secure trading" },
  { glyph: "↗", label: "Referral system" },
  { glyph: "◎", label: "Agents staking" },
];

const TRENDING = [
  { sym: "PUNK", chg: "+1500%", color: "#7c5cff" },
  { sym: "LAIKA", chg: "+113%", color: "#4ea65f" },
  { sym: "UNC", chg: "+62%", color: "#2d65c9" },
  { sym: "GENESIS", chg: "+24%", color: "#c94d4d" },
  { sym: "WOOF", chg: "+9%", color: "#e8891a" },
];

/** Wireframe label like `[ HERO / H1 ]`. */
function WireFrame({
  label,
  labelColor,
  className = "",
  children,
}: {
  label: string;
  labelColor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative outline outline-[1.5px] outline-dashed outline-pop-ink/35 -outline-offset-[1.5px] ${className}`}>
      <span
        className="absolute -top-2.5 left-3 font-pop-mono text-[9px] tracking-[0.15em] uppercase bg-pop-orange px-1.5 z-[2] pointer-events-none"
        style={{ color: labelColor || "rgba(14,11,8,0.55)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** Big terminal mockup with full candle SVG + y/x axis labels. */
function TerminalMockup() {
  return (
    <WireFrame
      label="[ live terminal ]"
      labelColor="rgba(245,165,36,0.7)"
      className="bg-pop-ink text-pop-cream font-pop-mono w-full max-w-[560px] mx-auto lg:mx-0 shadow-[6px_6px_0_hsl(var(--pop-cream)),6px_6px_0_2px_hsl(var(--pop-ink))]"
    >
      {/* head */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2b2218] bg-[#231c16]">
        <span className="w-2.5 h-2.5 bg-pop-orange border border-pop-ink" />
        <span className="w-2.5 h-2.5 bg-pop-orange border border-pop-ink" />
        <span className="w-2.5 h-2.5 bg-pop-orange border border-pop-ink" />
        <span className="ml-3 text-[10px] tracking-[0.1em] text-[#a49a8a] truncate">
          POPSHIBA.TERM / $POPSHIBA
        </span>
        <span className="ml-auto text-[10px] text-[#5ce68e] shrink-0">● LIVE</span>
      </div>

      {/* chart area */}
      <div className="relative px-4 sm:px-5 pt-4 pb-3.5 bg-pop-ink">
        {/* overview */}
        <div className="flex items-start justify-between gap-2 mb-2 text-[11px]">
          <div className="min-w-0">
            <div className="font-pop-display text-[13px] sm:text-[14px] text-pop-orange tracking-[0.03em] truncate">
              $POPSHIBA / WETH
            </div>
            <div className="text-[10px] text-[#a49a8a] tracking-[0.08em] mt-0.5">UNISWAP V3 · ETH</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-pop-display text-[18px] sm:text-[22px] text-pop-cream tracking-[-0.02em] leading-none whitespace-nowrap">
              $0.00042 <span className="text-[#5ce68e] font-bold ml-1.5 text-[14px] sm:text-[16px]">+142.8%</span>
            </div>
            <div className="text-[10px] text-[#a49a8a] tracking-[0.08em] mt-1">MC $4.2M · LP $820K</div>
          </div>
        </div>

        {/* y-axis labels */}
        <div className="absolute right-4 sm:right-5 top-[78px] bottom-9 flex flex-col justify-between text-right font-pop-mono text-[9px] text-[rgba(245,165,36,0.35)] pointer-events-none">
          <span>0.00048</span>
          <span>0.00044</span>
          <span>0.00040</span>
          <span>0.00036</span>
        </div>

        {/* candles */}
        <svg viewBox="0 0 400 140" preserveAspectRatio="none" className="w-full h-[180px] sm:h-[240px] lg:h-[280px] block">
          <g stroke="rgba(245,165,36,0.12)" strokeDasharray="3,4">
            <line x1="0" y1="35" x2="400" y2="35" />
            <line x1="0" y1="70" x2="400" y2="70" />
            <line x1="0" y1="105" x2="400" y2="105" />
          </g>
          {[
            [10,100,20,92,125,"#f5a524"],
            [28,92,16,85,115,"#f5a524"],
            [46,96,10,90,110,"#b8781a"],
            [64,80,22,72,108,"#f5a524"],
            [82,72,14,66,92,"#f5a524"],
            [100,78,8,72,90,"#b8781a"],
            [118,60,20,54,86,"#f5a524"],
            [136,52,12,46,70,"#f5a524"],
            [154,56,8,52,68,"#b8781a"],
            [172,40,20,34,64,"#f5a524"],
            [190,32,12,26,50,"#f5a524"],
            [208,36,8,30,48,"#b8781a"],
            [226,22,18,16,44,"#f5a524"],
            [244,16,12,10,32,"#f5a524"],
            [262,20,8,14,32,"#b8781a"],
            [280,12,12,6,28,"#f5a524"],
            [298,18,10,12,32,"#b8781a"],
            [316,8,14,4,26,"#f5a524"],
            [334,4,10,0,18,"#f5a524"],
            [352,14,8,8,24,"#b8781a"],
            [370,6,12,0,22,"#f5a524"],
          ].map(([x, y, h, wickT, wickB, c], i) => (
            <g key={i}>
              <rect x={x as number} y={y as number} width="8" height={h as number} fill={c as string} />
              <line x1={(x as number) + 4} y1={wickT as number} x2={(x as number) + 4} y2={wickB as number} stroke={c as string} />
            </g>
          ))}
        </svg>

        {/* x-axis */}
        <div className="flex justify-between mt-2 px-0.5 font-pop-mono text-[9px] text-[rgba(245,165,36,0.35)] tracking-[0.05em]">
          <span>09:00</span><span>11:00</span><span>13:00</span><span>15:00</span><span>17:00</span><span>NOW</span>
        </div>
      </div>

      {/* buy row */}
      <div className="grid grid-cols-2 gap-1.5 p-2.5 bg-[#231c16] border-t border-[#2b2218]">
        <button className="font-pop-mono text-[11px] py-2.5 border-2 font-bold tracking-[0.08em] bg-[#5ce68e] text-pop-ink border-[#5ce68e] shadow-[2px_2px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-transform">
          SNIPE BUY
        </button>
        <button className="font-pop-mono text-[11px] py-2.5 border-2 font-bold tracking-[0.08em] bg-[#e8605a] text-pop-cream border-[#e8605a] shadow-[2px_2px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-transform">
          SELL ALL
        </button>
      </div>
    </WireFrame>
  );
}

export function PopshibaHero() {
  return (
    <section className="relative bg-pop-orange text-pop-ink border-b-[3px] border-pop-ink overflow-hidden">
      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-8 lg:gap-12 items-center">
          {/* LEFT — wire-framed centered hero */}
          <WireFrame label="[ hero / h1 ]" className="text-center px-5 sm:px-8 lg:px-12 py-8 sm:py-10">
            {/* kicker */}
            <div className="inline-flex items-center gap-2 bg-pop-ink text-pop-cream px-3 py-1.5 mb-5 sm:mb-6 max-w-full">
              <span className="w-2 h-2 rounded-full bg-pop-orange shadow-[0_0_10px_hsl(var(--pop-orange))] animate-pulse shrink-0" />
              <span className="font-pop-mono text-[9px] sm:text-[11px] tracking-[0.16em] sm:tracking-[0.2em] uppercase truncate">
                The loudest barking launchpad · trading terminal
              </span>
            </div>

            {/* POPSHIBA wordmark with cream highlight */}
            <h1
              className="font-pop-display text-pop-ink leading-[0.86] tracking-[-0.045em] mb-4 sm:mb-5 whitespace-nowrap"
              style={{ fontSize: "clamp(48px, 9vw, 112px)" }}
            >
              POP
              <span className="relative inline-block">
                <span className="relative z-10">SHIBA</span>
                <span
                  className="absolute left-0 right-0 bottom-[8px] h-[10px] sm:h-[12px] bg-pop-cream -z-0"
                  aria-hidden
                />
              </span>
            </h1>

            {/* lede */}
            <p className="text-[14px] sm:text-[17px] lg:text-[18px] leading-snug text-[#3a1f14] max-w-[560px] mx-auto mb-6 sm:mb-7 font-medium">
              Fastest Ethereum trading terminal. Next-generation launchpad. One interface. Zero limits.
            </p>

            {/* CTAs */}
            <div className="flex justify-center gap-3 flex-wrap mb-7">
              <Link
                to="/trade"
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 bg-pop-orange border-2 border-pop-ink text-pop-ink font-bold text-[13px] sm:text-[15px] shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_hsl(var(--pop-ink))] transition-all"
              >
                ◆ Open Terminal →
              </Link>
              <Link
                to="/launch"
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 bg-pop-ink text-pop-cream border-2 border-pop-ink font-bold text-[13px] sm:text-[15px] shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_hsl(var(--pop-ink))] transition-all"
              >
                <Rocket className="w-4 h-4" /> Launch Token
              </Link>
            </div>

            {/* feature chips */}
            <div className="flex justify-center gap-x-4 sm:gap-x-5 gap-y-2 flex-wrap mb-6 sm:mb-7">
              {FEATURES.map((f) => (
                <span key={f.label} className="inline-flex items-center gap-2 font-pop-mono text-[10px] sm:text-[11px] uppercase tracking-[0.08em] font-semibold text-pop-ink">
                  <span className="inline-flex w-5 h-5 items-center justify-center bg-pop-ink text-pop-orange font-pop-display text-[11px]">
                    {f.glyph}
                  </span>
                  {f.label}
                </span>
              ))}
            </div>

            {/* trending */}
            <div className="flex items-center justify-center gap-2 flex-wrap font-pop-mono text-[10px] sm:text-[11px]">
              <span className="bg-pop-ink text-pop-cream px-2.5 py-1.5 tracking-[0.15em] font-bold">
                TRENDING
              </span>
              {TRENDING.map((t) => (
                <span
                  key={t.sym}
                  className="inline-flex items-center gap-1.5 bg-pop-cream border-2 border-pop-ink px-2.5 py-1 shadow-[2px_2px_0_hsl(var(--pop-ink))] font-bold text-pop-ink"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: t.color }}
                  />
                  {t.sym} <span className="text-[#0b8a3a]">{t.chg}</span>
                </span>
              ))}
            </div>
          </WireFrame>

          {/* RIGHT — terminal */}
          <div className="min-w-0">
            <TerminalMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
