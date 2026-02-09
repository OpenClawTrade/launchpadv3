import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet } = await req.json();
    const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY");
    if (!HELIUS_API_KEY) throw new Error("HELIUS_API_KEY not configured");

    // Fetch parsed transaction history from Helius
    const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=20`;
    const response = await fetch(url);
    const transactions = await response.json();

    // Extract swap details
    const swaps = transactions.map((tx: any) => ({
      signature: tx.signature,
      timestamp: tx.timestamp,
      type: tx.type,
      description: tx.description,
      tokenTransfers: tx.tokenTransfers?.map((t: any) => ({
        mint: t.mint,
        amount: t.tokenAmount,
        from: t.fromUserAccount,
        to: t.toUserAccount,
      })),
      nativeTransfers: tx.nativeTransfers?.map((t: any) => ({
        amount: t.amount / 1e9,
        from: t.fromUserAccount,
        to: t.toUserAccount,
      })),
    }));

    return new Response(JSON.stringify({ swaps }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
