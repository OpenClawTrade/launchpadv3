import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_V5_NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) throw new Error("Invalid UUID");

  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function sha1(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  // Deno's WebCrypto typings currently require ArrayBuffer-backed views.
  // Enforce ArrayBuffer here and pass a sliced ArrayBuffer to digest.
  const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const digest = await crypto.subtle.digest("SHA-1", ab);
  return new Uint8Array(digest);
}

async function uuidV5(name: string, namespaceUuid: string): Promise<string> {
  const ns = uuidToBytes(namespaceUuid);
  const nameBytes = new TextEncoder().encode(name);

  const toHash = new Uint8Array(ns.length + nameBytes.length);
  toHash.set(ns, 0);
  toHash.set(nameBytes, ns.length);

  const hash = await sha1(toHash);
  const bytes = hash.slice(0, 16);

  // Version 5
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  // Variant RFC4122
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytesToUuid(bytes);
}

async function privyUserIdToUuid(privyUserId: string): Promise<string> {
  return uuidV5(privyUserId, UUID_V5_NAMESPACE_DNS);
}

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

    const profileId = await privyUserIdToUuid(privyUserId);

    // Create Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate username from available data
    const username = twitterUsername ?? email?.split("@")[0] ?? `user_${profileId.slice(-8)}`;
    const name = displayName ?? username;

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, solana_wallet_address")
      .eq("id", profileId)
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
          .eq("id", profileId);

        if (updateError) {
          console.error("Error updating profile:", updateError);
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: "updated", profileId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: profileId,
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
        JSON.stringify({ success: true, action: "created", profileId }),
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

