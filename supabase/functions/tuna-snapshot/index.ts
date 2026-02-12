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

    const OLD_MINT = "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump";
    const COLLECTION_WALLET = "9ETnxTgU3Zqg3NuuZXyoa5HmtaCkP9PWjKxcCrLoWTXe";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if snapshot already exists
    const { count } = await supabase
      .from("tuna_migration_snapshot")
      .select("*", { count: "exact", head: true });

    if (count && count > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Snapshot already exists",
          holders: count,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch all token accounts using Helius DAS API
    const allHolders: { owner: string; balance: number }[] = [];
    let page = 1;
    const limit = 1000;

    while (true) {
      const response = await fetch(
        `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "tuna-snapshot",
            method: "getTokenAccounts",
            params: {
              mint: OLD_MINT,
              page: page,
              limit: limit,
              displayOptions: {
                showZeroBalance: false,
              },
            },
          }),
        }
      );

      const data = await response.json();

      if (!data.result || !data.result.token_accounts || data.result.token_accounts.length === 0) {
        break;
      }

      for (const account of data.result.token_accounts) {
        const balance = Number(account.amount) / 1e6; // assuming 6 decimals for SPL
        if (balance > 0) {
          allHolders.push({
            owner: account.owner,
            balance: balance,
          });
        }
      }

      if (data.result.token_accounts.length < limit) {
        break;
      }
      page++;
    }

    if (allHolders.length === 0) {
      return new Response(
        JSON.stringify({ error: "No holders found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculate total supply from holder balances
    const totalSupply = allHolders.reduce((sum, h) => sum + h.balance, 0);

    // Deduplicate by owner (in case of multiple token accounts)
    const ownerMap = new Map<string, number>();
    for (const h of allHolders) {
      ownerMap.set(h.owner, (ownerMap.get(h.owner) || 0) + h.balance);
    }

    // Insert holders in batches
    const holders = Array.from(ownerMap.entries()).map(([wallet, balance]) => ({
      wallet_address: wallet,
      token_balance: balance,
      supply_percentage: totalSupply > 0 ? (balance / totalSupply) * 100 : 0,
    }));

    const BATCH_SIZE = 500;
    for (let i = 0; i < holders.length; i += BATCH_SIZE) {
      const batch = holders.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("tuna_migration_snapshot")
        .insert(batch);

      if (error) {
        console.error("Insert error:", error);
        return new Response(
          JSON.stringify({ error: `Failed to insert batch ${i}: ${error.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create/update migration config with 48h deadline
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error: configError } = await supabase
      .from("tuna_migration_config")
      .insert({
        deadline_at: deadline,
        old_mint_address: OLD_MINT,
        collection_wallet: COLLECTION_WALLET,
        total_supply_snapshot: totalSupply,
      });

    if (configError) {
      console.error("Config insert error:", configError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        holders: holders.length,
        total_supply: totalSupply,
        deadline: deadline,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Snapshot error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
