import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simulated browser session state
const browserSessions: Map<string, {
  currentUrl: string;
  pageContent: string;
  screenshots: string[];
  lastAction: string;
}> = new Map();

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
      action,
      url,
      selector,
      text,
      extractSchema,
    } = await req.json();

    if (!agentId || !action) {
      return new Response(
        JSON.stringify({ error: "agentId and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate action
    const validActions = ['navigate', 'click', 'type', 'screenshot', 'extract', 'close'];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify agent exists and check permissions
    const { data: agent, error: agentError } = await supabase
      .from('opentuna_agents')
      .select('id, name, blocked_domains, total_fin_calls')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check domain blocking for navigate action
    if (action === 'navigate' && url) {
      try {
        const urlObj = new URL(url);
        const blockedDomains = agent.blocked_domains || [];
        if (blockedDomains.some((d: string) => urlObj.hostname.includes(d))) {
          return new Response(
            JSON.stringify({ error: `Domain blocked: ${urlObj.hostname}` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid URL" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get or create browser session
    let session = browserSessions.get(agentId);
    if (!session) {
      session = {
        currentUrl: '',
        pageContent: '',
        screenshots: [],
        lastAction: '',
      };
      browserSessions.set(agentId, session);
    }

    let result: any = {};
    const startTime = Date.now();

    // Simulate browser actions
    // In production, this would use Puppeteer or Playwright in a Docker container
    switch (action) {
      case 'navigate':
        if (!url) {
          return new Response(
            JSON.stringify({ error: "url is required for navigate action" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        session.currentUrl = url;
        session.pageContent = `[Simulated page content for ${url}]`;
        result = {
          success: true,
          action: 'navigate',
          url,
          status: 200,
          title: `Page: ${new URL(url).hostname}`,
        };
        break;

      case 'click':
        if (!selector) {
          return new Response(
            JSON.stringify({ error: "selector is required for click action" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = {
          success: true,
          action: 'click',
          selector,
          message: `Clicked element: ${selector}`,
        };
        break;

      case 'type':
        if (!selector || !text) {
          return new Response(
            JSON.stringify({ error: "selector and text are required for type action" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = {
          success: true,
          action: 'type',
          selector,
          textLength: text.length,
          message: `Typed ${text.length} characters into ${selector}`,
        };
        break;

      case 'screenshot':
        // In production, this would capture actual screenshot
        const screenshotId = crypto.randomUUID();
        session.screenshots.push(screenshotId);
        result = {
          success: true,
          action: 'screenshot',
          screenshotId,
          currentUrl: session.currentUrl,
          message: 'Screenshot captured (simulated)',
        };
        break;

      case 'extract':
        // In production, this would extract data from the page
        result = {
          success: true,
          action: 'extract',
          currentUrl: session.currentUrl,
          data: extractSchema ? { /* Would populate based on schema */ } : session.pageContent,
          message: 'Data extracted (simulated)',
        };
        break;

      case 'close':
        browserSessions.delete(agentId);
        result = {
          success: true,
          action: 'close',
          message: 'Browser session closed',
        };
        break;
    }

    const executionTime = Date.now() - startTime;
    session.lastAction = action;

    // Log execution
    await supabase.from('opentuna_fin_executions').insert({
      agent_id: agentId,
      fin_name: 'fin_browse',
      params: { action, url, selector },
      params_hash: await hashParams({ action, url, selector }),
      success: true,
      execution_time_ms: executionTime,
      result_summary: result.message || `${action} completed`,
    });

    // Update agent stats
    await supabase.from('opentuna_agents')
      .update({ 
        total_fin_calls: agent.total_fin_calls + 1,
        last_active_at: new Date().toISOString()
      })
      .eq('id', agentId);

    console.log(`fin_browse: ${action} for agent ${agentId} (${executionTime}ms)`);

    return new Response(
      JSON.stringify({
        ...result,
        executionTimeMs: executionTime,
        sessionActive: browserSessions.has(agentId),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fin_browse error:", error);
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
