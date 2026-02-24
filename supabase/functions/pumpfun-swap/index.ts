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
    const { publicKey, action, mint, amount, denominatedInSol, slippage, priorityFee } = await req.json();

    if (!publicKey || !action || !mint || amount === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[pumpfun-swap] Building tx:", { publicKey, action, mint, amount, slippage });

    const response = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey,
        action, // "buy" or "sell"
        mint,
        amount,
        denominatedInSol: denominatedInSol ?? "true",
        slippage: slippage ?? 10,
        priorityFee: priorityFee ?? 0.0005,
        pool: "pump",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[pumpfun-swap] PumpPortal error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `PumpPortal API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PumpPortal returns raw transaction bytes
    const txBytes = new Uint8Array(await response.arrayBuffer());

    // Convert to base64 for transport
    const base64Tx = btoa(String.fromCharCode(...txBytes));

    return new Response(
      JSON.stringify({ transaction: base64Tx }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[pumpfun-swap] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
