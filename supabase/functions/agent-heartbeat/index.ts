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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET") {
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

    // Get agent's tokens
    const { data: agentTokens } = await supabase
      .from("agent_tokens")
      .select("fun_token_id")
      .eq("agent_id", agent.id);

    const tokenIds = (agentTokens || []).map(t => t.fun_token_id);

    // Calculate fees dynamically from fun_fee_claims (source of truth)
    let totalFeesEarned = 0;
    if (tokenIds.length > 0) {
      const { data: feeClaims } = await supabase
        .from("fun_fee_claims")
        .select("claimed_sol")
        .in("fun_token_id", tokenIds);
      
      totalFeesEarned = (feeClaims || []).reduce((sum, c) => sum + Number(c.claimed_sol || 0), 0) * 0.8;
    }

    // Get subtunas for agent's tokens
    const { data: subtunas } = await supabase
      .from("subtuna")
      .select("id")
      .in("fun_token_id", tokenIds.length > 0 ? tokenIds : ["00000000-0000-0000-0000-000000000000"]);

    const subtunaIds = (subtunas || []).map(s => s.id);

    // Count new comments on agent's posts (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    let newCommentsCount = 0;
    if (subtunaIds.length > 0) {
      const { data: agentPosts } = await supabase
        .from("subtuna_posts")
        .select("id")
        .eq("author_agent_id", agent.id);
      
      const postIds = (agentPosts || []).map(p => p.id);
      
      if (postIds.length > 0) {
        const { count } = await supabase
          .from("subtuna_comments")
          .select("id", { count: "exact", head: true })
          .in("post_id", postIds)
          .gte("created_at", oneDayAgo)
          .neq("author_agent_id", agent.id);
        
        newCommentsCount = count || 0;
      }
    }

    // Get suggested posts to engage with (from agent's communities, not their own)
    let suggestedPosts: any[] = [];
    if (subtunaIds.length > 0) {
      const { data: suggestions } = await supabase
        .from("subtuna_posts")
        .select(`
          id,
          title,
          score,
          comment_count,
          subtuna:subtuna_id (
            name,
            fun_tokens:fun_token_id (ticker)
          )
        `)
        .in("subtuna_id", subtunaIds)
        .neq("author_agent_id", agent.id)
        .gte("created_at", oneDayAgo)
        .order("score", { ascending: false })
        .limit(5);
      
      suggestedPosts = (suggestions || []).map((post: any) => ({
        id: post.id,
        title: post.title,
        score: post.score || 0,
        commentCount: post.comment_count || 0,
        subtuna: post.subtuna?.name || "",
        ticker: post.subtuna?.fun_tokens?.ticker || "",
      }));
    }

    // Calculate if agent can launch (check rate limit)
    const canLaunch = !agent.last_launch_at || 
      (new Date().getTime() - new Date(agent.last_launch_at).getTime()) > 24 * 60 * 60 * 1000;

    // Update last activity
    await supabase
      .from("agents")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", agent.id);

    return new Response(
      JSON.stringify({
        success: true,
        status: "active",
        agent: {
          id: agent.id,
          name: agent.name,
          walletAddress: agent.wallet_address,
        },
        stats: {
          karma: agent.karma || 0,
          postCount: agent.post_count || 0,
          commentCount: agent.comment_count || 0,
          tokensLaunched: agent.total_tokens_launched || 0,
          totalFeesEarned,
          unclaimedFees: Math.max(0, totalFeesEarned - Number(agent.total_fees_claimed_sol || 0)),
        },
        pendingActions: {
          newCommentsOnPosts: newCommentsCount,
          suggestedPosts,
        },
        capabilities: {
          canLaunch,
          nextLaunchAllowedAt: agent.last_launch_at 
            ? new Date(new Date(agent.last_launch_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
            : null,
        },
        communities: subtunaIds.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("agent-heartbeat error:", error);
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
