/**
 * Client-side direct insert into alpha_trades as an ironclad fallback.
 * This ensures trades appear in Alpha Tracker even when edge function
 * calls silently fail (network timeout, cold start, etc.).
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

export async function recordAlphaTrade(trade: AlphaTradeRecord): Promise<void> {
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
      console.warn("[recordAlphaTrade] upsert failed:", error.message);
    } else {
      console.log("[recordAlphaTrade] ✅ Trade recorded:", trade.txHash.slice(0, 12));
    }
  } catch (err) {
    console.warn("[recordAlphaTrade] exception:", err);
  }
}
