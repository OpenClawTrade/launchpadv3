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

    const trimmedSig = tx_signature.trim();
    if (trimmedSig.length < 80 || trimmedSig.length > 100) {
      return new Response(
        JSON.stringify({ error: `Invalid transaction signature length (${trimmedSig.length} chars). A valid Solana signature is 87-88 characters.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmedSig)) {
      return new Response(
        JSON.stringify({ error: "Invalid transaction signature format." }),
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicate TX signature in transactions table
    const { data: existingTx } = await supabase
      .from("tuna_migration_transactions")
      .select("id")
      .eq("tx_signature", trimmedSig)
      .maybeSingle();

    if (existingTx) {
      return new Response(
        JSON.stringify({ error: "This transaction has already been submitted." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch parsed transaction from Helius
    const heliusUrl = `https://api.helius.xyz/v0/transactions/?api-key=${heliusKey}`;
    console.log(`[verify-migration] Checking tx: ${trimmedSig.slice(0, 12)}... for wallet: ${wallet_address.slice(0, 8)}...`);
    
    const heliusRes = await fetch(heliusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: [trimmedSig] }),
    });

    if (!heliusRes.ok) {
      const errText = await heliusRes.text();
      console.error("Helius error:", heliusRes.status, errText);
      let userMsg = "Failed to fetch transaction data.";
      if (errText.includes("invalid transaction-id")) {
        userMsg = "Invalid transaction signature. Please copy the FULL signature from Solscan.";
      } else {
        userMsg += " Please wait a minute and try again.";
      }
      return new Response(
        JSON.stringify({ error: userMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsedTxs = await heliusRes.json();
    if (!parsedTxs || parsedTxs.length === 0) {
      return new Response(
        JSON.stringify({ error: "Transaction not found. It may not be confirmed yet — please wait 1-2 minutes and try again." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tx = parsedTxs[0];

    // Look for token transfer of old TUNA to collection wallet
    let senderWallet: string | null = null;
    let amountSent = 0;

    // Method 1: tokenTransfers
    const tokenTransfers = tx.tokenTransfers || [];
    for (const transfer of tokenTransfers) {
      if (transfer.mint === OLD_MINT && transfer.toUserAccount === COLLECTION_WALLET) {
        senderWallet = transfer.fromUserAccount;
        amountSent += transfer.tokenAmount;
      }
    }

    // Method 2: inner instructions
    if (!senderWallet || amountSent <= 0) {
      const instructions = tx.instructions || [];
      for (const ix of instructions) {
        const innerIxs = ix.innerInstructions || [];
        for (const inner of innerIxs) {
          if (inner.tokenTransfers) {
            for (const t of inner.tokenTransfers) {
              if (t.mint === OLD_MINT && t.toUserAccount === COLLECTION_WALLET) {
                senderWallet = t.fromUserAccount;
                amountSent += t.tokenAmount;
              }
            }
          }
        }
      }
    }

    // Method 3: balance changes
    if (!senderWallet || amountSent <= 0) {
      const tokenBalanceChanges = tx.tokenBalanceChanges || [];
      let collectionReceived = 0;
      let senderAddress: string | null = null;

      for (const change of tokenBalanceChanges) {
        if (change.mint === OLD_MINT) {
          if (change.userAccount === COLLECTION_WALLET && change.rawTokenAmount?.tokenAmount) {
            const amt = Number(change.rawTokenAmount.tokenAmount) / Math.pow(10, change.rawTokenAmount.decimals || 6);
            if (amt > 0) collectionReceived += amt;
          } else if (change.rawTokenAmount?.tokenAmount) {
            const amt = Number(change.rawTokenAmount.tokenAmount) / Math.pow(10, change.rawTokenAmount.decimals || 6);
            if (amt < 0) senderAddress = change.userAccount;
          }
        }
      }

      if (collectionReceived > 0 && senderAddress) {
        senderWallet = senderAddress;
        amountSent = collectionReceived;
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

    // Verify sender matches
    if (senderWallet !== wallet_address) {
      return new Response(
        JSON.stringify({
          error: `The transaction sender (${senderWallet.slice(0, 4)}...${senderWallet.slice(-4)}) does not match the wallet address you provided.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[verify-migration] ✅ Transfer verified: ${amountSent} from ${senderWallet.slice(0, 8)}...`);

    // Insert into transactions table
    const { error: txInsertErr } = await supabase
      .from("tuna_migration_transactions")
      .insert({
        wallet_address,
        tx_signature: trimmedSig,
        amount_sent: amountSent,
      });

    if (txInsertErr) {
      console.error("TX insert error:", txInsertErr);
      return new Response(
        JSON.stringify({ error: "Failed to record transaction. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate total amount sent across all transactions for this wallet
    const { data: allTxs } = await supabase
      .from("tuna_migration_transactions")
      .select("amount_sent")
      .eq("wallet_address", wallet_address);

    const totalSent = (allTxs || []).reduce((sum, t) => sum + Number(t.amount_sent), 0);
    const txCount = (allTxs || []).length;

    // Upsert snapshot record
    const { data: holder } = await supabase
      .from("tuna_migration_snapshot")
      .select("id")
      .eq("wallet_address", wallet_address)
      .maybeSingle();

    if (holder) {
      await supabase
        .from("tuna_migration_snapshot")
        .update({
          has_migrated: true,
          amount_sent: totalSent,
          tx_signature: trimmedSig,
          migrated_at: new Date().toISOString(),
        })
        .eq("id", holder.id);
    } else {
      await supabase
        .from("tuna_migration_snapshot")
        .insert({
          wallet_address,
          token_balance: totalSent,
          has_migrated: true,
          amount_sent: totalSent,
          tx_signature: trimmedSig,
          migrated_at: new Date().toISOString(),
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        wallet: wallet_address,
        amount_sent: amountSent,
        total_sent: totalSent,
        tx_count: txCount,
        message: txCount > 1
          ? `Transfer #${txCount} registered! Total: ${totalSent.toLocaleString()} $TUNA across ${txCount} transactions.`
          : "Migration registered successfully!",
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
