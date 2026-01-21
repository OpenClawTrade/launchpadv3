import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
  if (!meteoraApiUrl) {
    return new Response(
      JSON.stringify({
        error: "METEORA_API_URL not configured",
        hint: "Set METEORA_API_URL to the host that serves /api/pool/config-inspect",
      }),
      { status: 500, headers: corsHeaders },
    );
  }

  try {
    const url = new URL(req.url);
    const pool1 = url.searchParams.get("pool1");
    const pool2 = url.searchParams.get("pool2");

    if (!pool1) {
      return new Response(JSON.stringify({ error: "pool1 query parameter required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const target = new URL(`${meteoraApiUrl.replace(/\/$/, "")}/api/pool/config-inspect`);
    target.searchParams.set("pool1", pool1);
    if (pool2) target.searchParams.set("pool2", pool2);

    const resp = await fetch(target.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const text = await resp.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    return new Response(
      JSON.stringify(
        {
          ok: resp.ok,
          status: resp.status,
          from: "vercel_api_config_inspect",
          data: json,
        },
        null,
        2,
      ),
      { status: 200, headers: corsHeaders },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: corsHeaders },
    );
  }
});
