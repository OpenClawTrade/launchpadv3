import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

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

interface AccountWithRules {
  id: string;
  username: string;
  is_active: boolean;
  rules: {
    monitored_mentions: string[];
    tracked_cashtags: string[];
    min_follower_count: number;
    require_blue_verified: boolean;
    require_gold_verified: boolean;
    enabled: boolean;
  } | null;
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

async function searchTweets(apiKey: string, query: string): Promise<Tweet[]> {
  const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
  searchUrl.searchParams.set("query", `${query} -is:retweet -is:reply`);
  searchUrl.searchParams.set("queryType", "Latest");

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

function isRecentTweet(createdAt: string | undefined, maxAgeMinutes: number): boolean {
  if (!createdAt) return false;
  const tweetTime = new Date(createdAt).getTime();
  return Date.now() - tweetTime < maxAgeMinutes * 60 * 1000;
}

function isActuallyReply(tweet: Tweet): boolean {
  if (tweet.inReplyToTweetId) return true;
  const text = tweet.text.trim();
  if (text.startsWith("@")) {
    const firstWord = text.split(/\s/)[0].toLowerCase();
    // Check if it's replying to someone other than our monitored accounts
    if (!["@moltbook", "@openclaw", "@buildtuna", "@tunalaunch"].includes(firstWord)) {
      return true;
    }
  }
  return false;
}

function hasVerificationBadge(tweet: Tweet, requireBlue: boolean, requireGold: boolean): boolean {
  const author = tweet.author;
  if (!author) return false;
  
  // If both are required, need to match at least one
  if (!requireBlue && !requireGold) return true; // No verification required
  
  const isBlue = author.isBlueVerified === true || author.verified === true;
  const isGold = author.isGoldVerified === true || 
    (author.verifiedType && ["gold", "business", "government"].includes(author.verifiedType.toLowerCase()));
  
  if (requireGold && isGold) return true;
  if (requireBlue && isBlue) return true;
  
  return false;
}

function getFollowerCount(tweet: Tweet): number {
  const author = tweet.author;
  if (!author) return 0;
  return author.followersCount || author.followers || 0;
}

function determineMentionType(text: string, mentions: string[], cashtags: string[]): string {
  const textLower = text.toLowerCase();
  
  // Check cashtags first
  for (const tag of cashtags) {
    if (textLower.includes(tag.toLowerCase())) {
      return `cashtag:${tag}`;
    }
  }
  
  // Check mentions
  for (const mention of mentions) {
    if (textLower.includes(mention.toLowerCase())) {
      return `mention:${mention}`;
    }
  }
  
  return "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const debug = { 
    accountsProcessed: 0, 
    tweetsSearched: 0, 
    queued: 0, 
    skipped: 0, 
    errors: [] as string[] 
  };

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

    // Acquire lock
    const lockName = "x-bot-scan";
    await supabase.from("cron_locks").upsert({
      lock_name: lockName,
      acquired_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 110000).toISOString(),
    }, { onConflict: "lock_name" });

    // Get all active accounts with their rules
    const { data: accounts, error: accountsError } = await supabase
      .from("x_bot_accounts")
      .select(`
        id,
        username,
        is_active,
        x_bot_account_rules (
          monitored_mentions,
          tracked_cashtags,
          min_follower_count,
          require_blue_verified,
          require_gold_verified,
          enabled
        )
      `)
      .eq("is_active", true);

    if (accountsError) {
      debug.errors.push(`Accounts fetch error: ${accountsError.message}`);
      throw accountsError;
    }

    // Process each active account
    for (const account of accounts || []) {
      const rules = (account as any).x_bot_account_rules?.[0];
      if (!rules?.enabled) continue;

      debug.accountsProcessed++;

      // Build search queries from mentions and cashtags
      const mentions = rules.monitored_mentions || [];
      const cashtags = rules.tracked_cashtags || [];
      
      if (mentions.length === 0 && cashtags.length === 0) continue;

      // Search for mentions
      const mentionQuery = mentions.map((m: string) => `(${m})`).join(" OR ");
      const cashtagQuery = cashtags.map((t: string) => `(${t})`).join(" OR ");
      const fullQuery = [mentionQuery, cashtagQuery].filter(Boolean).join(" OR ");

      if (!fullQuery) continue;

      const tweets = await searchTweets(TWITTERAPI_IO_KEY, fullQuery);
      debug.tweetsSearched += tweets.length;

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

        // Check verification requirements
        if (!hasVerificationBadge(tweet, rules.require_blue_verified, rules.require_gold_verified)) {
          debug.skipped++;
          continue;
        }

        // Check follower count
        const followers = getFollowerCount(tweet);
        if (followers < (rules.min_follower_count || 5000)) {
          debug.skipped++;
          continue;
        }

        // Skip own tweets
        const username = tweet.author?.userName?.toLowerCase() || "";
        if (username === account.username.toLowerCase()) {
          debug.skipped++;
          continue;
        }

        // Check if already in queue
        const { data: existingQueue } = await supabase
          .from("x_bot_account_queue")
          .select("id")
          .eq("account_id", account.id)
          .eq("tweet_id", tweet.id)
          .single();

        if (existingQueue) continue;

        // Check if already replied
        const { data: existingReply } = await supabase
          .from("x_bot_account_replies")
          .select("id")
          .eq("account_id", account.id)
          .eq("tweet_id", tweet.id)
          .single();

        if (existingReply) continue;

        // Add to queue
        const { error: insertError } = await supabase.from("x_bot_account_queue").insert({
          account_id: account.id,
          tweet_id: tweet.id,
          tweet_author: tweet.author?.userName || null,
          tweet_author_id: tweet.author?.id || null,
          tweet_text: tweet.text.substring(0, 500),
          conversation_id: tweet.conversationId || tweet.id,
          follower_count: followers,
          is_verified: true,
          match_type: determineMentionType(tweet.text, mentions, cashtags),
          status: "pending",
        });

        if (!insertError) {
          debug.queued++;
        } else {
          debug.errors.push(`Insert error: ${insertError.message}`);
        }
      }
    }

    // Cleanup old queue entries (older than 2 hours)
    await supabase
      .from("x_bot_account_queue")
      .delete()
      .lt("created_at", new Date(Date.now() - 7200000).toISOString());

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
