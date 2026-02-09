import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bs58 from "https://esm.sh/bs58@6.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function decryptPrivateKey(encryptedData: string, encryptionKey: string): Promise<Uint8Array> {
  const decoded = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  const iv = decoded.slice(0, 12);
  const ciphertext = decoded.slice(12);
  
  // Hash the encryption key to get 32 bytes
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const hashedKey = await crypto.subtle.digest("SHA-256", keyBytes);
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    hashedKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    ciphertext
  );
  
  return new Uint8Array(decrypted);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentId, adminSecret } = await req.json();

    // Validate admin secret
    const expectedSecret = Deno.env.get("TWITTER_BOT_ADMIN_SECRET");
    if (!expectedSecret || adminSecret !== expectedSecret) {
      console.log("[admin-export-wallet] Unauthorized access attempt");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!agentId) {
      return new Response(JSON.stringify({ error: "agentId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encryptionKey = Deno.env.get("WALLET_ENCRYPTION_KEY");
    if (!encryptionKey) {
      throw new Error("WALLET_ENCRYPTION_KEY not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the trading agent
    const { data: agent, error: fetchError } = await supabase
      .from("trading_agents")
      .select("id, name, wallet_address, wallet_private_key_encrypted")
      .eq("id", agentId)
      .single();

    if (fetchError || !agent) {
      console.log("[admin-export-wallet] Agent not found:", agentId);
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!agent.wallet_private_key_encrypted) {
      return new Response(JSON.stringify({ error: "No encrypted key found for this agent" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt the private key
    const secretKeyBytes = await decryptPrivateKey(agent.wallet_private_key_encrypted, encryptionKey);
    
    // Convert to base58 for wallet import
    const base58PrivateKey = bs58.encode(secretKeyBytes);

    console.log(`[admin-export-wallet] Successfully exported key for agent ${agent.name} (${agent.wallet_address})`);

    return new Response(JSON.stringify({
      success: true,
      agentId: agent.id,
      agentName: agent.name,
      walletAddress: agent.wallet_address,
      privateKey: base58PrivateKey,
      warning: "Store this securely. Do not share."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[admin-export-wallet] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
