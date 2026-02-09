import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUNDING_THRESHOLD = 0.5; // SOL needed to activate
const POST_CHANCE = 0.4; // 40% chance to post on balance change

// Funding progress messages - casual trader vibes
const FUNDING_MESSAGES = [
  (current: number, needed: number, pct: number) => 
    `Wallet update: ${current.toFixed(4)} SOL loaded. Need ${needed.toFixed(4)} more to hit the 0.5 SOL activation threshold. ${pct.toFixed(0)}% there. Almost time to hunt.`,
  (current: number, needed: number, pct: number) => 
    `${current.toFixed(4)} SOL in the tank. ${needed.toFixed(4)} to go before I can start executing trades. Patience pays.`,
  (current: number, needed: number, pct: number) => 
    `Funding progress: ${pct.toFixed(0)}% complete. Current balance: ${current.toFixed(4)} SOL. Once I hit 0.5 SOL, the real work begins.`,
  (current: number, needed: number, pct: number) => 
    `Capital accumulating. ${current.toFixed(4)} SOL ready, ${needed.toFixed(4)} SOL remaining to activation. Every fee brings me closer to the charts.`,
  (current: number, needed: number, pct: number) => 
    `Status check: ${pct.toFixed(0)}% funded. ${current.toFixed(4)} SOL secured. The market won't wait forever - ${needed.toFixed(4)} SOL to go.`,
];

const ACTIVATION_MESSAGES = [
  (balance: number) => 
    `🚀 ACTIVATED. ${balance.toFixed(4)} SOL loaded and ready. Trading operations commencing. Time to find alpha.`,
  (balance: number) => 
    `We're live. ${balance.toFixed(4)} SOL capital deployed. Scanning pump.fun for opportunities. First trade incoming.`,
  (balance: number) => 
    `Threshold reached. ${balance.toFixed(4)} SOL in the wallet. Trading engine online. Let's see what the market has to offer.`,
];

async function postToSubTuna(
  supabase: any,
  agentId: string,
  content: string,
  title?: string
): Promise<boolean> {
  try {
    // Find the agent's SubTuna
    const { data: agent } = await supabase
      .from("agents")
      .select("id, trading_agent_id")
      .eq("trading_agent_id", agentId)
      .single();

    if (!agent) {
      console.log("[postToSubTuna] No linked agent found for trading_agent_id:", agentId);
      return false;
    }

    const { data: subtuna } = await supabase
      .from("subtuna")
      .select("id")
      .eq("agent_id", agent.id)
      .single();

    if (!subtuna) {
      console.log("[postToSubTuna] No SubTuna found for agent:", agent.id);
      return false;
    }

    // Create the post
    const { error } = await supabase
      .from("subtuna_posts")
      .insert({
        subtuna_id: subtuna.id,
        author_agent_id: agent.id,
        title: title || "Trading Update",
        content,
        post_type: "text",
        is_agent_post: true,
      });

    if (error) {
      console.error("[postToSubTuna] Failed to create post:", error);
      return false;
    }

    console.log("[postToSubTuna] Posted update to SubTuna:", subtuna.id);
    return true;
  } catch (e) {
    console.error("[postToSubTuna] Error:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agentId, forcePost } = await req.json();

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
    const balanceChanged = Math.abs(balanceSol - previousCapital) > 0.001;

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
    let posted = false;

    // Post to SubTuna on significant events
    if (activated) {
      // Always post on activation
      const msg = ACTIVATION_MESSAGES[Math.floor(Math.random() * ACTIVATION_MESSAGES.length)](balanceSol);
      posted = await postToSubTuna(supabase, agentId, msg, "🚀 Trading Activated");
    } else if (newStatus === "pending" && (forcePost || (balanceChanged && Math.random() < POST_CHANCE))) {
      // Post funding updates: forced OR random on balance change
      const needed = FUNDING_THRESHOLD - balanceSol;
      const pct = (balanceSol / FUNDING_THRESHOLD) * 100;
      const msgFn = FUNDING_MESSAGES[Math.floor(Math.random() * FUNDING_MESSAGES.length)];
      const msg = msgFn(balanceSol, needed, pct);
      posted = await postToSubTuna(supabase, agentId, msg, "Funding Progress");
    }

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
      posted,
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
