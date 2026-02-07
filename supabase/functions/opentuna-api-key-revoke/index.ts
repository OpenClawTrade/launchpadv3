import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { keyId, profileId } = await req.json();

    if (!keyId) {
      return new Response(
        JSON.stringify({ error: "keyId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the key and verify ownership
    const { data: keyData, error: keyError } = await supabase
      .from("opentuna_api_keys")
      .select(`
        id,
        agent_id,
        key_prefix,
        opentuna_agents (
          owner_profile_id
        )
      `)
      .eq("id", keyId)
      .single();

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({ error: "API key not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership if profileId provided
    const agent = keyData.opentuna_agents as any;
    if (profileId && agent?.owner_profile_id !== profileId) {
      return new Response(
        JSON.stringify({ error: "You don't own this API key" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Revoke the key
    const { error: updateError } = await supabase
      .from("opentuna_api_keys")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", keyId);

    if (updateError) {
      console.error("Failed to revoke API key:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to revoke API key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[api-key-revoke] Revoked key ${keyData.key_prefix} for agent ${keyData.agent_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `API key ${keyData.key_prefix} has been revoked`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("api-key-revoke error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
