import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// AES-256-GCM encryption
async function encryptPrivateKey(privateKey: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(encryptionKey);
  const keyHash = await crypto.subtle.digest("SHA-256", keyData);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyHash,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(privateKey)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { agentId, newPrivateKey, newWalletAddress } = await req.json();

    if (!agentId || !newPrivateKey || !newWalletAddress) {
      return new Response(
        JSON.stringify({ error: "agentId, newPrivateKey, and newWalletAddress required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encryptionKey = Deno.env.get("API_ENCRYPTION_KEY");
    if (!encryptionKey) {
      throw new Error("API_ENCRYPTION_KEY not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Encrypt the new private key
    const encryptedKey = await encryptPrivateKey(newPrivateKey, encryptionKey);

    // Update the trading agent
    const { data: agent, error: updateError } = await supabase
      .from("trading_agents")
      .update({
        wallet_address: newWalletAddress,
        wallet_private_key_encrypted: encryptedKey,
      })
      .eq("id", agentId)
      .select("id, name, wallet_address")
      .single();

    if (updateError) {
      throw updateError;
    }

    // Also update the linked agent record
    await supabase
      .from("agents")
      .update({ wallet_address: newWalletAddress })
      .eq("trading_agent_id", agentId);

    console.log(`[admin-update-agent-wallet] Updated wallet for ${agent.name} to ${newWalletAddress}`);

    return new Response(
      JSON.stringify({
        success: true,
        agentId: agent.id,
        agentName: agent.name,
        newWalletAddress: agent.wallet_address,
        message: "Wallet updated and private key encrypted. Future fees will go to this wallet.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[admin-update-agent-wallet] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
