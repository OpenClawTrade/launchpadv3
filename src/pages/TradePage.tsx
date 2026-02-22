import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { useFunTokensPaginated } from "@/hooks/useFunTokensPaginated";
import { useSolPrice } from "@/hooks/useSolPrice";
import { AxiomTerminalGrid } from "@/components/launchpad/AxiomTerminalGrid";

export default function TradePage() {
  const [searchParams] = useSearchParams();
  const search = searchParams.get("q") || "";
  const { tokens, totalCount, isLoading } = useFunTokensPaginated(1, 100);
  const { solPrice } = useSolPrice();

  const filtered = useMemo(() => {
    if (!search.trim()) return tokens;
    const q = search.toLowerCase();
    return tokens.filter(t =>
      t.name.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q)
    );
  }, [tokens, search]);

  return (
    <LaunchpadLayout>
      <div className="space-y-3">
        {/* Header + Search */}
        <div className="flex items-center gap-3 px-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold font-mono text-foreground">Terminal</h1>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse inline-block" />
              LIVE
            </span>
            <span className="text-[10px] font-mono text-muted-foreground ml-1">
              {totalCount.toLocaleString()} tokens
            </span>
          </div>
          {search && (
            <span className="text-[10px] font-mono text-accent-purple ml-1">
              filtering: "{search}"
            </span>
          )}
        </div>

        {/* Axiom Terminal Grid */}
        <AxiomTerminalGrid tokens={filtered} solPrice={solPrice} isLoading={isLoading} />
      </div>
    </LaunchpadLayout>
  );
}
