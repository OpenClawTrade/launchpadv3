import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function decryptToString(encryptedData: string, encryptionKey: string): Promise<string> {
  // Encrypted payload is base64( iv(12 bytes) + ciphertext )
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // Derive 32-byte key via SHA-256(encryptionKey)
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const hashedKey = await crypto.subtle.digest("SHA-256", keyBytes);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    hashedKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, keyMaterial, ciphertext);
  return new TextDecoder().decode(new Uint8Array(decrypted));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const agentId = body?.agentId as string | undefined;
    const adminSecret = body?.adminSecret as string | undefined;

    // Admin auth
    const expectedSecret = Deno.env.get("TWITTER_BOT_ADMIN_SECRET");
    if (!expectedSecret || !adminSecret || adminSecret !== expectedSecret) {
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    // Trading agents were encrypted with API_ENCRYPTION_KEY (legacy/wrong naming),
    // but we also try WALLET_ENCRYPTION_KEY as a fallback for safety.
    const apiKey = Deno.env.get("API_ENCRYPTION_KEY");
    const walletKey = Deno.env.get("WALLET_ENCRYPTION_KEY");

    let privateKeyBase58: string | null = null;
    let usedKey: string | null = null;

    if (apiKey) {
      try {
        privateKeyBase58 = await decryptToString(agent.wallet_private_key_encrypted, apiKey);
        usedKey = "API_ENCRYPTION_KEY";
      } catch {
        // ignore, try fallback
      }
    }

    if (!privateKeyBase58 && walletKey) {
      try {
        privateKeyBase58 = await decryptToString(agent.wallet_private_key_encrypted, walletKey);
        usedKey = "WALLET_ENCRYPTION_KEY";
      } catch {
        // ignore
      }
    }

    if (!privateKeyBase58) {
      throw new Error("Decryption failed with configured keys");
    }

    console.log(
      `[admin-export-wallet] Exported key for agent ${agent.name} (${agent.wallet_address}) using ${usedKey}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        agentId: agent.id,
        agentName: agent.name,
        walletAddress: agent.wallet_address,
        privateKey: privateKeyBase58,
        encryptionKeyUsed: usedKey,
        warning: "Store this securely. Do not share.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[admin-export-wallet] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
