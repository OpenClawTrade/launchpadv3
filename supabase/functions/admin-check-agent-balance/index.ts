import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUNDING_THRESHOLD = 0.5; // SOL needed to activate

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agentId } = await req.json();

    if (!agentId) {
      return new Response(JSON.stringify({ error: "agentId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL");
    if (!heliusRpcUrl) {
      throw new Error("HELIUS_RPC_URL not configured");
    }

    // Get agent
    const { data: agent, error: fetchError } = await supabase
      .from("trading_agents")
      .select("id, name, wallet_address, trading_capital_sol, status")
      .eq("id", agentId)
      .single();

    if (fetchError || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check on-chain balance
    const connection = new Connection(heliusRpcUrl, "confirmed");
    const walletPubkey = new PublicKey(agent.wallet_address);
    const balanceLamports = await connection.getBalance(walletPubkey);
    const balanceSol = balanceLamports / LAMPORTS_PER_SOL;

    console.log(`[admin-check-agent-balance] ${agent.name} wallet ${agent.wallet_address}: ${balanceSol.toFixed(6)} SOL`);

    // Determine new status
    const previousCapital = agent.trading_capital_sol || 0;
    const previousStatus = agent.status;
    const newStatus = balanceSol >= FUNDING_THRESHOLD ? "active" : "pending";

    // Update agent with current balance and status
    const { error: updateError } = await supabase
      .from("trading_agents")
      .update({
        trading_capital_sol: balanceSol,
        status: newStatus,
      })
      .eq("id", agentId);

    if (updateError) {
      throw updateError;
    }

    const activated = previousStatus === "pending" && newStatus === "active";

    return new Response(JSON.stringify({
      success: true,
      agentId: agent.id,
      agentName: agent.name,
      walletAddress: agent.wallet_address,
      previousCapital,
      currentBalance: balanceSol,
      previousStatus,
      newStatus,
      activated,
      message: activated 
        ? `🚀 Agent activated! Trading will begin on next execution cycle.`
        : newStatus === "active" 
          ? `Agent is active with ${balanceSol.toFixed(4)} SOL`
          : `Agent needs ${(FUNDING_THRESHOLD - balanceSol).toFixed(4)} more SOL to activate`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[admin-check-agent-balance] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
