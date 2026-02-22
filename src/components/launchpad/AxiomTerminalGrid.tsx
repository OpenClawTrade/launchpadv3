import { useMemo, useState } from "react";
import { FunToken } from "@/hooks/useFunTokensPaginated";
import { useKingOfTheHill } from "@/hooks/useKingOfTheHill";
import { AxiomTokenRow } from "./AxiomTokenRow";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, Flame, CheckCircle2 } from "lucide-react";

interface AxiomTerminalGridProps {
  tokens: FunToken[];
  solPrice: number | null;
  isLoading: boolean;
}

const COLUMN_TABS = [
  { id: "new", label: "New Pairs", icon: Rocket },
  { id: "final", label: "Final Stretch", icon: Flame },
  { id: "migrated", label: "Migrated", icon: CheckCircle2 },
] as const;

type ColumnTab = typeof COLUMN_TABS[number]["id"];

function ColumnHeader({ label, count, icon: Icon }: { label: string; count: number; icon: React.ElementType }) {
  return (
    <div className="axiom-col-header">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      <span className="axiom-col-count">{count}</span>
    </div>
  );
}

function ColumnSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="axiom-row-skeleton">
          <Skeleton className="w-10 h-10 rounded-lg skeleton-shimmer" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4 skeleton-shimmer" />
            <Skeleton className="h-2.5 w-1/2 skeleton-shimmer" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-12 skeleton-shimmer ml-auto" />
            <Skeleton className="h-2.5 w-10 skeleton-shimmer ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyColumn({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 empty-state-fade">
      <span className="text-2xl mb-2">🦞</span>
      <span className="text-[11px] text-muted-foreground">No {label.toLowerCase()} yet</span>
    </div>
  );
}

export function AxiomTerminalGrid({ tokens, solPrice, isLoading }: AxiomTerminalGridProps) {
  const [mobileTab, setMobileTab] = useState<ColumnTab>("new");

  const { tokens: kingTokens } = useKingOfTheHill();

  const { newPairs, finalStretch, migrated } = useMemo(() => {
    const newPairs = tokens
      .filter(t => (t.bonding_progress ?? 0) < 80 && t.status !== 'graduated')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Primary: tokens with ≥5% bonding progress
    let finalStretch = tokens
      .filter(t => (t.bonding_progress ?? 0) >= 5 && t.status !== 'graduated')
      .sort((a, b) => (b.bonding_progress ?? 0) - (a.bonding_progress ?? 0));

    // Fallback: fill with King of the Hill tokens if fewer than 3
    if (finalStretch.length < 3 && kingTokens.length > 0) {
      const existingIds = new Set(finalStretch.map(t => t.id));
      const kingFill = kingTokens
        .filter(k => !existingIds.has(k.id))
        .slice(0, 3 - finalStretch.length)
        .map(k => ({
          id: k.id,
          name: k.name,
          ticker: k.ticker,
          description: null,
          image_url: k.image_url,
          creator_wallet: k.creator_wallet ?? "",
          twitter_url: k.twitter_url,
          website_url: null,
          twitter_avatar_url: k.twitter_avatar_url ?? null,
          twitter_verified: k.twitter_verified ?? false,
          twitter_verified_type: k.twitter_verified_type ?? null,
          mint_address: k.mint_address,
          dbc_pool_address: k.dbc_pool_address,
          status: k.status,
          price_sol: 0,
          price_change_24h: null,
          volume_24h_sol: 0,
          total_fees_earned: 0,
          holder_count: k.holder_count,
          market_cap_sol: k.market_cap_sol,
          bonding_progress: k.bonding_progress,
          trading_fee_bps: k.trading_fee_bps,
          fee_mode: k.fee_mode,
          agent_id: k.agent_id,
          launchpad_type: k.launchpad_type,
          last_distribution_at: null,
          created_at: k.created_at,
          updated_at: k.created_at,
        } satisfies FunToken));
      finalStretch = [...finalStretch, ...kingFill];
    }

    const migrated = tokens
      .filter(t => t.status === 'graduated')
      .sort((a, b) => (b.market_cap_sol ?? 0) - (a.market_cap_sol ?? 0));

    return { newPairs, finalStretch, migrated };
  }, [tokens, kingTokens]);

  const columns = [
    { id: "new" as const, label: "New Pairs", icon: Rocket, tokens: newPairs },
    { id: "final" as const, label: "Final Stretch", icon: Flame, tokens: finalStretch },
    { id: "migrated" as const, label: "Migrated", icon: CheckCircle2, tokens: migrated },
  ];

  const activeColumn = columns.find(c => c.id === mobileTab)!;

  return (
    <div className="w-full">
      {/* ── Mobile: Tab Switcher ── */}
      <div className="lg:hidden">
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
                <span className="axiom-col-count">{isLoading ? '…' : col.tokens.length}</span>
              </button>
            );
          })}
        </div>

        {/* Active column content */}
        <div className="axiom-column-scroll">
          {isLoading ? (
            <ColumnSkeleton />
          ) : activeColumn.tokens.length === 0 ? (
            <EmptyColumn label={activeColumn.label} />
          ) : (
            <div className="flex flex-col gap-0.5 p-1.5">
              {activeColumn.tokens.map(token => (
                <AxiomTokenRow key={token.id} token={token} solPrice={solPrice} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop: Three Columns ── */}
      <div className="hidden lg:grid grid-cols-3 gap-3 axiom-grid-container">
        {columns.map((col) => (
          <div key={col.id} className="axiom-column border border-border/40 rounded-lg overflow-hidden bg-card/60 backdrop-blur-sm">
            <ColumnHeader label={col.label} count={col.tokens.length} icon={col.icon} />
            <div className="axiom-column-scroll">
              {isLoading ? (
                <ColumnSkeleton />
              ) : col.tokens.length === 0 ? (
                <EmptyColumn label={col.label} />
              ) : (
                <div className="flex flex-col gap-0.5 p-1.5">
                  {col.tokens.map(token => (
                    <AxiomTokenRow key={token.id} token={token} solPrice={solPrice} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
