import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WalletHolding {
  mint: string;
  balance: number;
  rawAmount: string;
  decimals: number;
  estimatedValueSol: number | null;
  tokenName: string | null;
  tokenSymbol: string | null;
  isTracked: boolean;
  dbPositionId: string | null;
  dbPositionStatus: string | null;
  program: string;
}

export interface WalletScanResult {
  walletAddress: string;
  solBalance: number;
  holdings: WalletHolding[];
  totalEstimatedValue: number;
  totalTokens: number;
  trackedTokens: number;
  untrackedTokens: number;
}

export interface ForceSellResult {
  message: string;
  results: Array<{
    token: string;
    mint: string;
    status: string;
    solReceived?: string;
    error?: string;
    signature?: string;
  }>;
  cancelledOrders: number;
  sellAll: boolean;
}

export function useWalletScan(agentId: string) {
  const [scanData, setScanData] = useState<WalletScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const scan = async (adminSecret: string) => {
    if (!agentId || !adminSecret) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const response = await supabase.functions.invoke("trading-agent-wallet-scan", {
        body: { agentId, adminSecret },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      setScanData(response.data as WalletScanResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setScanError(msg);
      toast.error("Wallet scan failed", { description: msg });
    } finally {
      setIsScanning(false);
    }
  };

  return { scanData, isScanning, scanError, scan };
}

export function useForceSellAll(agentId: string) {
  const [isSelling, setIsSelling] = useState(false);
  const [sellResult, setSellResult] = useState<ForceSellResult | null>(null);

  const sellAll = async (adminSecret: string) => {
    if (!agentId || !adminSecret) return;
    setIsSelling(true);
    setSellResult(null);
    try {
      const response = await supabase.functions.invoke("trading-agent-force-sell", {
        body: { agentId, sellAll: true, adminSecret },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      const data = response.data as ForceSellResult;
      setSellResult(data);
      const sold = data.results?.filter((r) => r.status === "sold").length || 0;
      const failed = data.results?.filter((r) => r.status === "failed" || r.status === "error").length || 0;
      if (sold > 0) toast.success(`Sold ${sold} token(s) successfully`);
      if (failed > 0) toast.error(`${failed} token(s) failed to sell`);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Force sell failed";
      toast.error("Force sell failed", { description: msg });
      throw err;
    } finally {
      setIsSelling(false);
    }
  };

  return { isSelling, sellResult, sellAll };
}
