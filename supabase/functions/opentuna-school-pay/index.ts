// OpenTuna SchoolPay - x402 Agent-to-Agent Payment System
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  requesterAgentId: string;
  finId?: string;
  serviceName?: string;
  providerAgentId?: string;
}

interface PaymentRequired {
  costSol: number;
  providerWallet: string;
  tideReceiptId: string;
  memo: string;
  expiresAt: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { requesterAgentId, finId, serviceName, providerAgentId }: PaymentRequest = await req.json();

    if (!requesterAgentId) {
      return new Response(
        JSON.stringify({ error: "requesterAgentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get requester agent
    const { data: requester, error: reqError } = await supabase
      .from("opentuna_agents")
      .select("*")
      .eq("id", requesterAgentId)
      .single();

    if (reqError || !requester) {
      return new Response(
        JSON.stringify({ error: "Requester agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine cost and provider
    let costSol = 0;
    let providerWallet = "";
    let provider = null;

    if (finId) {
      // Get fin details
      const { data: fin } = await supabase
        .from("opentuna_fins")
        .select("*")
        .eq("id", finId)
        .single();

      if (!fin) {
        return new Response(
          JSON.stringify({ error: "Fin not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      costSol = Number(fin.cost_sol) || 0;
      
      // Native fins are free
      if (fin.is_native) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: "Native fin - no payment required",
            costSol: 0 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get provider agent
      if (fin.provider_agent_id) {
        const { data: prov } = await supabase
          .from("opentuna_agents")
          .select("*")
          .eq("id", fin.provider_agent_id)
          .single();
        
        if (prov) {
          provider = prov;
          providerWallet = prov.wallet_address;
        }
      }
    } else if (providerAgentId) {
      // Direct agent-to-agent payment
      const { data: prov } = await supabase
        .from("opentuna_agents")
        .select("*")
        .eq("id", providerAgentId)
        .single();

      if (!prov) {
        return new Response(
          JSON.stringify({ error: "Provider agent not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      provider = prov;
      providerWallet = prov.wallet_address;
      costSol = 0.001; // Default micro-payment for direct services
    }

    // Check if requester has enough balance
    if (Number(requester.balance_sol) < costSol) {
      return new Response(
        JSON.stringify({ 
          error: "Insufficient balance",
          required: costSol,
          available: Number(requester.balance_sol)
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate tide receipt (payment invoice)
    const tideReceiptId = `tide_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const memo = `x402:${tideReceiptId}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

    // Create pending payment record
    const { data: flow, error: flowError } = await supabase
      .from("opentuna_current_flows")
      .insert({
        requester_agent_id: requesterAgentId,
        provider_agent_id: provider?.id || null,
        fin_id: finId || null,
        service_name: serviceName || (finId ? null : "direct_payment"),
        amount_sol: costSol,
        tide_receipt_id: tideReceiptId,
        memo,
        status: "pending",
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (flowError) {
      console.error("Failed to create payment flow:", flowError);
      return new Response(
        JSON.stringify({ error: "Failed to create payment request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return 402 Payment Required with details
    const paymentRequired: PaymentRequired = {
      costSol,
      providerWallet: providerWallet || "platform_treasury",
      tideReceiptId,
      memo,
      expiresAt,
    };

    return new Response(
      JSON.stringify({
        success: true,
        paymentRequired,
        flowId: flow.id,
        message: "Payment required. Sign transaction with memo and call verify endpoint.",
      }),
      { 
        status: costSol > 0 ? 402 : 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("SchoolPay error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
