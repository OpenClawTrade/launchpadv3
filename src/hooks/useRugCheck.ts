import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RugCheckReport {
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  liquidityLocked: boolean;
  liquidityLockedPct: number;
  topHolderPct: number;
  riskLevel: string;
  riskScore: number;
  warnings: string[];
}

async function fetchRugCheck(mintAddress: string): Promise<RugCheckReport> {
  const { data, error } = await supabase.functions.invoke("rugcheck-report", {
    body: { mintAddress },
  });

  if (error) throw new Error(error.message || "Failed to fetch rug check");
  return data as RugCheckReport;
}

export function useRugCheck(mintAddress?: string | null) {
  return useQuery({
    queryKey: ["rugcheck", mintAddress],
    queryFn: () => fetchRugCheck(mintAddress!),
    enabled: !!mintAddress,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
}
