import { useState, useCallback, useMemo } from "react";
import { FunToken } from "@/hooks/useFunTokensPaginated";
import { CodexPairToken } from "@/hooks/useCodexNewPairs";

export interface PulseFilterConfig {
  // Protocols
  protocols: string[];
  // Audit
  ageMin?: number;
  ageMax?: number;
  ageUnit: "m" | "h" | "d";
  holdersMin?: number;
  holdersMax?: number;
  devHoldingMax?: number;
  // $ Metrics
  liquidityMin?: number;
  liquidityMax?: number;
  volumeMin?: number;
  volumeMax?: number;
  mcapMin?: number;
  mcapMax?: number;
  bondCurveMin?: number;
  bondCurveMax?: number;
  // Socials
  hasTwitter?: boolean;
  hasWebsite?: boolean;
  hasTelegram?: boolean;
}

const DEFAULT_FILTER: PulseFilterConfig = {
  protocols: [],
  ageUnit: "m",
};

export type ColumnId = "new" | "final" | "migrated";

export function usePulseFilters() {
  const [filters, setFilters] = useState<Record<ColumnId, PulseFilterConfig>>({
    new: { ...DEFAULT_FILTER },
    final: { ...DEFAULT_FILTER },
    migrated: { ...DEFAULT_FILTER },
  });

  const [activeFilterColumn, setActiveFilterColumn] = useState<ColumnId>("new");

  const updateFilter = useCallback((column: ColumnId, partial: Partial<PulseFilterConfig>) => {
    setFilters(prev => ({
      ...prev,
      [column]: { ...prev[column], ...partial },
    }));
  }, []);

  const resetFilter = useCallback((column: ColumnId) => {
    setFilters(prev => ({ ...prev, [column]: { ...DEFAULT_FILTER } }));
  }, []);

  const hasActiveFilters = useCallback((column: ColumnId) => {
    const f = filters[column];
    return (
      f.protocols.length > 0 ||
      f.holdersMin != null || f.holdersMax != null ||
      f.liquidityMin != null || f.mcapMin != null || f.volumeMin != null ||
      f.bondCurveMin != null || f.bondCurveMax != null ||
      f.hasTwitter || f.hasWebsite || f.hasTelegram
    );
  }, [filters]);

  const applyFilterToFunTokens = useCallback((tokens: FunToken[], column: ColumnId, solPrice: number | null): FunToken[] => {
    const f = filters[column];
    return tokens.filter(t => {
      // Protocols
      if (f.protocols.length > 0) {
        const lp = t.launchpad_type || "unknown";
        if (!f.protocols.includes(lp)) return false;
      }
      // Holders
      if (f.holdersMin != null && (t.holder_count ?? 0) < f.holdersMin) return false;
      if (f.holdersMax != null && (t.holder_count ?? 0) > f.holdersMax) return false;
      // Mcap
      if (f.mcapMin != null && solPrice) {
        const mcapUsd = (t.market_cap_sol ?? 0) * solPrice;
        if (mcapUsd < f.mcapMin) return false;
      }
      if (f.mcapMax != null && solPrice) {
        const mcapUsd = (t.market_cap_sol ?? 0) * solPrice;
        if (mcapUsd > f.mcapMax) return false;
      }
      // Volume
      if (f.volumeMin != null && solPrice) {
        const volUsd = (t.volume_24h_sol ?? 0) * solPrice;
        if (volUsd < f.volumeMin) return false;
      }
      // Bond curve
      if (f.bondCurveMin != null && (t.bonding_progress ?? 0) < f.bondCurveMin) return false;
      if (f.bondCurveMax != null && (t.bonding_progress ?? 0) > f.bondCurveMax) return false;
      // Socials
      if (f.hasTwitter && !t.twitter_url) return false;
      if (f.hasWebsite && !t.website_url) return false;
      return true;
    });
  }, [filters]);

  const applyFilterToCodexTokens = useCallback((tokens: CodexPairToken[], column: ColumnId): CodexPairToken[] => {
    const f = filters[column];
    return tokens.filter(t => {
      if (f.protocols.length > 0) {
        if (!f.protocols.includes(t.launchpadName)) return false;
      }
      if (f.holdersMin != null && t.holders < f.holdersMin) return false;
      if (f.holdersMax != null && t.holders > f.holdersMax) return false;
      if (f.mcapMin != null && t.marketCap < f.mcapMin) return false;
      if (f.mcapMax != null && t.marketCap > f.mcapMax) return false;
      if (f.volumeMin != null && t.volume24h < f.volumeMin) return false;
      if (f.liquidityMin != null && t.liquidity < f.liquidityMin) return false;
      if (f.bondCurveMin != null && t.graduationPercent < f.bondCurveMin) return false;
      if (f.bondCurveMax != null && t.graduationPercent > f.bondCurveMax) return false;
      if (f.hasTwitter && !t.twitterUrl) return false;
      if (f.hasWebsite && !t.websiteUrl) return false;
      if (f.hasTelegram && !t.telegramUrl) return false;
      return true;
    });
  }, [filters]);

  return {
    filters,
    activeFilterColumn,
    setActiveFilterColumn,
    updateFilter,
    resetFilter,
    hasActiveFilters,
    applyFilterToFunTokens,
    applyFilterToCodexTokens,
  };
}
