/**
 * Client-side direct insert into alpha_trades with retry logic.
 * MUST be awaited to prevent silent failures from navigation/GC.
 */
import { supabase } from "@/integrations/supabase/client";

interface AlphaTradeRecord {
  walletAddress: string;
  tokenMint: string;
  tokenName?: string | null;
  tokenTicker?: string | null;
  tradeType: "buy" | "sell";
  amountSol: number;
  amountTokens?: number;
  priceSol?: number | null;
  txHash: string;
  chain?: string;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function recordAlphaTrade(trade: AlphaTradeRecord): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await (supabase as any)
        .from("alpha_trades")
        .upsert({
          wallet_address: trade.walletAddress,
          token_mint: trade.tokenMint,
          token_name: trade.tokenName || null,
          token_ticker: trade.tokenTicker || null,
          trade_type: trade.tradeType,
          amount_sol: trade.amountSol,
          amount_tokens: trade.amountTokens || 0,
          price_sol: trade.priceSol || null,
          price_usd: null,
          tx_hash: trade.txHash,
          chain: trade.chain || "solana",
        }, { onConflict: "tx_hash" });

      if (error) {
        console.warn(`[recordAlphaTrade] attempt ${attempt + 1} failed:`, error.message);
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
      } else {
        console.log("[recordAlphaTrade] ✅ Trade recorded:", trade.txHash.slice(0, 12));
        return;
      }
    } catch (err) {
      console.warn(`[recordAlphaTrade] attempt ${attempt + 1} exception:`, err);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
    }
  }
}
