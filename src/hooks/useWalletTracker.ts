import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TrackedWallet {
  id: string;
  wallet_address: string;
  wallet_label: string | null;
  created_at: string;
  is_copy_trading_enabled: boolean;
  notifications_enabled: boolean;
  total_pnl_sol: number | null;
  trades_copied: number | null;
}

export interface WalletWithBalance extends TrackedWallet {
  balance: number | null;
  lastActive: string | null;
}

export const TRACKER_TABS = ["All", "Manager", "Trades", "Monitor"] as const;
export type TrackerTab = typeof TRACKER_TABS[number];

const ETH_RPC_URL = "https://eth.llamarpc.com";

export function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

async function fetchEthBalance(address: string): Promise<number | null> {
  try {
    const res = await fetch(ETH_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [address, "latest"],
      }),
    });
    const json = await res.json();
    if (!json?.result) return null;
    return Number(BigInt(json.result)) / 1e18;
  } catch {
    return null;
  }
}

export function useWalletTracker() {
  const { isAuthenticated, profileId, login } = useAuth();
  const [wallets, setWallets] = useState<WalletWithBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchWallets = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const { data: resp, error: fnError } = await supabase.functions.invoke("wallet-tracker-manage", {
        body: { action: "list", user_profile_id: profileId },
      });
      if (fnError) throw fnError;
      const tracked = (resp?.data || []) as TrackedWallet[];

      // ETH-only: enrich with native ETH balance
      const enriched: WalletWithBalance[] = await Promise.all(
        tracked.map(async (w) => ({
          ...w,
          balance: await fetchEthBalance(w.wallet_address),
          lastActive: null, // last activity to be wired via Etherscan when key added
        }))
      );
      setWallets(enriched);
    } catch (err) {
      console.error("Failed to fetch tracked wallets:", err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (profileId) fetchWallets();
  }, [profileId, fetchWallets]);

  const addWallet = async (address: string, label: string | null) => {
    if (!profileId || !address.trim()) return;
    setAdding(true);
    try {
      const { data: resp, error: fnError } = await supabase.functions.invoke("wallet-tracker-manage", {
        body: {
          action: "add",
          user_profile_id: profileId,
          wallet_address: address.trim(),
          wallet_label: label?.trim() || null,
        },
      });
      if (fnError) throw fnError;
      if (resp?.error) throw new Error(resp.error);
      fetchWallets();
      return true;
    } catch (err) {
      console.error("Failed to add wallet:", err);
      return false;
    } finally {
      setAdding(false);
    }
  };

  const removeWallet = async (id: string) => {
    try {
      await supabase.functions.invoke("wallet-tracker-manage", {
        body: { action: "remove", user_profile_id: profileId, wallet_id: id },
      });
      setWallets((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      console.error("Failed to remove wallet:", err);
    }
  };

  const removeAll = async () => {
    if (!profileId) return;
    try {
      await supabase.functions.invoke("wallet-tracker-manage", {
        body: { action: "clear", user_profile_id: profileId },
      });
      setWallets([]);
    } catch (err) {
      console.error("Failed to remove wallets:", err);
    }
  };

  const toggleNotifications = async (walletId: string, enabled: boolean) => {
    setWallets((prev) => prev.map((w) => w.id === walletId ? { ...w, notifications_enabled: enabled } : w));
    try {
      await supabase.functions.invoke("wallet-tracker-manage", {
        body: { action: "update", user_profile_id: profileId, wallet_id: walletId, updates: { notifications_enabled: enabled } },
      });
    } catch (err) {
      console.error("Failed to toggle notifications:", err);
      setWallets((prev) => prev.map((w) => w.id === walletId ? { ...w, notifications_enabled: !enabled } : w));
    }
  };

  const toggleCopyTrading = async (walletId: string, enabled: boolean) => {
    setWallets((prev) => prev.map((w) => w.id === walletId ? { ...w, is_copy_trading_enabled: enabled } : w));
    try {
      await supabase.functions.invoke("wallet-tracker-manage", {
        body: { action: "update", user_profile_id: profileId, wallet_id: walletId, updates: { is_copy_trading_enabled: enabled } },
      });
    } catch (err) {
      console.error("Failed to toggle copy trading:", err);
      setWallets((prev) => prev.map((w) => w.id === walletId ? { ...w, is_copy_trading_enabled: !enabled } : w));
    }
  };

  return {
    isAuthenticated,
    login,
    wallets,
    loading,
    adding,
    fetchWallets,
    addWallet,
    removeWallet,
    removeAll,
    toggleNotifications,
    toggleCopyTrading,
  };
}
