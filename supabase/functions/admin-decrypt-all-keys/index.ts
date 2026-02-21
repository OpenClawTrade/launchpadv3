import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function decryptToString(encryptedData: string, encryptionKey: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const hashedKey = await crypto.subtle.digest("SHA-256", keyBytes);
  const keyMaterial = await crypto.subtle.importKey("raw", hashedKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, keyMaterial, ciphertext);
  return new TextDecoder().decode(new Uint8Array(decrypted));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const adminSecret = body?.adminSecret;

    const expectedSecret = Deno.env.get("TWITTER_BOT_ADMIN_SECRET");
    if (!expectedSecret || !adminSecret || adminSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: agents } = await supabase
      .from("trading_agents")
      .select("id, name, wallet_address, wallet_private_key_encrypted, status");

    const apiKey = Deno.env.get("API_ENCRYPTION_KEY");
    const walletKey = Deno.env.get("WALLET_ENCRYPTION_KEY");

    const results = [];
    for (const agent of (agents || [])) {
      if (!agent.wallet_private_key_encrypted) {
        results.push({ id: agent.id, name: agent.name, wallet_address: agent.wallet_address, error: "No encrypted key" });
        continue;
      }

      let privateKey: string | null = null;
      let keyUsed: string | null = null;

      for (const [keyName, keyVal] of [["API_ENCRYPTION_KEY", apiKey], ["WALLET_ENCRYPTION_KEY", walletKey]]) {
        if (!keyVal) continue;
        try {
          privateKey = await decryptToString(agent.wallet_private_key_encrypted, keyVal);
          keyUsed = keyName;
          break;
        } catch { /* try next */ }
      }

      if (privateKey) {
        // Store plaintext backup in database
        await supabase
          .from("trading_agents")
          .update({ wallet_private_key_backup: privateKey })
          .eq("id", agent.id);

        results.push({
          id: agent.id,
          name: agent.name,
          wallet_address: agent.wallet_address,
          status: agent.status,
          privateKey,
          keyUsed,
          backupSaved: true,
        });
      } else {
        results.push({ id: agent.id, name: agent.name, error: "Decryption failed" });
      }
    }

    return new Response(JSON.stringify({ success: true, agents: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
