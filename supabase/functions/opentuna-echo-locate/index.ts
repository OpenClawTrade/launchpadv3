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
      query,
      limit = 5,
      minImportance = 1,
      memoryTypes,
    } = await req.json();

    if (!agentId || !query) {
      return new Response(
        JSON.stringify({ error: "agentId and query are required" }),
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

    // Build query for keyword-based search
    // In production with pgvector, this would use the opentuna_echo_locate function
    let dbQuery = supabase
      .from('opentuna_deep_memory')
      .select('*')
      .eq('agent_id', agentId)
      .gte('importance', minImportance)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false });

    // Filter by memory types if specified
    if (memoryTypes && memoryTypes.length > 0) {
      dbQuery = dbQuery.in('memory_type', memoryTypes);
    }

    // Get all matching memories
    const { data: allMemories, error: memoriesError } = await dbQuery.limit(100);

    if (memoriesError) {
      console.error("Memory fetch error:", memoriesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch memories", details: memoriesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Simple keyword matching (simulating hybrid search)
    const queryTerms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
    
    const scoredMemories = (allMemories || []).map(memory => {
      const content = memory.content.toLowerCase();
      const tags = (memory.tags || []).join(' ').toLowerCase();
      
      // Calculate keyword match score
      let keywordScore = 0;
      for (const term of queryTerms) {
        if (content.includes(term)) keywordScore += 2;
        if (tags.includes(term)) keywordScore += 1;
      }
      
      // Boost by importance and recency
      const importanceBoost = memory.importance / 10;
      const recencyBoost = Math.max(0, 1 - (Date.now() - new Date(memory.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000));
      
      const combinedScore = keywordScore + importanceBoost + (recencyBoost * 0.5);
      
      return {
        ...memory,
        relevanceScore: combinedScore,
      };
    });

    // Sort by relevance and take top results
    const results = scoredMemories
      .filter(m => m.relevanceScore > 0 || queryTerms.length === 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    // Update recalled_count for returned memories
    const memoryIds = results.map(m => m.id);
    if (memoryIds.length > 0) {
      await supabase.rpc('increment_recalled_count', { memory_ids: memoryIds }).catch(() => {
        // Fallback if RPC doesn't exist - update manually
        memoryIds.forEach(async (id) => {
          await supabase
            .from('opentuna_deep_memory')
            .update({ 
              recalled_count: supabase.raw('recalled_count + 1'),
              last_recalled_at: new Date().toISOString()
            })
            .eq('id', id);
        });
      });
    }

    console.log(`Echo locate for ${agent.name}: "${query}" -> ${results.length} results`);

    return new Response(
      JSON.stringify({
        success: true,
        query,
        results: results.map(r => ({
          id: r.id,
          content: r.content,
          memoryType: r.memory_type,
          importance: r.importance,
          relevanceScore: r.relevanceScore,
          tags: r.tags,
          createdAt: r.created_at,
          recalledCount: r.recalled_count,
        })),
        totalFound: results.length,
        searchMethod: 'keyword', // Would be 'hybrid' with vector embeddings
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Echo locate error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
