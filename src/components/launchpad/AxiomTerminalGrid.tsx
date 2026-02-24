import { useMemo, useState } from "react";
import { FunToken } from "@/hooks/useFunTokensPaginated";
import { CodexPairToken } from "@/hooks/useCodexNewPairs";
import { useKingOfTheHill } from "@/hooks/useKingOfTheHill";
import { AxiomTokenRow } from "./AxiomTokenRow";
import { CodexPairRow } from "./CodexPairRow";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, Flame, CheckCircle2 } from "lucide-react";

interface AxiomTerminalGridProps {
  tokens: FunToken[];
  solPrice: number | null;
  isLoading: boolean;
  codexNewPairs?: CodexPairToken[];
  codexCompleting?: CodexPairToken[];
  codexGraduated?: CodexPairToken[];
}

const COLUMN_TABS = [
  { id: "new", label: "New Pairs", icon: Rocket },
  { id: "final", label: "Final Stretch", icon: Flame },
  { id: "migrated", label: "Migrated", icon: CheckCircle2 },
] as const;

type ColumnTab = typeof COLUMN_TABS[number]["id"];

function PulseColumnHeader({ label, count, icon: Icon }: { label: string; count: number; icon: React.ElementType }) {
  return (
    <div className="pulse-col-header">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[13px] font-bold text-foreground">{label}</span>
        <span className="pulse-count-badge">{count}</span>
      </div>
    </div>
  );
}

function PulseColumnSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="pulse-card-skeleton">
          <Skeleton className="w-11 h-11 rounded-xl skeleton-shimmer" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4 skeleton-shimmer" />
            <Skeleton className="h-2.5 w-1/2 skeleton-shimmer" />
            <Skeleton className="h-1.5 w-full skeleton-shimmer" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-14 skeleton-shimmer ml-auto" />
            <Skeleton className="h-2.5 w-10 skeleton-shimmer ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PulseEmptyColumn({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 empty-state-fade">
      <span className="text-2xl mb-2 opacity-40">🦞</span>
      <span className="text-[11px] text-muted-foreground/60">No {label.toLowerCase()} yet</span>
    </div>
  );
}

export function AxiomTerminalGrid({ tokens, solPrice, isLoading, codexNewPairs = [], codexCompleting = [], codexGraduated = [] }: AxiomTerminalGridProps) {
  const [mobileTab, setMobileTab] = useState<ColumnTab>("new");
  const { tokens: kingTokens } = useKingOfTheHill();

  const { newPairs, finalStretch, migrated } = useMemo(() => {
    const newPairs = tokens
      .filter(t => (t.bonding_progress ?? 0) < 80 && t.status !== 'graduated')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    let finalStretch = tokens
      .filter(t => (t.bonding_progress ?? 0) >= 5 && t.status !== 'graduated')
      .sort((a, b) => (b.bonding_progress ?? 0) - (a.bonding_progress ?? 0));

    if (finalStretch.length < 3 && kingTokens.length > 0) {
      const existingIds = new Set(finalStretch.map(t => t.id));
      const kingFill = kingTokens
        .filter(k => !existingIds.has(k.id))
        .slice(0, 3 - finalStretch.length)
        .map(k => ({
          id: k.id, name: k.name, ticker: k.ticker, description: null,
          image_url: k.image_url, creator_wallet: k.creator_wallet ?? "",
          twitter_url: k.twitter_url, website_url: null,
          twitter_avatar_url: k.twitter_avatar_url ?? null,
          twitter_verified: k.twitter_verified ?? false,
          twitter_verified_type: k.twitter_verified_type ?? null,
          mint_address: k.mint_address, dbc_pool_address: k.dbc_pool_address,
          status: k.status, price_sol: 0, price_change_24h: null,
          volume_24h_sol: 0, total_fees_earned: 0, holder_count: k.holder_count,
          market_cap_sol: k.market_cap_sol, bonding_progress: k.bonding_progress,
          trading_fee_bps: k.trading_fee_bps, fee_mode: k.fee_mode,
          agent_id: k.agent_id, launchpad_type: k.launchpad_type,
          last_distribution_at: null, created_at: k.created_at, updated_at: k.created_at,
        } satisfies FunToken));
      finalStretch = [...finalStretch, ...kingFill];
    }

    const migrated = tokens
      .filter(t => t.status === 'graduated')
      .sort((a, b) => (b.market_cap_sol ?? 0) - (a.market_cap_sol ?? 0));

    return { newPairs, finalStretch, migrated };
  }, [tokens, kingTokens]);

  const columns = [
    { id: "new" as const, label: "New Pairs", icon: Rocket, tokens: newPairs, codex: codexNewPairs },
    { id: "final" as const, label: "Final Stretch", icon: Flame, tokens: finalStretch, codex: codexCompleting },
    { id: "migrated" as const, label: "Migrated", icon: CheckCircle2, tokens: migrated, codex: codexGraduated },
  ];

  const activeColumn = columns.find(c => c.id === mobileTab)!;

  const renderColumnContent = (col: typeof columns[number]) => {
    if (isLoading) return <PulseColumnSkeleton />;
    if (col.tokens.length === 0 && col.codex.length === 0) return <PulseEmptyColumn label={col.label} />;
    return (
      <div className="flex flex-col gap-0.5 p-1.5">
        {col.codex.map(t => (
          <CodexPairRow key={`codex-${t.address}`} token={t} />
        ))}
        {col.tokens.map(token => (
          <AxiomTokenRow key={token.id} token={token} solPrice={solPrice} />
        ))}
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Mobile: Tab Switcher */}
      <div className="xl:hidden">
        <div className="flex border-b border-border">
          {COLUMN_TABS.map(tab => {
            const col = columns.find(c => c.id === tab.id)!;
            return (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-semibold transition-all border-b-2 -mb-px ${
                  mobileTab === tab.id
                    ? "text-foreground border-success"
                    : "text-muted-foreground border-transparent"
                }`}
              >
                <tab.icon className="h-3 w-3" />
                {tab.label}
                <span className="pulse-count-badge">{isLoading ? '…' : col.tokens.length + col.codex.length}</span>
              </button>
            );
          })}
        </div>
        <div className="pulse-column-scroll">
          {renderColumnContent(activeColumn)}
        </div>
      </div>

      {/* Desktop: Three Columns */}
      <div className="hidden xl:grid grid-cols-3 gap-3">
        {columns.map((col) => (
          <div key={col.id} className="pulse-column">
            <PulseColumnHeader label={col.label} count={col.tokens.length + col.codex.length} icon={col.icon} />
            <div className="pulse-column-scroll">
              {renderColumnContent(col)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
