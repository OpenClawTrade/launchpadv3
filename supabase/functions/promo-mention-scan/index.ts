import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";
const BOT_USERNAMES = new Set([
  "clawmode", "moltbook", "openclaw",
]);

const MIN_FOLLOWER_COUNT = 5000; // Minimum followers for quality engagement

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

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchMentions(apiKey: string): Promise<Tweet[]> {
  const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
  // ONLY search for direct platform mentions - NO generic crypto terms
  searchUrl.searchParams.set("query", "(@moltbook OR @openclaw OR @clawmode) -is:retweet -is:reply");
  searchUrl.searchParams.set("queryType", "Latest");
  searchUrl.searchParams.set("count", "10"); // Limit to 10 results to save API credits

  try {
    const response = await fetchWithTimeout(
      searchUrl.toString(),
      { headers: { "X-API-Key": apiKey } },
      20000
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

function isActuallyReply(tweet: Tweet): boolean {
  if (tweet.inReplyToTweetId) return true;
  const text = tweet.text.trim();
  if (text.startsWith("@") && !text.startsWith("@moltbook") && !text.startsWith("@openclaw") && !text.startsWith("@Solana")) {
    return true;
  }
  return false;
}

function hasVerificationBadge(tweet: Tweet): boolean {
  const author = tweet.author;
  if (!author) return false;
  if (author.isBlueVerified === true) return true;
  if (author.isGoldVerified === true) return true;
  if (author.verified === true) return true;
  if (author.verifiedType && ["blue", "gold", "business", "government"].includes(author.verifiedType.toLowerCase())) {
    return true;
  }
  return false;
}

function determineMentionType(text: string): string {
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

function getFollowerCount(tweet: Tweet): number {
  const author = tweet.author;
  if (!author) return 0;
  return author.followersCount || author.followers || 0;
}

function isRecentTweet(createdAt: string | undefined, maxAgeMinutes: number): boolean {
  if (!createdAt) return false;
  const tweetTime = new Date(createdAt).getTime();
  return Date.now() - tweetTime < maxAgeMinutes * 60 * 1000;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const debug = { tweetsSearched: 0, queued: 0, skipped: 0, errors: [] as string[] };

  try {
    const ENABLE_PROMO_MENTIONS = Deno.env.get("ENABLE_PROMO_MENTIONS");
    const ENABLE_X_POSTING = Deno.env.get("ENABLE_X_POSTING");

    if (ENABLE_X_POSTING !== "true" || ENABLE_PROMO_MENTIONS !== "true") {
      return new Response(JSON.stringify({ ok: true, reason: "Kill switch disabled", debug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TWITTERAPI_IO_KEY = Deno.env.get("TWITTERAPI_IO_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!TWITTERAPI_IO_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Missing API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Skip scan if queue already has 5+ pending items (saves API credits)
    const { count: pendingCount } = await supabase
      .from("promo_mention_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (pendingCount && pendingCount >= 5) {
      return new Response(JSON.stringify({ ok: true, reason: "Queue has 5+ pending items, skipping scan", debug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Acquire lock
    const lockName = "promo-mention-scan";
    await supabase.from("cron_locks").upsert({
      lock_name: lockName,
      acquired_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 110000).toISOString(),
    }, { onConflict: "lock_name" });

    // Cleanup old queue entries
    await supabase.from("promo_mention_queue").delete().lt("created_at", new Date(Date.now() - 3600000).toISOString());

    // Search for mentions
    const tweets = await searchMentions(TWITTERAPI_IO_KEY);
    debug.tweetsSearched = tweets.length;

    for (const tweet of tweets) {
      // Skip old tweets (only last 30 minutes)
      if (!isRecentTweet(tweet.createdAt, 30)) {
        debug.skipped++;
        continue;
      }

      // Skip replies
      if (isActuallyReply(tweet)) {
        debug.skipped++;
        continue;
      }

      // Skip unverified
      if (!hasVerificationBadge(tweet)) {
        debug.skipped++;
        continue;
      }

      // Require minimum 5000 followers for quality engagement
      const followers = getFollowerCount(tweet);
      if (followers < MIN_FOLLOWER_COUNT) {
        debug.skipped++;
        continue;
      }

      const username = tweet.author?.userName?.toLowerCase() || "";
      if (BOT_USERNAMES.has(username)) {
        debug.skipped++;
        continue;
      }

      // Skip tweets from our own bot accounts
      const tweetAuthorLower = tweet.author?.userName?.toLowerCase() || "";
      if (BOT_USERNAMES.has(tweetAuthorLower)) {
        debug.skipped++;
        continue;
      }

      // Check if already in queue or already replied
      const { data: existingQueue } = await supabase
        .from("promo_mention_queue")
        .select("id")
        .eq("tweet_id", tweet.id)
        .single();

      if (existingQueue) continue;

      const { data: existingReply } = await supabase
        .from("promo_mention_replies")
        .select("id")
        .eq("tweet_id", tweet.id)
        .single();

      if (existingReply) continue;

      const { data: botReplied } = await supabase
        .from("twitter_bot_replies")
        .select("id")
        .eq("tweet_id", tweet.id)
        .single();

      if (botReplied) continue;

      // Add to queue
      const { error: insertError } = await supabase.from("promo_mention_queue").insert({
        tweet_id: tweet.id,
        tweet_author: tweet.author?.userName || null,
        tweet_author_id: tweet.author?.id || null,
        tweet_text: tweet.text.substring(0, 500),
        conversation_id: tweet.conversationId || tweet.id,
        mention_type: determineMentionType(tweet.text),
        follower_count: getFollowerCount(tweet),
        is_verified: hasVerificationBadge(tweet),
        tweet_created_at: tweet.createdAt || null,
        status: "pending",
      });

      if (!insertError) {
        debug.queued++;
      }
    }

    // Release lock
    await supabase.from("cron_locks").delete().eq("lock_name", lockName);

    return new Response(JSON.stringify({ ok: true, debug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    debug.errors.push(e instanceof Error ? e.message : "Unknown error");
    return new Response(JSON.stringify({ ok: false, debug }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
