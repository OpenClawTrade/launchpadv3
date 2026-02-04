import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Rate limits: 20 replies per hour = ~4 per 10-minute cycle
const MAX_REPLIES_PER_RUN = 4;
const TWEET_RECENCY_HOURS = 24; // Look at tweets from last 24 hours

// IMPORTANT: The browser will show a CORS error if the request times out upstream.
// So we enforce a strict per-run time budget to avoid gateway 504s.
const RUN_BUDGET_MS = 25_000;
const MEMBERS_SCAN_CAP = 25;
const MAX_ELIGIBLE_TWEETS_MULTIPLIER = 10; // e.g., 4 replies => collect up to 40 candidates

const DEFAULT_HTTP_TIMEOUT_MS = 7_000;

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

function msSince(startMs: number) {
  return Date.now() - startMs;
}

function timeLeftMs(startMs: number) {
  return RUN_BUDGET_MS - msSince(startMs);
}

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
      membersScanCap: MEMBERS_SCAN_CAP,
      tweetRecencyHours: TWEET_RECENCY_HOURS,
    };

    if (!TWITTERAPI_IO_KEY || !X_FULL_COOKIE || !LOVABLE_API_KEY) {
      return jsonResponse(
        { error: "Missing required environment variables", debug },
        { status: 500 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check for status request
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "status") {
      const { data: config } = await supabase
        .from("influencer_list_config")
        .select("*")
        .single();
      
      const { data: recentReplies } = await supabase
        .from("influencer_replies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      const { count: hourlyCount } = await supabase
        .from("influencer_replies")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

      return jsonResponse({
        config,
        recentReplies,
        repliesLastHour: hourlyCount,
        enabled: ENABLE_INFLUENCER_REPLIES,
      });
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

    // Check hourly rate limit (20 per hour)
    const { count: hourlyCount } = await supabase
      .from("influencer_replies")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if ((hourlyCount || 0) >= 20) {
      console.log("Hourly rate limit reached (20/hour)");
      return jsonResponse({ message: "Hourly rate limit reached", count: hourlyCount, debug });
    }

    const maxReplies = Math.min(config.max_replies_per_run || MAX_REPLIES_PER_RUN, 20 - (hourlyCount || 0));

    // Fetch list members
    console.log(`Fetching members from list ${config.list_id}...`);
    const membersFetchStartedAtMs = Date.now();
    const membersResponse = await fetchWithTimeout(
      `https://api.twitterapi.io/twitter/list/members?list_id=${config.list_id}`,
      { headers: { "X-API-Key": TWITTERAPI_IO_KEY } },
      8_000
    );
    debug.membersFetchMs = Date.now() - membersFetchStartedAtMs;

    if (!membersResponse.ok) {
      const errorText = await membersResponse.text();
      console.error("Failed to fetch list members:", errorText);
      return jsonResponse(
        { error: "Failed to fetch list members", details: errorText, debug },
        { status: 500 }
      );
    }

    const membersData = await membersResponse.json();
    const members = membersData.users || membersData.members || [];
    console.log(`Found ${members.length} members in list`);
    debug.membersTotal = members.length;

    if (members.length === 0) {
      return jsonResponse({ message: "No members found in list", debug });
    }

    // Get already replied tweet IDs
    const { data: existingReplies } = await supabase
      .from("influencer_replies")
      .select("tweet_id")
      .eq("list_id", config.list_id);

    const repliedTweetIds = new Set((existingReplies || []).map(r => r.tweet_id));
    debug.alreadyRepliedCount = repliedTweetIds.size;

    // Collect eligible tweets from all members
    const eligibleTweets: any[] = [];
    const cutoffTime = Date.now() - TWEET_RECENCY_HOURS * 60 * 60 * 1000;

    let totalTweetsFetched = 0;
    let skippedAlreadyReplied = 0;
    let skippedTooOld = 0;
    let skippedType = 0;

    let membersScanned = 0;
    let stoppedReason: string | null = null;

    const maxEligibleTweets = maxReplies * MAX_ELIGIBLE_TWEETS_MULTIPLIER;

    // Scan only a bounded number of members so the request finishes fast enough for browsers.
    // (The cron-based runs can still cycle over time.)
    const membersToScan = members.slice(0, MEMBERS_SCAN_CAP);

    for (const member of membersToScan) {
      if (timeLeftMs(runStartedAtMs) < 6_000) {
        stoppedReason = "time_budget_scan";
        break;
      }

      const username = member.userName || member.username || member.screen_name;
      if (!username) continue;

      try {
        const tweetsUrl = `https://api.twitterapi.io/twitter/user/last_tweets?userName=${username}`;
        const tweetsResponse = await fetchWithTimeout(
          tweetsUrl,
          { headers: { "X-API-Key": TWITTERAPI_IO_KEY } },
          6_000
        );

        if (!tweetsResponse.ok) {
          console.log(`Failed to fetch tweets for ${username}: ${tweetsResponse.status}`);
          continue;
        }

        const tweetsData = await tweetsResponse.json();
        
        // Handle various API response formats
        let tweets: any[] = [];
        if (Array.isArray(tweetsData)) {
          tweets = tweetsData;
        } else if (Array.isArray(tweetsData.tweets)) {
          tweets = tweetsData.tweets;
        } else if (Array.isArray(tweetsData.data)) {
          tweets = tweetsData.data;
        } else if (tweetsData.timeline?.instructions) {
          // Twitter API v2 timeline format
          for (const inst of tweetsData.timeline.instructions) {
            if (inst.entries) {
              for (const entry of inst.entries) {
                if (entry.content?.itemContent?.tweet_results?.result) {
                  tweets.push(entry.content.itemContent.tweet_results.result);
                }
              }
            }
          }
        }
        
        // Log first member's response structure for debugging
        if (members.indexOf(member) === 0) {
          console.log(`First member ${username} response type: ${typeof tweetsData}, isArray: ${Array.isArray(tweetsData)}`);
          console.log(`Response keys: ${Object.keys(tweetsData || {}).join(', ')}`);
          console.log(`Extracted tweets count: ${tweets.length}`);
        }
        
        totalTweetsFetched += tweets.length;

        for (const tweet of tweets) {
          const tweetId = tweet.id || tweet.id_str;
          if (!tweetId) continue;
          
          if (repliedTweetIds.has(tweetId)) {
            skippedAlreadyReplied++;
            continue;
          }

          // Check recency - expand to 24 hours
          const tweetDate = new Date(tweet.createdAt || tweet.created_at).getTime();
          if (tweetDate < cutoffTime) {
            skippedTooOld++;
            continue;
          }

          // Determine tweet type
          let tweetType = "original";
          const isRetweet = tweet.isRetweet || tweet.retweeted_status || tweet.text?.startsWith("RT @");
          const isReply = tweet.isReply || tweet.in_reply_to_status_id || tweet.inReplyToId;

          if (isRetweet) {
            if (!config.include_retweets) {
              skippedType++;
              continue;
            }
            tweetType = "retweet";
          } else if (isReply) {
            if (!config.include_replies) {
              skippedType++;
              continue;
            }
            tweetType = "reply";
          }

          // Get engagement metrics
          const likes = tweet.likeCount || tweet.favorite_count || 0;
          const replies = tweet.replyCount || tweet.reply_count || 0;
          const retweets = tweet.retweetCount || tweet.retweet_count || 0;
          const engagement = likes + replies * 2 + retweets * 3;

          eligibleTweets.push({
            id: tweetId,
            text: tweet.text || tweet.full_text,
            username,
            tweetType,
            engagement,
            createdAt: tweet.createdAt || tweet.created_at,
          });

          if (eligibleTweets.length >= maxEligibleTweets) {
            stoppedReason = "eligible_cap_reached";
            break;
          }
        }

        membersScanned++;

        if (stoppedReason) break;
      } catch (err) {
        console.error(`Error fetching tweets for ${username}:`, err);
      }
    }

    debug.membersScanned = membersScanned;
    debug.totalTweetsFetched = totalTweetsFetched;
    debug.skippedTooOld = skippedTooOld;
    debug.skippedAlreadyReplied = skippedAlreadyReplied;
    debug.skippedType = skippedType;
    debug.eligibleTweetsFound = eligibleTweets.length;
    debug.scanStoppedReason = stoppedReason;

    console.log(`Tweet stats: fetched=${totalTweetsFetched}, skippedOld=${skippedTooOld}, skippedReplied=${skippedAlreadyReplied}, skippedType=${skippedType}`);

    console.log(`Found ${eligibleTweets.length} eligible tweets`);

    if (eligibleTweets.length === 0) {
      debug.totalRunMs = msSince(runStartedAtMs);
      return jsonResponse({ message: "No eligible tweets to reply to", debug });
    }

    // Sort by engagement and take top N
    eligibleTweets.sort((a, b) => b.engagement - a.engagement);
    const tweetsToReply = eligibleTweets.slice(0, maxReplies);

    const results: any[] = [];

    let repliesStoppedReason: string | null = null;

    for (const tweet of tweetsToReply) {
      try {
        if (timeLeftMs(runStartedAtMs) < 7_000) {
          repliesStoppedReason = "time_budget_reply";
          break;
        }

        // Generate AI reply
        const prompt = `You are replying to a crypto influencer's tweet. Generate a short, engaging reply (max 250 chars) that:
- Is relevant and adds value to the conversation
- Is friendly and professional, not spammy
- Can subtly mention TUNA.fun as a meme coin launchpad if naturally fits (not forced)
- Feels authentic, not like a bot

Tweet by @${tweet.username}: "${tweet.text}"

Reply (max 250 chars):`;

        const aiResponse = await fetchWithTimeout(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-5-mini",
              messages: [{ role: "user", content: prompt }],
              max_tokens: 100,
            }),
          },
          8_000
        );

        if (!aiResponse.ok) {
          console.error("AI generation failed:", await aiResponse.text());
          continue;
        }

        const aiData = await aiResponse.json();
        let replyText = aiData.choices?.[0]?.message?.content?.trim() || "";
        
        // Clean up the reply
        replyText = replyText.replace(/^["']|["']$/g, "").trim();
        if (replyText.length > 280) replyText = replyText.substring(0, 277) + "...";

        if (!replyText) {
          console.error("Empty AI reply generated");
          continue;
        }

        console.log(`Replying to @${tweet.username}: "${replyText.substring(0, 50)}..."`);

        // Insert pending reply record
        await supabase.from("influencer_replies").insert({
          list_id: config.list_id,
          influencer_username: tweet.username,
          tweet_id: tweet.id,
          tweet_text: tweet.text?.substring(0, 500),
          tweet_type: tweet.tweetType,
          reply_text: replyText,
          status: "pending",
        });

        // Post the reply
        const loginCookies = btoa(X_FULL_COOKIE);
        const postResponse = await fetchWithTimeout(
          "https://api.twitterapi.io/twitter/tweet/create_v2",
          {
            method: "POST",
            headers: {
              "X-API-Key": TWITTERAPI_IO_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: replyText,
              reply_to_tweet_id: tweet.id,
              login_cookies: loginCookies,
              ...(TWITTER_PROXY && { proxy: TWITTER_PROXY }),
            }),
          },
          8_000
        );

        const postData = await postResponse.json();

        if (postResponse.ok && (postData.data?.id || postData.tweet?.id || postData.id)) {
          const replyId = postData.data?.id || postData.tweet?.id || postData.id;
          
          await supabase
            .from("influencer_replies")
            .update({ status: "sent", reply_id: replyId })
            .eq("tweet_id", tweet.id);

          results.push({
            success: true,
            username: tweet.username,
            tweetId: tweet.id,
            replyId,
            tweetType: tweet.tweetType,
          });

          console.log(`✅ Replied to @${tweet.username} (${tweet.tweetType})`);
        } else {
          const errorMsg = postData.error || postData.message || JSON.stringify(postData);
          
          await supabase
            .from("influencer_replies")
            .update({ status: "failed", error_message: errorMsg })
            .eq("tweet_id", tweet.id);

          results.push({
            success: false,
            username: tweet.username,
            tweetId: tweet.id,
            error: errorMsg,
          });

          console.error(`❌ Failed to reply to @${tweet.username}:`, errorMsg);
        }

        // Small delay between replies (bounded so we don't hit gateway timeouts)
        if (timeLeftMs(runStartedAtMs) > 2_000) {
          await new Promise(r => setTimeout(r, 700));
        }

      } catch (err) {
        console.error(`Error processing tweet ${tweet.id}:`, err);
        results.push({
          success: false,
          tweetId: tweet.id,
          error: String(err),
        });
      }
    }

    debug.repliesStoppedReason = repliesStoppedReason;
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
