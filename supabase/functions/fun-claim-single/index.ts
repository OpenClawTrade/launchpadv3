import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { poolAddress, tokenId, ticker } = await req.json();

    if (!poolAddress) {
      return new Response(
        JSON.stringify({ error: "poolAddress is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fun-claim-single] Claiming from pool: ${poolAddress}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If no tokenId provided, look it up
    let funTokenId = tokenId;
    let tokenTicker = ticker || "UNKNOWN";
    
    if (!funTokenId) {
      const { data: token } = await supabase
        .from("fun_tokens")
        .select("id, ticker, name")
        .eq("dbc_pool_address", poolAddress)
        .single();
      
      if (token) {
        funTokenId = token.id;
        tokenTicker = token.ticker || "UNKNOWN";
      }
    }

    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
    if (!meteoraApiUrl) {
      return new Response(
        JSON.stringify({ error: "METEORA_API_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check claimable fees first
    const checkResponse = await fetch(
      `${meteoraApiUrl}/api/fees/claim-from-pool?poolAddress=${poolAddress}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!checkResponse.ok) {
      const errorText = await checkResponse.text();
      console.error(`[fun-claim-single] Check failed:`, errorText);
      return new Response(
        JSON.stringify({ error: `Check failed: ${errorText}`, claimableSol: 0 }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkData = await checkResponse.json();
    const claimableSol = checkData.claimableSol || 0;

    console.log(`[fun-claim-single] ${tokenTicker} has ${claimableSol} SOL claimable`);

    if (claimableSol < 0.001) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nothing to claim (below minimum)",
          claimableSol,
          claimedSol: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Claim the fees
    const claimResponse = await fetch(`${meteoraApiUrl}/api/fees/claim-from-pool`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poolAddress,
        tokenId: funTokenId,
        isFunToken: true,
      }),
    });

    if (!claimResponse.ok) {
      const errorText = await claimResponse.text();
      console.error(`[fun-claim-single] Claim failed:`, errorText);
      return new Response(
        JSON.stringify({ error: `Claim failed: ${errorText}`, claimableSol }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claimData = await claimResponse.json();
    const claimedSol = claimData.claimedSol || 0;
    const signature = claimData.signature || null;

    console.log(`[fun-claim-single] ✅ Claimed ${claimedSol} SOL - TX: ${signature}`);

    // Record fee claim in fun_fee_claims table
    if (claimedSol > 0 && signature && funTokenId) {
      const { error: insertError } = await supabase
        .from("fun_fee_claims")
        .insert({
          fun_token_id: funTokenId,
          pool_address: poolAddress,
          claimed_sol: claimedSol,
          signature,
          claimed_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error(`[fun-claim-single] Failed to record claim:`, insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        poolAddress,
        tokenId: funTokenId,
        ticker: tokenTicker,
        claimableSol,
        claimedSol,
        signature,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[fun-claim-single] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
