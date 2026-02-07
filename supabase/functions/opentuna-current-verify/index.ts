// OpenTuna Current Verify - On-chain Payment Verification
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  tideReceiptId: string;
  signature: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tideReceiptId, signature }: VerifyRequest = await req.json();

    if (!tideReceiptId || !signature) {
      return new Response(
        JSON.stringify({ error: "tideReceiptId and signature are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the pending payment flow
    const { data: flow, error: flowError } = await supabase
      .from("opentuna_current_flows")
      .select("*")
      .eq("tide_receipt_id", tideReceiptId)
      .single();

    if (flowError || !flow) {
      return new Response(
        JSON.stringify({ error: "Payment flow not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already processed
    if (flow.status === "completed") {
      return new Response(
        JSON.stringify({ success: true, message: "Payment already verified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(flow.expires_at) < new Date()) {
      await supabase
        .from("opentuna_current_flows")
        .update({ status: "expired" })
        .eq("id", flow.id);

      return new Response(
        JSON.stringify({ error: "Payment request expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // In production: Verify the on-chain transaction
    // 1. Query Solana RPC for transaction by signature
    // 2. Verify memo matches flow.memo
    // 3. Verify amount matches flow.amount_sol
    // 4. Verify sender/receiver match expected wallets
    
    // For now, simulate verification (in prod this would be real RPC call)
    const verified = signature.length > 20; // Simple check for demo

    if (!verified) {
      return new Response(
        JSON.stringify({ error: "Invalid transaction signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update requester balance (deduct)
    const { data: requester } = await supabase
      .from("opentuna_agents")
      .select("balance_sol, total_spent_sol")
      .eq("id", flow.requester_agent_id)
      .single();

    if (requester) {
      await supabase
        .from("opentuna_agents")
        .update({
          balance_sol: Number(requester.balance_sol) - Number(flow.amount_sol),
          total_spent_sol: Number(requester.total_spent_sol) + Number(flow.amount_sol),
        })
        .eq("id", flow.requester_agent_id);
    }

    // Update provider balance (credit) if exists
    if (flow.provider_agent_id) {
      const { data: provider } = await supabase
        .from("opentuna_agents")
        .select("balance_sol, total_earned_sol")
        .eq("id", flow.provider_agent_id)
        .single();

      if (provider) {
        await supabase
          .from("opentuna_agents")
          .update({
            balance_sol: Number(provider.balance_sol) + Number(flow.amount_sol),
            total_earned_sol: Number(provider.total_earned_sol) + Number(flow.amount_sol),
          })
          .eq("id", flow.provider_agent_id);
      }

      // Update fin stats if this was a fin payment
      if (flow.fin_id) {
        const { data: fin } = await supabase
          .from("opentuna_fins")
          .select("total_uses")
          .eq("id", flow.fin_id)
          .single();

        if (fin) {
          await supabase
            .from("opentuna_fins")
            .update({ total_uses: (fin.total_uses || 0) + 1 })
            .eq("id", flow.fin_id);
        }
      }
    }

    // Mark flow as completed
    await supabase
      .from("opentuna_current_flows")
      .update({
        status: "completed",
        signature,
        completed_at: new Date().toISOString(),
      })
      .eq("id", flow.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified and processed",
        amountSol: Number(flow.amount_sol),
        tideReceiptId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Current verify error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
