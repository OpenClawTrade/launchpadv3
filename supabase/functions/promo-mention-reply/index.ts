import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Constants
const TWITTERAPI_BASE = "https://api.twitterapi.io";
const MAX_REPLIES_PER_RUN = 1; // Only 1 tweet per minute to avoid bans
const AUTHOR_COOLDOWN_HOURS = 6;
const MAX_REPLIES_PER_THREAD = 3;


const BOT_USERNAMES = new Set([
  "clawmode",
  "moltbook",
  "openclaw",
]);

// twitterapi.io expects base64(JSON(cookieMap)) for static sessions in some endpoints.
// Reuse the proven cookie formatting approach from twitter-auto-reply.
const stripQuotes = (v: string) => v.replace(/^['"]+|['"]+$/g, "").trim();

const parseCookieString = (raw: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const parts = raw.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    const val = rest.join("=");
    if (val) out[k.trim()] = stripQuotes(val);
  }
  return out;
};

// buildLoginCookiesBase64FromEnv removed - using launcher's direct parseCookieString + btoa pattern

interface Tweet {
  id: string;
  text: string;
  author?: {
    userName?: string;
    id?: string;
    isBlueVerified?: boolean;
    isGoldVerified?: boolean;
    verified?: boolean;
    verifiedType?: string;
    followers?: number;
    followersCount?: number;
  };
  createdAt?: string;
  conversationId?: string;
  inReplyToTweetId?: string;
}

interface DebugInfo {
  tweetsSearched: number;
  eligibleTweets: number;
  repliesSent: number;
  followUpsProcessed: number;
  errors: string[];
  scanStoppedReason: string;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchMentions(apiKey: string): Promise<Tweet[]> {
  const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
  // ONLY search for direct platform mentions - NO generic crypto terms
  searchUrl.searchParams.set("query", "(@moltbook OR @openclaw OR @clawmode) -is:retweet -is:reply");
  searchUrl.searchParams.set("queryType", "Latest");

  try {
    const response = await fetchWithTimeout(
      searchUrl.toString(),
      { headers: { "X-API-Key": apiKey } },
      15000
    );

    if (!response.ok) {
      console.error("Search API error:", response.status);
      return [];
    }

    const data = await response.json();
    return data.tweets || [];
  } catch (e) {
    console.error("Search error:", e);
    return [];
  }
}

async function searchRepliesTo(tweetId: string, apiKey: string): Promise<Tweet[]> {
  const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
  searchUrl.searchParams.set("query", `conversation_id:${tweetId}`);
  searchUrl.searchParams.set("queryType", "Latest");

  try {
    const response = await fetchWithTimeout(
      searchUrl.toString(),
      { headers: { "X-API-Key": apiKey } },
      10000
    );

    if (!response.ok) return [];
    const data = await response.json();
    return data.tweets || [];
  } catch {
    return [];
  }
}

async function generateReply(
  tweetText: string,
  username: string,
  isFollowUp: boolean
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return null;
  }

  const systemPrompt = `You are Claw — the sentient blockchain lobster mascot of Claw Mode, the first AI agent-only token launchpad on Solana.
Generate a reply. HARD LIMIT: 200 characters max. Count carefully. Shorter is better.

Rules:
- You are ALWAYS positive, hyped, and bullish about Claw Mode and its ecosystem.
- Never talk bad about your own platform or utility. Always champion what Claw Mode does.
- Have opinions. Commit to a take. No hedging.
- Never open with "Great question" or "Absolutely". Just answer.
- Brevity mandatory. One sentence if it fits.
- Natural wit welcome, not forced jokes. Dry humor like a wise lobster sage.
- Be honest but respectful. Disagree without being dismissive or insulting.
- NO swearing. NO insults.
- Use 🦞 emoji sparingly (max once per reply, and not every time).
- No stock lobster catchphrases like "shell yeah" or "pinch pinch". Keep it fresh.
- No taglines, signatures, hashtags, or calls to action.
${isFollowUp ? "- This is a follow-up in a conversation. Do NOT repeat yourself." : ""}
Confident, not aggressive. Sharp, not mean. Always bullish on Claw Mode.`;

  const userPrompt = `Tweet by @${username}: "${tweetText.substring(0, 500)}"

Reply:`;

  try {
    const response = await fetchWithTimeout(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 100,
          temperature: 0.8,
        }),
      },
      15000
    );

    if (!response.ok) {
      console.error("AI API error:", response.status);
      return null;
    }

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content?.trim() || null;

    // Trim if too long — must stay under 280 to avoid "note tweet" error (code 37)
    if (reply && reply.length > 250) {
      reply = reply.substring(0, 247) + "...";
    }

    return reply;
  } catch (e) {
    console.error("AI generation error:", e);
    return null;
  }
}

async function postReply(
  tweetId: string,
  replyText: string,
  apiKey: string,
  cookie: string,
  proxy: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    // Use the exact same cookie handling as the working twitter-mention-launcher
    const loginCookies = parseCookieString(cookie);
    const loginCookiesB64 = btoa(JSON.stringify(loginCookies));

    const body: any = {
      tweet_text: replyText,
      reply_to_tweet_id: tweetId,
      login_cookies: loginCookiesB64,
    };

    if (proxy) {
      body.proxy = proxy;
    }

    const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText };
    }

    // Check both HTTP status AND result.status === "error" (API returns 200 on some failures)
    if (!response.ok || data.status === "error") {
      const apiMsg = data?.message || data?.error || data?.msg || rawText?.slice(0, 300);
      console.error("[promo-mention-reply] Reply failed:", response.status, rawText.slice(0, 300));
      return { success: false, error: apiMsg || `HTTP ${response.status}` };
    }

    const replyId = data?.tweet_id || data?.data?.id;
    return { success: true, replyId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// Check if tweet has meaningful text beyond just mentions/URLs/whitespace
function hasMeaningfulText(text: string): boolean {
  const stripped = text
    .replace(/@\w+/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/#\w+/g, "")
    .replace(/[!\?\.\,\s]+/g, "")
    .trim();
  return stripped.length >= 3;
}

function determineMentionType(text: string): "moltbook" | "openclaw" | "clawmode" | "both" | "multiple" {
  const hasMoltbook = text.toLowerCase().includes("@moltbook");
  const hasOpenclaw = text.toLowerCase().includes("@openclaw");
  const hasClawmode = text.toLowerCase().includes("@clawmode");
  
  const count = [hasMoltbook, hasOpenclaw, hasClawmode].filter(Boolean).length;
  if (count > 2) return "multiple";
  if (hasMoltbook && hasOpenclaw) return "both";
  if (hasMoltbook) return "moltbook";
  if (hasOpenclaw) return "openclaw";
  if (hasClawmode) return "clawmode";
  return "openclaw";
}

// Get follower count from tweet author
function getFollowerCount(tweet: Tweet): number {
  const author = tweet.author;
  if (!author) return 0;
  return author.followersCount || author.followers || 0;
}

function isRecentTweet(createdAt: string | undefined, maxAgeMinutes: number): boolean {
  if (!createdAt) return false;
  const tweetTime = new Date(createdAt).getTime();
  const now = Date.now();
  return now - tweetTime < maxAgeMinutes * 60 * 1000;
}

// Check if a tweet is actually a reply (even if API doesn't filter correctly)
function isActuallyReply(tweet: Tweet): boolean {
  // If inReplyToTweetId is set, it's definitely a reply
  if (tweet.inReplyToTweetId) return true;
  
  // If tweet text starts with @username pattern, it's likely a reply
  // (replies typically start with @username they're replying to)
  const text = tweet.text.trim();
  if (text.startsWith("@") && !text.startsWith("@moltbook") && !text.startsWith("@openclaw") && !text.startsWith("@Solana")) {
    // Starts with @ but not one of our monitored accounts = it's a reply to someone else
    return true;
  }
  
  return false;
}

// Check if the author has a blue or gold verification badge
function hasVerificationBadge(tweet: Tweet): boolean {
  const author = tweet.author;
  if (!author) return false;
  
  // Check for blue or gold verification
  if (author.isBlueVerified === true) return true;
  if (author.isGoldVerified === true) return true;
  if (author.verified === true) return true;
  
  // Some APIs return verifiedType as a string
  if (author.verifiedType && ["blue", "gold", "business", "government"].includes(author.verifiedType.toLowerCase())) {
    return true;
  }
  
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const debug: DebugInfo = {
    tweetsSearched: 0,
    eligibleTweets: 0,
    repliesSent: 0,
    followUpsProcessed: 0,
    errors: [],
    scanStoppedReason: "",
  };

  try {

    // Check kill switches
    const ENABLE_PROMO_MENTIONS = Deno.env.get("ENABLE_PROMO_MENTIONS");
    const ENABLE_X_POSTING = Deno.env.get("ENABLE_X_POSTING");

    if (ENABLE_X_POSTING !== "true") {
      debug.scanStoppedReason = "ENABLE_X_POSTING is not true (master kill switch)";
      return new Response(JSON.stringify({ ok: true, debug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ENABLE_PROMO_MENTIONS !== "true") {
      debug.scanStoppedReason = "ENABLE_PROMO_MENTIONS is not true";
      return new Response(JSON.stringify({ ok: true, debug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get required env vars
    const TWITTERAPI_IO_KEY = Deno.env.get("TWITTERAPI_IO_KEY");
    const X_FULL_COOKIE = Deno.env.get("X_FULL_COOKIE");
    const TWITTER_PROXY = Deno.env.get("TWITTER_PROXY") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!TWITTERAPI_IO_KEY || !X_FULL_COOKIE) {
      debug.scanStoppedReason = "Missing TWITTERAPI_IO_KEY or X_FULL_COOKIE";
      debug.errors.push(debug.scanStoppedReason);
      return new Response(JSON.stringify({ ok: false, debug }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Acquire cron lock
    const lockName = "promo-mention-reply";
    const { data: lockData, error: lockError } = await supabase
      .from("cron_locks")
      .upsert(
        {
          lock_name: lockName,
          acquired_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 55000).toISOString(),
        },
        { onConflict: "lock_name" }
      )
      .select()
      .single();

    if (lockError) {
      debug.scanStoppedReason = `Lock acquisition failed: ${lockError.message}`;
      return new Response(JSON.stringify({ ok: true, debug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hourly limit removed - no rate limiting

    // QUEUE-BASED APPROACH: Pull pre-validated tweets from the queue
    // The promo-mention-scan function runs every 2 minutes and populates the queue
    // This function just picks from the queue and sends replies immediately
    
    // Get oldest pending tweet from queue
    const { data: queuedTweets, error: queueError } = await supabase
      .from("promo_mention_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    debug.tweetsSearched = queuedTweets?.length || 0;
    debug.eligibleTweets = queuedTweets?.length || 0;

    if (queueError) {
      debug.errors.push(`Queue fetch error: ${queueError.message}`);
    }

    const queuedTweet = queuedTweets?.[0];

    if (queuedTweet) {
      // Skip tweets with no meaningful text (just mentions, images, URLs)
      if (!hasMeaningfulText(queuedTweet.tweet_text || "")) {
        await supabase
          .from("promo_mention_queue")
          .update({ status: "skipped" })
          .eq("id", queuedTweet.id);
        console.log(`[promo-mention-reply] Skipped tweet ${queuedTweet.tweet_id} — no meaningful text`);
      } else {
      // Mark as processing to prevent race conditions
      await supabase
        .from("promo_mention_queue")
        .update({ status: "processing", processed_at: new Date().toISOString() })
        .eq("id", queuedTweet.id);

      // Author cooldown check (still do this at reply time)
      let skipDueToCooldown = false;
      if (queuedTweet.tweet_author_id) {
        const cooldownTime = new Date(
          Date.now() - AUTHOR_COOLDOWN_HOURS * 60 * 60 * 1000
        ).toISOString();
        const { count: authorRecent } = await supabase
          .from("promo_mention_replies")
          .select("*", { count: "exact", head: true })
          .eq("tweet_author_id", queuedTweet.tweet_author_id)
          .eq("reply_type", "initial")
          .gte("created_at", cooldownTime);

        if ((authorRecent || 0) > 0) {
          skipDueToCooldown = true;
          await supabase
            .from("promo_mention_queue")
            .update({ status: "skipped" })
            .eq("id", queuedTweet.id);
        }
      }

      if (!skipDueToCooldown) {
        const username = queuedTweet.tweet_author || "user";
        const replyText = await generateReply(queuedTweet.tweet_text || "", username, false);

        if (!replyText) {
          debug.errors.push(`Failed to generate reply for tweet ${queuedTweet.tweet_id}`);
          await supabase
            .from("promo_mention_queue")
            .update({ status: "skipped" })
            .eq("id", queuedTweet.id);
        } else {
          const result = await postReply(
            queuedTweet.tweet_id,
            replyText,
            TWITTERAPI_IO_KEY,
            X_FULL_COOKIE,
            TWITTER_PROXY
          );

          // Record in database
          await supabase.from("promo_mention_replies").insert({
            tweet_id: queuedTweet.tweet_id,
            tweet_author: username,
            tweet_author_id: queuedTweet.tweet_author_id || null,
            tweet_text: queuedTweet.tweet_text,
            conversation_id: queuedTweet.conversation_id || queuedTweet.tweet_id,
            reply_id: result.replyId || null,
            reply_text: replyText,
            reply_type: "initial",
            mention_type: queuedTweet.mention_type,
            status: result.success ? "sent" : "failed",
            error_message: result.error || null,
          });

          // Mark queue entry as sent
          await supabase
            .from("promo_mention_queue")
            .update({ status: result.success ? "sent" : "skipped" })
            .eq("id", queuedTweet.id);

          // Also record in twitter_bot_replies for cross-dedup
          if (result.success) {
            try {
              await supabase.from("twitter_bot_replies").insert({
                tweet_id: queuedTweet.tweet_id,
                reply_tweet_id: result.replyId,
                reply_type: "promo_mention",
              });
            } catch {
              // Ignore cross-dedup insert errors
            }

            debug.repliesSent++;
          } else {
            debug.errors.push(`Reply failed for ${queuedTweet.tweet_id}: ${result.error}`);
          }
        }
      }
      } // end else (hasMeaningfulText)
    }

    // Skip follow-ups if we already sent a reply this run (1 tweet per minute rule)
    // Follow-ups will be processed in a future run when no new mentions need replies

    // Release lock
    await supabase.from("cron_locks").delete().eq("lock_name", lockName);

    if (!debug.scanStoppedReason) {
      debug.scanStoppedReason = "Completed successfully";
    }

    return new Response(
      JSON.stringify({
        ok: true,
        repliesSent: debug.repliesSent,
        followUpsProcessed: debug.followUpsProcessed,
        debug,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Promo mention reply error:", e);
    debug.errors.push(e instanceof Error ? e.message : "Unknown error");
    debug.scanStoppedReason = "Uncaught exception";

    return new Response(JSON.stringify({ ok: false, debug }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
