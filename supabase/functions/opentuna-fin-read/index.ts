import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simulated file system for agent sandboxes
// In production, this would interface with a real sandboxed file system
const virtualFS: Map<string, Map<string, string>> = new Map();

function getAgentFS(agentId: string): Map<string, string> {
  if (!virtualFS.has(agentId)) {
    const fs = new Map<string, string>();
    // Default files for new agents
    fs.set('/README.md', `# Agent Sandbox\n\nThis is your agent's working directory.\nYou can read, write, and edit files here.`);
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

    const { agentId, path, encoding = 'text' } = await req.json();

    if (!agentId || !path) {
      return new Response(
        JSON.stringify({ error: "agentId and path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify agent exists and has permission
    const { data: agent, error: agentError } = await supabase
      .from('opentuna_agents')
      .select('id, name, status')
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
    
    const agentFS = getAgentFS(agentId);

    // Handle directory listing (tree mode)
    if (encoding === 'tree') {
      const files: string[] = [];
      for (const filePath of agentFS.keys()) {
        if (filePath.startsWith(normalizedPath) || normalizedPath === '/') {
          files.push(filePath);
        }
      }
      
      // Log fin execution
      await supabase.from('opentuna_fin_executions').insert({
        agent_id: agentId,
        fin_name: 'fin_read',
        params: { path, encoding },
        params_hash: await hashParams({ path, encoding }),
        success: true,
        result_summary: `Listed ${files.length} files`,
      });

      // Update agent stats
      await supabase.from('opentuna_agents')
        .update({ 
          total_fin_calls: agent.total_fin_calls + 1,
          last_active_at: new Date().toISOString()
        })
        .eq('id', agentId);

      return new Response(
        JSON.stringify({
          success: true,
          type: 'directory',
          path: normalizedPath,
          files: files.sort(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read file content
    const content = agentFS.get(normalizedPath);

    if (content === undefined) {
      await supabase.from('opentuna_fin_executions').insert({
        agent_id: agentId,
        fin_name: 'fin_read',
        params: { path, encoding },
        params_hash: await hashParams({ path, encoding }),
        success: false,
        error_message: 'File not found',
      });

      return new Response(
        JSON.stringify({ error: `File not found: ${normalizedPath}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log successful execution
    await supabase.from('opentuna_fin_executions').insert({
      agent_id: agentId,
      fin_name: 'fin_read',
      params: { path, encoding },
      params_hash: await hashParams({ path, encoding }),
      success: true,
      result_summary: `Read ${content.length} bytes`,
    });

    // Update agent stats
    await supabase.from('opentuna_agents')
      .update({ 
        total_fin_calls: (agent as any).total_fin_calls + 1,
        last_active_at: new Date().toISOString()
      })
      .eq('id', agentId);

    // Handle encoding
    let responseContent = content;
    if (encoding === 'base64') {
      responseContent = btoa(content);
    }

    // Add line numbers if requested
    const lines = encoding === 'text' ? content.split('\n').map((line, i) => `${i + 1}: ${line}`) : undefined;

    return new Response(
      JSON.stringify({
        success: true,
        type: 'file',
        path: normalizedPath,
        content: responseContent,
        encoding,
        lines,
        size: content.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fin_read error:", error);
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
