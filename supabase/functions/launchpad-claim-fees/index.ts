import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tokenId, walletAddress, profileId } = await req.json();

    console.log("[launchpad-claim-fees] Request:", { tokenId, walletAddress, profileId });

    if (!tokenId || !walletAddress) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tokenId, walletAddress" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get fee earner record
    const { data: earner, error: earnerError } = await supabase
      .from("fee_earners")
      .select("*")
      .eq("token_id", tokenId)
      .eq("wallet_address", walletAddress)
      .single();

    if (earnerError || !earner) {
      // Try by profile_id
      const { data: earnerByProfile, error: profileError } = await supabase
        .from("fee_earners")
        .select("*")
        .eq("token_id", tokenId)
        .eq("profile_id", profileId)
        .single();

      if (profileError || !earnerByProfile) {
        console.error("[launchpad-claim-fees] Fee earner not found");
        return new Response(
          JSON.stringify({ error: "You are not a fee earner for this token" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const activeEarner = earner || await supabase
      .from("fee_earners")
      .select("*")
      .eq("token_id", tokenId)
      .eq("profile_id", profileId)
      .single()
      .then(r => r.data);

    if (!activeEarner) {
      return new Response(
        JSON.stringify({ error: "Fee earner not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const unclaimedAmount = activeEarner.unclaimed_sol || 0;

    if (unclaimedAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "No fees to claim", unclaimedAmount: 0 }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to acquire lock
    const { data: lockAcquired } = await supabase.rpc("acquire_claim_lock", {
      p_token_id: tokenId,
      p_lock_duration_seconds: 60,
    });

    if (!lockAcquired) {
      return new Response(
        JSON.stringify({ error: "Another claim is in progress. Please try again." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      // In production, execute actual SOL transfer here
      // For now, just record the claim
      const signature = `claim_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Record fee claim
      const { error: claimError } = await supabase.from("fee_claims").insert({
        fee_earner_id: activeEarner.id,
        amount_sol: unclaimedAmount,
        signature,
      });

      if (claimError) {
        console.error("[launchpad-claim-fees] Claim insert error:", claimError);
        throw claimError;
      }

      // Reset unclaimed balance
      const { error: updateError } = await supabase
        .from("fee_earners")
        .update({
          unclaimed_sol: 0,
          last_claimed_at: new Date().toISOString(),
        })
        .eq("id", activeEarner.id);

      if (updateError) {
        console.error("[launchpad-claim-fees] Update error:", updateError);
        throw updateError;
      }

      // Release lock
      await supabase.rpc("release_claim_lock", { p_token_id: tokenId });

      console.log("[launchpad-claim-fees] Success:", { signature, claimedAmount: unclaimedAmount });

      return new Response(
        JSON.stringify({
          success: true,
          claimedAmount: unclaimedAmount,
          signature,
          message: "Fees claimed successfully (simulated)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (innerError) {
      // Release lock on error
      await supabase.rpc("release_claim_lock", { p_token_id: tokenId });
      throw innerError;
    }

  } catch (error) {
    console.error("[launchpad-claim-fees] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
