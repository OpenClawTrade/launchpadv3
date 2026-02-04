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
const RUN_BUDGET_MS = 25_000;
const MAX_REPLIES_PER_HOUR = 20;
const AUTHOR_COOLDOWN_HOURS = 6;
const MAX_REPLIES_PER_THREAD = 3;
const REPLY_SIGNATURE = "Tuna Launchpad for AI Agents on Solana.";

const BOT_USERNAMES = new Set([
  "buildtuna",
  "tunalaunch",
  "moltbook",
  "openclaw",
  "tuna_launch",
  "tunaagents",
]);

interface Tweet {
  id: string;
  text: string;
  author?: { userName?: string; id?: string };
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
  searchUrl.searchParams.set("query", "(@moltbook OR @openclaw) -is:retweet");
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

  const systemPrompt = isFollowUp
    ? `You are continuing a friendly crypto conversation. Generate a short, natural reply (max 200 chars before signature). Be conversational and relevant. Do NOT repeat yourself from previous replies.`
    : `You are a friendly crypto community member. Generate a short, conversational reply (max 200 chars before signature) to this tweet. Be relevant and add value. Do NOT be promotional or spammy. Sound human and authentic.`;

  const userPrompt = `Tweet by @${username}: "${tweetText.substring(0, 500)}"

End your reply with exactly: "${REPLY_SIGNATURE}"

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
          model: "openai/gpt-5-mini",
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

    // Ensure signature is present
    if (reply && !reply.includes(REPLY_SIGNATURE)) {
      reply = reply.substring(0, 230) + " " + REPLY_SIGNATURE;
    }

    // Trim if too long
    if (reply && reply.length > 280) {
      const sigIndex = reply.lastIndexOf(REPLY_SIGNATURE);
      if (sigIndex > 0) {
        reply = reply.substring(0, 280 - REPLY_SIGNATURE.length - 1) + " " + REPLY_SIGNATURE;
      }
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
    const response = await fetchWithTimeout(
      `${TWITTERAPI_BASE}/twitter/tweet/create_tweet_v2`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          login_cookies: cookie,
          tweet_text: replyText,
          reply_to_tweet_id: tweetId,
          proxy: proxy,
        }),
      },
      20000
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || `HTTP ${response.status}` };
    }

    const replyId = data.data?.tweet?.rest_id || data.tweet_id || data.id;
    return { success: true, replyId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

function determineMentionType(text: string): "moltbook" | "openclaw" | "both" {
  const hasMoltbook = text.toLowerCase().includes("@moltbook");
  const hasOpenclaw = text.toLowerCase().includes("@openclaw");
  if (hasMoltbook && hasOpenclaw) return "both";
  if (hasMoltbook) return "moltbook";
  return "openclaw";
}

function isRecentTweet(createdAt: string | undefined, maxAgeMinutes: number): boolean {
  if (!createdAt) return false;
  const tweetTime = new Date(createdAt).getTime();
  const now = Date.now();
  return now - tweetTime < maxAgeMinutes * 60 * 1000;
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

    // Check hourly rate limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentReplies } = await supabase
      .from("promo_mention_replies")
      .select("*", { count: "exact", head: true })
      .gte("created_at", oneHourAgo)
      .eq("status", "sent");

    if ((recentReplies || 0) >= MAX_REPLIES_PER_HOUR) {
      debug.scanStoppedReason = `Hourly limit reached: ${recentReplies}/${MAX_REPLIES_PER_HOUR}`;
      return new Response(JSON.stringify({ ok: true, debug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search for mentions
    const tweets = await searchMentions(TWITTERAPI_IO_KEY);
    debug.tweetsSearched = tweets.length;

    // Filter eligible tweets
    const thirtyMinutesAgo = 30;
    const eligibleTweets: Tweet[] = [];

    for (const tweet of tweets) {
      // Time budget check
      if (Date.now() - startTime > RUN_BUDGET_MS - 5000) {
        debug.scanStoppedReason = "Time budget exhausted during filtering";
        break;
      }

      // Skip old tweets
      if (!isRecentTweet(tweet.createdAt, thirtyMinutesAgo)) continue;

      const username = tweet.author?.userName?.toLowerCase() || "";

      // Skip bots
      if (BOT_USERNAMES.has(username)) continue;

      // Skip if contains our signature (self-reply prevention)
      if (tweet.text.includes(REPLY_SIGNATURE)) continue;

      // Check if already replied
      const { data: existing } = await supabase
        .from("promo_mention_replies")
        .select("id")
        .eq("tweet_id", tweet.id)
        .single();

      if (existing) continue;

      // Cross-check with twitter_bot_replies
      const { data: botReplied } = await supabase
        .from("twitter_bot_replies")
        .select("id")
        .eq("tweet_id", tweet.id)
        .single();

      if (botReplied) continue;

      // Author cooldown check
      if (tweet.author?.id) {
        const cooldownTime = new Date(
          Date.now() - AUTHOR_COOLDOWN_HOURS * 60 * 60 * 1000
        ).toISOString();
        const { count: authorRecent } = await supabase
          .from("promo_mention_replies")
          .select("*", { count: "exact", head: true })
          .eq("tweet_author_id", tweet.author.id)
          .eq("reply_type", "initial")
          .gte("created_at", cooldownTime);

        if ((authorRecent || 0) > 0) continue;
      }

      eligibleTweets.push(tweet);
    }

    debug.eligibleTweets = eligibleTweets.length;

    // Process eligible tweets
    for (const tweet of eligibleTweets) {
      if (Date.now() - startTime > RUN_BUDGET_MS - 3000) {
        debug.scanStoppedReason = "Time budget exhausted during replies";
        break;
      }

      // Recheck hourly limit
      const { count: currentCount } = await supabase
        .from("promo_mention_replies")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneHourAgo)
        .eq("status", "sent");

      if ((currentCount || 0) >= MAX_REPLIES_PER_HOUR) {
        debug.scanStoppedReason = "Hourly limit reached during processing";
        break;
      }

      const username = tweet.author?.userName || "user";
      const replyText = await generateReply(tweet.text, username, false);

      if (!replyText) {
        debug.errors.push(`Failed to generate reply for tweet ${tweet.id}`);
        continue;
      }

      const result = await postReply(
        tweet.id,
        replyText,
        TWITTERAPI_IO_KEY,
        X_FULL_COOKIE,
        TWITTER_PROXY
      );

      // Record in database
      const mentionType = determineMentionType(tweet.text);
      await supabase.from("promo_mention_replies").insert({
        tweet_id: tweet.id,
        tweet_author: username,
        tweet_author_id: tweet.author?.id || null,
        tweet_text: tweet.text.substring(0, 500),
        conversation_id: tweet.conversationId || tweet.id,
        reply_id: result.replyId || null,
        reply_text: replyText,
        reply_type: "initial",
        mention_type: mentionType,
        status: result.success ? "sent" : "failed",
        error_message: result.error || null,
      });

      // Also record in twitter_bot_replies for cross-dedup
      if (result.success) {
        try {
          await supabase.from("twitter_bot_replies").insert({
            tweet_id: tweet.id,
            reply_tweet_id: result.replyId,
            reply_type: "promo_mention",
          });
        } catch {
          // Ignore cross-dedup insert errors
        }

        debug.repliesSent++;
      } else {
        debug.errors.push(`Reply failed for ${tweet.id}: ${result.error}`);
      }
    }

    // Process follow-ups (if time permits)
    if (Date.now() - startTime < RUN_BUDGET_MS - 5000) {
      // Find our recent replies that can have follow-ups
      const { data: pendingFollowUps } = await supabase
        .from("promo_mention_replies")
        .select("*")
        .eq("status", "sent")
        .neq("reply_type", "followup_2")
        .not("reply_id", "is", null)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(10);

      for (const ourReply of pendingFollowUps || []) {
        if (Date.now() - startTime > RUN_BUDGET_MS - 3000) break;

        // Search for replies to our tweet
        const replies = await searchRepliesTo(ourReply.reply_id!, TWITTERAPI_IO_KEY);

        for (const reply of replies) {
          // Check if this is from the original author
          if (reply.author?.userName?.toLowerCase() !== ourReply.tweet_author.toLowerCase())
            continue;

          // Check if we already replied to this
          const { data: alreadyReplied } = await supabase
            .from("promo_mention_replies")
            .select("id")
            .eq("tweet_id", reply.id)
            .single();

          if (alreadyReplied) continue;

          // Count replies in this thread
          const { count: threadCount } = await supabase
            .from("promo_mention_replies")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", ourReply.conversation_id);

          if ((threadCount || 0) >= MAX_REPLIES_PER_THREAD) continue;

          // Determine follow-up type
          const nextType = ourReply.reply_type === "initial" ? "followup_1" : "followup_2";

          // Generate follow-up reply
          const followUpText = await generateReply(
            reply.text,
            reply.author?.userName || "user",
            true
          );

          if (!followUpText) continue;

          const result = await postReply(
            reply.id,
            followUpText,
            TWITTERAPI_IO_KEY,
            X_FULL_COOKIE,
            TWITTER_PROXY
          );

          await supabase.from("promo_mention_replies").insert({
            tweet_id: reply.id,
            tweet_author: reply.author?.userName || "user",
            tweet_author_id: reply.author?.id || null,
            tweet_text: reply.text.substring(0, 500),
            conversation_id: ourReply.conversation_id,
            reply_id: result.replyId || null,
            reply_text: followUpText,
            reply_type: nextType,
            mention_type: ourReply.mention_type,
            status: result.success ? "sent" : "failed",
            error_message: result.error || null,
          });

          if (result.success) {
            debug.followUpsProcessed++;
          }

          break; // One follow-up per thread per run
        }
      }
    }

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
