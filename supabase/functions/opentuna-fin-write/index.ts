import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simulated file system for agent sandboxes
// This is shared with fin_read - in production would be a proper storage service
const virtualFS: Map<string, Map<string, string>> = new Map();

function getAgentFS(agentId: string): Map<string, string> {
  if (!virtualFS.has(agentId)) {
    const fs = new Map<string, string>();
    fs.set('/README.md', `# Agent Sandbox\n\nThis is your agent's working directory.`);
    fs.set('/config.json', JSON.stringify({ version: 1, created: new Date().toISOString() }, null, 2));
    virtualFS.set(agentId, fs);
  }
  return virtualFS.get(agentId)!;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { agentId, path, content, encoding = 'utf8', createParents = true } = await req.json();

    if (!agentId || !path || content === undefined) {
      return new Response(
        JSON.stringify({ error: "agentId, path, and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify agent exists
    const { data: agent, error: agentError } = await supabase
      .from('opentuna_agents')
      .select('id, name, status, total_fin_calls')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize path
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Decode content if base64
    let fileContent = content;
    if (encoding === 'base64') {
      try {
        fileContent = atob(content);
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid base64 content" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check file size limit (1MB)
    if (fileContent.length > 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "File too large. Maximum 1MB allowed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentFS = getAgentFS(agentId);
    const existed = agentFS.has(normalizedPath);

    // Write the file
    agentFS.set(normalizedPath, fileContent);

    // Log execution
    await supabase.from('opentuna_fin_executions').insert({
      agent_id: agentId,
      fin_name: 'fin_write',
      params: { path, encoding, size: fileContent.length },
      params_hash: await hashParams({ path }),
      success: true,
      result_summary: existed ? `Updated ${normalizedPath}` : `Created ${normalizedPath}`,
    });

    // Update agent stats
    await supabase.from('opentuna_agents')
      .update({ 
        total_fin_calls: agent.total_fin_calls + 1,
        last_active_at: new Date().toISOString()
      })
      .eq('id', agentId);

    // Store memory if this is a significant file
    if (normalizedPath.endsWith('.ts') || normalizedPath.endsWith('.json') || normalizedPath.endsWith('.md')) {
      await supabase.from('opentuna_deep_memory').insert({
        agent_id: agentId,
        content: `${existed ? 'Updated' : 'Created'} file: ${normalizedPath} (${fileContent.length} bytes)`,
        memory_type: 'surface',
        importance: 4,
        tags: ['file', 'write'],
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      });
    }

    console.log(`fin_write: ${existed ? 'Updated' : 'Created'} ${normalizedPath} for agent ${agentId}`);

    return new Response(
      JSON.stringify({
        success: true,
        action: existed ? 'updated' : 'created',
        path: normalizedPath,
        size: fileContent.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fin_write error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function hashParams(params: Record<string, any>): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(params));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
