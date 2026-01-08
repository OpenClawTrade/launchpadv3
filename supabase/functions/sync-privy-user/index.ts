import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { privyUserId, solanaWalletAddress, email, twitterUsername, displayName, avatarUrl } = await req.json();

    if (!privyUserId) {
      return new Response(
        JSON.stringify({ error: "privyUserId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate username from available data
    const username = twitterUsername ?? email?.split("@")[0] ?? `user_${privyUserId.slice(-8)}`;
    const name = displayName ?? username;

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, solana_wallet_address")
      .eq("id", privyUserId)
      .maybeSingle();

    if (existingProfile) {
      // Update existing profile
      const updates: Record<string, unknown> = {};
      
      if (solanaWalletAddress && existingProfile.solana_wallet_address !== solanaWalletAddress) {
        updates.solana_wallet_address = solanaWalletAddress;
      }
      if (avatarUrl) updates.avatar_url = avatarUrl;
      
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", privyUserId);

        if (updateError) {
          console.error("Error updating profile:", updateError);
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: "updated", profileId: privyUserId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: privyUserId,
          username,
          display_name: name,
          avatar_url: avatarUrl,
          solana_wallet_address: solanaWalletAddress,
        });

      if (insertError) {
        console.error("Error creating profile:", insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: "created", profileId: privyUserId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in sync-privy-user:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
