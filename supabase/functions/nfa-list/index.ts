import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nfaMintId, sellerWallet, askingPriceSol } = await req.json();

    if (!nfaMintId || !sellerWallet || !askingPriceSol) {
      return new Response(
        JSON.stringify({ error: "nfaMintId, sellerWallet, and askingPriceSol required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (askingPriceSol <= 0 || askingPriceSol > 10000) {
      return new Response(
        JSON.stringify({ error: "Invalid asking price" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify ownership
    const { data: mint, error: mintError } = await supabase
      .from("nfa_mints")
      .select("*")
      .eq("id", nfaMintId)
      .single();

    if (mintError || !mint) {
      return new Response(
        JSON.stringify({ error: "NFA not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mint.owner_wallet !== sellerWallet) {
      return new Response(
        JSON.stringify({ error: "You don't own this NFA" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mint.listed_for_sale) {
      return new Response(
        JSON.stringify({ error: "NFA is already listed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create listing
    const { data: listing, error: listError } = await supabase
      .from("nfa_listings")
      .insert({
        nfa_mint_id: nfaMintId,
        seller_wallet: sellerWallet,
        asking_price_sol: askingPriceSol,
        status: "active",
      })
      .select()
      .single();

    if (listError) {
      console.error("Listing error:", listError);
      return new Response(
        JSON.stringify({ error: "Failed to create listing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update mint record
    await supabase
      .from("nfa_mints")
      .update({ listed_for_sale: true, listing_price_sol: askingPriceSol })
      .eq("id", nfaMintId);

    return new Response(
      JSON.stringify({ success: true, listing }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("NFA list error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
