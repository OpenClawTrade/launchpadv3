import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  console.log("[claw-agent-bid-settle] ⏰ Settlement cron started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find agents where bidding has ended and not yet owned
    const { data: expiredAgents, error: fetchError } = await supabase
      .from("claw_trading_agents")
      .select("id, name, bidding_ends_at, agent_id")
      .eq("is_owned", false)
      .not("bidding_ends_at", "is", null)
      .lt("bidding_ends_at", new Date().toISOString());

    if (fetchError) throw new Error(`Failed to fetch expired agents: ${fetchError.message}`);

    if (!expiredAgents?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No agents to settle", duration: Date.now() - startTime }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[claw-agent-bid-settle] Found ${expiredAgents.length} agents to settle`);

    const results: any[] = [];

    for (const agent of expiredAgents) {
      try {
        // Get highest active bid
        const { data: winningBid } = await supabase
          .from("claw_agent_bids")
          .select("*")
          .eq("trading_agent_id", agent.id)
          .eq("status", "active")
          .order("bid_amount_sol", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!winningBid) {
          console.log(`[claw-agent-bid-settle] No bids for ${agent.name}, skipping`);
          // No bids - leave as unowned, clear bidding window
          await supabase.from("claw_trading_agents").update({ bidding_ends_at: null }).eq("id", agent.id);
          results.push({ agentId: agent.id, agentName: agent.name, settled: false, reason: "no_bids" });
          continue;
        }

        // Transfer ownership
        const { error: updateError } = await supabase
          .from("claw_trading_agents")
          .update({
            owner_wallet: winningBid.bidder_wallet,
            is_owned: true,
            ownership_transferred_at: new Date().toISOString(),
          })
          .eq("id", agent.id);

        if (updateError) throw updateError;

        // Mark winning bid
        await supabase.from("claw_agent_bids").update({ status: "won" }).eq("id", winningBid.id);

        // Mark all other bids as expired
        await supabase.from("claw_agent_bids").update({ status: "expired" }).eq("trading_agent_id", agent.id).neq("id", winningBid.id).neq("status", "outbid");

        console.log(`[claw-agent-bid-settle] ✅ ${agent.name} -> owned by ${winningBid.bidder_wallet} for ${winningBid.bid_amount_sol} SOL`);

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          settled: true,
          winner: winningBid.bidder_wallet,
          amount: winningBid.bid_amount_sol,
        });
      } catch (agentError) {
        console.error(`[claw-agent-bid-settle] Error settling ${agent.name}:`, agentError);
        results.push({ agentId: agent.id, agentName: agent.name, settled: false, error: agentError instanceof Error ? agentError.message : "Unknown" });
      }
    }

    const settledCount = results.filter(r => r.settled).length;
    console.log(`[claw-agent-bid-settle] ✅ Settled ${settledCount}/${expiredAgents.length} agents`);

    return new Response(
      JSON.stringify({ success: true, settled: settledCount, total: expiredAgents.length, duration: Date.now() - startTime, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[claw-agent-bid-settle] ❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
