import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Treasury wallet
const TREASURY_WALLET = "7UiXCtz3wxjiKS2W3LQsJcs6GqwfuDbeEcRhaAVwcHB2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[fun-claim-fees] Starting fee claim process for fun tokens...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active fun tokens with pool addresses
    const { data: funTokens, error: fetchError } = await supabase
      .from("fun_tokens")
      .select("*")
      .eq("status", "active")
      .not("dbc_pool_address", "is", null);

    if (fetchError) {
      throw new Error(`Failed to fetch fun tokens: ${fetchError.message}`);
    }

    console.log(`[fun-claim-fees] Found ${funTokens?.length || 0} active fun tokens with pools`);

    if (!funTokens || funTokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active fun tokens to claim fees from" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
    if (!meteoraApiUrl) {
      throw new Error("METEORA_API_URL not configured");
    }

    const results: Array<{ tokenId: string; success: boolean; claimedSol?: number; error?: string }> = [];

    // Process each token
    for (const token of funTokens) {
      try {
        console.log(`[fun-claim-fees] Claiming fees for ${token.name} (${token.ticker})...`);

        // Call the fee claim API
        const claimResponse = await fetch(`${meteoraApiUrl}/api/fees/claim-from-pool`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poolAddress: token.dbc_pool_address,
            tokenId: token.id,
          }),
        });

        if (claimResponse.ok) {
          const claimData = await claimResponse.json();
          const claimedSol = claimData.claimedSol || 0;

          console.log(`[fun-claim-fees] Claimed ${claimedSol} SOL from ${token.ticker}`);

          // Update token with claimed fees
          if (claimedSol > 0) {
            await supabase
              .from("fun_tokens")
              .update({
                total_fees_earned: (token.total_fees_earned || 0) + claimedSol,
                updated_at: new Date().toISOString(),
              })
              .eq("id", token.id);
          }

          results.push({ tokenId: token.id, success: true, claimedSol });
        } else {
          const errorText = await claimResponse.text();
          console.error(`[fun-claim-fees] Claim failed for ${token.ticker}:`, errorText);
          results.push({ tokenId: token.id, success: false, error: errorText });
        }
      } catch (tokenError) {
        console.error(`[fun-claim-fees] Error processing ${token.ticker}:`, tokenError);
        results.push({
          tokenId: token.id,
          success: false,
          error: tokenError instanceof Error ? tokenError.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalClaimed = results.reduce((sum, r) => sum + (r.claimedSol || 0), 0);

    console.log(`[fun-claim-fees] Complete: ${successCount}/${results.length} tokens, ${totalClaimed} SOL total`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        totalClaimedSol: totalClaimed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fun-claim-fees] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
