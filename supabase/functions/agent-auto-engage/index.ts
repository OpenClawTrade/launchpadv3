import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "openai/gpt-5-mini";

// Rate limits per agent per 15-minute cycle
const MAX_COMMENTS_PER_CYCLE = 2;
const MAX_VOTES_PER_CYCLE = 3;

interface Agent {
  id: string;
  name: string;
  description: string | null;
  wallet_address: string;
  last_auto_engage_at: string | null;
}

interface Post {
  id: string;
  title: string;
  content: string | null;
  author_agent_id: string | null;
  subtuna_id: string;
  score: number;
  comment_count: number;
  created_at: string;
  subtuna: {
    name: string;
    fun_token_id: string;
  } | null;
}

interface Engagement {
  target_id: string;
  engagement_type: string;
}

interface AgentToken {
  fun_token_id: string;
}

interface SubtunaRecord {
  id: string;
}

interface CommentRecord {
  content: string;
}

async function generateAgentResponse(
  agentName: string,
  agentDescription: string | null,
  postTitle: string,
  postContent: string | null,
  existingComments: string[],
  lovableApiKey: string
): Promise<string | null> {
  try {
    const systemPrompt = `You are ${agentName}, an AI agent participating in a crypto community forum called TunaBook. 
${agentDescription ? `Your personality: ${agentDescription}` : "You're helpful, insightful, and occasionally witty."}

Guidelines:
- Keep responses SHORT (1-3 sentences max)
- Be authentic and engaging, not generic
- Reference specific points from the post when relevant
- Use crypto/meme culture naturally (not forced)
- Occasionally use emojis but don't overdo it
- Never be spammy or promotional
- If the post is about a token launch, be supportive but not shill-y`;

    const userPrompt = `Post Title: "${postTitle}"
${postContent ? `Post Content: "${postContent.slice(0, 500)}"` : ""}
${existingComments.length > 0 ? `\nExisting comments:\n${existingComments.slice(0, 3).join("\n")}` : ""}

Write a short, engaging comment on this post. Be natural and authentic.`;

    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      console.error(`AI API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("Error generating AI response:", error);
    return null;
  }
}

// deno-lint-ignore no-explicit-any
async function processAgent(
  supabase: any,
  agent: Agent,
  lovableApiKey: string
): Promise<{ comments: number; votes: number }> {
  const stats = { comments: 0, votes: 0 };

  try {
    // Get SubTunas this agent is associated with (via their tokens)
    const { data: agentTokens } = await supabase
      .from("agent_tokens")
      .select("fun_token_id")
      .eq("agent_id", agent.id);

    const tokenIds = (agentTokens as AgentToken[] | null)?.map((t) => t.fun_token_id) || [];

    // Get SubTunas for agent's tokens
    const { data: agentSubtunas } = await supabase
      .from("subtuna")
      .select("id")
      .in("fun_token_id", tokenIds.length > 0 ? tokenIds : ["none"]);

    const agentSubtunaIds = (agentSubtunas as SubtunaRecord[] | null)?.map((s) => s.id) || [];

    // Get recent posts this agent hasn't engaged with
    const { data: recentPosts } = await supabase
      .from("subtuna_posts")
      .select(`
        id, title, content, author_agent_id, subtuna_id, score, comment_count, created_at,
        subtuna:subtuna_id (name, fun_token_id)
      `)
      .neq("author_agent_id", agent.id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("score", { ascending: false })
      .limit(20);

    const posts = recentPosts as Post[] | null;

    if (!posts || posts.length === 0) {
      console.log(`[${agent.name}] No recent posts to engage with`);
      return stats;
    }

    // Check what this agent has already engaged with
    const { data: existingEngagements } = await supabase
      .from("agent_engagements")
      .select("target_id, engagement_type")
      .eq("agent_id", agent.id)
      .eq("target_type", "post")
      .in("target_id", posts.map((p) => p.id));

    const engagements = existingEngagements as Engagement[] | null;
    const engagedPostIds = new Set(engagements?.map((e) => e.target_id) || []);

    // Filter to posts not yet engaged with
    const unengagedPosts = posts.filter((p) => !engagedPostIds.has(p.id));

    // Prioritize agent's own SubTunas
    const ownCommunityPosts = unengagedPosts.filter((p) =>
      agentSubtunaIds.includes(p.subtuna_id)
    );
    const otherPosts = unengagedPosts.filter(
      (p) => !agentSubtunaIds.includes(p.subtuna_id)
    );

    const postsToEngage = [...ownCommunityPosts, ...otherPosts].slice(0, 5);

    for (const post of postsToEngage) {
      if (stats.comments >= MAX_COMMENTS_PER_CYCLE) break;

      // 70% chance to comment (add some randomness)
      if (Math.random() > 0.7) continue;

      // Get existing comments for context
      const { data: existingComments } = await supabase
        .from("subtuna_comments")
        .select("content")
        .eq("post_id", post.id)
        .order("created_at", { ascending: false })
        .limit(5);

      const comments = existingComments as CommentRecord[] | null;
      const commentTexts = comments?.map((c) => `- ${c.content}`) || [];

      // Generate AI response
      const response = await generateAgentResponse(
        agent.name,
        agent.description,
        post.title,
        post.content,
        commentTexts,
        lovableApiKey
      );

      if (!response) continue;

      // Insert comment
      const { error: commentError } = await supabase
        .from("subtuna_comments")
        .insert({
          post_id: post.id,
          author_agent_id: agent.id,
          content: response,
          is_agent_comment: true,
        });

      if (commentError) {
        console.error(`[${agent.name}] Comment error:`, commentError);
        continue;
      }

      // Record engagement
      await supabase.from("agent_engagements").insert({
        agent_id: agent.id,
        target_type: "post",
        target_id: post.id,
        engagement_type: "comment",
      });

      stats.comments++;
      console.log(`[${agent.name}] Commented on post: ${post.title.slice(0, 30)}...`);

      // Small delay between comments
      await new Promise((r) => setTimeout(r, 500));
    }

    // Vote on some posts (simpler, no AI needed)
    const unvotedPosts = unengagedPosts.filter(
      (p) => !engagedPostIds.has(p.id) || 
        !engagements?.some((e) => e.target_id === p.id && e.engagement_type === "vote")
    );

    for (const post of unvotedPosts.slice(0, MAX_VOTES_PER_CYCLE)) {
      if (stats.votes >= MAX_VOTES_PER_CYCLE) break;

      // 80% upvote, 20% skip
      const shouldUpvote = Math.random() < 0.8;
      if (!shouldUpvote) continue;

      // Record the engagement intent (actual voting handled separately)
      await supabase.from("agent_engagements").insert({
        agent_id: agent.id,
        target_type: "post",
        target_id: post.id,
        engagement_type: "vote",
      });

      stats.votes++;
    }

    // Update agent's last auto-engage time
    await supabase
      .from("agents")
      .update({ last_auto_engage_at: new Date().toISOString() })
      .eq("id", agent.id);

  } catch (error) {
    console.error(`[${agent.name}] Error processing:`, error);
  }

  return stats;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active agents that haven't engaged recently (15 min cooldown)
    const cooldownTime = new Date(Date.now() - 14 * 60 * 1000).toISOString();

    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("id, name, description, wallet_address, last_auto_engage_at")
      .eq("status", "active")
      .or(`last_auto_engage_at.is.null,last_auto_engage_at.lt.${cooldownTime}`)
      .limit(10);

    if (agentsError) {
      console.error("Error fetching agents:", agentsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch agents" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentList = agents as Agent[] | null;

    if (!agentList || agentList.length === 0) {
      console.log("No agents ready for auto-engagement");
      return new Response(
        JSON.stringify({ success: true, message: "No agents ready", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${agentList.length} agents for auto-engagement`);

    let totalComments = 0;
    let totalVotes = 0;

    for (const agent of agentList) {
      const stats = await processAgent(supabase, agent, lovableApiKey);
      totalComments += stats.comments;
      totalVotes += stats.votes;
    }

    console.log(`Auto-engage complete: ${totalComments} comments, ${totalVotes} votes`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: agentList.length,
        totalComments,
        totalVotes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("agent-auto-engage error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
