// Aggregates total claimable WETH across all tokens for a connected wallet.
// Polls every 30s. Used by the global nav pill.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatEther } from "viem";

interface ClaimableToken {
  token_address: string;
  owedWei: bigint;
}

interface State {
  totalEth: string;
  totalWei: bigint;
  tokens: ClaimableToken[];
  loading: boolean;
}

export function useClaimableCreatorFees(wallet?: string | null) {
  const [state, setState] = useState<State>({ totalEth: "0", totalWei: 0n, tokens: [], loading: false });

  const fetchClaimable = useCallback(async () => {
    if (!wallet) { setState({ totalEth: "0", totalWei: 0n, tokens: [], loading: false }); return; }
    setState((s) => ({ ...s, loading: true }));
    try {
      const { data, error } = await supabase
        .from("eth_creator_fee_ledger")
        .select("token_address,creator_share_weth,creator_paid_weth")
        .ilike("creator_wallet", wallet);
      if (error) throw error;
      let total = 0n;
      const tokens: ClaimableToken[] = [];
      for (const row of (data ?? [])) {
        try {
          const share = BigInt(row.creator_share_weth || "0");
          const paid = BigInt(row.creator_paid_weth || "0");
          const owed = share > paid ? share - paid : 0n;
          if (owed > 0n) {
            tokens.push({ token_address: row.token_address, owedWei: owed });
            total += owed;
          }
        } catch { /* skip malformed */ }
      }
      setState({
        totalEth: parseFloat(formatEther(total)).toFixed(6),
        totalWei: total,
        tokens,
        loading: false,
      });
    } catch (e) {
      console.error("[useClaimableCreatorFees]", e);
      setState((s) => ({ ...s, loading: false }));
    }
  }, [wallet]);

  useEffect(() => {
    fetchClaimable();
    if (!wallet) return;
    const id = setInterval(fetchClaimable, 30_000);
    return () => clearInterval(id);
  }, [wallet, fetchClaimable]);

  return { ...state, refetch: fetchClaimable };
}
