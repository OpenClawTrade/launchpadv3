import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a secure random API key
function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCharCode(...bytes));
  // Clean up base64 for URL safety
  return `ota_live_${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').slice(0, 32)}`;
}

// Hash API key for storage
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { agentId, name, profileId } = await req.json();

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "agentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify agent exists and user owns it
    const { data: agent, error: agentError } = await supabase
      .from("opentuna_agents")
      .select("id, name, owner_profile_id")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership if profileId provided
    if (profileId && agent.owner_profile_id !== profileId) {
      return new Response(
        JSON.stringify({ error: "You don't own this agent" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate new API key
    const apiKey = generateApiKey();
    const keyHash = await hashApiKey(apiKey);
    const keyPrefix = apiKey.slice(0, 16) + "...";

    // Store in database
    const { error: insertError } = await supabase
      .from("opentuna_api_keys")
      .insert({
        agent_id: agentId,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name: name || `API Key for ${agent.name}`,
        is_active: true,
      });

    if (insertError) {
      console.error("Failed to create API key:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create API key", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[api-key-create] Created key for agent ${agentId}: ${keyPrefix}`);

    // Return the full key ONCE - user must save it
    return new Response(
      JSON.stringify({
        success: true,
        apiKey, // Full key - shown only once
        keyPrefix, // Safe to store/display
        message: "Save this API key now! It won't be shown again.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("api-key-create error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
