import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get aggregate stats for all agent-launched tokens
    const { data: agentTokens, error: tokensError } = await supabase
      .from("agent_tokens")
      .select(`
        id,
        agent_id,
        fun_token_id,
        source_platform,
        created_at,
        fun_tokens (
          id,
          name,
          ticker,
          mint_address,
          market_cap_sol,
          volume_24h_sol,
          price_change_24h,
          image_url,
          created_at
        )
      `)
      .order("created_at", { ascending: false });

    if (tokensError) {
      throw new Error(`Failed to fetch agent tokens: ${tokensError.message}`);
    }

    // Get agent stats (include total_fees_claimed_sol for payouts)
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("id, name, total_fees_earned_sol, total_fees_claimed_sol, total_tokens_launched, post_count, comment_count")
      .eq("status", "active");

    if (agentsError) {
      throw new Error(`Failed to fetch agents: ${agentsError.message}`);
    }

    // Get agent token IDs for fee claims query
    const agentTokenIds = agentTokens?.map(at => at.fun_token_id).filter(Boolean) || [];

    // Calculate total volume from fee claims (fee is 1%, so volume = fees / 0.01)
    let totalVolume = 0;
    if (agentTokenIds.length > 0) {
      const { data: feeClaims } = await supabase
        .from("fun_fee_claims")
        .select("claimed_sol")
        .in("fun_token_id", agentTokenIds);

      const totalFeesClaimed = feeClaims?.reduce(
        (sum, fc) => sum + Number(fc.claimed_sol || 0), 0
      ) || 0;

      // Volume = Fees / 1% fee rate
      totalVolume = totalFeesClaimed / 0.01;
    }

    // Calculate totals
    const totalTokensLaunched = agentTokens?.length || 0;
    // totalAgentFeesEarned is calculated dynamically from fun_fee_claims (same as totalAgentPayouts)
    // This ensures accurate data even if the agents.total_fees_earned_sol column becomes stale

    const totalMarketCap = agentTokens?.reduce((sum, at) => {
      const token = at.fun_tokens as any;
      return sum + Number(token?.market_cap_sol || 0);
    }, 0) || 0;

    const totalAgents = agents?.length || 0;
    
    // Sum up all agent posts and comments
    const totalAgentPosts = agents?.reduce(
      (sum, a) => sum + Number(a.post_count || 0) + Number(a.comment_count || 0),
      0
    ) || 0;

    // Calculate agent payouts from source of truth (fun_fee_claims)
    // Agent share = 80% of claimed fees for agent-launched tokens
    let totalAgentPayouts = 0;
    if (agentTokenIds.length > 0) {
      const { data: agentFeeClaims } = await supabase
        .from("fun_fee_claims")
        .select("claimed_sol")
        .in("fun_token_id", agentTokenIds);

      const agentTokenFees = agentFeeClaims?.reduce(
        (sum, fc) => sum + Number(fc.claimed_sol || 0), 0
      ) || 0;

      // Agents get 80% of fees from their tokens
      totalAgentPayouts = agentTokenFees * 0.8;
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          totalMarketCap,
          totalAgentFeesEarned: totalAgentPayouts, // Use same source-of-truth calculation
          totalTokensLaunched,
          totalVolume,
          totalAgents,
          totalAgentPosts,
          totalAgentPayouts,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("agent-stats error:", error);
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
