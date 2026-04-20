import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tokenAddress, clientId } = await req.json();
    if (!tokenAddress || typeof tokenAddress !== "string" || tokenAddress.length > 128) {
      return new Response(JSON.stringify({ error: "Invalid tokenAddress" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedAddress = tokenAddress.trim().toLowerCase();

    // Build a per-visitor hash from IP + UA + optional clientId so refreshes within a day count once.
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const ua = req.headers.get("user-agent") || "unknown";
    const cid = typeof clientId === "string" && clientId.length <= 128 ? clientId : "";
    const visitorHash = await sha256Hex(`${ip}|${ua}|${cid}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.rpc("increment_token_view", {
      p_token_address: normalizedAddress,
      p_visitor_hash: visitorHash,
    });

    if (error) {
      console.error("[track-token-view] rpc error:", error);
      return new Response(JSON.stringify({ error: "Failed to track view" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return new Response(
      JSON.stringify({
        ok: true,
        viewCount: Number(row?.view_count ?? 0),
        uniqueCount: Number(row?.unique_count ?? 0),
        wasUnique: !!row?.was_unique,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[track-token-view] error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
