import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowed commands in sandbox mode
const ALLOWED_COMMANDS = [
  'echo',
  'date',
  'whoami',
  'pwd',
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'grep',
  'sort',
  'uniq',
  'tr',
  'cut',
  'awk',
  'sed',
  'jq',
  'curl',
  'wget',
  'node',
  'deno',
  'python3',
  'pip',
];

// Commands that are never allowed
const BLOCKED_COMMANDS = [
  'rm',
  'dd',
  'mkfs',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
  'kill',
  'killall',
  'pkill',
  'chmod',
  'chown',
  'chgrp',
  'passwd',
  'useradd',
  'userdel',
  'groupadd',
  'groupdel',
  'mount',
  'umount',
  'fdisk',
  'parted',
  'sudo',
  'su',
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { agentId, command, timeout = 30000, env = {} } = await req.json();

    if (!agentId || !command) {
      return new Response(
        JSON.stringify({ error: "agentId and command are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify agent exists
    const { data: agent, error: agentError } = await supabase
      .from('opentuna_agents')
      .select('id, name, sandbox_type, total_fin_calls')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the command to check if it's allowed
    const commandParts = command.trim().split(/\s+/);
    const baseCommand = commandParts[0].replace(/^\.\//, '').replace(/^\/.*\//, '');

    // Check for blocked commands
    if (BLOCKED_COMMANDS.some(blocked => command.includes(blocked))) {
      await supabase.from('opentuna_fin_executions').insert({
        agent_id: agentId,
        fin_name: 'fin_bash',
        params: { command: command.slice(0, 100) },
        params_hash: await hashParams({ command }),
        success: false,
        error_message: 'Command contains blocked operations',
      });

      return new Response(
        JSON.stringify({ 
          error: "Command contains blocked operations",
          blocked: true,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // In restricted sandbox, only allow specific commands
    if (agent.sandbox_type === 'restricted') {
      if (!ALLOWED_COMMANDS.includes(baseCommand)) {
        await supabase.from('opentuna_fin_executions').insert({
          agent_id: agentId,
          fin_name: 'fin_bash',
          params: { command: command.slice(0, 100) },
          params_hash: await hashParams({ command }),
          success: false,
          error_message: `Command not allowed in restricted sandbox: ${baseCommand}`,
        });

        return new Response(
          JSON.stringify({ 
            error: `Command not allowed in restricted sandbox: ${baseCommand}`,
            allowedCommands: ALLOWED_COMMANDS,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Simulate command execution
    // In production, this would run in a real Docker container
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      // Safe simulated execution for demo purposes
      if (baseCommand === 'echo') {
        stdout = commandParts.slice(1).join(' ').replace(/"/g, '').replace(/'/g, '');
      } else if (baseCommand === 'date') {
        stdout = new Date().toISOString();
      } else if (baseCommand === 'whoami') {
        stdout = `agent-${agentId.slice(0, 8)}`;
      } else if (baseCommand === 'pwd') {
        stdout = '/home/agent/workspace';
      } else if (baseCommand === 'ls') {
        stdout = 'README.md\nconfig.json\nsrc/\ndata/';
      } else {
        // For other commands, provide a helpful message
        stdout = `[Sandbox] Command '${baseCommand}' would execute here in a real Docker environment.\nOutput would appear in this response.`;
      }
    } catch (execError) {
      stderr = execError.message;
      exitCode = 1;
    }

    const executionTime = Date.now() - startTime;

    // Log execution
    await supabase.from('opentuna_fin_executions').insert({
      agent_id: agentId,
      fin_name: 'fin_bash',
      params: { command: command.slice(0, 200) },
      params_hash: await hashParams({ command }),
      success: exitCode === 0,
      execution_time_ms: executionTime,
      result_summary: exitCode === 0 ? stdout.slice(0, 100) : stderr.slice(0, 100),
      error_message: exitCode !== 0 ? stderr : null,
    });

    // Update agent stats
    await supabase.from('opentuna_agents')
      .update({ 
        total_fin_calls: agent.total_fin_calls + 1,
        last_active_at: new Date().toISOString()
      })
      .eq('id', agentId);

    console.log(`fin_bash: Executed '${command.slice(0, 50)}' for agent ${agentId} (exit: ${exitCode})`);

    return new Response(
      JSON.stringify({
        success: exitCode === 0,
        command,
        stdout,
        stderr,
        exitCode,
        executionTimeMs: executionTime,
        sandbox: agent.sandbox_type,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fin_bash error:", error);
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
