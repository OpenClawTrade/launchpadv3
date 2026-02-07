import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hash API key for lookup
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

    // Extract API key from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = authHeader.replace("Bearer ", "");
    
    // Validate key format
    if (!apiKey.startsWith("ota_live_")) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid API key format" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash and lookup
    const keyHash = await hashApiKey(apiKey);

    const { data: keyData, error: keyError } = await supabase
      .from("opentuna_api_keys")
      .select(`
        id,
        agent_id,
        is_active,
        revoked_at,
        opentuna_agents (
          id,
          name,
          status,
          balance_sol
        )
      `)
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({ valid: false, error: "API key not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if key is active
    if (!keyData.is_active || keyData.revoked_at) {
      return new Response(
        JSON.stringify({ valid: false, error: "API key has been revoked" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if agent is active
    const agent = keyData.opentuna_agents as any;
    if (!agent || agent.status === 'disabled') {
      return new Response(
        JSON.stringify({ valid: false, error: "Agent is disabled" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last used timestamp and increment request count
    await supabase
      .from("opentuna_api_keys")
      .update({
        last_used_at: new Date().toISOString(),
        total_requests: supabase.rpc ? undefined : keyData.total_requests + 1, // Increment if not using RPC
      })
      .eq("id", keyData.id);

    // Return success with agent info
    return new Response(
      JSON.stringify({
        valid: true,
        agentId: agent.id,
        agentName: agent.name,
        agentStatus: agent.status,
        balanceSol: agent.balance_sol,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("api-key-validate error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Validation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
