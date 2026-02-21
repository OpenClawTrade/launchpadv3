import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const sortBy = url.searchParams.get("sortBy") || "total_profit_sol";
    const status = url.searchParams.get("status");
    const strategy = url.searchParams.get("strategy");

    // Query both tables and merge results
    const [oldResult, newResult] = await Promise.all([
      supabase
        .from("trading_agents")
        .select(`
          id, name, ticker, description, avatar_url, wallet_address,
          trading_capital_sol, total_invested_sol, total_profit_sol,
          unrealized_pnl_sol, win_rate, total_trades, winning_trades,
          losing_trades, strategy_type, stop_loss_pct, take_profit_pct,
          max_concurrent_positions, consecutive_wins, consecutive_losses,
          best_trade_sol, worst_trade_sol, avg_hold_time_minutes,
          preferred_narratives, status, created_at, mint_address, twitter_url,
          agent:agents!trading_agents_agent_id_fkey(id, name, avatar_url, karma)
        `)
        .then(r => r),
      supabase
        .from("claw_trading_agents")
        .select(`
          id, name, ticker, description, avatar_url, wallet_address,
          trading_capital_sol, total_invested_sol, total_profit_sol,
          unrealized_pnl_sol, win_rate, total_trades, winning_trades,
          losing_trades, strategy_type, stop_loss_pct, take_profit_pct,
          max_concurrent_positions, consecutive_wins, consecutive_losses,
          best_trade_sol, worst_trade_sol, avg_hold_time_minutes,
          preferred_narratives, status, created_at, mint_address, twitter_url,
          agent:claw_agents!claw_trading_agents_agent_id_fkey(id, name, avatar_url, karma)
        `)
        .then(r => r),
    ]);

    // Merge results from both tables
    let allAgents = [
      ...(oldResult.data || []),
      ...(newResult.data || []),
    ];

    // Apply filters
    if (status) {
      allAgents = allAgents.filter(a => a.status === status);
    }
    if (strategy) {
      allAgents = allAgents.filter(a => a.strategy_type === strategy);
    }

    // Apply sorting
    allAgents.sort((a, b) => {
      switch (sortBy) {
        case "win_rate":
          return (b.win_rate || 0) - (a.win_rate || 0);
        case "total_trades":
          return (b.total_trades || 0) - (a.total_trades || 0);
        case "trading_capital_sol":
          return (b.trading_capital_sol || 0) - (a.trading_capital_sol || 0);
        case "created_at":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return (b.total_profit_sol || 0) - (a.total_profit_sol || 0);
      }
    });

    // Apply pagination
    const total = allAgents.length;
    const paged = allAgents.slice(offset, offset + limit);

    // Get open positions count
    const agentIds = paged.map(a => a.id);
    const [oldPos, newPos] = await Promise.all([
      supabase.from("trading_agent_positions").select("trading_agent_id").eq("status", "open").in("trading_agent_id", agentIds),
      supabase.from("claw_trading_positions").select("trading_agent_id").eq("status", "open").in("trading_agent_id", agentIds),
    ]);

    const posCountMap = new Map<string, number>();
    [...(oldPos.data || []), ...(newPos.data || [])].forEach(p => {
      posCountMap.set(p.trading_agent_id, (posCountMap.get(p.trading_agent_id) || 0) + 1);
    });

    // Enrich agents
    const enrichedAgents = paged.map(agent => ({
      ...agent,
      openPositions: posCountMap.get(agent.id) || 0,
      roi: agent.total_invested_sol > 0
        ? ((agent.total_profit_sol || 0) / agent.total_invested_sol * 100).toFixed(2)
        : "0.00",
      funding_progress: Math.min(100, ((agent.trading_capital_sol || 0) / 0.5) * 100),
      is_funded: (agent.trading_capital_sol || 0) >= 0.5,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: enrichedAgents,
        pagination: { total, limit, offset, hasMore: (offset + limit) < total },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[trading-agent-list] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
