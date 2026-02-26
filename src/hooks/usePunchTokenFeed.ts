import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PunchToken {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  mint_address: string | null;
  created_at: string;
  market_cap_sol: number | null;
  price_sol: number | null;
  holder_count: number | null;
}

export function usePunchTokenFeed() {
  const [tokens, setTokens] = useState<PunchToken[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTokens = async () => {
    const { data } = await supabase
      .from("fun_tokens")
      .select("id, name, ticker, image_url, mint_address, created_at, market_cap_sol, price_sol, holder_count")
      .eq("launchpad_type", "punch")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setTokens(data as PunchToken[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchTokens();

    const channel = supabase
      .channel("punch-token-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fun_tokens" },
        (payload) => {
          const row = payload.new as any;
          if (row.launchpad_type === "punch") {
            setTokens((prev) => [
              {
                id: row.id,
                name: row.name,
                ticker: row.ticker,
                image_url: row.image_url,
                mint_address: row.mint_address,
                created_at: row.created_at,
                market_cap_sol: row.market_cap_sol ?? null,
                price_sol: row.price_sol ?? null,
                holder_count: row.holder_count ?? null,
              },
              ...prev,
            ].slice(0, 50));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { tokens, loading };
}
