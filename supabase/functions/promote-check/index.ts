import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REQUIRED_SOL = 1.0;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { promotionId } = await req.json();

    if (!promotionId) {
      return new Response(
        JSON.stringify({ error: "promotionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get promotion record
    const { data: promotion, error: promotionError } = await supabase
      .from("token_promotions")
      .select(`
        id,
        fun_token_id,
        payment_address,
        status,
        created_at,
        fun_tokens (
          id,
          name,
          ticker,
          mint_address,
          image_url,
          description
        )
      `)
      .eq("id", promotionId)
      .single();

    if (promotionError || !promotion) {
      return new Response(
        JSON.stringify({ error: "Promotion not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already paid/posted, return current status
    if (promotion.status === "paid" || promotion.status === "posted") {
      return new Response(
        JSON.stringify({
          success: true,
          status: promotion.status,
          paid: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if promotion has expired (1 hour window)
    const createdAt = new Date(promotion.created_at);
    const now = new Date();
    if (now.getTime() - createdAt.getTime() > 60 * 60 * 1000) {
      // Mark as expired
      await supabase.rpc("backend_update_promotion_status", {
        p_promotion_id: promotionId,
        p_status: "expired",
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: "expired",
          paid: false,
          message: "Payment window expired. Please start a new promotion.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check SOL balance on payment address
    const connection = new Connection(heliusRpcUrl, "confirmed");
    const paymentPubkey = new PublicKey(promotion.payment_address);
    const balance = await connection.getBalance(paymentPubkey);
    const balanceSol = balance / LAMPORTS_PER_SOL;

    console.log(`[promote-check] Payment address ${promotion.payment_address} balance: ${balanceSol} SOL`);

    if (balanceSol >= REQUIRED_SOL) {
      // Payment received! Update status to paid
      await supabase.rpc("backend_update_promotion_status", {
        p_promotion_id: promotionId,
        p_status: "paid",
      });

      console.log(`[promote-check] Payment confirmed for promotion ${promotionId}`);

      // Trigger Twitter post by calling promote-post function
      const projectId = Deno.env.get("SUPABASE_PROJECT_ID") || supabaseUrl.split("//")[1].split(".")[0];
      const postUrl = `https://${projectId}.supabase.co/functions/v1/promote-post`;
      
      try {
        const postResponse = await fetch(postUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ promotionId }),
        });

        const postResult = await postResponse.json();
        console.log(`[promote-check] Twitter post result:`, postResult);

        return new Response(
          JSON.stringify({
            success: true,
            status: "paid",
            paid: true,
            twitterPosted: postResult.success || false,
            tweetId: postResult.tweetId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (postError) {
        console.error("[promote-check] Error calling promote-post:", postError);
        // Still return success for payment
        return new Response(
          JSON.stringify({
            success: true,
            status: "paid",
            paid: true,
            twitterPosted: false,
            message: "Payment confirmed. Tweet will be posted shortly.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Payment not yet received
    return new Response(
      JSON.stringify({
        success: true,
        status: "pending",
        paid: false,
        currentBalance: balanceSol,
        requiredBalance: REQUIRED_SOL,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[promote-check] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
