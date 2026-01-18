import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
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

    // Handle POST - claim fees
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

      // For now, mark as distributed (actual on-chain transfer would happen here)
      // In production, this would trigger a SOL transfer from treasury to feeWallet
      const { error: updateError } = await supabaseAdmin
        .from("api_fee_distributions")
        .update({
          status: "distributed",
          distributed_at: new Date().toISOString(),
          signature: `claim_${Date.now()}`, // Would be actual tx signature
        })
        .in("id", feeIds);

      if (updateError) {
        throw updateError;
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

      console.log("[api-claim-fees] Claimed:", { accountId, totalToClaim, feeIds: feeIds.length });

      return new Response(
        JSON.stringify({
          success: true,
          claimedAmount: totalToClaim,
          claimedCount: feeIds.length,
          feeWallet,
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
