import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CODEX_URL = "https://graph.codex.io/graphql";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("CODEX_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "CODEX_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      tokenAddress,
      networkId = 1399811149,
      cursor = null,
      limit = 50,
    } = body;

    if (!tokenAddress) {
      return new Response(
        JSON.stringify({ error: "tokenAddress required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const graphqlQuery = `{
      getTokenEvents(
        query: {
          address: "${tokenAddress}"
          networkId: ${networkId}
        }
        ${cursor ? `cursor: "${cursor}"` : ""}
        limit: ${Math.min(limit, 100)}
      ) {
        cursor
        items {
          timestamp
          eventType
          eventDisplayType
          maker
          data {
            ... on SwapEventData {
              amount0
              amount1
              priceUsd
              priceUsdTotal
              type
            }
          }
          transaction {
            hash
          }
        }
      }
    }`;

    const codexRes = await fetch(CODEX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ query: graphqlQuery }),
    });

    if (!codexRes.ok) {
      const errText = await codexRes.text();
      console.error("Codex API error:", codexRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Codex API error", status: codexRes.status, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await codexRes.json();

    if (data.errors) {
      console.error("Codex GraphQL errors:", JSON.stringify(data.errors));
      return new Response(
        JSON.stringify({ error: "Codex GraphQL error", details: data.errors }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const raw = data.data?.getTokenEvents;
    const result = raw ? { cursor: raw.cursor, events: raw.items } : null;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
