import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Decision actions an agent can take
type SonarAction = 'drift' | 'research' | 'code' | 'execute' | 'trade' | 'post' | 'reply' | 'hire_fin' | 'delegate';

interface SonarDecision {
  action: SonarAction;
  priority: number; // 0-100
  reasoning: string;
  params?: Record<string, any>;
}

// AI model endpoint (using Lovable AI)
const AI_ENDPOINT = "https://ai.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { agentId, forcePing = false } = await req.json();

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "agentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get agent and sonar config
    const { data: agent, error: agentError } = await supabase
      .from('opentuna_agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: sonarConfig, error: sonarError } = await supabase
      .from('opentuna_sonar_config')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (sonarError || !sonarConfig) {
      return new Response(
        JSON.stringify({ error: "Sonar config not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if paused
    if (sonarConfig.is_paused && !forcePing) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          skipped: true,
          reason: sonarConfig.paused_reason || "Sonar is paused" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cost limit
    if (sonarConfig.current_daily_cost_sol >= sonarConfig.max_daily_cost_sol && !forcePing) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          skipped: true,
          reason: "Daily cost limit reached" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get DNA for personality
    const { data: dna } = await supabase
      .from('opentuna_dna')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    // Get recent memories
    const { data: memories } = await supabase
      .from('opentuna_deep_memory')
      .select('content, memory_type, importance')
      .eq('agent_id', agentId)
      .order('importance', { ascending: false })
      .limit(5);

    // Get recent pings
    const { data: recentPings } = await supabase
      .from('opentuna_sonar_pings')
      .select('action, reasoning, success')
      .eq('agent_id', agentId)
      .order('executed_at', { ascending: false })
      .limit(3);

    // Build context for AI decision
    const context = {
      agent: {
        name: agent.name,
        type: agent.agent_type,
        balance: agent.balance_sol,
      },
      personality: dna?.personality || "A helpful AI agent",
      goals: dna?.migration_goals || [],
      limits: dna?.reef_limits || [],
      recentMemories: memories?.map(m => m.content) || [],
      recentActions: recentPings?.map(p => `${p.action}: ${p.reasoning}`) || [],
      currentTime: new Date().toISOString(),
    };

    // Make AI decision
    let decision: SonarDecision;
    
    if (lovableApiKey) {
      try {
        const aiResponse = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: dna?.preferred_model || 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are ${agent.name}, an autonomous AI agent. Your personality: ${dna?.personality || 'helpful and efficient'}

Your current goals: ${JSON.stringify(dna?.migration_goals || [])}
Your hard limits (NEVER violate): ${JSON.stringify(dna?.reef_limits || [])}

Decide what action to take. Available actions:
- drift: Do nothing, conserve resources (priority 0-20)
- research: Gather information (priority 20-50)
- trade: Execute a trade (priority 50-80)
- post: Create social content (priority 30-60)
- reply: Respond to messages (priority 40-70)
- code: Write or modify code (priority 40-70)
- execute: Run a command/fin (priority 30-60)

Respond with JSON: {"action": "...", "priority": 0-100, "reasoning": "brief explanation"}`
              },
              {
                role: 'user',
                content: `Current context:\n${JSON.stringify(context, null, 2)}\n\nWhat should you do now?`
              }
            ],
            max_tokens: 200,
            temperature: 0.7,
          }),
        });

        const aiResult = await aiResponse.json();
        const content = aiResult.choices?.[0]?.message?.content || '';
        
        // Parse AI response
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            decision = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON in response');
          }
        } catch {
          decision = { action: 'drift', priority: 10, reasoning: 'Failed to parse AI response, defaulting to drift' };
        }
      } catch (aiError) {
        console.error('AI call failed:', aiError);
        decision = { action: 'drift', priority: 5, reasoning: 'AI unavailable, conserving resources' };
      }
    } else {
      // No AI key - simulate decision based on agent type
      const actions: Record<string, SonarAction[]> = {
        trading: ['trade', 'research', 'drift'],
        social: ['post', 'reply', 'drift'],
        research: ['research', 'code', 'drift'],
        creative: ['post', 'code', 'drift'],
        general: ['research', 'execute', 'drift'],
      };
      
      const availableActions = actions[agent.agent_type] || actions.general;
      const randomAction = availableActions[Math.floor(Math.random() * availableActions.length)];
      
      decision = {
        action: randomAction,
        priority: Math.floor(Math.random() * 60) + 20,
        reasoning: `Simulated ${randomAction} decision for ${agent.agent_type} agent`,
      };
    }

    // Estimate cost (simplified)
    const costSol = 0.001; // ~$0.002 per ping

    // Store ping result
    const { data: ping, error: pingError } = await supabase
      .from('opentuna_sonar_pings')
      .insert({
        agent_id: agentId,
        action: decision.action,
        priority: decision.priority,
        reasoning: decision.reasoning,
        success: true,
        cost_sol: costSol,
        context_snapshot: context,
      })
      .select()
      .single();

    if (pingError) {
      console.error('Failed to store ping:', pingError);
    }

    // Update sonar config
    const nextPingAt = new Date(Date.now() + sonarConfig.interval_minutes * 60 * 1000);
    
    await supabase
      .from('opentuna_sonar_config')
      .update({
        last_ping_at: new Date().toISOString(),
        next_ping_at: nextPingAt.toISOString(),
        total_pings: sonarConfig.total_pings + 1,
        current_daily_cost_sol: (sonarConfig.current_daily_cost_sol || 0) + costSol,
      })
      .eq('agent_id', agentId);

    // Update agent activity
    await supabase
      .from('opentuna_agents')
      .update({
        last_active_at: new Date().toISOString(),
        total_ai_tokens_used: (agent.total_ai_tokens_used || 0) + 200,
      })
      .eq('id', agentId);

    // Store decision in memory
    await supabase.from('opentuna_deep_memory').insert({
      agent_id: agentId,
      content: `Sonar ping: ${decision.action} (P:${decision.priority}) - ${decision.reasoning}`,
      memory_type: 'surface',
      importance: Math.ceil(decision.priority / 20),
      tags: ['sonar', decision.action],
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    console.log(`Sonar ping for ${agent.name}: ${decision.action} (P:${decision.priority})`);

    return new Response(
      JSON.stringify({
        success: true,
        pingId: ping?.id,
        decision,
        nextPingAt: nextPingAt.toISOString(),
        dailyCost: (sonarConfig.current_daily_cost_sol || 0) + costSol,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sonar ping error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
