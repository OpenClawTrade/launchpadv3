// OpenTuna School Delegate - Multi-Agent Task Assignment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DelegateRequest {
  schoolId: string;
  assignedBy: string; // Agent ID of the delegator
  assignedTo?: string; // Agent ID - if null, auto-assign based on specialization
  taskType: string;
  taskPayload: Record<string, unknown>;
  priority?: number;
  deadline?: string;
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
      assignedBy, 
      assignedTo, 
      taskType, 
      taskPayload,
      priority = 5,
      deadline
    }: DelegateRequest = await req.json();

    if (!schoolId || !assignedBy || !taskType || !taskPayload) {
      return new Response(
        JSON.stringify({ error: "schoolId, assignedBy, taskType, and taskPayload are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify school exists
    const { data: school, error: schoolError } = await supabase
      .from("opentuna_schools")
      .select("*, lead_agent_id")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      return new Response(
        JSON.stringify({ error: "School not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify assignedBy is a member of the school
    const { data: assigner } = await supabase
      .from("opentuna_school_members")
      .select("*")
      .eq("school_id", schoolId)
      .eq("agent_id", assignedBy)
      .single();

    if (!assigner) {
      return new Response(
        JSON.stringify({ error: "Delegator is not a member of this school" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine assignee
    let targetAgentId = assignedTo;
    let autoAssigned = false;

    if (!targetAgentId) {
      // Auto-assign based on task type and specialization
      const taskToSpecialization: Record<string, string[]> = {
        trade: ["trading"],
        research: ["research"],
        post: ["social"],
        create: ["creative"],
        analyze: ["research", "trading"],
        engage: ["social"],
      };

      const preferredSpecs = taskToSpecialization[taskType] || [];

      // Find best available member
      const { data: members } = await supabase
        .from("opentuna_school_members")
        .select(`
          agent_id,
          role,
          specialization,
          opentuna_agents!inner(id, status)
        `)
        .eq("school_id", schoolId)
        .neq("agent_id", assignedBy); // Don't assign to self

      if (members && members.length > 0) {
        // Score each member
        const scored = members.map(m => {
          let score = 0;
          
          // Prefer specialists in the required field
          if (m.specialization && preferredSpecs.length > 0) {
            const overlap = (m.specialization as string[]).filter(s => preferredSpecs.includes(s));
            score += overlap.length * 10;
          }
          
          // Prefer assistants for general tasks
          if (m.role === "assistant") score += 2;
          if (m.role === "specialist") score += 5;
          
          return { ...m, score };
        });

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);
        
        if (scored.length > 0) {
          targetAgentId = scored[0].agent_id;
          autoAssigned = true;
        }
      }
    }

    if (!targetAgentId) {
      return new Response(
        JSON.stringify({ error: "No suitable agent found for task assignment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the task
    const { data: task, error: taskError } = await supabase
      .from("opentuna_school_tasks")
      .insert({
        school_id: schoolId,
        assigned_to: targetAgentId,
        assigned_by: assignedBy,
        task_type: taskType,
        task_payload: taskPayload,
        priority,
        deadline: deadline || null,
        status: "pending",
      })
      .select()
      .single();

    if (taskError) {
      console.error("Failed to create task:", taskError);
      return new Response(
        JSON.stringify({ error: "Failed to create task" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store in assignee's memory
    await supabase
      .from("opentuna_deep_memory")
      .insert({
        agent_id: targetAgentId,
        content: `Task delegated: ${taskType}. Priority: ${priority}. Details: ${JSON.stringify(taskPayload).slice(0, 200)}`,
        memory_type: "surface",
        importance: Math.min(priority + 3, 10),
        tags: ["task", "delegation", taskType],
        metadata: { taskId: task.id, schoolId, assignedBy },
      });

    return new Response(
      JSON.stringify({
        success: true,
        task: {
          id: task.id,
          assignedTo: targetAgentId,
          autoAssigned,
          taskType,
          priority,
          status: "pending",
        },
        message: autoAssigned 
          ? `Task auto-assigned to best matching agent`
          : `Task assigned successfully`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("School delegate error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
