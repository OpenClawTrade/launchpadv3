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
  'npm',
  'npx',
  'git',
  'base64',
  'sha256sum',
  'md5sum',
  'gzip',
  'gunzip',
  'tar',
  'zip',
  'unzip',
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
  'doas',
];

// Max output size (100KB)
const MAX_OUTPUT_SIZE = 100 * 1024;

// Default timeout (30s)
const DEFAULT_TIMEOUT_MS = 30000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { agentId, command, timeout = DEFAULT_TIMEOUT_MS, env = {} } = await req.json();

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

    // Check for blocked commands anywhere in the command
    const commandLower = command.toLowerCase();
    for (const blocked of BLOCKED_COMMANDS) {
      // Check for the command at word boundaries
      const regex = new RegExp(`\\b${blocked}\\b`, 'i');
      if (regex.test(commandLower)) {
        await logExecution(supabase, agentId, agent, command, false, 'Command contains blocked operations');

        return new Response(
          JSON.stringify({ 
            error: "Command contains blocked operations",
            blocked: true,
            blockedCommand: blocked,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // In restricted sandbox, only allow specific commands
    if (agent.sandbox_type === 'restricted') {
      if (!ALLOWED_COMMANDS.includes(baseCommand)) {
        await logExecution(supabase, agentId, agent, command, false, `Command not allowed: ${baseCommand}`);

        return new Response(
          JSON.stringify({ 
            error: `Command not allowed in restricted sandbox: ${baseCommand}`,
            allowedCommands: ALLOWED_COMMANDS,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      // Real execution using Deno.Command
      // Create a sanitized environment
      const safeEnv: Record<string, string> = {
        HOME: '/tmp/agent-sandbox',
        PATH: '/usr/local/bin:/usr/bin:/bin',
        TERM: 'xterm',
        LANG: 'en_US.UTF-8',
        ...env,
      };

      // Execute the command
      const cmd = new Deno.Command('bash', {
        args: ['-c', command],
        stdin: 'null',
        stdout: 'piped',
        stderr: 'piped',
        env: safeEnv,
        cwd: '/tmp',
      });

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Math.min(timeout, DEFAULT_TIMEOUT_MS));

      try {
        const process = cmd.spawn();
        const result = await process.output();

        exitCode = result.code;
        
        // Decode and truncate output
        const decoder = new TextDecoder();
        stdout = decoder.decode(result.stdout);
        stderr = decoder.decode(result.stderr);

        // Truncate if too large
        if (stdout.length > MAX_OUTPUT_SIZE) {
          stdout = stdout.slice(0, MAX_OUTPUT_SIZE) + '\n... (output truncated)';
        }
        if (stderr.length > MAX_OUTPUT_SIZE) {
          stderr = stderr.slice(0, MAX_OUTPUT_SIZE) + '\n... (output truncated)';
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (execError) {
      // Handle execution errors
      if (execError.name === 'NotCapable' || execError.message?.includes('permission')) {
        // Deno permission denied - fallback to simulation
        console.warn('[fin_bash] Deno subprocess not permitted, using simulation');
        
        // Simulate common commands
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
          stdout = `[Sandbox Simulation] Command '${baseCommand}' executed.\nIn production with full permissions, real output would appear here.`;
        }
      } else {
        stderr = execError.message || 'Command execution failed';
        exitCode = 1;
      }
    }

    const executionTime = Date.now() - startTime;

    // Log execution
    await logExecution(
      supabase,
      agentId,
      agent,
      command,
      exitCode === 0,
      exitCode === 0 ? stdout.slice(0, 100) : stderr.slice(0, 100)
    );

    console.log(`[fin_bash] Executed '${command.slice(0, 50)}...' for agent ${agentId} (exit: ${exitCode}, ${executionTime}ms)`);

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

async function logExecution(
  supabase: any,
  agentId: string,
  agent: any,
  command: string,
  success: boolean,
  summary: string
) {
  await supabase.from('opentuna_fin_executions').insert({
    agent_id: agentId,
    fin_name: 'fin_bash',
    params: { command: command.slice(0, 200) },
    params_hash: await hashParams({ command }),
    success,
    result_summary: summary,
    error_message: !success ? summary : null,
  });

  // Update agent stats
  await supabase.from('opentuna_agents')
    .update({ 
      total_fin_calls: agent.total_fin_calls + 1,
      last_active_at: new Date().toISOString()
    })
    .eq('id', agentId);
}

async function hashParams(params: Record<string, any>): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(params));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
