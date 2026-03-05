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

    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

    // 1. Fetch all token accounts (paginated)
    const holderMap = new Map<string, number>(); // owner -> raw amount
    let cursor: string | undefined;
    let page = 0;
    const MAX_PAGES = 50;

    while (page < MAX_PAGES) {
      page++;
      const params: any = { mint: mintAddress, limit: 1000 };
      if (cursor) params.cursor = cursor;

      const resp = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `holders-${page}`,
          method: "getTokenAccounts",
          params,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Helius API error (${resp.status}): ${errText}`);
      }

      const data = await resp.json();
      if (data.error) throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`);

      const accounts = data.result?.token_accounts || [];
      for (const acct of accounts) {
        if (acct.owner && acct.amount && Number(acct.amount) > 0) {
          const prev = holderMap.get(acct.owner) || 0;
          holderMap.set(acct.owner, prev + Number(acct.amount));
        }
      }

      cursor = data.result?.cursor;
      if (!cursor || accounts.length === 0) break;
    }

    // 2. Get token supply + decimals
    const supplyResp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "supply",
        method: "getTokenSupply",
        params: [mintAddress],
      }),
    });
    const supplyData = await supplyResp.json();
    await supplyResp.text().catch(() => {}); // consume
    const totalSupplyRaw = Number(supplyData.result?.value?.amount || "0");
    const decimals = supplyData.result?.value?.decimals || 9;
    const divisor = Math.pow(10, decimals);

    // 3. Sort holders by amount desc, take top 100
    const sorted = [...holderMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);

    // 4. Batch fetch SOL balances for top holders
    const addresses = sorted.map(([addr]) => addr);
    const solBalances = new Map<string, number>();

    for (let i = 0; i < addresses.length; i += 100) {
      const batch = addresses.slice(i, i + 100);
      const balResp = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "balances",
          method: "getMultipleAccounts",
          params: [batch, { encoding: "jsonParsed" }],
        }),
      });
      const balData = await balResp.json();
      const accts = balData.result?.value || [];
      accts.forEach((acct: any, idx: number) => {
        if (acct) {
          solBalances.set(batch[idx], (acct.lamports || 0) / 1e9);
        }
      });
    }

    // 5. Build enriched holder list
    const holders = sorted.map(([address, rawAmount]) => ({
      address,
      tokenAmount: rawAmount / divisor,
      percentage: totalSupplyRaw > 0 ? (rawAmount / totalSupplyRaw) * 100 : 0,
      solBalance: solBalances.get(address) || 0,
    }));

    return new Response(
      JSON.stringify({
        holders,
        count: holderMap.size,
        totalSupply: totalSupplyRaw / divisor,
        decimals,
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
