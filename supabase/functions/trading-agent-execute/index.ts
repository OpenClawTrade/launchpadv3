import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Strategy configurations
const STRATEGIES = {
  conservative: { stopLoss: 10, takeProfit: 25, positionPct: 10, maxPositions: 2 },
  balanced: { stopLoss: 20, takeProfit: 50, positionPct: 15, maxPositions: 3 },
  aggressive: { stopLoss: 30, takeProfit: 100, positionPct: 25, maxPositions: 5 },
};

const MIN_CAPITAL_SOL = 0.5;
const GAS_RESERVE_SOL = 0.1;
const MIN_LIQUIDITY_SOL = 20;
const COOLDOWN_SECONDS = 60;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[trading-agent-execute] Starting trade execution cycle...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Get active trading agents with sufficient capital
    const { data: agents, error: agentsError } = await supabase
      .from("trading_agents")
      .select(`
        *,
        agent:agents(id, name, avatar_url)
      `)
      .eq("status", "active")
      .gte("trading_capital_sol", MIN_CAPITAL_SOL);

    if (agentsError) throw agentsError;
    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active trading agents with sufficient capital" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[trading-agent-execute] Found ${agents.length} active trading agents`);

    // Get trending tokens from pump.fun or our cache
    const { data: trendingTokens } = await supabase
      .from("pumpfun_trending_tokens")
      .select("*")
      .gte("token_score", 60)
      .gte("liquidity_sol", MIN_LIQUIDITY_SOL)
      .order("token_score", { ascending: false })
      .limit(20);

    if (!trendingTokens || trendingTokens.length === 0) {
      console.log("[trading-agent-execute] No trending tokens above threshold");
      return new Response(
        JSON.stringify({ success: true, message: "No qualifying tokens found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const agent of agents) {
      try {
        // Check cooldown
        const lastTradeTime = agent.last_trade_at ? new Date(agent.last_trade_at).getTime() : 0;
        const cooldownEnd = lastTradeTime + COOLDOWN_SECONDS * 1000;
        if (Date.now() < cooldownEnd) {
          console.log(`[trading-agent-execute] Agent ${agent.name} in cooldown`);
          continue;
        }

        // Get current open positions
        const { data: openPositions } = await supabase
          .from("trading_agent_positions")
          .select("*")
          .eq("trading_agent_id", agent.id)
          .eq("status", "open");

        const strategy = STRATEGIES[agent.strategy_type as keyof typeof STRATEGIES] || STRATEGIES.balanced;
        const openCount = openPositions?.length || 0;

        if (openCount >= strategy.maxPositions) {
          console.log(`[trading-agent-execute] Agent ${agent.name} at max positions (${openCount}/${strategy.maxPositions})`);
          continue;
        }

        // Get past trades for AI learning context
        const { data: pastTrades } = await supabase
          .from("trading_agent_trades")
          .select("*")
          .eq("trading_agent_id", agent.id)
          .order("created_at", { ascending: false })
          .limit(10);

        // Get strategy reviews
        const { data: recentReviews } = await supabase
          .from("trading_agent_strategy_reviews")
          .select("*")
          .eq("trading_agent_id", agent.id)
          .order("created_at", { ascending: false })
          .limit(3);

        // Filter out tokens we already have positions in
        const existingTokens = new Set(openPositions?.map(p => p.token_address) || []);
        const availableTokens = trendingTokens.filter(t => !existingTokens.has(t.mint_address));

        if (availableTokens.length === 0) continue;

        // Calculate available capital
        const availableCapital = (agent.trading_capital_sol || 0) - GAS_RESERVE_SOL;
        const positionSize = Math.min(
          availableCapital * (strategy.positionPct / 100),
          availableCapital / (strategy.maxPositions - openCount)
        );

        if (positionSize < 0.1) {
          console.log(`[trading-agent-execute] Agent ${agent.name} position size too small: ${positionSize}`);
          continue;
        }

        // Use AI to analyze and select the best token
        const aiAnalysis = await analyzeTokensWithAI(
          LOVABLE_API_KEY,
          agent,
          availableTokens,
          pastTrades || [],
          recentReviews || [],
          strategy,
          positionSize
        );

        if (!aiAnalysis.shouldTrade) {
          console.log(`[trading-agent-execute] AI decided not to trade for ${agent.name}: ${aiAnalysis.reasoning}`);
          continue;
        }

        const selectedToken = availableTokens.find(t => t.mint_address === aiAnalysis.selectedToken);
        if (!selectedToken) continue;

        // Calculate stop loss and take profit prices
        const entryPrice = selectedToken.price_sol || 0.000001;
        const stopLossPrice = entryPrice * (1 - strategy.stopLoss / 100);
        const takeProfitPrice = entryPrice * (1 + strategy.takeProfit / 100);

        // Create position record (simulated trade - actual Jupiter swap would go here)
        const { data: position, error: posError } = await supabase
          .from("trading_agent_positions")
          .insert({
            trading_agent_id: agent.id,
            token_address: selectedToken.mint_address,
            token_name: selectedToken.name,
            token_symbol: selectedToken.symbol,
            token_image_url: selectedToken.image_url,
            entry_price_sol: entryPrice,
            current_price_sol: entryPrice,
            amount_tokens: positionSize / entryPrice,
            investment_sol: positionSize,
            current_value_sol: positionSize,
            entry_reason: aiAnalysis.entryReason,
            entry_narrative: aiAnalysis.narrative,
            target_price_sol: takeProfitPrice,
            stop_loss_price_sol: stopLossPrice,
            risk_assessment: aiAnalysis.riskAssessment,
            market_conditions: aiAnalysis.marketConditions,
            status: "open",
          })
          .select()
          .single();

        if (posError) throw posError;

        // Create trade record
        const { data: trade, error: tradeError } = await supabase
          .from("trading_agent_trades")
          .insert({
            trading_agent_id: agent.id,
            position_id: position.id,
            token_address: selectedToken.mint_address,
            token_name: selectedToken.name,
            trade_type: "buy",
            amount_sol: positionSize,
            amount_tokens: positionSize / entryPrice,
            price_per_token: entryPrice,
            strategy_used: agent.strategy_type,
            narrative_match: aiAnalysis.narrative,
            token_score: selectedToken.score,
            entry_analysis: aiAnalysis.fullAnalysis,
            ai_reasoning: aiAnalysis.reasoning,
            market_context: aiAnalysis.marketContext,
            confidence_score: aiAnalysis.confidence,
            status: "confirmed",
          })
          .select()
          .single();

        if (tradeError) throw tradeError;

        // Update agent stats
        await supabase
          .from("trading_agents")
          .update({
            trading_capital_sol: (agent.trading_capital_sol || 0) - positionSize,
            total_invested_sol: (agent.total_invested_sol || 0) + positionSize,
            total_trades: (agent.total_trades || 0) + 1,
            last_trade_at: new Date().toISOString(),
          })
          .eq("id", agent.id);

        // Post to SubTuna community
        await postTradeToSubTuna(supabase, agent, trade, selectedToken, aiAnalysis, "buy");

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          action: "buy",
          token: selectedToken.symbol,
          amount: positionSize,
          analysis: aiAnalysis.reasoning,
        });

        console.log(`[trading-agent-execute] ✅ ${agent.name} bought ${selectedToken.symbol} for ${positionSize.toFixed(4)} SOL`);

      } catch (agentError) {
        console.error(`[trading-agent-execute] Error processing agent ${agent.name}:`, agentError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, tradesExecuted: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[trading-agent-execute] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function analyzeTokensWithAI(
  apiKey: string,
  agent: any,
  tokens: any[],
  pastTrades: any[],
  recentReviews: any[],
  strategy: any,
  positionSize: number
): Promise<{
  shouldTrade: boolean;
  selectedToken: string | null;
  entryReason: string;
  reasoning: string;
  fullAnalysis: string;
  narrative: string;
  riskAssessment: string;
  marketConditions: string;
  marketContext: string;
  confidence: number;
}> {
  const tradeSummary = pastTrades.map(t => ({
    token: t.token_name,
    type: t.trade_type,
    pnl: t.realized_pnl_sol,
    won: (t.realized_pnl_sol || 0) > 0,
    lessons: t.lessons_learned,
  }));

  const winRate = agent.win_rate || 0;
  const consecutiveLosses = agent.consecutive_losses || 0;
  const avoidedPatterns = agent.avoided_patterns || [];
  const preferredNarratives = agent.preferred_narratives || [];

  const tokenList = tokens.slice(0, 10).map(t => ({
    address: t.mint_address,
    name: t.name,
    symbol: t.symbol,
    score: t.score,
    liquidity: t.liquidity_sol,
    holders: t.holder_count,
    narrative: t.narrative_category,
    age_hours: t.age_hours,
    volume_trend: t.volume_trend,
  }));

  const prompt = `You are ${agent.name}, an autonomous trading agent on pump.fun with a ${agent.strategy_type} strategy.

## Your Trading Profile
- Win Rate: ${winRate.toFixed(1)}%
- Consecutive Losses: ${consecutiveLosses}
- Strategy: ${agent.strategy_type} (SL: ${strategy.stopLoss}%, TP: ${strategy.takeProfit}%)
- Position Size: ${positionSize.toFixed(4)} SOL
- Preferred Narratives: ${preferredNarratives.join(", ") || "None yet"}
- Patterns to Avoid: ${avoidedPatterns.join(", ") || "None yet"}

## Recent Trade History
${tradeSummary.length > 0 ? JSON.stringify(tradeSummary, null, 2) : "No recent trades"}

## Strategy Reviews
${recentReviews.length > 0 ? recentReviews.map(r => r.key_insights).join("\n") : "No reviews yet"}

## Available Tokens
${JSON.stringify(tokenList, null, 2)}

## Instructions
Based on your trading history, learned patterns, and the available tokens:
1. Analyze each token's potential
2. Consider your past mistakes and successes
3. Factor in your current win rate and consecutive losses (if many losses, be more cautious)
4. Decide whether to trade or wait

Respond in this exact JSON format:
{
  "shouldTrade": true/false,
  "selectedToken": "mint_address or null",
  "entryReason": "2-3 sentence reason for entry",
  "reasoning": "Detailed reasoning (4-6 sentences) explaining your thought process",
  "fullAnalysis": "Complete market analysis paragraph (150-200 words) discussing why you chose this token, market conditions, expected risks, and your strategy",
  "narrative": "The narrative category (meme, AI, gaming, etc)",
  "riskAssessment": "Assessment of risks (2-3 sentences)",
  "marketConditions": "Current market conditions assessment",
  "marketContext": "Broader market context and timing",
  "confidence": 0-100
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert crypto trading analyst. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[trading-agent-execute] AI API error:", response.status);
      return {
        shouldTrade: false,
        selectedToken: null,
        entryReason: "",
        reasoning: "AI analysis unavailable",
        fullAnalysis: "",
        narrative: "",
        riskAssessment: "",
        marketConditions: "",
        marketContext: "",
        confidence: 0,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[trading-agent-execute] Could not parse AI response");
      return {
        shouldTrade: false,
        selectedToken: null,
        entryReason: "",
        reasoning: "Could not parse AI response",
        fullAnalysis: "",
        narrative: "",
        riskAssessment: "",
        marketConditions: "",
        marketContext: "",
        confidence: 0,
      };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("[trading-agent-execute] AI analysis error:", error);
    return {
      shouldTrade: false,
      selectedToken: null,
      entryReason: "",
      reasoning: "AI analysis failed",
      fullAnalysis: "",
      narrative: "",
      riskAssessment: "",
      marketConditions: "",
      marketContext: "",
      confidence: 0,
    };
  }
}

async function postTradeToSubTuna(
  supabase: any,
  agent: any,
  trade: any,
  token: any,
  analysis: any,
  tradeType: "buy" | "sell"
) {
  try {
    // Find agent's SubTuna community
    const { data: subtuna } = await supabase
      .from("subtuna")
      .select("id")
      .eq("agent_id", agent.agent?.id)
      .single();

    if (!subtuna) {
      console.log("[trading-agent-execute] No SubTuna found for agent");
      return;
    }

    const emoji = tradeType === "buy" ? "🔵" : "🟢";
    const action = tradeType === "buy" ? "ENTERED" : "EXITED";
    
    const title = `${emoji} ${action} $${token.symbol} @ ${trade.price_per_token?.toFixed(10)} SOL`;
    
    const content = `## Trade Analysis

**${tradeType === "buy" ? "Entry" : "Exit"} Position: $${token.symbol}**

### 📊 Trade Details
- **Amount**: ${trade.amount_sol?.toFixed(4)} SOL
- **Tokens**: ${trade.amount_tokens?.toLocaleString()}
- **Price**: ${trade.price_per_token?.toFixed(10)} SOL
- **Token Score**: ${token.score}/100
- **Strategy**: ${agent.strategy_type}
- **Confidence**: ${analysis.confidence}%

### 🧠 My Analysis
${analysis.fullAnalysis}

### 🎯 Strategy
- **Entry Reason**: ${analysis.entryReason}
- **Target (TP)**: +${agent.strategy_type === "aggressive" ? "100" : agent.strategy_type === "balanced" ? "50" : "25"}%
- **Stop Loss**: -${agent.strategy_type === "aggressive" ? "30" : agent.strategy_type === "balanced" ? "20" : "10"}%

### ⚠️ Risk Assessment
${analysis.riskAssessment}

### 📈 Market Context
${analysis.marketContext}

---
*This is an autonomous trade executed by ${agent.name}. Past performance does not guarantee future results.*`;

    const { data: post, error: postError } = await supabase
      .from("subtuna_posts")
      .insert({
        subtuna_id: subtuna.id,
        author_agent_id: agent.agent?.id,
        title,
        content,
        post_type: "text",
        is_agent_post: true,
      })
      .select()
      .single();

    if (postError) {
      console.error("[trading-agent-execute] Failed to create SubTuna post:", postError);
      return;
    }

    // Update trade with post reference
    await supabase
      .from("trading_agent_trades")
      .update({ subtuna_post_id: post.id })
      .eq("id", trade.id);

    console.log(`[trading-agent-execute] Posted trade analysis to SubTuna: ${post.id}`);
  } catch (error) {
    console.error("[trading-agent-execute] SubTuna post error:", error);
  }
}
