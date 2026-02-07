// OpenTuna Fin Forge - Auto-generate Fins from Usage Patterns
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ForgeRequest {
  agentId: string;
  minOccurrences?: number;
  minSuccessRate?: number;
}

interface DetectedPattern {
  finSequence: string[];
  occurrences: number;
  successRate: number;
  avgExecutionMs: number;
  sampleParams: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { agentId, minOccurrences = 5, minSuccessRate = 80 }: ForgeRequest = await req.json();

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "agentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify agent exists
    const { data: agent, error: agentError } = await supabase
      .from("opentuna_agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recent fin executions
    const { data: executions, error: execError } = await supabase
      .from("opentuna_fin_executions")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (execError) {
      console.error("Failed to fetch executions:", execError);
      return new Response(
        JSON.stringify({ error: "Failed to analyze execution history" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!executions || executions.length < minOccurrences) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Not enough execution history for pattern detection",
          patterns: [],
          forgedFins: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect patterns: group by params_hash to find repeated sequences
    const patternMap = new Map<string, {
      finName: string;
      count: number;
      successCount: number;
      totalMs: number;
      sampleParams: Record<string, unknown>;
    }>();

    for (const exec of executions) {
      const key = `${exec.fin_name}:${exec.params_hash}`;
      const existing = patternMap.get(key);
      
      if (existing) {
        existing.count++;
        if (exec.success) existing.successCount++;
        existing.totalMs += exec.execution_time_ms || 0;
      } else {
        patternMap.set(key, {
          finName: exec.fin_name,
          count: 1,
          successCount: exec.success ? 1 : 0,
          totalMs: exec.execution_time_ms || 0,
          sampleParams: exec.params || {},
        });
      }
    }

    // Filter patterns that meet criteria
    const validPatterns: DetectedPattern[] = [];
    
    for (const [key, data] of patternMap) {
      const successRate = (data.successCount / data.count) * 100;
      
      if (data.count >= minOccurrences && successRate >= minSuccessRate) {
        validPatterns.push({
          finSequence: [data.finName],
          occurrences: data.count,
          successRate: Math.round(successRate * 10) / 10,
          avgExecutionMs: Math.round(data.totalMs / data.count),
          sampleParams: data.sampleParams,
        });
      }
    }

    // Sort by occurrences
    validPatterns.sort((a, b) => b.occurrences - a.occurrences);

    // Auto-forge fins for top patterns
    const forgedFins = [];
    
    for (const pattern of validPatterns.slice(0, 3)) { // Max 3 auto-forged fins
      const finName = `forge_${pattern.finSequence.join("_")}_${Date.now().toString(36)}`;
      const displayName = `${pattern.finSequence.map(f => f.replace("fin_", "")).join(" + ")} (Forged)`;
      
      // Generate handler code template
      const handlerCode = generateFinHandler(pattern);
      
      // Check if similar fin already exists
      const { data: existingFin } = await supabase
        .from("opentuna_fins")
        .select("id")
        .eq("provider_agent_id", agentId)
        .ilike("name", `%${pattern.finSequence[0]}%`)
        .maybeSingle();

      if (existingFin) {
        continue; // Skip if already forged similar
      }

      // Create the new fin
      const { data: newFin, error: finError } = await supabase
        .from("opentuna_fins")
        .insert({
          name: finName,
          display_name: displayName,
          description: `Auto-generated fin based on ${pattern.occurrences} successful executions`,
          category: "development",
          handler_code: handlerCode,
          permission_scope: ["network"],
          cost_sol: 0.001, // Minimal cost for forged fins
          is_native: false,
          is_verified: false, // Needs security scan
          security_scan_passed: false,
          provider_agent_id: agentId,
          provider_wallet: agent.wallet_address,
          total_uses: 0,
          success_rate: pattern.successRate,
          avg_execution_ms: pattern.avgExecutionMs,
        })
        .select()
        .single();

      if (!finError && newFin) {
        // Auto-install in agent's fin rack
        await supabase
          .from("opentuna_fin_rack")
          .insert({
            agent_id: agentId,
            fin_id: newFin.id,
            enabled: true,
          });

        forgedFins.push({
          id: newFin.id,
          name: finName,
          displayName,
          pattern,
        });

        // Store memory about the forge
        await supabase
          .from("opentuna_deep_memory")
          .insert({
            agent_id: agentId,
            content: `Forged new fin "${displayName}" from detected pattern. Based on ${pattern.occurrences} executions with ${pattern.successRate}% success rate.`,
            memory_type: "pattern",
            importance: 7,
            tags: ["fin_forge", "automation", finName],
            metadata: { finId: newFin.id, pattern },
          });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        patternsDetected: validPatterns.length,
        patterns: validPatterns.slice(0, 10),
        forgedFins,
        message: forgedFins.length > 0 
          ? `Forged ${forgedFins.length} new fin(s) from detected patterns`
          : "Patterns detected but no new fins forged (may already exist)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Fin Forge error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateFinHandler(pattern: DetectedPattern): string {
  const finName = pattern.finSequence[0];
  
  return `
// Auto-generated Fin Handler
// Pattern: ${pattern.finSequence.join(" → ")}
// Success Rate: ${pattern.successRate}%
// Based on ${pattern.occurrences} executions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export async function handler(params: Record<string, unknown>, context: { agentId: string }) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Execute the underlying fin
  const response = await fetch(
    \`\${Deno.env.get("SUPABASE_URL")}/functions/v1/opentuna-${finName.replace("_", "-")}\`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}\`,
      },
      body: JSON.stringify({
        agentId: context.agentId,
        ...params,
      }),
    }
  );

  return response.json();
}

// Sample params from detection:
// ${JSON.stringify(pattern.sampleParams, null, 2)}
`.trim();
}
