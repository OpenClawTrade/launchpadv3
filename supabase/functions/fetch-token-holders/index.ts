import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mintAddress } = await req.json();
    if (!mintAddress || typeof mintAddress !== "string") {
      return new Response(JSON.stringify({ error: "mintAddress required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("HELIUS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "HELIUS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    const allOwners: string[] = [];
    let cursor: string | undefined;
    let page = 0;
    const MAX_PAGES = 100; // safety limit

    while (page < MAX_PAGES) {
      page++;
      const body: any = {
        jsonrpc: "2.0",
        id: `holders-${page}`,
        method: "getTokenAccounts",
        params: {
          mint: mintAddress,
          limit: 1000,
        },
      };
      if (cursor) {
        body.params.cursor = cursor;
      }

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Helius API error (${resp.status}): ${errText}`);
      }

      const data = await resp.json();
      
      if (data.error) {
        throw new Error(`Helius RPC error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      const accounts = data.result?.token_accounts || [];
      
      for (const acct of accounts) {
        if (acct.owner && acct.amount && Number(acct.amount) > 0) {
          allOwners.push(acct.owner);
        }
      }

      cursor = data.result?.cursor;
      if (!cursor || accounts.length === 0) break;
    }

    // Deduplicate owners
    const uniqueOwners = [...new Set(allOwners)];

    return new Response(
      JSON.stringify({
        holders: uniqueOwners,
        count: uniqueOwners.length,
        pages: page,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
