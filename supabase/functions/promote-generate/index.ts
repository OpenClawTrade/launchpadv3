import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@6.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { funTokenId, promoterWallet } = await req.json();

    if (!funTokenId || !promoterWallet) {
      return new Response(
        JSON.stringify({ error: "funTokenId and promoterWallet are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token exists
    const { data: token, error: tokenError } = await supabase
      .from("fun_tokens")
      .select("id, name, ticker, mint_address")
      .eq("id", funTokenId)
      .single();

    if (tokenError || !token) {
      return new Response(
        JSON.stringify({ error: "Token not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing active promotion
    const { data: existingPromotion } = await supabase
      .from("token_promotions")
      .select("id, status, expires_at")
      .eq("fun_token_id", funTokenId)
      .eq("status", "posted")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (existingPromotion) {
      return new Response(
        JSON.stringify({ error: "Token already has an active promotion" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing pending promotion (within 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: pendingPromotion } = await supabase
      .from("token_promotions")
      .select("id, payment_address, created_at")
      .eq("fun_token_id", funTokenId)
      .eq("status", "pending")
      .gt("created_at", oneHourAgo)
      .single();

    if (pendingPromotion) {
      // Return existing pending promotion
      return new Response(
        JSON.stringify({
          success: true,
          promotionId: pendingPromotion.id,
          paymentAddress: pendingPromotion.payment_address,
          amountSol: 1.0,
          expiresIn: "1 hour",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate new Solana keypair for payment
    const keypair = Keypair.generate();
    const paymentAddress = keypair.publicKey.toBase58();
    const privateKeyBase58 = bs58.encode(keypair.secretKey);

    // Create promotion record using SECURITY DEFINER function
    const { data: promotionId, error: createError } = await supabase
      .rpc("backend_create_promotion", {
        p_fun_token_id: funTokenId,
        p_promoter_wallet: promoterWallet,
        p_payment_address: paymentAddress,
        p_payment_private_key: privateKeyBase58,
      });

    if (createError) {
      console.error("Error creating promotion:", createError);
      return new Response(
        JSON.stringify({ error: "Failed to create promotion record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[promote-generate] Created promotion ${promotionId} for token ${token.ticker}`);

    return new Response(
      JSON.stringify({
        success: true,
        promotionId,
        paymentAddress,
        amountSol: 1.0,
        expiresIn: "1 hour",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[promote-generate] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
