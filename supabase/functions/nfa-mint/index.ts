import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TREASURY_WALLET = "HSVmkUnmkjD9YLJmgeHCRyL1isusKkU3xv4VwDaZJqRx";
const MINT_PRICE_SOL = 1.0;
const LAMPORTS_PER_SOL = 1_000_000_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { minterWallet, paymentSignature } = await req.json();

    if (!minterWallet || !paymentSignature) {
      return new Response(
        JSON.stringify({ error: "minterWallet and paymentSignature required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify payment on-chain via Helius RPC
    const heliusApiKey = Deno.env.get("HELIUS_API_KEY");
    const rpcUrl = Deno.env.get("HELIUS_RPC_URL") || 
      (heliusApiKey ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}` : "https://api.mainnet-beta.solana.com");

    const txResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [paymentSignature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
      }),
    });

    const txData = await txResponse.json();
    const tx = txData?.result;

    if (!tx) {
      return new Response(
        JSON.stringify({ error: "Transaction not found. Please wait for confirmation and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tx.meta?.err) {
      return new Response(
        JSON.stringify({ error: "Transaction failed on-chain" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify SOL transfer to treasury
    const instructions = tx.transaction?.message?.instructions || [];
    let transferVerified = false;

    for (const ix of instructions) {
      if (ix.parsed?.type === "transfer" && ix.program === "system") {
        const info = ix.parsed.info;
        if (
          info.destination === TREASURY_WALLET &&
          info.source === minterWallet &&
          Number(info.lamports) >= MINT_PRICE_SOL * LAMPORTS_PER_SOL * 0.99 // 1% tolerance for fees
        ) {
          transferVerified = true;
          break;
        }
      }
    }

    if (!transferVerified) {
      return new Response(
        JSON.stringify({ error: `Payment of ${MINT_PRICE_SOL} SOL to treasury not found in transaction` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicate signature
    const { data: existingMint } = await supabase
      .from("nfa_mints")
      .select("id")
      .eq("payment_signature", paymentSignature)
      .maybeSingle();

    if (existingMint) {
      return new Response(
        JSON.stringify({ error: "This transaction has already been used for an NFA mint" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current open batch
    const { data: batch, error: batchError } = await supabase
      .from("nfa_batches")
      .select("*")
      .eq("status", "open")
      .order("batch_number", { ascending: true })
      .limit(1)
      .single();

    if (batchError || !batch) {
      return new Response(
        JSON.stringify({ error: "No open NFA batch available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newSlotNumber = batch.minted_count + 1;

    // Insert mint record
    const { data: mint, error: mintError } = await supabase
      .from("nfa_mints")
      .insert({
        batch_id: batch.id,
        slot_number: newSlotNumber,
        minter_wallet: minterWallet,
        payment_signature: paymentSignature,
        payment_verified: true,
        status: "paid",
      })
      .select()
      .single();

    if (mintError) {
      console.error("Mint insert error:", mintError);
      return new Response(
        JSON.stringify({ error: "Failed to record mint: " + mintError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment batch counter
    const newCount = newSlotNumber;
    const batchUpdate: Record<string, unknown> = { minted_count: newCount };

    // If batch is full, mark for generation
    if (newCount >= batch.total_slots) {
      batchUpdate.status = "generating";
      batchUpdate.generation_started_at = new Date().toISOString();
    }

    await supabase
      .from("nfa_batches")
      .update(batchUpdate)
      .eq("id", batch.id);

    return new Response(
      JSON.stringify({
        success: true,
        mint: {
          id: mint.id,
          slotNumber: newSlotNumber,
          batchNumber: batch.batch_number,
          totalSlots: batch.total_slots,
          mintedCount: newCount,
          status: newCount >= batch.total_slots ? "batch_full" : "minted",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("NFA mint error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
