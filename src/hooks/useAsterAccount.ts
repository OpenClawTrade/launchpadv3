import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AsterPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  marginType: string;
  positionSide: string;
  notional: string;
}

export interface AsterAccountInfo {
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  availableBalance: string;
  totalInitialMargin: string;
  totalMaintMargin: string;
  totalPositionInitialMargin: string;
  totalOpenOrderInitialMargin: string;
  positions: AsterPosition[];
  assets?: AsterAssetBalance[];
}

export interface AsterAssetBalance {
  asset: string;
  walletBalance: string;
  unrealizedProfit: string;
  marginBalance: string;
  availableBalance: string;
  crossWalletBalance: string;
  crossUnPnl: string;
}

export interface AsterOpenOrder {
  orderId: number;
  symbol: string;
  type: string;
  side: string;
  price: string;
  origQty: string;
  status: string;
  time: number;
  stopPrice: string;
}

export interface AsterOrderHistory {
  orderId: number;
  symbol: string;
  type: string;
  side: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  time: number;
  avgPrice: string;
}

export interface AsterTradeHistory {
  id: number;
  symbol: string;
  side: string;
  price: string;
  qty: string;
  realizedPnl: string;
  commission: string;
  commissionAsset: string;
  time: number;
  buyer: boolean;
  maker: boolean;
}

export function useAsterAccount() {
  const { user, isAuthenticated } = useAuth();
  const privyUserId = user?.privyId || null;

  const [account, setAccount] = useState<AsterAccountInfo | null>(null);
  const [openOrders, setOpenOrders] = useState<AsterOpenOrder[]>([]);
  const [orderHistory, setOrderHistory] = useState<AsterOrderHistory[]>([]);
  const [tradeHistory, setTradeHistory] = useState<AsterTradeHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invokeAster = useCallback(async (action: string, params: Record<string, any> = {}) => {
    if (!privyUserId) throw new Error("Not authenticated");
    const { data, error } = await supabase.functions.invoke("aster-trade", {
      body: { action, params, privyUserId },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, [privyUserId]);

  const checkApiKey = useCallback(async () => {
    if (!privyUserId) {
      setHasApiKey(false);
      return;
    }
    try {
      const result = await invokeAster("check_key");
      setHasApiKey(result?.hasKey ?? false);
    } catch {
      setHasApiKey(false);
    }
  }, [invokeAster, privyUserId]);

  useEffect(() => {
    if (isAuthenticated && privyUserId) {
      checkApiKey();
    } else {
      setHasApiKey(false);
    }
  }, [isAuthenticated, privyUserId, checkApiKey]);

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invokeAster("account");
      setAccount(data);
      setHasApiKey(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [invokeAster]);

  const fetchOpenOrders = useCallback(async (symbol?: string) => {
    try {
      const data = await invokeAster("open_orders", symbol ? { symbol } : {});
      setOpenOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to fetch open orders:", err);
    }
  }, [invokeAster]);

  const fetchOrderHistory = useCallback(async (symbol?: string) => {
    try {
      const data = await invokeAster("all_orders", { symbol, limit: 50 });
      setOrderHistory(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to fetch order history:", err);
    }
  }, [invokeAster]);

  const fetchTradeHistory = useCallback(async (symbol?: string) => {
    try {
      const data = await invokeAster("trade_history", { symbol, limit: 50 });
      setTradeHistory(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to fetch trade history:", err);
    }
  }, [invokeAster]);

  // Auto-fetch account data when API key is confirmed
  useEffect(() => {
    if (hasApiKey === true) {
      fetchAccount();
      fetchOpenOrders();
    }
  }, [hasApiKey, fetchAccount, fetchOpenOrders]);

  const placeOrder = useCallback(async (params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT" | "STOP_MARKET" | "TAKE_PROFIT_MARKET";
    quantity: string;
    price?: string;
    stopPrice?: string;
    leverage?: number;
    timeInForce?: string;
  }) => {
    return invokeAster("place_order", params);
  }, [invokeAster]);

  const cancelOrder = useCallback(async (symbol: string, orderId: number) => {
    return invokeAster("cancel_order", { symbol, orderId });
  }, [invokeAster]);

  const cancelAllOrders = useCallback(async (symbol: string) => {
    return invokeAster("cancel_all_orders", { symbol });
  }, [invokeAster]);

  const changeLeverage = useCallback(async (symbol: string, leverage: number) => {
    return invokeAster("change_leverage", { symbol, leverage });
  }, [invokeAster]);

  const saveApiKey = useCallback(async (apiKey: string, apiSecret: string) => {
    return invokeAster("save_key", { apiKey, apiSecret });
  }, [invokeAster]);

  const deleteApiKey = useCallback(async () => {
    await invokeAster("delete_key");
    setHasApiKey(false);
    setAccount(null);
    setOpenOrders([]);
    setOrderHistory([]);
    setTradeHistory([]);
  }, [invokeAster]);

  return {
    account, openOrders, orderHistory, tradeHistory, loading, hasApiKey, error,
    checkApiKey, fetchAccount, fetchOpenOrders, fetchOrderHistory, fetchTradeHistory,
    placeOrder, cancelOrder, cancelAllOrders, changeLeverage, saveApiKey, deleteApiKey,
  };
}
