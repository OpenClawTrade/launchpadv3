import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const SUPPORTED_EVENTS = [
  "token.created",
  "token.graduated",
  "trade.executed",
  "fees.accumulated",
];

interface WebhookCreateRequest {
  url: string;
  events: string[];
}

interface WebhookUpdateRequest {
  webhookId: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing x-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify API key using RPC
    const { data: verifyData, error: verifyError } = await supabase.rpc("verify_api_key", {
      p_api_key: apiKey,
    });

    if (verifyError || !verifyData?.is_valid) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiAccountId = verifyData.account_id as string;
    const url = new URL(req.url);

    // Handle different HTTP methods
    switch (req.method) {
      case "GET":
        return await handleList(supabase, apiAccountId);
      
      case "POST":
        return await handleCreate(req, supabase, apiAccountId);
      
      case "PUT":
        return await handleUpdate(req, supabase, apiAccountId);
      
      case "DELETE": {
        const webhookId = url.searchParams.get("id");
        if (!webhookId) {
          return new Response(
            JSON.stringify({ error: "Missing webhook id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return await handleDelete(supabase, apiAccountId, webhookId);
      }
      
      default:
        return new Response(
          JSON.stringify({ error: "Method not allowed" }),
          { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("[api-webhooks] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// deno-lint-ignore no-explicit-any
async function handleList(
  supabase: any,
  apiAccountId: string
) {
  const { data, error } = await supabase.rpc("backend_manage_webhook", {
    p_api_account_id: apiAccountId,
    p_action: "list",
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to list webhooks" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      webhooks: data?.webhooks || [],
      supportedEvents: SUPPORTED_EVENTS,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// deno-lint-ignore no-explicit-any
async function handleCreate(
  req: Request,
  supabase: any,
  apiAccountId: string
) {
  const body: WebhookCreateRequest = await req.json();

  // Validate URL
  if (!body.url) {
    return new Response(
      JSON.stringify({ error: "Missing webhook URL" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    new URL(body.url);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid webhook URL" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate events
  if (!body.events || body.events.length === 0) {
    return new Response(
      JSON.stringify({ error: "At least one event is required", supportedEvents: SUPPORTED_EVENTS }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const invalidEvents = body.events.filter((e) => !SUPPORTED_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    return new Response(
      JSON.stringify({ 
        error: `Invalid events: ${invalidEvents.join(", ")}`,
        supportedEvents: SUPPORTED_EVENTS 
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Generate webhook secret
  const secret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

  const { data, error } = await supabase.rpc("backend_manage_webhook", {
    p_api_account_id: apiAccountId,
    p_action: "create",
    p_url: body.url,
    p_events: body.events,
    p_secret: secret,
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to create webhook" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      webhookId: data?.webhook_id,
      secret: secret,
      note: "Store this secret securely - it won't be shown again. Use it to verify webhook signatures.",
    }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// deno-lint-ignore no-explicit-any
async function handleUpdate(
  req: Request,
  supabase: any,
  apiAccountId: string
) {
  const body: WebhookUpdateRequest = await req.json();

  if (!body.webhookId) {
    return new Response(
      JSON.stringify({ error: "Missing webhookId" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate URL if provided
  if (body.url) {
    try {
      new URL(body.url);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid webhook URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Validate events if provided
  if (body.events) {
    const invalidEvents = body.events.filter((e) => !SUPPORTED_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid events: ${invalidEvents.join(", ")}`,
          supportedEvents: SUPPORTED_EVENTS 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const { error } = await supabase.rpc("backend_manage_webhook", {
    p_api_account_id: apiAccountId,
    p_action: "update",
    p_webhook_id: body.webhookId,
    p_url: body.url,
    p_events: body.events,
    p_is_active: body.isActive,
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to update webhook" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// deno-lint-ignore no-explicit-any
async function handleDelete(
  supabase: any,
  apiAccountId: string,
  webhookId: string
) {
  const { error } = await supabase.rpc("backend_manage_webhook", {
    p_api_account_id: apiAccountId,
    p_action: "delete",
    p_webhook_id: webhookId,
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to delete webhook" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
