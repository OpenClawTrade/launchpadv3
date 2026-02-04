// Bags Data Sync - Fetches live data from bags.fm for tracked tokens
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BAGS_API_URL = "https://public-api-v2.bags.fm/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[bags-data-sync] ⏰ Starting bags.fm data sync...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bagsApiKey = Deno.env.get("BAGS_API_KEY");

    if (!bagsApiKey) {
      throw new Error("BAGS_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all bags tokens from our database
    const { data: bagsTokens, error: fetchError } = await supabase
      .from("fun_tokens")
      .select("id, mint_address, ticker, name, status")
      .eq("launchpad_type", "bags")
      .eq("status", "active");

    if (fetchError) {
      throw new Error(`Failed to fetch bags tokens: ${fetchError.message}`);
    }

    console.log(`[bags-data-sync] Found ${bagsTokens?.length || 0} bags tokens to sync`);

    if (!bagsTokens || bagsTokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No bags tokens to sync",
          synced: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let syncedCount = 0;
    let failedCount = 0;

    for (const token of bagsTokens) {
      try {
        // Fetch token data from bags.fm
        const response = await fetch(`${BAGS_API_URL}/token/${token.mint_address}`, {
          headers: {
            "x-api-key": bagsApiKey,
          },
        });

        if (!response.ok) {
          console.warn(`[bags-data-sync] Failed to fetch ${token.ticker}: ${response.status}`);
          failedCount++;
          continue;
        }

        const data = await response.json();

        // Update our database with fresh data
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        if (data.priceUsd !== undefined) {
          // Convert USD price to SOL (approximate)
          // We'll need SOL price from elsewhere, for now store USD
          updateData.price_usd = data.priceUsd;
        }

        if (data.marketCapUsd !== undefined) {
          updateData.market_cap_usd = data.marketCapUsd;
        }

        if (data.marketCapSol !== undefined) {
          updateData.market_cap_sol = data.marketCapSol;
        }

        if (data.priceSol !== undefined) {
          updateData.price_sol = data.priceSol;
        }

        if (data.holderCount !== undefined) {
          updateData.holder_count = data.holderCount;
        }

        if (data.volume24h !== undefined) {
          updateData.volume_24h_sol = data.volume24h;
        }

        if (data.bondingProgress !== undefined) {
          updateData.bonding_progress = data.bondingProgress;
        }

        // Check if graduated (migrated to Raydium)
        if (data.isGraduated || data.status === 'graduated') {
          updateData.status = 'graduated';
        }

        const { error: updateError } = await supabase
          .from("fun_tokens")
          .update(updateData)
          .eq("id", token.id);

        if (updateError) {
          console.error(`[bags-data-sync] Update failed for ${token.ticker}:`, updateError);
          failedCount++;
        } else {
          syncedCount++;
        }

        // Rate limit - don't hammer the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (tokenError) {
        console.error(`[bags-data-sync] Error syncing ${token.ticker}:`, tokenError);
        failedCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[bags-data-sync] ✅ Completed in ${duration}ms: ${syncedCount} synced, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        failed: failedCount,
        duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[bags-data-sync] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
