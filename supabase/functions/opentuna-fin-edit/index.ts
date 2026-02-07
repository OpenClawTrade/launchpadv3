import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simulated file system for agent sandboxes
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

    const { agentId, path, search, replace, expectedMatches = 1 } = await req.json();

    if (!agentId || !path || search === undefined || replace === undefined) {
      return new Response(
        JSON.stringify({ error: "agentId, path, search, and replace are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify agent exists
    const { data: agent, error: agentError } = await supabase
      .from('opentuna_agents')
      .select('id, name, total_fin_calls')
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
    const content = agentFS.get(normalizedPath);

    if (content === undefined) {
      await supabase.from('opentuna_fin_executions').insert({
        agent_id: agentId,
        fin_name: 'fin_edit',
        params: { path, searchLength: search.length },
        params_hash: await hashParams({ path, search }),
        success: false,
        error_message: 'File not found',
      });

      return new Response(
        JSON.stringify({ error: `File not found: ${normalizedPath}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count matches (EXACT string match, no regex)
    let matchCount = 0;
    let index = 0;
    while ((index = content.indexOf(search, index)) !== -1) {
      matchCount++;
      index += search.length;
    }

    // Validate expected matches
    if (matchCount === 0) {
      await supabase.from('opentuna_fin_executions').insert({
        agent_id: agentId,
        fin_name: 'fin_edit',
        params: { path, searchLength: search.length },
        params_hash: await hashParams({ path, search }),
        success: false,
        error_message: 'Search string not found',
      });

      return new Response(
        JSON.stringify({ 
          error: "Search string not found in file",
          hint: "Use fin_read first to see the exact file contents",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (expectedMatches !== null && matchCount !== expectedMatches) {
      await supabase.from('opentuna_fin_executions').insert({
        agent_id: agentId,
        fin_name: 'fin_edit',
        params: { path, searchLength: search.length },
        params_hash: await hashParams({ path, search }),
        success: false,
        error_message: `Expected ${expectedMatches} matches, found ${matchCount}`,
      });

      return new Response(
        JSON.stringify({ 
          error: `Match count mismatch. Expected ${expectedMatches}, found ${matchCount}`,
          foundMatches: matchCount,
          hint: "Set expectedMatches to null to replace all occurrences",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Perform replacement
    const newContent = content.replaceAll(search, replace);
    agentFS.set(normalizedPath, newContent);

    // Log execution
    await supabase.from('opentuna_fin_executions').insert({
      agent_id: agentId,
      fin_name: 'fin_edit',
      params: { path, searchLength: search.length, replaceLength: replace.length, matchCount },
      params_hash: await hashParams({ path, search }),
      success: true,
      result_summary: `Replaced ${matchCount} occurrences`,
    });

    // Update agent stats
    await supabase.from('opentuna_agents')
      .update({ 
        total_fin_calls: agent.total_fin_calls + 1,
        last_active_at: new Date().toISOString()
      })
      .eq('id', agentId);

    console.log(`fin_edit: Replaced ${matchCount} occurrences in ${normalizedPath} for agent ${agentId}`);

    return new Response(
      JSON.stringify({
        success: true,
        path: normalizedPath,
        replacements: matchCount,
        oldSize: content.length,
        newSize: newContent.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fin_edit error:", error);
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
