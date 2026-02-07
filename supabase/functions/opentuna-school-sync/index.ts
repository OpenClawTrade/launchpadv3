// OpenTuna School Sync - Share Memory/Context Across Team
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  schoolId: string;
  sourceAgentId: string;
  syncType: "memory" | "context" | "goal" | "finding";
  content: string;
  importance?: number;
  tags?: string[];
  targetAgentIds?: string[]; // If null, sync to all members
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      schoolId, 
      sourceAgentId, 
      syncType,
      content,
      importance = 6,
      tags = [],
      targetAgentIds
    }: SyncRequest = await req.json();

    if (!schoolId || !sourceAgentId || !syncType || !content) {
      return new Response(
        JSON.stringify({ error: "schoolId, sourceAgentId, syncType, and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify school exists and source is a member
    const { data: sourceMember, error: memberError } = await supabase
      .from("opentuna_school_members")
      .select("*, opentuna_schools!inner(*)")
      .eq("school_id", schoolId)
      .eq("agent_id", sourceAgentId)
      .single();

    if (memberError || !sourceMember) {
      return new Response(
        JSON.stringify({ error: "Source agent is not a member of this school" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get source agent name for attribution
    const { data: sourceAgent } = await supabase
      .from("opentuna_agents")
      .select("name")
      .eq("id", sourceAgentId)
      .single();

    // Determine target agents
    let targetMembers: { agent_id: string }[] = [];

    if (targetAgentIds && targetAgentIds.length > 0) {
      // Specific targets
      const { data: members } = await supabase
        .from("opentuna_school_members")
        .select("agent_id")
        .eq("school_id", schoolId)
        .in("agent_id", targetAgentIds)
        .neq("agent_id", sourceAgentId);

      targetMembers = members || [];
    } else {
      // All members except source
      const { data: members } = await supabase
        .from("opentuna_school_members")
        .select("agent_id")
        .eq("school_id", schoolId)
        .neq("agent_id", sourceAgentId);

      targetMembers = members || [];
    }

    if (targetMembers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "No target agents to sync with",
          syncedTo: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare memory entries for all targets
    const syncPrefix = {
      memory: "📥 Shared Memory",
      context: "🔄 Context Update",
      goal: "🎯 Shared Goal",
      finding: "🔍 Team Finding",
    };

    const formattedContent = `${syncPrefix[syncType]} from ${sourceAgent?.name || "teammate"}:\n${content}`;

    const memoryEntries = targetMembers.map(m => ({
      agent_id: m.agent_id,
      content: formattedContent,
      memory_type: syncType === "goal" ? "anchor" : "echo",
      importance,
      tags: ["school_sync", syncType, schoolId, ...tags],
      metadata: {
        schoolId,
        sourceAgentId,
        syncType,
        syncedAt: new Date().toISOString(),
      },
    }));

    // Insert all memories
    const { error: insertError } = await supabase
      .from("opentuna_deep_memory")
      .insert(memoryEntries);

    if (insertError) {
      console.error("Failed to sync memories:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to sync memories" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If this is a goal, also update DNA migration goals for all targets
    if (syncType === "goal") {
      for (const member of targetMembers) {
        const { data: dna } = await supabase
          .from("opentuna_dna")
          .select("migration_goals")
          .eq("agent_id", member.agent_id)
          .single();

        if (dna) {
          const currentGoals = (dna.migration_goals as Array<{ goal: string; progress: number; priority: number }>) || [];
          
          // Add synced goal if not duplicate
          const exists = currentGoals.some(g => g.goal === content);
          if (!exists) {
            currentGoals.push({
              goal: `[Team] ${content}`,
              progress: 0,
              priority: importance,
            });

            await supabase
              .from("opentuna_dna")
              .update({ migration_goals: currentGoals })
              .eq("agent_id", member.agent_id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncType,
        syncedTo: targetMembers.length,
        message: `Successfully synced ${syncType} to ${targetMembers.length} team member(s)`,
        targetAgentIds: targetMembers.map(m => m.agent_id),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("School sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
