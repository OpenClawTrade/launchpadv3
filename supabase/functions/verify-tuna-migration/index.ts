import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OLD_MINT = "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump";
const COLLECTION_WALLET = "9ETnxTgU3Zqg3NuuZXyoa5HmtaCkP9PWjKxcCrLoWTXe";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, tx_signature } = await req.json();

    if (!tx_signature || typeof tx_signature !== "string") {
      return new Response(
        JSON.stringify({ error: "Transaction signature is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!wallet_address || typeof wallet_address !== "string") {
      return new Response(
        JSON.stringify({ error: "Wallet address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const heliusKey = Deno.env.get("HELIUS_API_KEY");
    if (!heliusKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch parsed transaction from Helius
    const heliusUrl = `https://api.helius.xyz/v0/transactions/?api-key=${heliusKey}`;
    const heliusRes = await fetch(heliusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: [tx_signature] }),
    });

    if (!heliusRes.ok) {
      const errText = await heliusRes.text();
      console.error("Helius error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch transaction data. Please check the signature." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsedTxs = await heliusRes.json();
    if (!parsedTxs || parsedTxs.length === 0) {
      return new Response(
        JSON.stringify({ error: "Transaction not found. It may not be confirmed yet — please wait and try again." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tx = parsedTxs[0];

    // Look for token transfer of old TUNA to collection wallet
    let senderWallet: string | null = null;
    let amountSent = 0;

    // Check tokenTransfers in Helius parsed format
    const tokenTransfers = tx.tokenTransfers || [];
    for (const transfer of tokenTransfers) {
      if (
        transfer.mint === OLD_MINT &&
        transfer.toUserAccount === COLLECTION_WALLET
      ) {
        senderWallet = transfer.fromUserAccount;
        amountSent += transfer.tokenAmount;
      }
    }

    if (!senderWallet || amountSent <= 0) {
      return new Response(
        JSON.stringify({
          error: "This transaction does not contain a transfer of old $TUNA to the collection wallet.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the sender matches the wallet_address provided
    if (senderWallet !== wallet_address) {
      return new Response(
        JSON.stringify({
          error: `The transaction sender (${senderWallet.slice(0, 4)}...${senderWallet.slice(-4)}) does not match the wallet address you provided.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to update migration snapshot
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if wallet exists in snapshot
    const { data: holder, error: holderErr } = await supabase
      .from("tuna_migration_snapshot")
      .select("id, wallet_address, token_balance, has_migrated")
      .eq("wallet_address", wallet_address)
      .single();

    if (holderErr || !holder) {
      return new Response(
        JSON.stringify({ error: "Your wallet is not in the migration snapshot." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (holder.has_migrated) {
      return new Response(
        JSON.stringify({ error: "This wallet has already been registered for migration." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate TX signature
    const { data: existingTx } = await supabase
      .from("tuna_migration_snapshot")
      .select("id")
      .eq("tx_signature", tx_signature)
      .maybeSingle();

    if (existingTx) {
      return new Response(
        JSON.stringify({ error: "This transaction has already been submitted." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update migration record
    const { error: updateErr } = await supabase
      .from("tuna_migration_snapshot")
      .update({
        has_migrated: true,
        amount_sent: amountSent,
        tx_signature: tx_signature,
        migrated_at: new Date().toISOString(),
      })
      .eq("id", holder.id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to register migration. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        wallet: wallet_address,
        amount_sent: amountSent,
        message: "Migration registered successfully!",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-tuna-migration error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
