import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Minimum SOL to distribute (avoid micro-transactions)
const MIN_CLAIM_SOL = 0.01;

// Hash API key using the same method as api-account
async function hashApiKey(apiKey: string): Promise<string> {
  const encryptionKey = Deno.env.get("API_ENCRYPTION_KEY") || "";
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey + encryptionKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyApiKey(
  supabaseAdmin: any,
  apiKey: string
): Promise<{ valid: boolean; accountId?: string; walletAddress?: string; feeWallet?: string }> {
  const hash = await hashApiKey(apiKey);

  const { data, error } = await supabaseAdmin
    .from("api_accounts")
    .select("id, wallet_address, fee_wallet_address, status")
    .eq("api_key_hash", hash)
    .single();

  if (error || !data) {
    return { valid: false };
  }

  if (data.status !== "active") {
    return { valid: false };
  }

  return { 
    valid: true, 
    accountId: data.id, 
    walletAddress: data.wallet_address,
    feeWallet: data.fee_wallet_address 
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);

    // Handle GET - fetch pending fees
    if (req.method === "GET") {
      const walletAddress = url.searchParams.get("wallet");
      
      if (!walletAddress) {
        return new Response(
          JSON.stringify({ error: "wallet parameter required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get account by wallet
      const { data: account } = await supabaseAdmin
        .from("api_accounts")
        .select("id, total_fees_earned, total_fees_paid_out")
        .eq("wallet_address", walletAddress)
        .single();

      if (!account) {
        return new Response(
          JSON.stringify({ error: "Account not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get pending fee distributions
      const { data: pendingFees } = await supabaseAdmin
        .from("api_fee_distributions")
        .select("id, api_user_share, platform_share, total_fee_sol, created_at, launchpad_id, token_id")
        .eq("api_account_id", account.id)
        .eq("status", "pending");

      const totalPending = (pendingFees || []).reduce((sum, f) => sum + (f.api_user_share || 0), 0);

      return new Response(
        JSON.stringify({
          totalEarned: account.total_fees_earned || 0,
          totalPaidOut: account.total_fees_paid_out || 0,
          pendingAmount: totalPending,
          pendingCount: pendingFees?.length || 0,
          pendingFees: pendingFees || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle POST - claim fees (with on-chain payout)
    if (req.method === "POST") {
      const apiKey = req.headers.get("x-api-key");
      const body = await req.json();
      const { walletAddress } = body;

      // Verify either API key or wallet ownership
      let accountId: string | null = null;
      let feeWallet: string | null = null;

      if (apiKey) {
        const authResult = await verifyApiKey(supabaseAdmin, apiKey);
        if (!authResult.valid) {
          return new Response(
            JSON.stringify({ error: "Invalid API key" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        accountId = authResult.accountId!;
        feeWallet = authResult.feeWallet!;
      } else if (walletAddress) {
        const { data: account } = await supabaseAdmin
          .from("api_accounts")
          .select("id, fee_wallet_address")
          .eq("wallet_address", walletAddress)
          .single();

        if (!account) {
          return new Response(
            JSON.stringify({ error: "Account not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        accountId = account.id;
        feeWallet = account.fee_wallet_address;
      } else {
        return new Response(
          JSON.stringify({ error: "API key or wallet address required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get pending fees
      const { data: pendingFees } = await supabaseAdmin
        .from("api_fee_distributions")
        .select("id, api_user_share")
        .eq("api_account_id", accountId)
        .eq("status", "pending");

      if (!pendingFees || pendingFees.length === 0) {
        return new Response(
          JSON.stringify({ error: "No pending fees to claim" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const totalToClaim = pendingFees.reduce((sum, f) => sum + (f.api_user_share || 0), 0);
      const feeIds = pendingFees.map(f => f.id);

      if (totalToClaim < MIN_CLAIM_SOL) {
        return new Response(
          JSON.stringify({ 
            error: `Minimum claim amount is ${MIN_CLAIM_SOL} SOL. Current pending: ${totalToClaim.toFixed(4)} SOL` 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get treasury keypair for on-chain transfer
      const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
      const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");

      if (!treasuryPrivateKey || !heliusRpcUrl) {
        console.error("[api-claim-fees] Missing TREASURY_PRIVATE_KEY or HELIUS_RPC_URL");
        return new Response(
          JSON.stringify({ error: "Server configuration error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse treasury keypair
      let treasuryKeypair: Keypair;
      try {
        if (treasuryPrivateKey.startsWith("[")) {
          const keyArray = JSON.parse(treasuryPrivateKey);
          treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
        } else {
          const decoded = bs58.decode(treasuryPrivateKey);
          treasuryKeypair = Keypair.fromSecretKey(decoded);
        }
      } catch (e) {
        console.error("[api-claim-fees] Invalid TREASURY_PRIVATE_KEY format");
        return new Response(
          JSON.stringify({ error: "Server configuration error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const connection = new Connection(heliusRpcUrl, "confirmed");

      // Check treasury balance
      const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
      const treasuryBalanceSol = treasuryBalance / 1e9;

      if (treasuryBalanceSol < totalToClaim + 0.001) {
        console.error("[api-claim-fees] Insufficient treasury balance:", treasuryBalanceSol);
        return new Response(
          JSON.stringify({ error: "Treasury balance insufficient. Please try again later." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send SOL to fee wallet
      let txSignature: string;
      try {
        if (!feeWallet) {
          throw new Error("Fee wallet not configured");
        }
        console.log(`[api-claim-fees] Sending ${totalToClaim.toFixed(6)} SOL to ${feeWallet}`);

        const recipientPubkey = new PublicKey(feeWallet);
        const lamports = Math.floor(totalToClaim * 1e9);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: treasuryKeypair.publicKey,
            toPubkey: recipientPubkey,
            lamports,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = treasuryKeypair.publicKey;

        txSignature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], {
          commitment: "confirmed",
          maxRetries: 3,
        });

        console.log(`[api-claim-fees] ✅ Sent ${totalToClaim} SOL to ${feeWallet}, sig: ${txSignature}`);
      } catch (txError: unknown) {
        const errMsg = txError instanceof Error ? txError.message : "Transaction failed";
        console.error("[api-claim-fees] ❌ Transaction error:", errMsg);
        return new Response(
          JSON.stringify({ error: `Transaction failed: ${errMsg}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark fees as distributed
      const { error: updateError } = await supabaseAdmin
        .from("api_fee_distributions")
        .update({
          status: "distributed",
          distributed_at: new Date().toISOString(),
          signature: txSignature,
        })
        .in("id", feeIds);

      if (updateError) {
        console.error("[api-claim-fees] DB update error:", updateError);
        // Transaction succeeded but DB failed - log for manual reconciliation
      }

      // Update account totals
      const { data: currentAccount } = await supabaseAdmin
        .from("api_accounts")
        .select("total_fees_paid_out")
        .eq("id", accountId)
        .single();

      await supabaseAdmin
        .from("api_accounts")
        .update({
          total_fees_paid_out: (currentAccount?.total_fees_paid_out || 0) + totalToClaim,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);

      console.log("[api-claim-fees] ✅ Claimed:", { accountId, totalToClaim, feeIds: feeIds.length, signature: txSignature });

      return new Response(
        JSON.stringify({
          success: true,
          claimedAmount: totalToClaim,
          claimedCount: feeIds.length,
          feeWallet,
          signature: txSignature,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[api-claim-fees] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
