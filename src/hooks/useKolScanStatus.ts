import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KolScanRun {
  id: string;
  created_at: string;
  accounts_scanned: number;
  tweets_fetched: number;
  cas_detected: number;
  tweets_inserted: number;
  errors_count: number;
  duration_ms: number | null;
  raw_response_sample: string | null;
}

export interface KolScanError {
  id: string;
  run_id: string;
  kol_username: string;
  error_message: string;
  raw_response_preview: string | null;
  created_at: string;
}

export function useKolScanStatus() {
  const runsQuery = useQuery<KolScanRun[]>({
    queryKey: ["kol-scan-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kol_scan_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data as unknown as KolScanRun[]) || [];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const latestRunId = runsQuery.data?.[0]?.id;

  const errorsQuery = useQuery<KolScanError[]>({
    queryKey: ["kol-scan-errors", latestRunId],
    queryFn: async () => {
      if (!latestRunId) return [];
      const { data, error } = await supabase
        .from("kol_scan_errors")
        .select("*")
        .eq("run_id", latestRunId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data as unknown as KolScanError[]) || [];
    },
    enabled: !!latestRunId,
    staleTime: 30_000,
  });

  return {
    runs: runsQuery.data || [],
    latestRun: runsQuery.data?.[0] || null,
    errors: errorsQuery.data || [],
    isLoading: runsQuery.isLoading,
  };
}
