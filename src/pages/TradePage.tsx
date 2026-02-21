import { useState } from "react";
import { Search } from "lucide-react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { useFunTokensPaginated } from "@/hooks/useFunTokensPaginated";
import { useSolPrice } from "@/hooks/useSolPrice";
import { AxiomTerminalGrid } from "@/components/launchpad/AxiomTerminalGrid";
import { Input } from "@/components/ui/input";

export default function TradePage() {
  const [search, setSearch] = useState("");
  const { tokens, totalCount, isLoading } = useFunTokensPaginated(1, 100);
  const { solPrice } = useSolPrice();

  const filtered = search.trim()
    ? tokens.filter(t => {
        const q = search.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q);
      })
    : tokens;

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
          <div className="relative flex-1 max-w-xs ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-8 h-8 text-xs font-mono bg-secondary/30 border-border/60 focus-visible:border-primary/60"
            />
          </div>
        </div>

        {/* Axiom Terminal Grid */}
        <AxiomTerminalGrid tokens={filtered} solPrice={solPrice} isLoading={isLoading} />
      </div>
    </LaunchpadLayout>
  );
}
