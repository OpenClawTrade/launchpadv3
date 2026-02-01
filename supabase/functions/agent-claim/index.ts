import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_CLAIM_SOL = 0.05; // Minimum SOL to claim

// Hash API key using HMAC-SHA256
async function hashApiKey(apiKey: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(apiKey);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || !apiKey.startsWith("tna_live_")) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid API key required in x-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { tokenId } = body; // Optional: claim from specific token

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiEncryptionKey = Deno.env.get("API_ENCRYPTION_KEY");
    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");

    if (!apiEncryptionKey || !treasuryPrivateKey || !heliusRpcUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify API key and get agent
    const apiKeyHash = await hashApiKey(apiKey, apiEncryptionKey);

    const { data: agent } = await supabase
      .from("agents")
      .select("*")
      .eq("api_key_hash", apiKeyHash)
      .eq("status", "active")
      .maybeSingle();

    if (!agent) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or inactive API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get pending fee distributions for this agent
    let query = supabase
      .from("agent_fee_distributions")
      .select("*")
      .eq("agent_id", agent.id)
      .eq("status", "pending");

    if (tokenId) {
      query = query.eq("fun_token_id", tokenId);
    }

    const { data: pendingFees, error: feesError } = await query;

    if (feesError) {
      throw new Error(`Failed to fetch pending fees: ${feesError.message}`);
    }

    if (!pendingFees || pendingFees.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          claimedAmount: 0,
          message: "No pending fees to claim",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate total claimable amount
    const totalClaimable = pendingFees.reduce((sum, f) => sum + Number(f.amount_sol || 0), 0);

    if (totalClaimable < MIN_CLAIM_SOL) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Minimum claim amount is ${MIN_CLAIM_SOL} SOL. Current balance: ${totalClaimable.toFixed(6)} SOL`,
          pendingAmount: totalClaimable,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agent-claim] Agent ${agent.name} claiming ${totalClaimable.toFixed(6)} SOL`);

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
      throw new Error("Invalid treasury configuration");
    }

    const connection = new Connection(heliusRpcUrl, "confirmed");

    // Check treasury balance
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const treasuryBalanceSol = treasuryBalance / 1e9;

    if (treasuryBalanceSol < totalClaimable + 0.01) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Insufficient treasury balance. Please try again later.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SOL to agent wallet
    const recipientPubkey = new PublicKey(agent.wallet_address);
    const lamports = Math.floor(totalClaimable * 1e9);

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

    const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], {
      commitment: "confirmed",
      maxRetries: 3,
    });

    console.log(`[agent-claim] ✅ Sent ${totalClaimable} SOL to ${agent.wallet_address}, sig: ${signature}`);

    // Update fee distributions as completed
    const feeIds = pendingFees.map(f => f.id);
    await supabase
      .from("agent_fee_distributions")
      .update({
        status: "completed",
        signature,
        completed_at: new Date().toISOString(),
      })
      .in("id", feeIds);

    // Update agent's claimed total
    await supabase
      .from("agents")
      .update({
        total_fees_claimed_sol: (agent.total_fees_claimed_sol || 0) + totalClaimable,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agent.id);

    return new Response(
      JSON.stringify({
        success: true,
        claimedAmount: totalClaimable,
        signature,
        solscanUrl: `https://solscan.io/tx/${signature}`,
        newPendingBalance: 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("agent-claim error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
