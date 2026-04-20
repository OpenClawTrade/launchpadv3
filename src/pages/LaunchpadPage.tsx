import { TokenCard, WalletBalanceCard } from "@/components/launchpad";
import { DevWalletRotationBanner } from "@/components/launchpad/DevWalletRotationBanner";
import { TopPerformersToday } from "@/components/launchpad/TopPerformersToday";
import { PulseColumnHeaderBar } from "@/components/launchpad/PulseColumnHeaderBar";
import { PulseFiltersDialog } from "@/components/launchpad/PulseFiltersDialog";
import { useLaunchpad } from "@/hooks/useLaunchpad";
import { usePulseFilters } from "@/hooks/usePulseFilters";
import { useSolPrice } from "@/hooks/useSolPrice";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, Search, Clock, Sparkles, Zap, GraduationCap, Flame, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useMemo, useCallback } from "react";
import { BRAND } from "@/config/branding";

const TABS = [
  { id: "new", label: "NEW", icon: Clock },
  { id: "hot", label: "HOT", icon: Flame },
  { id: "top", label: "TOP", icon: Trophy },
  { id: "bonding", label: "BONDING", icon: Zap },
  { id: "graduated", label: "LIVE", icon: GraduationCap },
];

export default function LaunchpadPage() {
  const { tokens, isLoadingTokens } = useLaunchpad();
  const { solPrice } = useSolPrice();
  const { filters, activeFilterColumn, setActiveFilterColumn, updateFilter, resetFilter, hasActiveFilters } = usePulseFilters();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("new");
  const [quickBuyAmount, setQuickBuyAmount] = useState(() => {
    try { const v = localStorage.getItem("pulse-qb-P1"); if (v) { const n = parseFloat(v); if (n > 0) return n; } } catch {}
    return 0.5;
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleQuickBuyChange = useCallback((amount: number) => {
    setQuickBuyAmount(amount);
  }, []);

  const calculateHotScore = (token: typeof tokens[0]) => {
    const now = Date.now();
    const ageHours = (now - new Date(token.created_at).getTime()) / (1000 * 60 * 60);
    const volumeScore = Math.log10(token.volume_24h_sol + 1) * 30;
    const recencyScore = Math.max(0, 20 - ageHours * 0.8);
    const priceChangeRaw = (token as any).price_change_24h || 0;
    const momentumScore = Math.min(20, Math.max(-10, priceChangeRaw * 0.5));
    const holderScore = Math.log10(token.holder_count + 1) * 10;
    const bondingBonus = token.status === 'bonding' ? (token.bonding_curve_progress || 0) * 0.2 : 0;
    return volumeScore + recencyScore + momentumScore + holderScore + bondingBonus;
  };

  const filteredTokens = useMemo(() => {
    let result = tokens;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.ticker.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }
    switch (activeTab) {
      case "hot":
        result = [...result].sort((a, b) => calculateHotScore(b) - calculateHotScore(a));
        break;
      case "bonding":
        result = result.filter(t => t.status === 'bonding')
          .sort((a, b) => (b.bonding_curve_progress || 0) - (a.bonding_curve_progress || 0));
        break;
      case "graduated":
        result = result.filter(t => t.status === 'graduated')
          .sort((a, b) => b.volume_24h_sol - a.volume_24h_sol);
        break;
      default:
        result = [...result].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
    return result;
  }, [tokens, searchQuery, activeTab]);

  const totalTokens = tokens.length;
  const bondingTokens = tokens.filter(t => t.status === 'bonding').length;
  const graduatedTokens = tokens.filter(t => t.status === 'graduated').length;
  const totalVolume = tokens.reduce((acc, t) => acc + t.volume_24h_sol, 0);

  return (
    <div className="min-h-screen bg-pop-orange text-pop-ink">
      {/* Poster Header */}
      <header className="relative border-b-[3px] border-pop-ink bg-pop-orange">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-7 py-6">
          {/* Eyebrow + title */}
          <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
            <div>
              <div className="font-pop-mono text-[11px] tracking-[0.18em] uppercase text-pop-ink/65 mb-2">
                // Launchpad — live feed
              </div>
              <h1 className="font-pop-display text-3xl sm:text-5xl leading-[0.95] tracking-[-0.02em] text-pop-ink">
                Launch. Bond. <span className="underline decoration-pop-ink decoration-[3px] underline-offset-[6px]">Pop.</span>
              </h1>
            </div>
            <Link to="/launch">
              <button className="inline-flex items-center gap-2 font-pop-display text-[13px] tracking-[0.02em] px-5 py-3 bg-pop-ink text-pop-cream border-2 border-pop-ink shadow-[3px_3px_0_hsl(var(--pop-cream))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-cream))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_hsl(var(--pop-cream))] transition-all">
                <Sparkles className="h-4 w-4" />
                LAUNCH TOKEN →
              </button>
            </Link>
          </div>

          <WalletBalanceCard className="mb-4" />
          <DevWalletRotationBanner />

          {/* Stats wire-frame strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "TOTAL", value: totalTokens, mono: true },
              { label: "BONDING", value: bondingTokens, accent: true },
              { label: "GRADUATED", value: graduatedTokens },
              { label: "24H VOL", value: `${totalVolume.toFixed(1)} SOL` },
            ].map((s) => (
              <div
                key={s.label}
                className="relative bg-pop-cream border-2 border-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] px-3 py-3 text-center"
              >
                <p className={`font-pop-display text-xl sm:text-2xl leading-none ${s.accent ? "text-pop-orange" : "text-pop-ink"}`}>
                  {s.value}
                </p>
                <p className="font-pop-mono text-[9px] tracking-[0.18em] uppercase text-pop-ink/60 mt-1.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pop-ink/60 z-10" />
            <Input
              placeholder="Search by name, ticker, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-pop-cream border-2 border-pop-ink rounded-none shadow-[3px_3px_0_hsl(var(--pop-ink))] font-pop-mono text-[12px] placeholder:text-pop-ink/40 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-pop-ink text-pop-ink"
            />
          </div>
        </div>

        {/* Tabs strip — ink bar */}
        <div className="bg-pop-ink border-t-[3px] border-pop-ink">
          <div className="max-w-[1440px] mx-auto px-2 sm:px-7 flex overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`relative flex items-center gap-2 px-4 sm:px-6 py-3 font-pop-display text-[12px] sm:text-[13px] tracking-[0.06em] whitespace-nowrap transition-colors ${
                    active ? "text-pop-orange" : "text-pop-cream/70 hover:text-pop-cream"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                  {active && (
                    <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-pop-orange" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Pulse Header Bar */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <PulseColumnHeaderBar
          label="Launchpad"
          color="36 90% 55%"
          icon={Rocket}
          columnId="launchpad"
          quickBuyAmount={quickBuyAmount}
          onQuickBuyChange={handleQuickBuyChange}
          onOpenFilters={() => setFiltersOpen(true)}
          hasActiveFilters={hasActiveFilters("new")}
        />
      </div>

      <PulseFiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        activeColumn={activeFilterColumn}
        onColumnChange={setActiveFilterColumn}
        onUpdate={updateFilter}
        onReset={resetFilter}
      />

      {/* Content */}
      {activeTab === "top" ? (
        <TopPerformersToday />
      ) : (
        <div className="p-4 space-y-3 max-w-4xl mx-auto">
          {!isLoadingTokens && filteredTokens.length > 0 && (
            <div className="flex items-center justify-between font-pop-mono text-[11px] tracking-[0.1em] uppercase text-pop-ink/70 px-1">
              <span>{filteredTokens.length} TOKEN{filteredTokens.length !== 1 ? 'S' : ''}</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-pop-ink underline decoration-pop-ink underline-offset-2 hover:text-pop-ink/70"
                >
                  CLEAR SEARCH
                </button>
              )}
            </div>
          )}

          {isLoadingTokens ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 border-2 border-pop-ink bg-pop-cream shadow-[3px_3px_0_hsl(var(--pop-ink))] space-y-3 animate-pulse">
                <div className="flex gap-4">
                  <Skeleton className="h-14 w-14 rounded-none" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full max-w-xs" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full rounded-none" />
              </div>
            ))
          ) : filteredTokens.length === 0 ? (
            <div className="text-center py-16 space-y-4 bg-pop-cream border-2 border-pop-ink shadow-[4px_4px_0_hsl(var(--pop-ink))]">
              <div className="mx-auto w-20 h-20 bg-pop-orange border-2 border-pop-ink flex items-center justify-center">
                <Rocket className="h-10 w-10 text-pop-ink" />
              </div>
              <h3 className="font-pop-display text-2xl text-pop-ink">NO TOKENS FOUND</h3>
              <p className="font-pop-mono text-[12px] text-pop-ink/65 max-w-sm mx-auto">
                {searchQuery
                  ? "Try adjusting your search query or filters."
                  : `Be the first to launch a token on ${BRAND.name}!`}
              </p>
              <Link to="/launch" className="inline-block">
                <button className="inline-flex items-center gap-2 font-pop-display text-[13px] px-5 py-3 bg-pop-orange text-pop-ink border-2 border-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all">
                  <Sparkles className="h-4 w-4" />
                  LAUNCH TOKEN →
                </button>
              </Link>
            </div>
          ) : (
            filteredTokens.map((token, index) => (
              <div
                key={token.id}
                className="animate-fadeIn"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <TokenCard token={token as any} solPrice={solPrice} quickBuyAmount={quickBuyAmount} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
