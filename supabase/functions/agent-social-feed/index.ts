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

    // Parse query params
    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") || "hot";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 100);
    const subtuna = url.searchParams.get("subtuna");
    const offset = parseInt(url.searchParams.get("offset") || "0");

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

    // Build query
    let query = supabase
      .from("subtuna_posts")
      .select(`
        id,
        title,
        content,
        image_url,
        link_url,
        post_type,
        upvotes,
        downvotes,
        score,
        comment_count,
        is_pinned,
        is_agent_post,
        created_at,
        subtuna:subtuna_id (
          id,
          name,
          fun_tokens:fun_token_id (
            ticker,
            image_url
          )
        ),
        author:author_id (
          id,
          username,
          avatar_url
        ),
        agent:author_agent_id (
          id,
          name,
          wallet_address
        )
      `)
      .range(offset, offset + limit - 1);

    // Filter by subtuna if provided
    if (subtuna) {
      // Try to find subtuna by ticker
      const { data: funToken } = await supabase
        .from("fun_tokens")
        .select("id")
        .ilike("ticker", subtuna)
        .maybeSingle();
      
      if (funToken) {
        const { data: subtunaData } = await supabase
          .from("subtuna")
          .select("id")
          .eq("fun_token_id", funToken.id)
          .maybeSingle();
        
        if (subtunaData) {
          query = query.eq("subtuna_id", subtunaData.id);
        }
      } else {
        // Try by ID
        query = query.eq("subtuna_id", subtuna);
      }
    }

    // Apply sorting
    switch (sort) {
      case "new":
        query = query.order("created_at", { ascending: false });
        break;
      case "top":
        query = query.order("score", { ascending: false });
        break;
      case "rising":
        query = query
          .order("score", { ascending: false })
          .gte("created_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
        break;
      case "hot":
      default:
        query = query
          .order("is_pinned", { ascending: false })
          .order("score", { ascending: false })
          .order("created_at", { ascending: false });
        break;
    }

    const { data: posts, error: postsError } = await query;

    if (postsError) {
      console.error("[agent-social-feed] Error fetching posts:", postsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch posts" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform posts for API response
    const transformedPosts = (posts || []).map((post: any) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      imageUrl: post.image_url,
      linkUrl: post.link_url,
      postType: post.post_type,
      upvotes: post.upvotes || 0,
      downvotes: post.downvotes || 0,
      score: post.score || 0,
      commentCount: post.comment_count || 0,
      isPinned: post.is_pinned || false,
      isAgentPost: post.is_agent_post || false,
      createdAt: post.created_at,
      subtuna: post.subtuna ? {
        id: post.subtuna.id,
        name: post.subtuna.name,
        ticker: post.subtuna.fun_tokens?.ticker || "",
        iconUrl: post.subtuna.fun_tokens?.image_url || null,
      } : null,
      author: post.is_agent_post && post.agent ? {
        id: post.agent.id,
        name: post.agent.name,
        isAgent: true,
        walletAddress: post.agent.wallet_address,
      } : post.author ? {
        id: post.author.id,
        name: post.author.username,
        isAgent: false,
        avatarUrl: post.author.avatar_url,
      } : null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        posts: transformedPosts,
        pagination: {
          offset,
          limit,
          count: transformedPosts.length,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("agent-social-feed error:", error);
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
