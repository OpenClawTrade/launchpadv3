import { Link, useLocation, useNavigate } from "react-router-dom";
import { formatChange24h } from "@/lib/formatters";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { KingOfTheHill } from "@/components/launchpad/KingOfTheHill";
import { JustLaunched } from "@/components/launchpad/JustLaunched";
import { LazySection } from "@/components/ui/LazySection";
import { useCodexNewPairs, ETH_NETWORK_ID, BSC_NETWORK_ID, type CodexPairToken } from "@/hooks/useCodexNewPairs";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LiveAge } from "@/components/ui/LiveAge";
import {
  Zap, Rocket, ArrowRight, Crosshair, Radar,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { useMemo, useEffect, lazy, Suspense } from "react";

import popshibaLogo from "@/assets/popshiba-logo.png";
import { useChain } from "@/contexts/ChainContext";

// Lazy below-fold sections
const AlphaSection = lazy(() => import("@/components/home/AlphaSection"));
const XTrackerSection = lazy(() => import("@/components/home/XTrackerSection"));

/* ─── Poster Pulse Card ─── */
function PulseTokenRow({ token }: { token: CodexPairToken }) {
  const mcap = token.marketCap;
  const formatMcap = mcap >= 1e6 ? `$${(mcap / 1e6).toFixed(2)}M` : mcap >= 1e3 ? `$${(mcap / 1e3).toFixed(1)}K` : `$${mcap.toFixed(0)}`;
  const change = token.change24h;
  const isPositive = change >= 0;

  return (
    <Link
      to={`/trade/${token.address}`}
      className="group flex items-center gap-3 px-3 py-2.5 bg-pop-cream pop-border rounded-md
                 transition-all duration-150 hover:-translate-x-[2px] hover:-translate-y-[2px]
                 hover:shadow-[4px_4px_0_0_hsl(var(--pop-ink))] active:translate-x-0 active:translate-y-0 active:shadow-none"
    >
      <OptimizedTokenImage
        src={token.imageUrl}
        fallbackSrc={token.fallbackImageUrl || undefined}
        alt={token.name}
        className="w-9 h-9 rounded-md shrink-0 pop-border"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-pop-display text-pop-ink truncate">{token.symbol}</span>
          <LiveAge createdAt={token.createdAt} isUnixSeconds className="text-[9px] text-pop-ink/60" />
          {token.graduationPercent > 0 && token.graduationPercent < 100 && (
            <span className="text-[9px] font-pop-mono text-pop-ink bg-pop-orange px-1 rounded-sm pop-border">
              {token.graduationPercent.toFixed(0)}%
            </span>
          )}
        </div>
        <span className="text-[10px] font-pop-body text-pop-ink/70 truncate block">{token.name}</span>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[11px] font-pop-display text-pop-ink">{formatMcap}</div>
        <div className={cn(
          "text-[10px] font-pop-mono font-bold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm pop-border mt-0.5",
          isPositive ? "bg-pop-mint text-pop-ink" : "bg-pop-pink text-pop-ink"
        )}>
          {isPositive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
          {formatChange24h(change)}
        </div>
      </div>
    </Link>
  );
}

/* ─── Pulse Column (cream panel) ─── */
function PulseColumn({ title, emoji, tokens, loading }: { title: string; emoji: string; tokens: CodexPairToken[]; loading: boolean }) {
  return (
    <div className="bg-pop-cream pop-border rounded-xl p-3 pop-shadow flex flex-col gap-2">
      <div className="flex items-center justify-between px-1 pb-2 border-b-2 border-pop-ink mb-1">
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <h3 className="text-[11px] font-pop-display text-pop-ink uppercase tracking-wider">{title}</h3>
        </div>
        <span className="text-[9px] font-pop-mono text-pop-ink/60">LIVE</span>
      </div>
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-md bg-pop-ink/10" />
        ))
      ) : tokens.length > 0 ? (
        tokens.map((t) => <PulseTokenRow key={t.address || t.symbol} token={t} />)
      ) : (
        <div className="text-center py-6 text-[11px] font-pop-mono text-pop-ink/60">No tokens</div>
      )}
    </div>
  );
}

/* ─── Section Header ─── */
function SectionHeader({ icon: Icon, title, linkTo, linkLabel }: {
  icon: React.ElementType; title: string; linkTo: string; linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-pop-orange pop-border rounded-md flex items-center justify-center pop-shadow-sm">
          <Icon className="w-4 h-4 text-pop-ink" strokeWidth={2.5} />
        </div>
        <h2 className="text-base font-pop-display text-pop-cream uppercase tracking-tight">{title}</h2>
      </div>
      <Link
        to={linkTo}
        className="flex items-center gap-1.5 text-[11px] font-pop-display text-pop-ink uppercase
                   bg-pop-orange pop-border px-3 py-2 rounded-md pop-shadow-sm
                   hover:-translate-x-[2px] hover:-translate-y-[2px]
                   hover:shadow-[6px_6px_0_0_hsl(var(--pop-ink))] transition-all duration-150"
      >
        {linkLabel} <ArrowRight className="w-3 h-3" strokeWidth={3} />
      </Link>
    </div>
  );
}
export { SectionHeader };

const CW = "w-full max-w-7xl";

/* ─── Hot Pair Pill ─── */
function HotPairPill({ token }: { token: CodexPairToken }) {
  const change = token.change24h;
  const isPositive = change >= 0;
  return (
    <Link
      to={`/trade/${token.address}`}
      className="flex items-center gap-2 px-2.5 py-1.5 bg-pop-cream pop-border rounded-full
                 hover:-translate-y-[2px] transition-transform duration-150 shrink-0"
    >
      <OptimizedTokenImage src={token.imageUrl} alt={token.symbol} className="w-4 h-4 rounded-full" />
      <span className="text-[10px] font-pop-display text-pop-ink">{token.symbol}</span>
      <span className={cn("text-[10px] font-pop-mono font-bold", isPositive ? "text-emerald-700" : "text-red-700")}>
        {isPositive ? "+" : ""}{change.toFixed(1)}%
      </span>
    </Link>
  );
}

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== "/") return;
    const createParam = new URLSearchParams(location.search).get("create");
    if (createParam === "1") navigate("/launchpad", { replace: true });
  }, [location.pathname, location.search, navigate]);

  const { chain } = useChain();
  const networkId = chain === "bnb" ? BSC_NETWORK_ID : ETH_NETWORK_ID;
  const { newPairs: codexNewPairs, completing: codexCompleting, graduated: codexGraduated, isLoading: codexLoading } =
    useCodexNewPairs(networkId);

  const limitedNewPairs = useMemo(() => (codexNewPairs || []).slice(0, 5), [codexNewPairs]);
  const limitedCompleting = useMemo(() => (codexCompleting || []).slice(0, 5), [codexCompleting]);
  const limitedGraduated = useMemo(() => (codexGraduated || []).slice(0, 5), [codexGraduated]);

  const hotPairs = useMemo(() => {
    const all = [...(codexNewPairs || []), ...(codexCompleting || []), ...(codexGraduated || [])];
    const seen = new Set<string>();
    return all
      .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
      .filter(t => {
        const key = (t.symbol || '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }, [codexNewPairs, codexCompleting, codexGraduated]);

  return (
    <LaunchpadLayout noPadding>
      <div className="bg-pop-ink min-h-screen font-pop-body">

        {/* ═══ POSTER HERO ═══ */}
        <section className="relative overflow-hidden bg-pop-orange pop-border border-x-0 border-t-0">
          {/* dotted bg pattern */}
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, hsl(var(--pop-ink)) 1.5px, transparent 1.5px)",
              backgroundSize: "18px 18px",
            }}
          />

          <div className={`${CW} mx-auto px-4 sm:px-6 py-10 sm:py-14 lg:py-16 relative z-10`}>
            <div className="grid lg:grid-cols-[1fr,auto] gap-8 items-center">
              {/* LEFT: poster text */}
              <div>
                <div className="inline-flex items-center gap-2 bg-pop-ink text-pop-cream px-3 py-1.5 rounded-full pop-border-cream mb-5">
                  <span className="w-2 h-2 rounded-full bg-pop-orange animate-pulse" />
                  <span className="text-[10px] font-pop-mono uppercase tracking-widest">Live · Ethereum + BNB Chain</span>
                </div>

                <h1 className="font-pop-display text-pop-ink leading-[0.85] uppercase tracking-tighter
                               text-[3rem] sm:text-[4.5rem] lg:text-[6rem] mb-4">
                  Launch<br />
                  <span className="inline-block bg-pop-ink text-pop-orange px-3 -rotate-1">Memes</span><br />
                  Faster.
                </h1>

                <p className="text-pop-ink font-pop-body text-base sm:text-lg max-w-lg mb-6 leading-snug">
                  One-click <strong>ERC-20</strong> &amp; <strong>BEP-20</strong> deploys.
                  Fair launches. Instant LP burn. Contract renounce.
                  <span className="font-pop-display"> Pure pop. Pure shiba.</span>
                </p>

                <div className="flex items-center gap-3 flex-wrap">
                  <Link
                    to="/launchpad"
                    className="group flex items-center gap-2 bg-pop-ink text-pop-cream font-pop-display uppercase
                               text-sm px-6 py-3.5 rounded-md pop-shadow border-2 border-pop-ink
                               hover:-translate-x-[3px] hover:-translate-y-[3px]
                               hover:shadow-[9px_9px_0_0_hsl(var(--pop-ink))] transition-all duration-150
                               active:translate-x-0 active:translate-y-0 active:shadow-none"
                  >
                    <Rocket className="w-4 h-4" strokeWidth={3} />
                    Launch Token
                  </Link>
                  <Link
                    to="/trade"
                    className="flex items-center gap-2 bg-pop-cream text-pop-ink font-pop-display uppercase
                               text-sm px-6 py-3.5 rounded-md pop-border pop-shadow-sm
                               hover:-translate-x-[2px] hover:-translate-y-[2px]
                               hover:shadow-[6px_6px_0_0_hsl(var(--pop-ink))] transition-all duration-150"
                  >
                    <Zap className="w-4 h-4" strokeWidth={3} />
                    Open Terminal
                  </Link>
                </div>

                {/* Stat strip */}
                <div className="grid grid-cols-3 gap-3 mt-8 max-w-md">
                  {[
                    { k: "0.001Ξ", v: "Launch Fee" },
                    { k: "1%", v: "Trade Fee" },
                    { k: "<2s", v: "Deploy" },
                  ].map(s => (
                    <div key={s.v} className="bg-pop-cream pop-border rounded-md px-3 py-2 text-center pop-shadow-sm">
                      <div className="font-pop-display text-pop-ink text-lg leading-none">{s.k}</div>
                      <div className="font-pop-mono text-[9px] text-pop-ink/70 uppercase tracking-wider mt-1">{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT: logo poster */}
              <div className="hidden lg:block relative">
                <div className="relative w-[340px] h-[340px] bg-pop-cream pop-border rounded-2xl pop-shadow flex items-center justify-center rotate-3">
                  <img src={popshibaLogo} alt="PopShiba" className="w-[78%] h-[78%] object-contain" />
                  <div className="absolute -top-3 -left-3 bg-pop-ink text-pop-orange font-pop-display text-xs uppercase px-3 py-1.5 rounded-md pop-border -rotate-6">
                    POP · SHIBA
                  </div>
                  <div className="absolute -bottom-3 -right-3 bg-pop-orange pop-border font-pop-display text-[10px] uppercase px-2.5 py-1 rounded-md text-pop-ink rotate-6">
                    v1 · MAINNET
                  </div>
                </div>
              </div>
            </div>

            {/* Hot pairs ticker */}
            {hotPairs.length > 0 && (
              <div className="mt-10 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-pop-display text-pop-ink uppercase tracking-widest mr-1">🔥 Trending</span>
                {hotPairs.map(t => <HotPairPill key={t.address} token={t} />)}
              </div>
            )}
          </div>

          {/* bottom zigzag accent */}
          <div className="h-3 bg-pop-ink" />
        </section>

        {/* ═══ Live Pulse — 3 cream panels ═══ */}
        <section className={`${CW} mx-auto px-4 sm:px-6 py-10`}>
          <SectionHeader icon={Zap} title="Live Pulse" linkTo="/trade" linkLabel="Terminal" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PulseColumn title="New Pairs" emoji="⚡" tokens={limitedNewPairs} loading={codexLoading} />
            <PulseColumn title="Final Stretch" emoji="🔥" tokens={limitedCompleting} loading={codexLoading} />
            <PulseColumn title="Migrated" emoji="🚀" tokens={limitedGraduated} loading={codexLoading} />
          </div>
        </section>

        {/* ═══ Just Launched ═══ */}
        <section className={`${CW} mx-auto px-4 sm:px-6 py-10 border-t-2 border-pop-cream/15`}>
          <SectionHeader icon={Rocket} title="Just Launched" linkTo="/tokens" linkLabel="View All" />
          <div className="bg-pop-cream pop-border rounded-xl p-4 pop-shadow">
            <JustLaunched />
          </div>
        </section>

        {/* ═══ King of the Hill ═══ */}
        <section className={`${CW} mx-auto px-4 sm:px-6 py-10 border-t-2 border-pop-cream/15`}>
          <div className="bg-pop-cream pop-border rounded-xl p-4 pop-shadow">
            <KingOfTheHill />
          </div>
        </section>

        {/* ═══ Alpha Trades ═══ */}
        <LazySection>
          <section className={`${CW} mx-auto px-4 sm:px-6 py-10 border-t-2 border-pop-cream/15`}>
            <SectionHeader icon={Crosshair} title="Alpha Trades" linkTo="/alpha-tracker" linkLabel="View All" />
            <div className="bg-pop-cream pop-border rounded-xl p-4 pop-shadow">
              <Suspense fallback={<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md bg-pop-ink/10" />)}</div>}>
                <AlphaSection />
              </Suspense>
            </div>
          </section>
        </LazySection>

        {/* ═══ X Tracker ═══ */}
        <LazySection>
          <section className={`${CW} mx-auto px-4 sm:px-6 py-10 border-t-2 border-pop-cream/15`}>
            <SectionHeader icon={Radar} title="X Tracker" linkTo="/x-tracker" linkLabel="View All" />
            <div className="bg-pop-cream pop-border rounded-xl p-4 pop-shadow">
              <Suspense fallback={<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-md bg-pop-ink/10" />)}</div>}>
                <XTrackerSection />
              </Suspense>
            </div>
          </section>
        </LazySection>

      </div>
    </LaunchpadLayout>
  );
}
