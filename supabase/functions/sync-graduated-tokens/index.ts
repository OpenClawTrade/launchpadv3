import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all graduated tokens
    const { data: tokens, error } = await supabase
      .from("fun_tokens")
      .select("id, mint_address, ticker, market_cap_sol, price_sol, holder_count")
      .eq("status", "graduated")
      .not("mint_address", "is", null);

    if (error) throw error;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No graduated tokens to sync" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const token of tokens) {
      try {
        // Fetch from DexScreener
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${token.mint_address}`,
          { signal: AbortSignal.timeout(8000) }
        );

        if (!res.ok) {
          results.push({ id: token.id, ticker: token.ticker, error: `DexScreener ${res.status}` });
          continue;
        }

        const data = await res.json();
        const pairs = data.pairs || [];

        if (pairs.length === 0) {
          // Fallback: try pool-state for on-chain data
          results.push({ id: token.id, ticker: token.ticker, error: "No pairs on DexScreener" });
          continue;
        }

        // Find the best Solana pool by liquidity
        const solanaPairs = pairs.filter((p: any) => p.chainId === "solana");
        const bestPool = (solanaPairs.length > 0 ? solanaPairs : pairs).sort(
          (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];

        const priceUsd = parseFloat(bestPool.priceUsd || "0");
        const mcapUsd = bestPool.marketCap || bestPool.fdv || 0;
        const volume24h = bestPool.volume?.h24 || 0;

        // We need SOL price to convert. Use the quote token if it's SOL.
        const solPriceUsd = bestPool.priceNative
          ? priceUsd / parseFloat(bestPool.priceNative)
          : null;

        let priceSol = 0;
        let marketCapSol = 0;

        if (bestPool.quoteToken?.symbol === "SOL" || bestPool.quoteToken?.symbol === "WSOL") {
          priceSol = parseFloat(bestPool.priceNative || "0");
          marketCapSol = solPriceUsd ? mcapUsd / solPriceUsd : 0;
        } else if (solPriceUsd && solPriceUsd > 0) {
          priceSol = priceUsd / solPriceUsd;
          marketCapSol = mcapUsd / solPriceUsd;
        }

        const updates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        if (priceSol > 0) updates.price_sol = priceSol;
        if (marketCapSol > 0) updates.market_cap_sol = marketCapSol;
        if (volume24h > 0) updates.volume_24h_sol = solPriceUsd ? volume24h / solPriceUsd : 0;

        // Store previous price for 24h change calc
        if (priceSol > 0 && token.price_sol && token.price_sol > 0) {
          updates.price_change_24h = ((priceSol - token.price_sol) / token.price_sol) * 100;
        }

        await supabase.from("fun_tokens").update(updates).eq("id", token.id);

        results.push({
          id: token.id,
          ticker: token.ticker,
          priceSol,
          marketCapSol,
          updated: true,
        });

        console.log(`[sync-graduated] Updated $${token.ticker}: price=${priceSol}, mcap=${marketCapSol}`);
      } catch (tokenErr) {
        console.error(`[sync-graduated] Error syncing ${token.ticker}:`, tokenErr);
        results.push({
          id: token.id,
          ticker: token.ticker,
          error: tokenErr instanceof Error ? tokenErr.message : "Unknown",
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[sync-graduated] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
