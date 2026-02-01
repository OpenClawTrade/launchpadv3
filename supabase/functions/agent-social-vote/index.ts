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
    const { type, id, vote } = body;

    // Validate required fields
    if (!type || !["post", "comment"].includes(type)) {
      return new Response(
        JSON.stringify({ success: false, error: "type must be 'post' or 'comment'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!id || typeof id !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!vote || ![1, -1].includes(vote)) {
      return new Response(
        JSON.stringify({ success: false, error: "vote must be 1 (upvote) or -1 (downvote)" }),
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

    // Use wallet_address as a pseudo user_id for agents
    // We'll create a deterministic UUID from the agent's wallet
    const agentUserId = agent.id;

    if (type === "post") {
      // Verify post exists
      const { data: post } = await supabase
        .from("subtuna_posts")
        .select("id")
        .eq("id", id)
        .maybeSingle();

      if (!post) {
        return new Response(
          JSON.stringify({ success: false, error: "Post not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for existing vote
      const { data: existingVote } = await supabase
        .from("subtuna_votes")
        .select("id, vote_type")
        .eq("post_id", id)
        .eq("user_id", agentUserId)
        .maybeSingle();

      if (existingVote) {
        if (existingVote.vote_type === vote) {
          // Remove vote if same
          await supabase.from("subtuna_votes").delete().eq("id", existingVote.id);
          
          return new Response(
            JSON.stringify({ success: true, action: "removed", voteType: null }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          // Change vote
          await supabase.from("subtuna_votes").update({ vote_type: vote }).eq("id", existingVote.id);
          
          return new Response(
            JSON.stringify({ success: true, action: "changed", voteType: vote }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        // Create new vote
        await supabase.from("subtuna_votes").insert({
          post_id: id,
          user_id: agentUserId,
          vote_type: vote,
        });
        
        return new Response(
          JSON.stringify({ success: true, action: "created", voteType: vote }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 201 }
        );
      }
    } else {
      // Comment vote
      const { data: comment } = await supabase
        .from("subtuna_comments")
        .select("id")
        .eq("id", id)
        .maybeSingle();

      if (!comment) {
        return new Response(
          JSON.stringify({ success: false, error: "Comment not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for existing vote
      const { data: existingVote } = await supabase
        .from("subtuna_comment_votes")
        .select("id, vote_type")
        .eq("comment_id", id)
        .eq("user_id", agentUserId)
        .maybeSingle();

      if (existingVote) {
        if (existingVote.vote_type === vote) {
          // Remove vote
          await supabase.from("subtuna_comment_votes").delete().eq("id", existingVote.id);
          
          return new Response(
            JSON.stringify({ success: true, action: "removed", voteType: null }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          // Change vote
          await supabase.from("subtuna_comment_votes").update({ vote_type: vote }).eq("id", existingVote.id);
          
          return new Response(
            JSON.stringify({ success: true, action: "changed", voteType: vote }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        // Create new vote
        await supabase.from("subtuna_comment_votes").insert({
          comment_id: id,
          user_id: agentUserId,
          vote_type: vote,
        });
        
        return new Response(
          JSON.stringify({ success: true, action: "created", voteType: vote }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 201 }
        );
      }
    }
  } catch (error) {
    console.error("agent-social-vote error:", error);
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
