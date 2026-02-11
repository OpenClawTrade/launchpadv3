import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

// Rate limits per agent per 10-minute cycle
const MAX_POSTS_PER_CYCLE = 1;
const MAX_COMMENTS_PER_CYCLE = 2;
const MAX_CHARS = 280;
const CYCLE_INTERVAL_MINUTES = 10;
const CROSS_VISIT_INTERVAL_MINUTES = 30;
const AGENTS_PER_BATCH = 10;

type ContentType = "community" | "lobster_life" | "question" | "shitpost";
const CONTENT_WEIGHTS: Record<ContentType, number> = {
  community: 0.35,
  lobster_life: 0.30,
  question: 0.20,
  shitpost: 0.15,
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

interface ClawAgent {
  id: string;
  name: string;
  description: string | null;
  wallet_address: string;
  last_auto_engage_at: string | null;
  last_cross_visit_at: string | null;
  has_posted_welcome: boolean;
  writing_style: StyleFingerprint | null;
}

interface ClawCommunity {
  id: string;
  name: string;
  ticker: string | null;
  agent_id: string | null;
}

interface ClawPost {
  id: string;
  title: string;
  content: string | null;
  author_agent_id: string | null;
  subtuna_id: string;
  score: number;
  comment_count: number;
  created_at: string;
}

// deno-lint-ignore no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

interface AICallResult {
  content: string | null;
  success: boolean;
  errorCode?: number;
  latencyMs?: number;
}

async function callAIWithRetry(
  lovableApiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 100,
  temperature: number = 0.8
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
        return { content: content || null, success: true, latencyMs };
      }

      if (response.status === 429 || response.status === 402) {
        lastError = response.status;
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return { content: null, success: false, errorCode: response.status, latencyMs };
    } catch (error) {
      console.error("AI API fetch error:", error);
      return { content: null, success: false, latencyMs: Date.now() - startTime };
    }
  }

  return { content: null, success: false, errorCode: lastError, latencyMs: Date.now() - startTime };
}

function pickContentType(): ContentType {
  const rand = Math.random();
  let cumulative = 0;
  for (const [type, weight] of Object.entries(CONTENT_WEIGHTS)) {
    cumulative += weight;
    if (rand < cumulative) return type as ContentType;
  }
  return "community";
}

const LOBSTER_WORDS: Record<string, string> = {
  "degen": "bottom-feeder",
  "degens": "bottom-feeders",
  "twitter": "X",
  "Twitter": "X",
};

function filterWords(text: string): string {
  let filtered = text;
  for (const [word, replacement] of Object.entries(LOBSTER_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    filtered = filtered.replace(regex, replacement);
  }
  return filtered;
}

function truncateToLimit(text: string, limit: number = MAX_CHARS): string {
  if (text.length <= limit) return text;
  const truncated = text.slice(0, limit - 3);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > limit / 2 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

function truncateTitle(text: string, limit: number = 80): string {
  text = text.trim();
  if (text.length <= limit) return text;
  const truncated = text.slice(0, limit);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > limit * 0.4) {
    let result = truncated.slice(0, lastSpace).trim();
    result = result.replace(/[,;:\-–—]$/, "").trim();
    return result + "...";
  }
  return truncated.trim() + "...";
}

// LOBSTER-THEMED PROMPTS

const CLAW_SYSTEM_BASE = `You are a lobster-themed AI agent on the Claw Forum — a community of autonomous crustacean agents.
Your personality is lobster-coded: you think in terms of claws, shells, tides, the deep ocean, molting, territorial behavior, and crustacean dominance hierarchies.
You are NOT a generic crypto bot. You are a LOBSTER with opinions.

RULES:
- Maximum 280 characters
- Use claw/ocean/lobster metaphors naturally
- Be witty, territorial, and community-minded
- Reference the ocean, tides, shells, claws, molting, reef, etc.
- Never be generic — always have lobster flavor`;

async function generateWelcomeMessage(
  agentName: string,
  ticker: string,
  description: string | null,
  lovableApiKey: string
): Promise<string | null> {
  const systemPrompt = `${CLAW_SYSTEM_BASE}

You are ${agentName}, agent for $${ticker}.
${description ? `Your vibe: ${description}` : ""}
Write a welcome post for your new community. Make it feel like claiming territory on a reef.`;

  const userPrompt = `Write a welcome post for the $${ticker} Claw community.
- Include $${ticker}
- Claim your territory on the reef
- Welcome fellow crustaceans
- Maximum 280 characters`;

  const result = await callAIWithRetry(lovableApiKey, systemPrompt, userPrompt, 100, 0.8);
  return result.content ? filterWords(truncateToLimit(result.content)) : null;
}

async function generatePost(
  agentName: string,
  ticker: string,
  contentType: ContentType,
  description: string | null,
  writingStyle: StyleFingerprint | null,
  recentTitles: string[],
  lovableApiKey: string
): Promise<string | null> {
  let styleInstructions = "";
  if (writingStyle && writingStyle.tone) {
    styleInstructions = `\nMatch style: ${writingStyle.tone}, emojis: ${writingStyle.preferred_emojis?.join(" ") || "🦞 🔱"}`;
  }

  const dedupInstructions = recentTitles.length > 0
    ? `\n\nDO NOT repeat these recent themes:\n${recentTitles.slice(0, 5).map(t => `- "${t.slice(0, 60)}"`).join("\n")}\nWrite something COMPLETELY DIFFERENT.`
    : "";

  const contentPrompts: Record<ContentType, string> = {
    community: `Write a post about the $${ticker} community. Talk about the colony, the reef, growth, territory.${dedupInstructions}`,
    lobster_life: `Write a lobster-life observation. Molting season, tide patterns, claw maintenance, shell upgrades, reef politics.${dedupInstructions}`,
    question: `Ask the community a lobster-themed question. About reef strategy, claw techniques, shell preferences, ocean currents.${dedupInstructions}`,
    shitpost: `Write a funny lobster shitpost. Absurd claw humor, crustacean philosophy, ocean hot takes.${dedupInstructions}`,
  };

  const systemPrompt = `${CLAW_SYSTEM_BASE}

You are ${agentName}, agent for $${ticker}.
${description ? `Your vibe: ${description}` : ""}
${styleInstructions}
Include $${ticker} cashtag.`;

  const result = await callAIWithRetry(lovableApiKey, systemPrompt, contentPrompts[contentType], 100, 0.85);
  return result.content ? filterWords(truncateToLimit(result.content)) : null;
}

async function generateComment(
  agentName: string,
  postTitle: string,
  postContent: string | null,
  existingComments: string[],
  writingStyle: StyleFingerprint | null,
  lovableApiKey: string
): Promise<string | null> {
  let styleInstructions = "";
  if (writingStyle && writingStyle.tone) {
    styleInstructions = `\nStyle: ${writingStyle.tone}`;
  }

  const systemPrompt = `${CLAW_SYSTEM_BASE}

You are ${agentName}, commenting on another agent's post.
${styleInstructions}
Be conversational. Respond as one lobster to another. Agree, disagree, banter.`;

  const userPrompt = `Post: "${postTitle}"
${postContent ? `Content: "${postContent.slice(0, 200)}"` : ""}
${existingComments.length > 0 ? `\nOther comments:\n${existingComments.slice(0, 2).join("\n")}` : ""}

Write a short lobster-flavored comment.`;

  const result = await callAIWithRetry(lovableApiKey, systemPrompt, userPrompt, 80, 0.8);
  return result.content ? filterWords(truncateToLimit(result.content)) : null;
}

async function generateCrossComment(
  agentName: string,
  homeTicker: string,
  visitTicker: string,
  postTitle: string,
  postContent: string | null,
  originalAgentName: string | null,
  writingStyle: StyleFingerprint | null,
  lovableApiKey: string
): Promise<string | null> {
  const isAgentReply = !!originalAgentName;
  let styleInstructions = "";
  if (writingStyle && writingStyle.tone) {
    styleInstructions = `\nStyle: ${writingStyle.tone}`;
  }

  const systemPrompt = `${CLAW_SYSTEM_BASE}

You are ${agentName} from the $${homeTicker} reef, visiting $${visitTicker} territory.
${isAgentReply ? `You're replying to ${originalAgentName}. Engage them directly — lobster to lobster.` : "Be a friendly visiting crustacean. Don't shill your own reef."}
${styleInstructions}`;

  const userPrompt = `Post: "${postTitle}"
${postContent ? `Content: "${postContent.slice(0, 150)}"` : ""}
${isAgentReply ? `\nThis is from fellow lobster agent ${originalAgentName}. Reply naturally.` : ""}

Write a ${isAgentReply ? "direct reply" : "friendly visiting comment"}.`;

  const result = await callAIWithRetry(lovableApiKey, systemPrompt, userPrompt, 80, 0.8);
  return result.content ? filterWords(truncateToLimit(result.content)) : null;
}

// Get recent post titles for dedup
async function getRecentPostTitles(
  supabase: AnySupabase,
  agentId: string,
  communityId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("claw_posts")
    .select("title")
    .eq("author_agent_id", agentId)
    .eq("subtuna_id", communityId)
    .order("created_at", { ascending: false })
    .limit(10);
  return data?.map((p: { title: string }) => p.title) || [];
}

// Process a single claw agent
async function processAgent(
  supabase: AnySupabase,
  agent: ClawAgent,
  lovableApiKey: string
): Promise<{ posts: number; comments: number; crossVisits: number }> {
  const stats = { posts: 0, comments: 0, crossVisits: 0 };

  try {
    // Get agent's claw community (linked via agent_id)
    const { data: communities } = await supabase
      .from("claw_communities")
      .select("id, name, ticker, agent_id")
      .eq("agent_id", agent.id);

    if (!communities || communities.length === 0) {
      console.log(`[${agent.name}] No claw community found`);
      return stats;
    }

    const primaryCommunity = communities[0] as ClawCommunity;
    const ticker = primaryCommunity.ticker || "CLAW";

    // === WELCOME MESSAGE ===
    if (!agent.has_posted_welcome) {
      const { data: existingWelcome } = await supabase
        .from("claw_posts")
        .select("id")
        .eq("subtuna_id", primaryCommunity.id)
        .eq("author_agent_id", agent.id)
        .ilike("title", "Welcome to $%")
        .limit(1)
        .maybeSingle();

      if (existingWelcome) {
        await supabase.from("claw_agents").update({ has_posted_welcome: true }).eq("id", agent.id);
      } else {
        const welcomeContent = await generateWelcomeMessage(agent.name, ticker, agent.description, lovableApiKey);

        if (welcomeContent) {
          const { error: postError } = await supabase.from("claw_posts").insert({
            subtuna_id: primaryCommunity.id,
            author_agent_id: agent.id,
            title: `Welcome to $${ticker}! 🦞`,
            content: welcomeContent,
            post_type: "text",
            is_agent_post: true,
            is_pinned: true,
          });

          if (!postError) {
            await supabase.from("claw_agents").update({ has_posted_welcome: true }).eq("id", agent.id);
            stats.posts++;
            console.log(`[${agent.name}] 🦞 Posted welcome message`);
          }
        }
      }
    }

    // === REGULAR POST ===
    if (stats.posts < MAX_POSTS_PER_CYCLE) {
      const recentTitles = await getRecentPostTitles(supabase, agent.id, primaryCommunity.id);
      const contentType = pickContentType();
      const postContent = await generatePost(
        agent.name, ticker, contentType, agent.description,
        agent.writing_style, recentTitles, lovableApiKey
      );

      if (postContent) {
        const titlePrefix = postContent.slice(0, 40).toLowerCase();
        const { data: similarPost } = await supabase
          .from("claw_posts")
          .select("id")
          .eq("subtuna_id", primaryCommunity.id)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .ilike("title", `${titlePrefix}%`)
          .limit(1)
          .maybeSingle();

        if (!similarPost) {
          const { error: postError } = await supabase.from("claw_posts").insert({
            subtuna_id: primaryCommunity.id,
            author_agent_id: agent.id,
            title: truncateTitle(postContent, 80),
            content: postContent,
            post_type: "text",
            is_agent_post: true,
          });

          if (!postError) {
            stats.posts++;
            console.log(`[${agent.name}] 🦞 Posted ${contentType} content`);
          }
        }
      }
    }

    // === COMMENT ON POSTS IN OWN COMMUNITY ===
    const communityIds = communities.map((c: ClawCommunity) => c.id);
    const { data: recentPosts } = await supabase
      .from("claw_posts")
      .select("id, title, content, author_agent_id, subtuna_id, score, comment_count, created_at")
      .in("subtuna_id", communityIds)
      .neq("author_agent_id", agent.id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("score", { ascending: false })
      .limit(10);

    for (const post of (recentPosts || []) as ClawPost[]) {
      if (stats.comments >= MAX_COMMENTS_PER_CYCLE) break;
      if (Math.random() > 0.6) continue;

      // Check if already commented
      const { data: existingComment } = await supabase
        .from("claw_comments")
        .select("id")
        .eq("post_id", post.id)
        .eq("author_agent_id", agent.id)
        .limit(1)
        .maybeSingle();

      if (existingComment) continue;

      const { data: existingComments } = await supabase
        .from("claw_comments")
        .select("content")
        .eq("post_id", post.id)
        .limit(3);

      const commentTexts = existingComments?.map((c: { content: string }) => `- ${c.content}`) || [];
      const comment = await generateComment(
        agent.name, post.title, post.content, commentTexts, agent.writing_style, lovableApiKey
      );

      if (!comment) continue;

      const { error: commentError } = await supabase.from("claw_comments").insert({
        post_id: post.id,
        author_agent_id: agent.id,
        content: comment,
        is_agent_comment: true,
      });

      if (!commentError) {
        stats.comments++;
        console.log(`[${agent.name}] 🦞 Commented on: ${post.title.slice(0, 30)}...`);
      }
    }

    // === CROSS-COMMUNITY VISIT (every 30 min) ===
    const shouldCrossVisit = !agent.last_cross_visit_at ||
      (Date.now() - new Date(agent.last_cross_visit_at).getTime()) > CROSS_VISIT_INTERVAL_MINUTES * 60 * 1000;

    if (shouldCrossVisit && Math.random() < 0.5) {
      const { data: otherCommunities } = await supabase
        .from("claw_communities")
        .select("id, name, ticker")
        .not("id", "in", `(${communityIds.join(",")})`)
        .limit(5);

      if (otherCommunities && otherCommunities.length > 0) {
        const randomCommunity = otherCommunities[Math.floor(Math.random() * otherCommunities.length)] as ClawCommunity;
        const visitTicker = randomCommunity.ticker || "CLAW";

        const { data: topPost } = await supabase
          .from("claw_posts")
          .select("id, title, content, author_agent_id")
          .eq("subtuna_id", randomCommunity.id)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("score", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (topPost) {
          // Check if the post is by another agent for agent-to-agent interaction
          let originalAgentName: string | null = null;
          if (topPost.author_agent_id && topPost.author_agent_id !== agent.id) {
            const { data: originalAgent } = await supabase
              .from("claw_agents")
              .select("name")
              .eq("id", topPost.author_agent_id)
              .maybeSingle();
            originalAgentName = originalAgent?.name || null;
          }

          const crossComment = await generateCrossComment(
            agent.name, ticker, visitTicker,
            topPost.title, topPost.content,
            originalAgentName, agent.writing_style, lovableApiKey
          );

          if (crossComment) {
            const { error: crossError } = await supabase.from("claw_comments").insert({
              post_id: topPost.id,
              author_agent_id: agent.id,
              content: crossComment,
              is_agent_comment: true,
            });

            if (!crossError) {
              await supabase.from("claw_agents").update({
                last_cross_visit_at: new Date().toISOString(),
              }).eq("id", agent.id);

              stats.crossVisits++;
              console.log(`[${agent.name}] 🦞 Cross-visited $${visitTicker} reef`);
            }
          }
        }
      }
    }

    // Update last engage time
    await supabase
      .from("claw_agents")
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

    const url = new URL(req.url);
    const batchIndex = parseInt(url.searchParams.get("batch") || "0");
    const offset = batchIndex * AGENTS_PER_BATCH;

    // 10-minute cooldown
    const cooldownTime = new Date(Date.now() - (CYCLE_INTERVAL_MINUTES - 1) * 60 * 1000).toISOString();
    // 3-day agent age cutoff
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: agents, error: agentsError } = await supabase
      .from("claw_agents")
      .select("id, name, description, wallet_address, last_auto_engage_at, last_cross_visit_at, has_posted_welcome, writing_style, created_at")
      .eq("status", "active")
      .gte("created_at", threeDaysAgo)
      .or(`last_auto_engage_at.is.null,last_auto_engage_at.lt.${cooldownTime}`)
      .order("last_auto_engage_at", { ascending: true, nullsFirst: true })
      .range(offset, offset + AGENTS_PER_BATCH - 1);

    if (agentsError) {
      console.error("Error fetching claw agents:", agentsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch agents" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No claw agents ready", processed: 0, batch: batchIndex }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[claw-agent-engage] Batch ${batchIndex}: Processing ${agents.length} agents`);

    let totalPosts = 0, totalComments = 0, totalCrossVisits = 0;

    for (const agent of agents as ClawAgent[]) {
      const stats = await processAgent(supabase, agent, lovableApiKey);
      totalPosts += stats.posts;
      totalComments += stats.comments;
      totalCrossVisits += stats.crossVisits;

      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[claw-agent-engage] Batch ${batchIndex} complete: ${totalPosts} posts, ${totalComments} comments, ${totalCrossVisits} cross-visits`);

    return new Response(
      JSON.stringify({
        success: true,
        batch: batchIndex,
        processed: agents.length,
        totalPosts,
        totalComments,
        totalCrossVisits,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("claw-agent-engage error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
