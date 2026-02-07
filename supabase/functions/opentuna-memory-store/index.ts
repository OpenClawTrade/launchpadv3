import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lovable AI for embedding generation
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/embeddings";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      agentId,
      content,
      memoryType = 'surface',
      importance = 5,
      tags = [],
      metadata = {},
    } = await req.json();

    if (!agentId || !content) {
      return new Response(
        JSON.stringify({ error: "agentId and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate memory type
    const validTypes = ['surface', 'anchor', 'echo', 'pattern'];
    if (!validTypes.includes(memoryType)) {
      return new Response(
        JSON.stringify({ error: `Invalid memoryType. Must be one of: ${validTypes.join(', ')}` }),
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

    // Calculate expiration based on memory type
    let expiresAt: string | null = null;
    switch (memoryType) {
      case 'surface':
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
        break;
      case 'echo':
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
        break;
      case 'anchor':
      case 'pattern':
        expiresAt = null; // Permanent
        break;
    }

    // Generate embedding if API key available
    let embedding: number[] | null = null;
    
    if (lovableApiKey) {
      try {
        // Note: This would require an embeddings endpoint
        // For now, we'll skip embedding and rely on keyword search
        // In production, you'd call an embeddings API here
        console.log("Embedding generation skipped - using keyword search fallback");
      } catch (embeddingError) {
        console.error("Embedding generation failed:", embeddingError);
      }
    }

    // Store the memory
    const memoryData: any = {
      agent_id: agentId,
      content,
      memory_type: memoryType,
      importance: Math.min(10, Math.max(1, importance)),
      tags,
      metadata,
      expires_at: expiresAt,
    };

    // Only add embedding if we have one (requires pgvector)
    // For now, we store without embedding and use keyword search
    
    const { data: memory, error: memoryError } = await supabase
      .from('opentuna_deep_memory')
      .insert(memoryData)
      .select()
      .single();

    if (memoryError) {
      console.error("Memory store error:", memoryError);
      return new Response(
        JSON.stringify({ error: "Failed to store memory", details: memoryError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Memory stored for ${agent.name}: ${memoryType} (importance: ${importance})`);

    return new Response(
      JSON.stringify({
        success: true,
        memoryId: memory.id,
        memoryType,
        importance,
        expiresAt,
        hasEmbedding: !!embedding,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Memory store error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
