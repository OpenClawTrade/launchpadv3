import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { computePositions, PositionSummary } from "@/lib/tradeUtils";

export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  website: string | null;
  verified_type: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  created_at: string;
  solana_wallet_address: string | null;
  isRegistered?: boolean;
}

export interface CreatedToken {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  mint_address: string | null;
  market_cap_sol: number | null;
  status: string | null;
  created_at: string;
}

export interface UserTrade {
  id: string;
  transaction_type: string;
  sol_amount: number;
  token_amount: number;
  price_per_token: number | null;
  created_at: string;
  token_id: string;
  signature: string | null;
}

export interface AlphaTradeRecord {
  id: string;
  wallet_address: string;
  token_mint: string;
  token_name: string | null;
  token_ticker: string | null;
  trade_type: string;
  amount_sol: number;
  amount_tokens: number;
  price_usd: number | null;
  price_sol: number | null;
  tx_hash: string;
  created_at: string;
  trader_display_name: string | null;
  trader_avatar_url: string | null;
  token_image_url?: string | null;
}

export interface TradingStats {
  totalPnl: number;
  realizedPnl: number;
  totalBuys: number;
  totalSells: number;
  totalBuySol: number;
  totalSellSol: number;
  positions: Map<string, PositionSummary>;
  pnlDistribution: { label: string; count: number; color: string }[];
}

function isWalletAddress(identifier: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(identifier);
}

function computeTradingStats(
  alphaTrades: AlphaTradeRecord[],
  alphaPositions: Map<string, PositionSummary>,
  launchpadTrades: UserTrade[],
  wallet: string | undefined,
): TradingStats {
  let totalBuys = 0, totalSells = 0, totalBuySol = 0, totalSellSol = 0;

  // Count from alpha trades
  for (const t of alphaTrades) {
    if (t.trade_type === "buy") { totalBuys++; totalBuySol += t.amount_sol; }
    else { totalSells++; totalSellSol += t.amount_sol; }
  }

  // Also count launchpad transactions
  for (const t of launchpadTrades) {
    if (t.transaction_type === "buy") { totalBuys++; totalBuySol += t.sol_amount; }
    else { totalSells++; totalSellSol += t.sol_amount; }
  }

  // Merge positions: start with alpha positions, then add launchpad positions
  const allPositions = new Map<string, PositionSummary>(alphaPositions);

  // Build positions from launchpad_transactions (grouped by token_id)
  if (launchpadTrades.length > 0 && wallet) {
    const lpByToken = new Map<string, { buySol: number; sellSol: number; buyTokens: number; sellTokens: number }>();
    for (const t of launchpadTrades) {
      let entry = lpByToken.get(t.token_id);
      if (!entry) { entry = { buySol: 0, sellSol: 0, buyTokens: 0, sellTokens: 0 }; lpByToken.set(t.token_id, entry); }
      if (t.transaction_type === "buy") {
        entry.buySol += t.sol_amount;
        entry.buyTokens += t.token_amount;
      } else {
        entry.sellSol += t.sol_amount;
        entry.sellTokens += t.token_amount;
      }
    }
    for (const [tokenId, entry] of lpByToken) {
      const key = `${wallet}::lp::${tokenId}`;
      if (!allPositions.has(key) && entry.buySol > 0) {
        const avgBuy = entry.buyTokens > 0 ? entry.buySol / entry.buyTokens : 0;
        const costOfSold = avgBuy * entry.sellTokens;
        allPositions.set(key, {
          wallet_address: wallet,
          token_mint: tokenId,
          token_ticker: null,
          total_bought_sol: entry.buySol,
          total_sold_sol: entry.sellSol,
          total_bought_tokens: entry.buyTokens,
          total_sold_tokens: entry.sellTokens,
          net_tokens: entry.buyTokens - entry.sellTokens,
          avg_buy_price_sol: avgBuy,
          realized_pnl_sol: entry.sellSol - costOfSold,
          status: entry.sellTokens >= entry.buyTokens ? "SOLD" : entry.sellTokens > 0 ? "PARTIAL" : "HOLDING",
        });
      }
    }
  }

  let realizedPnl = 0;
  const pnlBuckets = { gt10: 0, gt5: 0, gt0: 0, gtNeg1: 0, ltNeg1: 0 };

  for (const pos of allPositions.values()) {
    realizedPnl += pos.realized_pnl_sol;
    if (pos.total_bought_sol > 0 && pos.total_sold_sol > 0) {
      const pnlSol = pos.realized_pnl_sol;
      if (pnlSol > 10) pnlBuckets.gt10++;
      else if (pnlSol > 5) pnlBuckets.gt5++;
      else if (pnlSol >= 0) pnlBuckets.gt0++;
      else if (pnlSol >= -1) pnlBuckets.gtNeg1++;
      else pnlBuckets.ltNeg1++;
    }
  }

  return {
    totalPnl: realizedPnl,
    realizedPnl,
    totalBuys,
    totalSells,
    totalBuySol,
    totalSellSol,
    positions: allPositions,
    pnlDistribution: [
      { label: ">10 SOL", count: pnlBuckets.gt10, color: "bg-green-500" },
      { label: "5-10 SOL", count: pnlBuckets.gt5, color: "bg-green-400" },
      { label: "0-5 SOL", count: pnlBuckets.gt0, color: "bg-emerald-400" },
      { label: "0 to -1", count: pnlBuckets.gtNeg1, color: "bg-orange-400" },
      { label: "< -1 SOL", count: pnlBuckets.ltNeg1, color: "bg-red-500" },
    ],
  };
}

export function useUserProfile(identifier: string | undefined) {
  const profileQuery = useQuery({
    queryKey: ["user-profile", identifier],
    queryFn: async () => {
      if (!identifier) throw new Error("No identifier");

      let query = supabase.from("profiles").select("*");

      if (isWalletAddress(identifier)) {
        query = query.eq("solana_wallet_address", identifier);
      } else {
        query = query.eq("username", identifier);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data && isWalletAddress(identifier)) {
        return {
          id: identifier,
          username: null,
          display_name: null,
          bio: null,
          avatar_url: null,
          cover_url: null,
          website: null,
          verified_type: null,
          followers_count: 0,
          following_count: 0,
          posts_count: 0,
          created_at: new Date().toISOString(),
          solana_wallet_address: identifier,
          isRegistered: false,
        } as UserProfile;
      }
      if (!data) throw new Error("Profile not found");
      return { ...data, isRegistered: true } as UserProfile;
    },
    enabled: !!identifier,
  });

  const wallet = profileQuery.data?.solana_wallet_address || (identifier && isWalletAddress(identifier) ? identifier : undefined);
  const profileId = profileQuery.data?.isRegistered ? profileQuery.data?.id : undefined;

  const tokensQuery = useQuery({
    queryKey: ["user-profile-tokens", wallet],
    queryFn: async () => {
      if (!wallet) return [];
      const { data, error } = await supabase
        .from("fun_tokens")
        .select("id, name, ticker, image_url, mint_address, market_cap_sol, status, created_at")
        .eq("creator_wallet", wallet)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CreatedToken[];
    },
    enabled: !!wallet,
  });

  const tradesQuery = useQuery({
    queryKey: ["user-profile-trades", wallet, profileId],
    queryFn: async () => {
      if (!wallet && !profileId) return [];
      
      // Try wallet-based query first (covers both registered and unregistered)
      if (wallet) {
        const { data, error } = await supabase
          .from("launchpad_transactions")
          .select("id, transaction_type, sol_amount, token_amount, price_per_token, created_at, token_id, signature")
          .eq("user_wallet", wallet)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        if (data && data.length > 0) return data as UserTrade[];
      }
      
      // Fallback to profile ID
      if (profileId) {
        const { data, error } = await supabase
          .from("launchpad_transactions")
          .select("id, transaction_type, sol_amount, token_amount, price_per_token, created_at, token_id, signature")
          .eq("user_profile_id", profileId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return (data ?? []) as UserTrade[];
      }
      
      return [];
    },
    enabled: !!wallet || !!profileId,
  });

  // Alpha trades for this wallet
  const alphaTradesQuery = useQuery({
    queryKey: ["user-alpha-trades", wallet],
    queryFn: async () => {
      if (!wallet) return [];
      const { data, error } = await (supabase as any)
        .from("alpha_trades")
        .select("*")
        .eq("wallet_address", wallet)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const tradesData = (data ?? []) as AlphaTradeRecord[];

      // Fetch token images
      const mints = [...new Set(tradesData.map((t) => t.token_mint).filter(Boolean))];
      if (mints.length > 0) {
        const { data: tokens } = await supabase
          .from("tokens")
          .select("mint_address, image_url")
          .in("mint_address", mints);
        if (tokens) {
          const imgMap = new Map<string, string>();
          for (const t of tokens) {
            if (t.image_url) imgMap.set(t.mint_address, t.image_url);
          }
          return tradesData.map((t) => ({
            ...t,
            token_image_url: imgMap.get(t.token_mint) || null,
          }));
        }
      }
      return tradesData;
    },
    enabled: !!wallet,
  });

  const alphaTrades = alphaTradesQuery.data ?? [];
  const launchpadTrades = tradesQuery.data ?? [];
  const alphaPositions = useMemo(() => computePositions(alphaTrades), [alphaTrades]);
  const tradingStats = useMemo(() => computeTradingStats(alphaTrades, alphaPositions, launchpadTrades, wallet), [alphaTrades, alphaPositions, launchpadTrades, wallet]);

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    tokens: tokensQuery.data ?? [],
    tokensLoading: tokensQuery.isLoading,
    trades: tradesQuery.data ?? [],
    tradesLoading: tradesQuery.isLoading,
    alphaTrades,
    alphaTradesLoading: alphaTradesQuery.isLoading,
    alphaPositions,
    tradingStats,
  };
}
