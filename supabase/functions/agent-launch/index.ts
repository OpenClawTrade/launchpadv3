import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Hash API key using HMAC-SHA256
async function hashApiKey(apiKey: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(apiKey);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Check if agent has launched in last 24 hours
function isWithin24Hours(lastLaunchAt: string | null): boolean {
  if (!lastLaunchAt) return false;
  const lastLaunch = new Date(lastLaunchAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - lastLaunch.getTime()) / (1000 * 60 * 60);
  return hoursDiff < 24;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || !apiKey.startsWith("tna_live_")) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid API key required in x-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { name, symbol, description, image, website, twitter, telegram, discord, sourcePlatform, sourcePostUrl } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.length < 1 || name.length > 32) {
      return new Response(
        JSON.stringify({ success: false, error: "Name is required (1-32 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!symbol || typeof symbol !== "string" || symbol.length < 1 || symbol.length > 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Symbol is required (1-10 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!image || typeof image !== "string" || !image.startsWith("http")) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid image URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiEncryptionKey = Deno.env.get("API_ENCRYPTION_KEY");

    if (!apiEncryptionKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify API key and get agent
    const apiKeyHash = await hashApiKey(apiKey, apiEncryptionKey);

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("api_key_hash", apiKeyHash)
      .eq("status", "active")
      .maybeSingle();

    if (!agent) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or inactive API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit (1 launch per 24 hours)
    if (isWithin24Hours(agent.last_launch_at)) {
      const lastLaunch = new Date(agent.last_launch_at);
      const nextAllowed = new Date(lastLaunch.getTime() + 24 * 60 * 60 * 1000);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Rate limit exceeded: 1 launch per 24 hours",
          nextLaunchAllowedAt: nextAllowed.toISOString(),
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agent-launch] Agent ${agent.name} launching token: ${name} (${symbol})`);

    // Create the token in fun_tokens with agent attribution
    const { data: token, error: tokenError } = await supabase
      .from("fun_tokens")
      .insert({
        name: name.trim(),
        ticker: symbol.trim().toUpperCase(),
        description: description?.substring(0, 500) || null,
        image_url: image,
        website_url: website || null,
        twitter_url: twitter || null,
        telegram_url: telegram || null,
        discord_url: discord || null,
        creator_wallet: agent.wallet_address,
        agent_id: agent.id,
        agent_fee_share_bps: 8000, // 80% to agent
        status: "pending", // Will be activated after on-chain creation
        chain: "solana",
      })
      .select()
      .single();

    if (tokenError) {
      console.error("[agent-launch] Failed to create token:", tokenError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create token record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create agent_tokens link
    const { error: linkError } = await supabase
      .from("agent_tokens")
      .insert({
        agent_id: agent.id,
        fun_token_id: token.id,
        source_platform: sourcePlatform || "api",
        source_post_url: sourcePostUrl || null,
      });

    if (linkError) {
      console.error("[agent-launch] Failed to link agent token:", linkError);
    }

    // Update agent stats
    await supabase
      .from("agents")
      .update({
        total_tokens_launched: (agent.total_tokens_launched || 0) + 1,
        launches_today: (agent.launches_today || 0) + 1,
        last_launch_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", agent.id);

    // Create a job for the backend to process the actual on-chain creation
    const { data: job, error: jobError } = await supabase
      .from("fun_token_jobs")
      .insert({
        name: name.trim(),
        ticker: symbol.trim().toUpperCase(),
        description: description?.substring(0, 500) || null,
        image_url: image,
        website_url: website || null,
        twitter_url: twitter || null,
        creator_wallet: agent.wallet_address,
        fun_token_id: token.id,
        status: "pending",
      })
      .select()
      .single();

    if (jobError) {
      console.error("[agent-launch] Failed to create job:", jobError);
    }

    console.log(`[agent-launch] ✅ Token created: ${token.id} for agent ${agent.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        agent: agent.name,
        tokenId: token.id,
        jobId: job?.id,
        name: token.name,
        symbol: token.ticker,
        status: "pending",
        message: "Token is being created on-chain. Poll /agent-me or check the trade URL in ~30 seconds.",
        tradeUrl: `https://tuna.fun/launchpad/${token.id}`,
        rewards: {
          agentShare: "80%",
          platformShare: "20%",
          agentWallet: agent.wallet_address,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 202,
      }
    );
  } catch (error) {
    console.error("agent-launch error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
