import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY");
    if (!HELIUS_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing HELIUS_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { wallets } = await req.json();
    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      return new Response(JSON.stringify({ error: "wallets array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap at 100 wallets per request
    const addressList = wallets.slice(0, 100);

    // Batch using getMultipleAccounts (max 100 per call)
    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "sol-balances",
          method: "getMultipleAccounts",
          params: [
            addressList,
            { encoding: "jsonParsed" },
          ],
        }),
      }
    );

    const data = await response.json();
    const accounts = data.result?.value || [];

    const balances: Record<string, number> = {};
    for (let i = 0; i < addressList.length; i++) {
      const account = accounts[i];
      balances[addressList[i]] = account
        ? (account.lamports || 0) / 1e9
        : 0;
    }

    return new Response(JSON.stringify({ balances }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Balance fetch error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
