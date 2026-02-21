import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BitqueryCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MigrationEvent {
  time: number;
  label: string;
}

type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const DBC_PROGRAM = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";

function getIntervalConfig(interval: Interval) {
  switch (interval) {
    case "1m": return { count: 1, unit: "minutes", since: 2 }; // 2h of data
    case "5m": return { count: 5, unit: "minutes", since: 12 }; // 12h
    case "15m": return { count: 15, unit: "minutes", since: 24 }; // 24h
    case "1h": return { count: 60, unit: "minutes", since: 168 }; // 7d
    case "4h": return { count: 240, unit: "minutes", since: 720 }; // 30d
    case "1d": return { count: 1440, unit: "minutes", since: 2160 }; // 90d
    default: return { count: 5, unit: "minutes", since: 12 };
  }
}

/**
 * Fetch OHLCV candles from Bitquery for a Solana token on Meteora DBC.
 */
export function useBitqueryOHLC(mintAddress: string | null, interval: Interval = "5m") {
  return useQuery({
    queryKey: ["bitquery-ohlc", mintAddress, interval],
    queryFn: async (): Promise<{ candles: BitqueryCandle[]; migration: MigrationEvent | null }> => {
      if (!mintAddress) return { candles: [], migration: null };

      const cfg = getIntervalConfig(interval);
      const sinceDate = new Date(Date.now() - cfg.since * 3600000).toISOString();

      // Fetch OHLCV candles
      const ohlcQuery = `{
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {
          Currency: { MintAddress: { is: "${mintAddress}" } }
          Dex: { ProgramAddress: { is: "${DBC_PROGRAM}" } }
        }
        Block: { Time: { since: "${sinceDate}" } }
      }
      orderBy: { ascending: Block_Time }
    ) {
      Block {
        Time(interval: { in: ${cfg.unit}, count: ${cfg.count} })
      }
      Trade {
        open: PriceInUSD(minimum: Block_Time)
        close: PriceInUSD(maximum: Block_Time)
        high: PriceInUSD(maximum: Trade_PriceInUSD)
        low: PriceInUSD(minimum: Trade_PriceInUSD)
      }
      volume: sum(of: Trade_Amount)
    }
  }
}`;

      // Fetch migration event (first trade on DAMM pool)
      const migrationQuery = `{
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {
          Currency: { MintAddress: { is: "${mintAddress}" } }
          Dex: { ProtocolName: { is: "meteora_damm" } }
        }
      }
      orderBy: { ascending: Block_Time }
      limit: { count: 1 }
    ) {
      Block { Time }
    }
  }
}`;

      // Parallel fetch both queries
      const [ohlcRes, migrationRes] = await Promise.all([
        supabase.functions.invoke('bitquery-proxy', {
          body: { query: ohlcQuery },
        }),
        supabase.functions.invoke('bitquery-proxy', {
          body: { query: migrationQuery },
        }),
      ]);

      // Process OHLC
      let candles: BitqueryCandle[] = [];
      if (ohlcRes.data?.data?.Solana?.DEXTradeByTokens) {
        const rawCandles = ohlcRes.data.data.Solana.DEXTradeByTokens;
        candles = rawCandles
          .filter((c: any) => c.Block?.Time && c.Trade)
          .map((c: any) => ({
            time: Math.floor(new Date(c.Block.Time).getTime() / 1000),
            open: Number(c.Trade.open) || 0,
            high: Number(c.Trade.high) || 0,
            low: Number(c.Trade.low) || 0,
            close: Number(c.Trade.close) || 0,
            volume: Number(c.volume) || 0,
          }))
          .filter((c: BitqueryCandle) => c.open > 0);
      }

      // Process migration
      let migration: MigrationEvent | null = null;
      if (migrationRes.data?.data?.Solana?.DEXTradeByTokens?.[0]?.Block?.Time) {
        const migTime = migrationRes.data.data.Solana.DEXTradeByTokens[0].Block.Time;
        migration = {
          time: Math.floor(new Date(migTime).getTime() / 1000),
          label: "Migrated to Meteora Pool",
        };
      }

      return { candles, migration };
    },
    enabled: !!mintAddress,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
