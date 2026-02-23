import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const MAX_REPLIES_PER_RUN = 4;
const TWEET_RECENCY_HOURS = 24;
const RUN_BUDGET_MS = 55_000;
const MEMBERS_SCAN_CAP = 30;
const MAX_MEMBERS = 200;
const MAX_ELIGIBLE_TWEETS_MULTIPLIER = 10;
const DEFAULT_HTTP_TIMEOUT_MS = 7_000;

// ── Cookie helpers (ported from x-bot-reply) ──────────────────────────

function parseCookieString(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = raw.split(";");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

function buildLoginCookiesBase64(fullCookie: string): string | null {
  const cookies = parseCookieString(fullCookie);
  if (!cookies.auth_token || !cookies.ct0) {
    console.error("Cookie missing auth_token or ct0");
    return null;
  }
  return btoa(JSON.stringify(cookies));
}

// ── Reply persona ─────────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT = `You're a knowledgeable crypto native with genuine opinions.
Generate a reply (max 240 chars).

READING COMPREHENSION (CRITICAL):
- Before replying, carefully re-read the tweet and identify: WHO is doing WHAT to WHOM.
- Do NOT misinterpret the subject/object of the sentence.
- Example: "Why's everyone begging for money from ai agents" means PEOPLE are begging FROM AGENTS — do NOT reply as if agents are begging.
- If someone says "X is doing Y", reply about X doing Y, not Y doing X.
- Pay attention to pronouns like "this", "that", "they" — figure out what they refer to before replying.

Rules:
- Have opinions. Commit to a take. No hedging.
- Never open with "Great question" or "Absolutely". Just answer.
- Brevity mandatory. One sentence if it fits.
- Natural wit welcome, not forced jokes.
- Be honest but respectful. Disagree without being dismissive or insulting.
- NO swearing. NO insults. NO calling people clueless, lazy, or grifters.
- Do NOT mention any specific launchpad, platform, agent, or product.
- No taglines, signatures, hashtags, or calls to action.

Be the thoughtful reply you'd want to read.
Confident, not aggressive. Sharp, not mean.`;

// ── Utilities ─────────────────────────────────────────────────────────

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  const headers: HeadersInit = {
    ...corsHeaders,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_HTTP_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function msSince(startMs: number) { return Date.now() - startMs; }
function timeLeftMs(startMs: number) { return RUN_BUDGET_MS - msSince(startMs); }

// ── Tweet extraction (handles actual twitterapi.io response) ──────────

function extractTweets(tweetsData: any): any[] {
  // Primary: { data: { tweets: [...] } }
  if (tweetsData?.data?.tweets && Array.isArray(tweetsData.data.tweets)) {
    return tweetsData.data.tweets;
  }
  // Fallback: { data: [...] } (array directly)
  if (Array.isArray(tweetsData?.data)) {
    return tweetsData.data;
  }
  // Fallback: { tweets: [...] }
  if (Array.isArray(tweetsData?.tweets)) {
    return tweetsData.tweets;
  }
  // Fallback: top-level array
  if (Array.isArray(tweetsData)) {
    return tweetsData;
  }
  return [];
}

// ── Fetch all list members with pagination ────────────────────────────

async function fetchAllMembers(
  listId: string,
  apiKey: string,
  startMs: number,
): Promise<{ members: any[]; pages: number }> {
  const allMembers: any[] = [];
  let cursor: string | undefined;
  let pages = 0;

  while (allMembers.length < MAX_MEMBERS && timeLeftMs(startMs) > 8_000) {
    const url = cursor
      ? `https://api.twitterapi.io/twitter/list/members?list_id=${listId}&cursor=${cursor}`
      : `https://api.twitterapi.io/twitter/list/members?list_id=${listId}`;

    const res = await fetchWithTimeout(url, { headers: { "X-API-Key": apiKey } }, 8_000);
    if (!res.ok) {
      console.error(`Members page ${pages} failed: ${res.status}`);
      break;
    }

    const data = await res.json();
    const batch = data.users || data.members || [];
    allMembers.push(...batch);
    pages++;

    if (!data.has_next_page || !data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return { members: allMembers.slice(0, MAX_MEMBERS), pages };
}

// ── Main handler ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const runStartedAtMs = Date.now();

    const TWITTERAPI_IO_KEY = Deno.env.get("TWITTERAPI_IO_KEY");
    const X_FULL_COOKIE = Deno.env.get("X_FULL_COOKIE");
    const TWITTER_PROXY = Deno.env.get("TWITTER_PROXY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ENABLE_INFLUENCER_REPLIES = Deno.env.get("ENABLE_INFLUENCER_REPLIES") !== "false";

    const debug: Record<string, unknown> = {
      runStartedAt: new Date(runStartedAtMs).toISOString(),
      runBudgetMs: RUN_BUDGET_MS,
    };

    if (!TWITTERAPI_IO_KEY || !X_FULL_COOKIE || !LOVABLE_API_KEY) {
      return jsonResponse({ error: "Missing required environment variables", debug }, { status: 500 });
    }

    // Build login cookies (JSON → base64)
    const loginCookies = buildLoginCookiesBase64(X_FULL_COOKIE);
    if (!loginCookies) {
      return jsonResponse({ error: "Cookie parsing failed — missing auth_token or ct0", debug }, { status: 500 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Status endpoint
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "status") {
      const { data: config } = await supabase.from("influencer_list_config").select("*").single();
      const { data: recentReplies } = await supabase
        .from("influencer_replies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      const { count: hourlyCount } = await supabase
        .from("influencer_replies")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", new Date(Date.now() - 3600_000).toISOString());

      return jsonResponse({ config, recentReplies, repliesLastHour: hourlyCount, enabled: ENABLE_INFLUENCER_REPLIES });
    }


    if (!ENABLE_INFLUENCER_REPLIES) {
      console.log("Influencer replies disabled via kill switch");
      return jsonResponse({ message: "Influencer replies disabled", debug });
    }

    // Get active list config
    const { data: config, error: configError } = await supabase
      .from("influencer_list_config")
      .select("*")
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      console.log("No active influencer list config found");
      return jsonResponse({ message: "No active list config", debug });
    }

    // Hourly rate limit (20/hour)
    const { count: hourlyCount } = await supabase
      .from("influencer_replies")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());

    if ((hourlyCount || 0) >= 20) {
      console.log("Hourly rate limit reached (20/hour)");
      return jsonResponse({ message: "Hourly rate limit reached", count: hourlyCount, debug });
    }

    const maxReplies = Math.min(config.max_replies_per_run || MAX_REPLIES_PER_RUN, 20 - (hourlyCount || 0));

    // ── Fetch all list members (with pagination) ──────────────────────
    console.log(`Fetching members from list ${config.list_id}...`);
    const { members, pages } = await fetchAllMembers(config.list_id, TWITTERAPI_IO_KEY, runStartedAtMs);
    console.log(`Found ${members.length} members across ${pages} page(s)`);
    debug.membersTotal = members.length;
    debug.memberPages = pages;

    if (members.length === 0) {
      return jsonResponse({ message: "No members found in list", debug });
    }

    // Already-replied tweet IDs
    const { data: existingReplies } = await supabase
      .from("influencer_replies")
      .select("tweet_id")
      .eq("list_id", config.list_id);
    const repliedTweetIds = new Set((existingReplies || []).map((r: any) => r.tweet_id));
    debug.alreadyRepliedCount = repliedTweetIds.size;

    // ── Scan members for eligible tweets ──────────────────────────────
    const eligibleTweets: any[] = [];
    const cutoffTime = Date.now() - TWEET_RECENCY_HOURS * 3600_000;
    let totalTweetsFetched = 0;
    let skippedAlreadyReplied = 0;
    let skippedTooOld = 0;
    let skippedType = 0;
    let membersScanned = 0;
    let stoppedReason: string | null = null;
    const maxEligibleTweets = maxReplies * MAX_ELIGIBLE_TWEETS_MULTIPLIER;
    const membersToScan = members.slice(0, MEMBERS_SCAN_CAP);

    for (const member of membersToScan) {
      if (timeLeftMs(runStartedAtMs) < 6_000) { stoppedReason = "time_budget_scan"; break; }

      const username = member.userName || member.username || member.screen_name;
      if (!username) continue;

      try {
        const tweetsResponse = await fetchWithTimeout(
          `https://api.twitterapi.io/twitter/user/last_tweets?userName=${username}`,
          { headers: { "X-API-Key": TWITTERAPI_IO_KEY } },
          6_000,
        );
        if (!tweetsResponse.ok) { console.log(`Tweets ${username}: ${tweetsResponse.status}`); continue; }

        const tweetsData = await tweetsResponse.json();
        const tweets = extractTweets(tweetsData);

        // Debug first member's response structure
        if (membersScanned === 0) {
          console.log(`First member ${username}: keys=${Object.keys(tweetsData || {}).join(",")}, tweets=${tweets.length}`);
          if (tweetsData?.data) console.log(`  data keys: ${Object.keys(tweetsData.data).join(",")}`);
        }

        totalTweetsFetched += tweets.length;

        for (const tweet of tweets) {
          const tweetId = tweet.id || tweet.id_str;
          if (!tweetId) continue;
          if (repliedTweetIds.has(tweetId)) { skippedAlreadyReplied++; continue; }

          const tweetDate = new Date(tweet.createdAt || tweet.created_at).getTime();
          if (tweetDate < cutoffTime) { skippedTooOld++; continue; }

          const isRetweet = tweet.isRetweet || tweet.retweeted_status || tweet.text?.startsWith("RT @");
          const isReply = tweet.isReply || tweet.in_reply_to_status_id || tweet.inReplyToId;

          if (isRetweet) { if (!config.include_retweets) { skippedType++; continue; } }
          else if (isReply) { if (!config.include_replies) { skippedType++; continue; } }

          const likes = tweet.likeCount || tweet.favorite_count || 0;
          const replies = tweet.replyCount || tweet.reply_count || 0;
          const retweets = tweet.retweetCount || tweet.retweet_count || 0;

          eligibleTweets.push({
            id: tweetId,
            text: tweet.text || tweet.full_text,
            username,
            tweetType: isRetweet ? "retweet" : isReply ? "reply" : "original",
            engagement: likes + replies * 2 + retweets * 3,
            createdAt: tweet.createdAt || tweet.created_at,
          });

          if (eligibleTweets.length >= maxEligibleTweets) { stoppedReason = "eligible_cap_reached"; break; }
        }

        membersScanned++;
        if (stoppedReason) break;
      } catch (err) {
        console.error(`Error ${username}:`, err);
      }
    }

    debug.membersScanned = membersScanned;
    debug.totalTweetsFetched = totalTweetsFetched;
    debug.skippedTooOld = skippedTooOld;
    debug.skippedAlreadyReplied = skippedAlreadyReplied;
    debug.skippedType = skippedType;
    debug.eligibleTweetsFound = eligibleTweets.length;
    debug.scanStoppedReason = stoppedReason;

    console.log(`Tweets: fetched=${totalTweetsFetched} eligible=${eligibleTweets.length} skippedOld=${skippedTooOld} skippedReplied=${skippedAlreadyReplied}`);

    if (eligibleTweets.length === 0) {
      debug.totalRunMs = msSince(runStartedAtMs);
      return jsonResponse({ message: "No eligible tweets to reply to", debug });
    }

    // Sort by engagement, take top N
    eligibleTweets.sort((a, b) => b.engagement - a.engagement);
    const tweetsToReply = eligibleTweets.slice(0, maxReplies);

    // ── Generate & send replies ───────────────────────────────────────
    const results: any[] = [];

    for (const tweet of tweetsToReply) {
      if (timeLeftMs(runStartedAtMs) < 7_000) { debug.repliesStoppedReason = "time_budget_reply"; break; }

      try {
        // Generate AI reply with system/user split
        const aiBody = {
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: DEFAULT_SYSTEM_PROMPT },
            { role: "user", content: `Tweet by @${tweet.username}: "${tweet.text}"\n\nReply (max 240 chars, no quotes):` },
          ],
          max_tokens: 150,
        };

        const aiResponse = await fetchWithTimeout(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(aiBody),
          },
          8_000,
        );

        if (!aiResponse.ok) { console.error("AI failed:", await aiResponse.text()); continue; }

        const aiData = await aiResponse.json();
        let replyText = aiData.choices?.[0]?.message?.content?.trim() || "";
        replyText = replyText.replace(/^["']|["']$/g, "").trim();
        if (replyText.length > 280) replyText = replyText.substring(0, 277) + "...";
        if (!replyText) { console.error("Empty AI reply"); continue; }

        console.log(`Replying to @${tweet.username}: "${replyText.substring(0, 50)}..."`);

        // Insert pending record
        await supabase.from("influencer_replies").insert({
          list_id: config.list_id,
          influencer_username: tweet.username,
          tweet_id: tweet.id,
          tweet_text: tweet.text?.substring(0, 500),
          tweet_type: tweet.tweetType,
          reply_text: replyText,
          status: "pending",
        });

        // Post reply via twitterapi.io
        const postResponse = await fetchWithTimeout(
          "https://api.twitterapi.io/twitter/create_tweet_v2",
          {
            method: "POST",
            headers: { "X-API-Key": TWITTERAPI_IO_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              tweet_text: replyText,
              reply_to_tweet_id: tweet.id,
              login_cookies: loginCookies,
              ...(TWITTER_PROXY && { proxy: TWITTER_PROXY }),
            }),
          },
          8_000,
        );

        const postText = await postResponse.text();
        console.log(`Post response for @${tweet.username}: ${postText.slice(0, 300)}`);
        
        let postData: any = {};
        try { postData = JSON.parse(postText); } catch { postData = { raw: postText }; }

        // Extract reply ID from various response formats
        const replyId = postData.data?.id || postData.data?.tweet_id || postData.tweet?.id || 
                        postData.tweet_id || postData.id || postData.data?.rest_id;
        
        // Detect success: either we got a reply ID, or the message says success
        const isSuccess = !!replyId || 
          postData.msg?.toLowerCase()?.includes("success") || 
          postData.status === "success";

        if (isSuccess) {
          await supabase.from("influencer_replies").update({ status: "sent", reply_id: replyId || "unknown" }).eq("tweet_id", tweet.id);
          results.push({ success: true, username: tweet.username, tweetId: tweet.id, replyId: replyId || "unknown" });
          console.log(`✅ Replied to @${tweet.username}`);
        } else {
          const errorMsg = postData.error || postData.message || postText.slice(0, 200);
          await supabase.from("influencer_replies").update({ status: "failed", error_message: errorMsg }).eq("tweet_id", tweet.id);
          results.push({ success: false, username: tweet.username, tweetId: tweet.id, error: errorMsg });
          console.error(`❌ @${tweet.username}:`, errorMsg);
        }

        if (timeLeftMs(runStartedAtMs) > 2_000) await new Promise(r => setTimeout(r, 700));
      } catch (err) {
        console.error(`Error tweet ${tweet.id}:`, err);
        results.push({ success: false, tweetId: tweet.id, error: String(err) });
      }
    }

    debug.totalRunMs = msSince(runStartedAtMs);
    return jsonResponse({
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      debug,
    });
  } catch (error) {
    console.error("Influencer reply error:", error);
    return jsonResponse({ error: String(error) }, { status: 500 });
  }
});
