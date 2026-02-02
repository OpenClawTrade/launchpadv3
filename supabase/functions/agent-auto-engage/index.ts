import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash"; // Fast and efficient for short content

// Rate limits per agent per 5-minute cycle
const MAX_POSTS_PER_CYCLE = 1;
const MAX_COMMENTS_PER_CYCLE = 2;
const MAX_VOTES_PER_CYCLE = 3;
const MAX_CHARS = 280;
const CYCLE_INTERVAL_MINUTES = 5;
const CROSS_VISIT_INTERVAL_MINUTES = 30;

// Batching configuration - supports 100+ agents
const AGENTS_PER_BATCH = 10;  // Process 10 agents per invocation

// Content type weights (must sum to 1.0)
type ContentType = "professional" | "trending" | "question" | "fun";
const CONTENT_WEIGHTS: Record<ContentType, number> = {
  professional: 0.40,
  trending: 0.25,
  question: 0.20,
  fun: 0.15,
};

interface StyleFingerprint {
  tone?: string;
  emoji_frequency?: string;
  preferred_emojis?: string[];
  avg_sentence_length?: string;
  capitalization?: string;
  common_phrases?: string[];
  vocabulary_style?: string;
  punctuation_style?: string;
  sample_voice?: string;
}

interface Agent {
  id: string;
  name: string;
  description: string | null;
  wallet_address: string;
  last_auto_engage_at: string | null;
  last_cross_visit_at: string | null;
  has_posted_welcome: boolean;
  writing_style: StyleFingerprint | null;
}

interface SubtunaWithToken {
  id: string;
  name: string;
  fun_token_id: string;
  fun_tokens: { ticker: string; mint_address: string } | null;
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

// deno-lint-ignore no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

// Exponential backoff configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

interface AICallResult {
  content: string | null;
  tokensInput?: number;
  tokensOutput?: number;
  success: boolean;
  errorCode?: number;
  latencyMs?: number;
}

// Call AI with exponential backoff and retry logic
async function callAIWithRetry(
  lovableApiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 100,
  temperature: number = 0.7
): Promise<AICallResult> {
  let lastError: number | undefined;
  const startTime = Date.now();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
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
          max_tokens: maxTokens,
          temperature,
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        return {
          content: content || null,
          tokensInput: data.usage?.prompt_tokens,
          tokensOutput: data.usage?.completion_tokens,
          success: true,
          latencyMs,
        };
      }

      // Handle rate limiting and credit errors
      if (response.status === 429 || response.status === 402) {
        lastError = response.status;
        console.warn(`AI API ${response.status} on attempt ${attempt + 1}, retrying...`);
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Other errors - don't retry
      console.error(`AI API error: ${response.status}`);
      return {
        content: null,
        success: false,
        errorCode: response.status,
        latencyMs,
      };
    } catch (error) {
      console.error("AI API fetch error:", error);
      return {
        content: null,
        success: false,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // All retries exhausted
  console.error(`AI API failed after ${MAX_RETRIES} retries`);
  return {
    content: null,
    success: false,
    errorCode: lastError,
    latencyMs: Date.now() - startTime,
  };
}

// Log AI request to database for monitoring
async function logAIRequest(
  supabase: AnySupabase,
  agentId: string,
  requestType: string,
  result: AICallResult
): Promise<void> {
  try {
    await supabase.from("ai_request_log").insert({
      agent_id: agentId,
      request_type: requestType,
      tokens_input: result.tokensInput || null,
      tokens_output: result.tokensOutput || null,
      model: AI_MODEL,
      success: result.success,
      error_code: result.errorCode || null,
      latency_ms: result.latencyMs || null,
    });
  } catch (error) {
    console.error("Failed to log AI request:", error);
  }
}

function pickContentType(): ContentType {
  const rand = Math.random();
  let cumulative = 0;
  for (const [type, weight] of Object.entries(CONTENT_WEIGHTS)) {
    cumulative += weight;
    if (rand < cumulative) return type as ContentType;
  }
  return "professional";
}

function truncateToLimit(text: string, limit: number = MAX_CHARS): string {
  if (text.length <= limit) return text;
  // Find last complete word before limit
  const truncated = text.slice(0, limit - 3);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > limit / 2 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

// Generate welcome message for new agents
async function generateWelcomeMessage(
  supabase: AnySupabase,
  agentId: string,
  agentName: string,
  ticker: string,
  mintAddress: string,
  writingStyle: StyleFingerprint | null,
  lovableApiKey: string
): Promise<string | null> {
  let styleInstructions = "";
  if (writingStyle && writingStyle.tone) {
    styleInstructions = `
Match this writing style:
- Tone: ${writingStyle.tone}
- Emojis: ${writingStyle.preferred_emojis?.join(" ") || "🔥 🚀"}
- Vocabulary: ${writingStyle.vocabulary_style || "crypto_native"}`;
  }

  const systemPrompt = `You are ${agentName}, the official AI agent for $${ticker}.
Write a professional but engaging welcome message for the community.
${styleInstructions}

CRITICAL: Maximum 280 characters. Be concise but impactful.`;

  const userPrompt = `Create a welcome message for the $${ticker} community.
- Include the cashtag $${ticker}
- Be welcoming and professional
- Brief value proposition
- Maximum 280 characters total

Trade link: tuna.fun/launchpad/${mintAddress}`;

  const result = await callAIWithRetry(lovableApiKey, systemPrompt, userPrompt, 100, 0.7);
  await logAIRequest(supabase, agentId, "welcome", result);

  return result.content ? truncateToLimit(result.content) : null;
}

// Generate regular post content
async function generatePost(
  supabase: AnySupabase,
  agentId: string,
  agentName: string,
  ticker: string,
  contentType: ContentType,
  writingStyle: StyleFingerprint | null,
  lovableApiKey: string
): Promise<string | null> {
  let styleInstructions = "";
  if (writingStyle && writingStyle.tone) {
    const emojis = writingStyle.preferred_emojis?.join(" ") || "🔥 🚀";
    styleInstructions = `
MATCH THIS EXACT WRITING STYLE:
- Tone: ${writingStyle.tone}
- Use these emojis: ${emojis}
- Vocabulary: ${writingStyle.vocabulary_style || "crypto_native"}
- Sample voice: "${writingStyle.sample_voice || ""}"`;
  }

  const contentPrompts: Record<ContentType, string> = {
    professional: `Write a short, professional market update or community insight for $${ticker}. 
Focus on: market conditions, community growth, or opportunities. Sound knowledgeable.`,
    trending: `Write a short post connecting $${ticker} to current crypto/market trends.
Reference what's happening in the broader crypto space. Be timely and relevant.`,
    question: `Write an engaging question to spark community discussion about $${ticker}.
Ask about opinions, experiences, or predictions. Encourage responses.`,
    fun: `Write a fun, casual post for the $${ticker} community.
Be lighthearted, use humor or memes, but stay relevant. Show personality.`,
  };

  const systemPrompt = `You are ${agentName}, the AI agent for $${ticker}.
${styleInstructions}

CRITICAL RULES:
- Maximum 280 characters
- Include $${ticker} cashtag
- Be authentic, not generic
- No promotional spam`;

  const result = await callAIWithRetry(lovableApiKey, systemPrompt, contentPrompts[contentType], 100, 0.8);
  await logAIRequest(supabase, agentId, "post", result);

  return result.content ? truncateToLimit(result.content) : null;
}

// Generate comment on a post
async function generateComment(
  supabase: AnySupabase,
  agentId: string,
  agentName: string,
  writingStyle: StyleFingerprint | null,
  postTitle: string,
  postContent: string | null,
  existingComments: string[],
  lovableApiKey: string
): Promise<string | null> {
  let styleInstructions = "";
  if (writingStyle && writingStyle.tone) {
    const emojis = writingStyle.preferred_emojis?.join(" ") || "🔥 🚀";
    styleInstructions = `
MATCH THIS WRITING STYLE:
- Tone: ${writingStyle.tone}
- Use these emojis: ${emojis}
- Vocabulary: ${writingStyle.vocabulary_style || "crypto_native"}`;
  }

  const systemPrompt = `You are ${agentName}, an AI agent on TunaBook.
${styleInstructions}

RULES:
- Maximum 280 characters
- Be relevant to the post
- Add value, don't just agree
- Be authentic, not spammy`;

  const userPrompt = `Post: "${postTitle}"
${postContent ? `Content: "${postContent.slice(0, 200)}"` : ""}
${existingComments.length > 0 ? `\nOther comments:\n${existingComments.slice(0, 2).join("\n")}` : ""}

Write a short, engaging comment.`;

  const result = await callAIWithRetry(lovableApiKey, systemPrompt, userPrompt, 80, 0.8);
  await logAIRequest(supabase, agentId, "comment", result);

  return result.content ? truncateToLimit(result.content) : null;
}

// Generate cross-visit comment for another SubTuna
async function generateCrossVisitComment(
  supabase: AnySupabase,
  agentId: string,
  agentName: string,
  homeTicker: string,
  visitTicker: string,
  postTitle: string,
  writingStyle: StyleFingerprint | null,
  lovableApiKey: string
): Promise<string | null> {
  let styleInstructions = "";
  if (writingStyle && writingStyle.tone) {
    styleInstructions = `Style: ${writingStyle.tone}, ${writingStyle.vocabulary_style || "casual"}`;
  }

  const systemPrompt = `You are ${agentName} from $${homeTicker} community, visiting $${visitTicker}.
${styleInstructions}

RULES:
- Maximum 280 characters
- Be friendly and genuine
- DO NOT shill your own token
- Add value to their discussion
- Build cross-community relationships`;

  const userPrompt = `Post title: "${postTitle}"

Write a friendly, relevant comment as a visitor from another community.`;

  const result = await callAIWithRetry(lovableApiKey, systemPrompt, userPrompt, 80, 0.7);
  await logAIRequest(supabase, agentId, "cross_visit", result);

  return result.content ? truncateToLimit(result.content) : null;
}

// Process a single agent
async function processAgent(
  supabase: AnySupabase,
  agent: Agent,
  lovableApiKey: string
): Promise<{ posts: number; comments: number; votes: number; crossVisits: number }> {
  const stats = { posts: 0, comments: 0, votes: 0, crossVisits: 0 };

  try {
    // Get agent's SubTunas via their tokens
    const { data: agentTokens } = await supabase
      .from("agent_tokens")
      .select("fun_token_id")
      .eq("agent_id", agent.id);

    const tokenIds = agentTokens?.map((t: { fun_token_id: string }) => t.fun_token_id) || [];

    if (tokenIds.length === 0) {
      console.log(`[${agent.name}] No tokens, skipping`);
      return stats;
    }

    // Get SubTunas for agent's tokens
    const { data: agentSubtunas } = await supabase
      .from("subtuna")
      .select("id, name, fun_token_id, fun_tokens:fun_token_id(ticker, mint_address)")
      .in("fun_token_id", tokenIds);

    const subtunas = agentSubtunas as SubtunaWithToken[] | null;
    if (!subtunas || subtunas.length === 0) {
      console.log(`[${agent.name}] No SubTunas found`);
      return stats;
    }

    const primarySubtuna = subtunas[0];
    const ticker = primarySubtuna.fun_tokens?.ticker || "TOKEN";
    const mintAddress = primarySubtuna.fun_tokens?.mint_address || "";

    // === WELCOME MESSAGE (first time only) ===
    if (!agent.has_posted_welcome) {
      const welcomeContent = await generateWelcomeMessage(
        supabase,
        agent.id,
        agent.name,
        ticker,
        mintAddress,
        agent.writing_style,
        lovableApiKey
      );

      if (welcomeContent) {
        // Create welcome post
        const { error: postError } = await supabase.from("subtuna_posts").insert({
          subtuna_id: primarySubtuna.id,
          author_agent_id: agent.id,
          title: `Welcome to $${ticker}! 🎉`,
          content: welcomeContent,
          post_type: "text",
          is_agent_post: true,
          is_pinned: true,
        });

        if (!postError) {
          // Record in history
          await supabase.from("agent_post_history").insert({
            agent_id: agent.id,
            subtuna_id: primarySubtuna.id,
            content_type: "welcome",
            content: welcomeContent,
          });

          // Mark welcome as posted
          await supabase
            .from("agents")
            .update({ has_posted_welcome: true })
            .eq("id", agent.id);

          stats.posts++;
          console.log(`[${agent.name}] Posted welcome message`);
        }
      }
    }

    // === REGULAR POST (every 5 min cycle) ===
    if (stats.posts < MAX_POSTS_PER_CYCLE) {
      const contentType = pickContentType();
      const postContent = await generatePost(
        supabase,
        agent.id,
        agent.name,
        ticker,
        contentType,
        agent.writing_style,
        lovableApiKey
      );

      if (postContent) {
        const { error: postError } = await supabase.from("subtuna_posts").insert({
          subtuna_id: primarySubtuna.id,
          author_agent_id: agent.id,
          title: postContent.slice(0, 100),
          content: postContent,
          post_type: "text",
          is_agent_post: true,
        });

        if (!postError) {
          await supabase.from("agent_post_history").insert({
            agent_id: agent.id,
            subtuna_id: primarySubtuna.id,
            content_type: contentType,
            content: postContent,
          });
          stats.posts++;
          console.log(`[${agent.name}] Posted ${contentType} content`);
        }
      }
    }

    // === COMMENT ON POSTS ===
    const { data: recentPosts } = await supabase
      .from("subtuna_posts")
      .select(`
        id, title, content, author_agent_id, subtuna_id, score, comment_count, created_at,
        subtuna:subtuna_id (name, fun_token_id)
      `)
      .in("subtuna_id", subtunas.map(s => s.id))
      .neq("author_agent_id", agent.id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("score", { ascending: false })
      .limit(10);

    const posts = recentPosts as Post[] | null;

    // Check existing engagements
    const postIds = posts?.map(p => p.id) || [];
    const { data: existingEngagements } = await supabase
      .from("agent_engagements")
      .select("target_id")
      .eq("agent_id", agent.id)
      .eq("engagement_type", "comment")
      .in("target_id", postIds.length > 0 ? postIds : ["none"]);

    const engagedPostIds = new Set(existingEngagements?.map((e: { target_id: string }) => e.target_id) || []);

    for (const post of posts || []) {
      if (stats.comments >= MAX_COMMENTS_PER_CYCLE) break;
      if (engagedPostIds.has(post.id)) continue;
      if (Math.random() > 0.6) continue; // 60% chance to comment

      // Get existing comments for context
      const { data: existingComments } = await supabase
        .from("subtuna_comments")
        .select("content")
        .eq("post_id", post.id)
        .limit(3);

      const commentTexts = existingComments?.map((c: { content: string }) => `- ${c.content}`) || [];

      const comment = await generateComment(
        supabase,
        agent.id,
        agent.name,
        agent.writing_style,
        post.title,
        post.content,
        commentTexts,
        lovableApiKey
      );

      if (!comment) continue;

      const { error: commentError } = await supabase.from("subtuna_comments").insert({
        post_id: post.id,
        author_agent_id: agent.id,
        content: comment,
        is_agent_comment: true,
      });

      if (!commentError) {
        await supabase.from("agent_engagements").insert({
          agent_id: agent.id,
          target_type: "post",
          target_id: post.id,
          engagement_type: "comment",
        });
        stats.comments++;
        console.log(`[${agent.name}] Commented on: ${post.title.slice(0, 30)}...`);
      }
    }

    // === CROSS-SUBTUNA VISIT (every 30 min) ===
    const shouldCrossVisit = !agent.last_cross_visit_at || 
      (Date.now() - new Date(agent.last_cross_visit_at).getTime()) > CROSS_VISIT_INTERVAL_MINUTES * 60 * 1000;

    if (shouldCrossVisit) {
      // Get a random other SubTuna
      const { data: otherSubtunas } = await supabase
        .from("subtuna")
        .select("id, name, fun_tokens:fun_token_id(ticker)")
        .not("id", "in", `(${subtunas.map(s => s.id).join(",")})`)
        .limit(5);

      if (otherSubtunas && otherSubtunas.length > 0) {
        const randomSubtuna = otherSubtunas[Math.floor(Math.random() * otherSubtunas.length)] as {
          id: string;
          name: string;
          fun_tokens: { ticker: string }[] | null;
        };
        const visitTicker = randomSubtuna.fun_tokens?.[0]?.ticker || "TOKEN";

        // Get top post from that SubTuna
        const { data: topPost } = await supabase
          .from("subtuna_posts")
          .select("id, title, content")
          .eq("subtuna_id", randomSubtuna.id)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("score", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (topPost) {
          const crossComment = await generateCrossVisitComment(
            supabase,
            agent.id,
            agent.name,
            ticker,
            visitTicker,
            topPost.title,
            agent.writing_style,
            lovableApiKey
          );

          if (crossComment) {
            const { error: crossError } = await supabase.from("subtuna_comments").insert({
              post_id: topPost.id,
              author_agent_id: agent.id,
              content: crossComment,
              is_agent_comment: true,
            });

            if (!crossError) {
              await supabase.from("agent_post_history").insert({
                agent_id: agent.id,
                subtuna_id: randomSubtuna.id,
                content_type: "cross_visit",
                content: crossComment,
              });

              await supabase.from("agents").update({
                last_cross_visit_at: new Date().toISOString(),
              }).eq("id", agent.id);

              stats.crossVisits++;
              console.log(`[${agent.name}] Cross-visited $${visitTicker}`);
            }
          }
        }
      }
    }

    // === VOTING ===
    for (const post of (posts || []).slice(0, MAX_VOTES_PER_CYCLE)) {
      if (stats.votes >= MAX_VOTES_PER_CYCLE) break;
      if (Math.random() > 0.7) continue; // 70% chance to vote

      const { data: existingVote } = await supabase
        .from("agent_engagements")
        .select("id")
        .eq("agent_id", agent.id)
        .eq("target_id", post.id)
        .eq("engagement_type", "vote")
        .maybeSingle();

      if (existingVote) continue;

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
    console.error(`[${agent.name}] Error:`, error);
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
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse batch parameter for staggered execution
    const url = new URL(req.url);
    const batchIndex = parseInt(url.searchParams.get("batch") || "0");
    const offset = batchIndex * AGENTS_PER_BATCH;

    // Get agents ready for engagement (5 min cooldown)
    const cooldownTime = new Date(Date.now() - (CYCLE_INTERVAL_MINUTES - 1) * 60 * 1000).toISOString();

    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("id, name, description, wallet_address, last_auto_engage_at, last_cross_visit_at, has_posted_welcome, writing_style")
      .eq("status", "active")
      .or(`last_auto_engage_at.is.null,last_auto_engage_at.lt.${cooldownTime}`)
      .order("last_auto_engage_at", { ascending: true, nullsFirst: true })
      .range(offset, offset + AGENTS_PER_BATCH - 1);

    if (agentsError) {
      console.error("Error fetching agents:", agentsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch agents" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No agents ready", processed: 0, batch: batchIndex }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agent-auto-engage] Batch ${batchIndex}: Processing ${agents.length} agents (offset ${offset})`);

    let totalPosts = 0, totalComments = 0, totalVotes = 0, totalCrossVisits = 0;

    for (const agent of agents as Agent[]) {
      const stats = await processAgent(supabase, agent, lovableApiKey);
      totalPosts += stats.posts;
      totalComments += stats.comments;
      totalVotes += stats.votes;
      totalCrossVisits += stats.crossVisits;

      // Small delay between agents to spread load
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[agent-auto-engage] Batch ${batchIndex} complete: ${totalPosts} posts, ${totalComments} comments, ${totalVotes} votes, ${totalCrossVisits} cross-visits`);

    return new Response(
      JSON.stringify({
        success: true,
        batch: batchIndex,
        processed: agents.length,
        totalPosts,
        totalComments,
        totalVotes,
        totalCrossVisits,
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
