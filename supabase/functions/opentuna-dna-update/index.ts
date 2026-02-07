import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      agentId,
      personality,
      speciesTraits,
      migrationGoals,
      reefLimits,
      echoPattern,
      voiceSample,
      originStory,
      preferredModel,
      fallbackModel,
    } = await req.json();

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "agentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify agent exists
    const { data: agent, error: agentError } = await supabase
      .from('opentuna_agents')
      .select('id, name')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build update object
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (personality !== undefined) updates.personality = personality;
    if (speciesTraits !== undefined) updates.species_traits = speciesTraits;
    if (migrationGoals !== undefined) updates.migration_goals = migrationGoals;
    if (reefLimits !== undefined) updates.reef_limits = reefLimits;
    if (echoPattern !== undefined) updates.echo_pattern = echoPattern;
    if (voiceSample !== undefined) updates.voice_sample = voiceSample;
    if (originStory !== undefined) updates.origin_story = originStory;
    if (preferredModel !== undefined) updates.preferred_model = preferredModel;
    if (fallbackModel !== undefined) updates.fallback_model = fallbackModel;

    // Also increment version
    const { data: currentDNA } = await supabase
      .from('opentuna_dna')
      .select('version')
      .eq('agent_id', agentId)
      .single();

    updates.version = (currentDNA?.version || 0) + 1;

    // Update DNA
    const { data: dna, error: dnaError } = await supabase
      .from('opentuna_dna')
      .update(updates)
      .eq('agent_id', agentId)
      .select()
      .single();

    if (dnaError) {
      console.error("DNA update error:", dnaError);
      return new Response(
        JSON.stringify({ error: "Failed to update DNA", details: dnaError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store memory of DNA modification
    await supabase.from('opentuna_deep_memory').insert({
      agent_id: agentId,
      content: `DNA updated to version ${updates.version}. Changes: ${Object.keys(updates).filter(k => k !== 'updated_at' && k !== 'version').join(', ')}`,
      memory_type: 'echo',
      importance: 6,
      tags: ['dna', 'modification'],
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    });

    console.log(`DNA updated for agent ${agent.name} (${agentId}) - v${updates.version}`);

    return new Response(
      JSON.stringify({
        success: true,
        dna,
        version: updates.version,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("DNA update error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
