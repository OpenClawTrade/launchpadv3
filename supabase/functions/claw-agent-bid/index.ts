import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const tradingAgentId = url.searchParams.get("tradingAgentId");
      if (!tradingAgentId) return new Response(JSON.stringify({ error: "tradingAgentId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Get agent info
      const { data: agent } = await supabase.from("claw_trading_agents").select("id, name, bidding_ends_at, is_owned, owner_wallet, launched_at").eq("id", tradingAgentId).single();
      if (!agent) return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Get bids
      const { data: bids } = await supabase.from("claw_agent_bids").select("*").eq("trading_agent_id", tradingAgentId).order("bid_amount_sol", { ascending: false });

      const highestBid = bids?.[0] || null;
      const biddingOpen = agent.bidding_ends_at ? new Date(agent.bidding_ends_at) > new Date() : false;

      return new Response(JSON.stringify({
        success: true,
        agent: { id: agent.id, name: agent.name, biddingEndsAt: agent.bidding_ends_at, isOwned: agent.is_owned, ownerWallet: agent.owner_wallet, launchedAt: agent.launched_at },
        biddingOpen,
        highestBid: highestBid ? { bidder: highestBid.bidder_wallet, amount: highestBid.bid_amount_sol, createdAt: highestBid.created_at } : null,
        totalBids: bids?.length || 0,
        bids: (bids || []).slice(0, 10),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST") {
      const { tradingAgentId, bidderWallet, bidAmountSol } = await req.json();
      if (!tradingAgentId || !bidderWallet || !bidAmountSol) {
        return new Response(JSON.stringify({ error: "tradingAgentId, bidderWallet, and bidAmountSol required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (bidAmountSol <= 0) return new Response(JSON.stringify({ error: "Bid must be positive" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Check agent exists and bidding is open
      const { data: agent } = await supabase.from("claw_trading_agents").select("id, bidding_ends_at, is_owned, agent_id").eq("id", tradingAgentId).single();
      if (!agent) return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      if (agent.is_owned) return new Response(JSON.stringify({ error: "Agent already owned" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      if (!agent.bidding_ends_at || new Date(agent.bidding_ends_at) <= new Date()) {
        return new Response(JSON.stringify({ error: "Bidding window has closed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check highest current bid
      const { data: currentHighest } = await supabase.from("claw_agent_bids").select("bid_amount_sol, bidder_wallet").eq("trading_agent_id", tradingAgentId).eq("status", "active").order("bid_amount_sol", { ascending: false }).limit(1).maybeSingle();

      if (currentHighest && bidAmountSol <= currentHighest.bid_amount_sol) {
        return new Response(JSON.stringify({ error: `Bid must be higher than current highest (${currentHighest.bid_amount_sol} SOL)`, currentHighest: currentHighest.bid_amount_sol }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Mark previous highest as outbid
      if (currentHighest) {
        await supabase.from("claw_agent_bids").update({ status: "outbid" }).eq("trading_agent_id", tradingAgentId).eq("status", "active");
      }

      // Insert new bid
      const { data: newBid, error: bidError } = await supabase.from("claw_agent_bids").insert({
        claw_agent_id: agent.agent_id,
        trading_agent_id: tradingAgentId,
        bidder_wallet: bidderWallet,
        bid_amount_sol: bidAmountSol,
        status: "active",
        expires_at: agent.bidding_ends_at,
      }).select().single();

      if (bidError) throw bidError;

      console.log(`[claw-agent-bid] New bid: ${bidAmountSol} SOL by ${bidderWallet} on agent ${tradingAgentId}`);

      return new Response(JSON.stringify({ success: true, bid: newBid, message: `Bid of ${bidAmountSol} SOL placed successfully! 🦞` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[claw-agent-bid] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
