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
    const { listingId, sellerWallet } = await req.json();

    if (!listingId || !sellerWallet) {
      return new Response(
        JSON.stringify({ error: "listingId and sellerWallet required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the listing
    const { data: listing, error: listError } = await supabase
      .from("nfa_listings")
      .select("*")
      .eq("id", listingId)
      .eq("status", "active")
      .single();

    if (listError || !listing) {
      return new Response(
        JSON.stringify({ error: "Active listing not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (listing.seller_wallet !== sellerWallet) {
      return new Response(
        JSON.stringify({ error: "You don't own this listing" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cancel listing
    await supabase
      .from("nfa_listings")
      .update({ status: "cancelled" })
      .eq("id", listingId);

    // Update mint
    await supabase
      .from("nfa_mints")
      .update({ listed_for_sale: false, listing_price_sol: null })
      .eq("id", listing.nfa_mint_id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("NFA delist error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
