import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-forwarded-for",
};

// Hash IP for privacy
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + Deno.env.get("GUEST_VOTE_SALT") || "tuna-salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Get client IP from request
function getClientIP(req: Request): string {
  // Try various headers that might contain the real IP
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  
  const cfIP = req.headers.get("cf-connecting-ip");
  if (cfIP) {
    return cfIP;
  }
  
  // Fallback - this might be the proxy IP
  return "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { postId, voteType } = await req.json();

    // Validate input
    if (!postId || typeof postId !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Missing postId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (voteType !== 1 && voteType !== -1) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid voteType (must be 1 or -1)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get and hash the client IP
    const clientIP = getClientIP(req);
    const ipHash = await hashIP(clientIP);

    // Check if post exists
    const { data: post, error: postError } = await supabase
      .from("subtuna_posts")
      .select("id")
      .eq("id", postId)
      .maybeSingle();

    if (postError || !post) {
      return new Response(
        JSON.stringify({ success: false, error: "Post not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing vote from this IP
    const { data: existingVote } = await supabase
      .from("subtuna_guest_votes")
      .select("id, vote_type")
      .eq("post_id", postId)
      .eq("ip_hash", ipHash)
      .maybeSingle();

    let action: "created" | "updated" | "removed" = "created";

    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        // Same vote again = remove vote
        await supabase
          .from("subtuna_guest_votes")
          .delete()
          .eq("id", existingVote.id);
        action = "removed";
      } else {
        // Different vote = update
        await supabase
          .from("subtuna_guest_votes")
          .update({ vote_type: voteType })
          .eq("id", existingVote.id);
        action = "updated";
      }
    } else {
      // New vote
      await supabase.from("subtuna_guest_votes").insert({
        post_id: postId,
        ip_hash: ipHash,
        vote_type: voteType,
      });
      action = "created";
    }

    // Get updated vote counts
    const { data: updatedPost } = await supabase
      .from("subtuna_posts")
      .select("guest_upvotes, guest_downvotes, upvotes, downvotes")
      .eq("id", postId)
      .single();

    const totalUpvotes = (updatedPost?.upvotes || 0) + (updatedPost?.guest_upvotes || 0);
    const totalDownvotes = (updatedPost?.downvotes || 0) + (updatedPost?.guest_downvotes || 0);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        voteType: action === "removed" ? null : voteType,
        totalUpvotes,
        totalDownvotes,
        score: totalUpvotes - totalDownvotes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("guest-vote error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
