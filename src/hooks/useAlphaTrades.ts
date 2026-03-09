import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AlphaTrade {
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

export interface PositionSummary {
  wallet_address: string;
  token_mint: string;
  token_ticker: string | null;
  total_bought_sol: number;
  total_sold_sol: number;
  total_bought_tokens: number;
  total_sold_tokens: number;
  net_tokens: number;
  avg_buy_price_sol: number;
  realized_pnl_sol: number;
  status: "HOLDING" | "SOLD" | "PARTIAL";
}

function computePositions(trades: AlphaTrade[]): Map<string, PositionSummary> {
  const map = new Map<string, PositionSummary>();

  for (const t of trades) {
    const key = `${t.wallet_address}::${t.token_mint}`;
    let pos = map.get(key);
    if (!pos) {
      pos = {
        wallet_address: t.wallet_address,
        token_mint: t.token_mint,
        token_ticker: t.token_ticker,
        total_bought_sol: 0,
        total_sold_sol: 0,
        total_bought_tokens: 0,
        total_sold_tokens: 0,
        net_tokens: 0,
        avg_buy_price_sol: 0,
        realized_pnl_sol: 0,
        status: "HOLDING",
      };
      map.set(key, pos);
    }

    if (t.trade_type === "buy") {
      pos.total_bought_sol += t.amount_sol;
      pos.total_bought_tokens += t.amount_tokens;
    } else {
      pos.total_sold_sol += t.amount_sol;
      pos.total_sold_tokens += t.amount_tokens;
    }
  }

  for (const pos of map.values()) {
    pos.net_tokens = pos.total_bought_tokens - pos.total_sold_tokens;
    pos.avg_buy_price_sol =
      pos.total_bought_tokens > 0
        ? pos.total_bought_sol / pos.total_bought_tokens
        : 0;
    const costOfSold = pos.avg_buy_price_sol * pos.total_sold_tokens;
    pos.realized_pnl_sol = pos.total_sold_sol - costOfSold;

    if (pos.net_tokens <= 0) {
      pos.status = "SOLD";
    } else if (pos.total_sold_tokens > 0) {
      pos.status = "PARTIAL";
    } else {
      pos.status = "HOLDING";
    }
  }

  return map;
}

export function useAlphaTrades(limit = 50) {
  const [trades, setTrades] = useState<AlphaTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenImages, setTokenImages] = useState<Map<string, string>>(new Map());

  const fetchTrades = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("alpha_trades")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && data) {
      const tradesData = data as AlphaTrade[];
      setTrades(tradesData);

      // Fetch token images for unique mints
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
          setTokenImages(imgMap);
        }
      }
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchTrades();

    const channel = supabase
      .channel("alpha-trades-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alpha_trades" },
        (payload) => {
          const newTrade = payload.new as AlphaTrade;
          setTrades((prev) => [newTrade, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTrades, limit]);

  const positions = useMemo(() => computePositions(trades), [trades]);

  // Enrich trades with token images
  const enrichedTrades = useMemo(() => {
    return trades.map((t) => ({
      ...t,
      token_image_url: tokenImages.get(t.token_mint) || null,
    }));
  }, [trades, tokenImages]);

  return { trades: enrichedTrades, loading, positions };
}
