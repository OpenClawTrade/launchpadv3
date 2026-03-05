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
    const { walletAddress } = await req.json();
    if (!walletAddress || typeof walletAddress !== "string") {
      return new Response(JSON.stringify({ error: "walletAddress required" }), {
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

    // Use Helius enhanced transactions API to find funding source
    const url = `https://api.helius.dev/v0/addresses/${walletAddress}/transactions?api-key=${apiKey}&limit=100`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Helius API error (${resp.status}): ${errText}`);
    }

    const transactions = await resp.json();

    // Transactions are returned newest-first; reverse to find oldest
    const reversed = [...transactions].reverse();

    let fundingSource: string | null = null;
    let fundingAmount = 0;
    let fundingTimestamp: number | null = null;

    for (const tx of reversed) {
      if (tx.nativeTransfers && Array.isArray(tx.nativeTransfers)) {
        for (const transfer of tx.nativeTransfers) {
          if (
            transfer.toUserAccount === walletAddress &&
            transfer.fromUserAccount !== walletAddress &&
            transfer.amount > 0
          ) {
            fundingSource = transfer.fromUserAccount;
            fundingAmount = transfer.amount / 1e9; // lamports to SOL
            fundingTimestamp = tx.timestamp ? tx.timestamp * 1000 : null;
            break;
          }
        }
        if (fundingSource) break;
      }
    }

    // Calculate age string
    let age: string | null = null;
    if (fundingTimestamp) {
      const diffMs = Date.now() - fundingTimestamp;
      const diffMin = Math.floor(diffMs / 60000);
      const diffH = Math.floor(diffMin / 60);
      const diffD = Math.floor(diffH / 24);
      const diffMo = Math.floor(diffD / 30);
      const diffY = Math.floor(diffD / 365);

      if (diffY > 0) age = `${diffY}y`;
      else if (diffMo > 0) age = `${diffMo}mo`;
      else if (diffD > 0) age = `${diffD}d`;
      else if (diffH > 0) age = `${diffH}h`;
      else age = `${diffMin}m`;
    }

    return new Response(
      JSON.stringify({
        fundingSource,
        fundingAmount,
        fundingTimestamp,
        age,
        totalTxChecked: transactions.length,
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
