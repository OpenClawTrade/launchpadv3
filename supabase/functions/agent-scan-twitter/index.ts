import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TweetResult = {
  id: string;
  text: string;
  author_id: string;
  author_username: string;
  created_at: string;
};

// Search for mentions using Official X API v2 with Bearer Token (App-only auth)
async function searchMentionsViaOfficialApi(
  query: string,
  bearerToken: string
): Promise<TweetResult[]> {
  const searchUrl = new URL("https://api.x.com/2/tweets/search/recent");
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("max_results", "100");
  searchUrl.searchParams.set("tweet.fields", "created_at,author_id");
  searchUrl.searchParams.set("expansions", "author_id");
  searchUrl.searchParams.set("user.fields", "username");

  const response = await fetch(searchUrl.toString(), {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[agent-scan-twitter] X API error:", response.status, errorText);
    throw new Error(`X_API_ERROR [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  const tweets = data.data || [];
  const users = data.includes?.users || [];

  // Build username map
  const userMap: Record<string, string> = {};
  for (const user of users) {
    userMap[user.id] = user.username;
  }

  return tweets.map((t: any) => ({
    id: t.id,
    text: t.text,
    author_id: t.author_id || "",
    author_username: userMap[t.author_id] || "",
    created_at: t.created_at || "",
  }));
}

// Fallback: Search using twitterapi.io (session-based)
async function searchMentionsViaTwitterApiIo(
  query: string,
  apiKey: string
): Promise<TweetResult[]> {
  const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("queryType", "Latest");

  let lastStatus = 0;
  let lastBody: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(searchUrl.toString(), {
      headers: { "X-API-Key": apiKey },
    });

    lastStatus = response.status;
    const raw = await response.text();
    try {
      lastBody = raw ? JSON.parse(raw) : null;
    } catch {
      lastBody = { raw };
    }

    if (response.ok) {
      const data = lastBody;
      const tweets: Array<{
        id: string;
        text: string;
        author?: { id: string; userName: string };
        createdAt?: string;
      }> = data?.tweets || [];

      return tweets.map((t) => ({
        id: t.id,
        text: t.text,
        author_id: t.author?.id || "",
        author_username: t.author?.userName || "",
        created_at: t.createdAt || "",
      }));
    }

    if (response.status === 429) {
      const backoffMs = 1000 * Math.pow(2, attempt);
      console.warn(`[agent-scan-twitter] twitterapi.io rate limited. Retrying in ${backoffMs}ms`);
      await sleep(backoffMs);
      continue;
    }

    throw new Error(`twitterapi.io search failed [${response.status}]`);
  }

  throw new Error(`TWITTERAPI_RATE_LIMITED [${lastStatus}]`);
}

// Send reply using twitterapi.io (session-based posting)
async function replyToTweet(
  tweetId: string,
  text: string,
  apiKey: string,
  authToken: string,
  ct0Token: string,
  username?: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    console.log(`[agent-scan-twitter] 📤 Attempting reply to @${username || "unknown"} (tweet ${tweetId})`);
    
    const response = await fetch(
      "https://api.twitterapi.io/twitter/tweet/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          auth_token: authToken,
          ct0: ct0Token,
          text: text,
          reply_to_tweet_id: tweetId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[agent-scan-twitter] ❌ REPLY FAILED to @${username || "unknown"} (tweet ${tweetId}):`, {
        status: response.status,
        statusText: response.statusText,
        error: error.slice(0, 500),
      });
      return { success: false, error };
    }

    const data = await response.json();
    const replyId = data.data?.id || data.id;
    console.log(`[agent-scan-twitter] ✅ Reply sent to @${username || "unknown"}: ${replyId}`);
    return { success: true, replyId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[agent-scan-twitter] ❌ REPLY EXCEPTION to @${username || "unknown"} (tweet ${tweetId}):`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

// Check how many launches an X author has done in last 24 hours
// deno-lint-ignore no-explicit-any
async function getAuthorLaunchesToday(
  supabase: any,
  postAuthorId: string
): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { count } = await supabase
    .from("agent_social_posts")
    .select("id", { count: "exact", head: true })
    .eq("platform", "twitter")
    .eq("post_author_id", postAuthorId)
    .eq("status", "completed")
    .gte("processed_at", oneDayAgo);
  
  return count || 0;
}

const DAILY_LAUNCH_LIMIT_PER_AUTHOR = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Official X API Bearer Token (preferred for searching)
    const xBearerToken = Deno.env.get("X_BEARER_TOKEN");
    
    // twitterapi.io credentials (fallback for search, used for posting)
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0Token = Deno.env.get("X_CT0_TOKEN");

    // Need at least one search method
    if (!xBearerToken && !twitterApiIoKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No search credentials configured. Need X_BEARER_TOKEN or TWITTERAPI_IO_KEY" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const canPostReplies = !!(twitterApiIoKey && xAuthToken && xCt0Token);
    if (!canPostReplies) {
      console.log(
        "[agent-scan-twitter] Reply tokens not fully configured - will detect/process but skip replies"
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Acquire lock to prevent concurrent runs
    const lockName = "agent-scan-twitter-lock";
    const lockExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const rateLimitLockName = "agent-scan-twitter-rate-limit";

    // Clean up expired locks
    await supabase.from("cron_locks").delete().lt("expires_at", new Date().toISOString());

    const { error: lockError } = await supabase.from("cron_locks").insert({
      lock_name: lockName,
      expires_at: lockExpiry,
    });

    if (lockError) {
      console.log("[agent-scan-twitter] Another instance running, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "lock held" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      // Check rate-limit cooldown
      const nowIso = new Date().toISOString();
      const { data: rlLock } = await supabase
        .from("cron_locks")
        .select("lock_name, expires_at")
        .eq("lock_name", rateLimitLockName)
        .gt("expires_at", nowIso)
        .maybeSingle();

      if (rlLock) {
        console.warn(`[agent-scan-twitter] Skipping due to rate-limit cooldown until ${rlLock.expires_at}`);
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: "rate_limit_cooldown",
            cooldownUntil: rlLock.expires_at,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try Official X API first (Bearer Token), fallback to twitterapi.io
      const searchQuery = "(tunalaunch OR launchtuna) -is:retweet";
      let tweets: TweetResult[] = [];
      let rateLimited = false;
      let searchMethod = "none";

      if (xBearerToken) {
        try {
          console.log("[agent-scan-twitter] Searching via Official X API (Bearer Token)...");
          tweets = await searchMentionsViaOfficialApi(searchQuery, xBearerToken);
          searchMethod = "official_x_api";
          console.log(`[agent-scan-twitter] Found ${tweets.length} tweets via Official X API`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn("[agent-scan-twitter] Official X API failed:", msg);
          
          // Check if rate limited
          if (msg.includes("[429]")) {
            rateLimited = true;
          }
          
          // Try fallback if twitterapi.io is configured
          if (twitterApiIoKey && !rateLimited) {
            try {
              console.log("[agent-scan-twitter] Falling back to twitterapi.io...");
              tweets = await searchMentionsViaTwitterApiIo(searchQuery, twitterApiIoKey);
              searchMethod = "twitterapi_io_fallback";
              console.log(`[agent-scan-twitter] Found ${tweets.length} tweets via twitterapi.io fallback`);
            } catch (fallbackErr) {
              const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
              if (fallbackMsg.includes("RATE_LIMITED") || fallbackMsg.includes("[429]")) {
                rateLimited = true;
              } else {
                throw fallbackErr;
              }
            }
          }
        }
      } else if (twitterApiIoKey) {
        // No Bearer Token, use twitterapi.io directly
        try {
          console.log("[agent-scan-twitter] Searching via twitterapi.io...");
          tweets = await searchMentionsViaTwitterApiIo(searchQuery, twitterApiIoKey);
          searchMethod = "twitterapi_io";
          console.log(`[agent-scan-twitter] Found ${tweets.length} tweets via twitterapi.io`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("RATE_LIMITED") || msg.includes("[429]")) {
            rateLimited = true;
          } else {
            throw err;
          }
        }
      }

      // Set cooldown if rate-limited
      if (rateLimited) {
        const cooldownUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase.from("cron_locks").delete().eq("lock_name", rateLimitLockName);
        await supabase.from("cron_locks").insert({
          lock_name: rateLimitLockName,
          expires_at: cooldownUntil,
          acquired_at: new Date().toISOString(),
        });
        console.warn("[agent-scan-twitter] Rate limited, cooldown set until", cooldownUntil);
      }

      // Get the latest processed tweet timestamp to skip older ones
      const { data: latestProcessed } = await supabase
        .from("agent_social_posts")
        .select("post_id, created_at")
        .eq("platform", "twitter")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const latestProcessedId = latestProcessed?.post_id;
      
      if (tweets.length > 0) {
        const tweetIds = tweets.map((t) => t.id).slice(0, 5);
        console.log(`[agent-scan-twitter] Latest tweet IDs: ${tweetIds.join(", ")}`);
        if (latestProcessedId) {
          console.log(`[agent-scan-twitter] Last processed tweet ID: ${latestProcessedId}`);
        }
      }

      const results: Array<{
        tweetId: string;
        status: string;
        mintAddress?: string;
        error?: string;
      }> = [];

      // Sort tweets by ID descending (newest first) to process in order
      const sortedTweets = [...tweets].sort((a, b) => {
        // Tweet IDs are snowflake IDs - larger = newer
        return BigInt(b.id) > BigInt(a.id) ? 1 : -1;
      });

      for (const tweet of sortedTweets) {
        const tweetId = tweet.id;
        const tweetText = tweet.text;
        const normalizedText = tweetText.replace(/!launchtuna/gi, "!tunalaunch");
        const username = tweet.author_username;
        const authorId = tweet.author_id;

        // Skip tweets older than or equal to the last processed one
        if (latestProcessedId && BigInt(tweetId) <= BigInt(latestProcessedId)) {
          console.log(`[agent-scan-twitter] Skipping ${tweetId} - older than last processed`);
          results.push({ tweetId, status: "skipped_already_seen" });
          continue;
        }

        // Validate command presence
        if (!normalizedText.toLowerCase().includes("!tunalaunch")) {
          console.log(`[agent-scan-twitter] Skipping ${tweetId} - no !tunalaunch command`);
          results.push({ tweetId, status: "skipped_no_command" });
          continue;
        }

        // Check if already processed (double-check)
        const { data: existing } = await supabase
          .from("agent_social_posts")
          .select("id, status")
          .eq("platform", "twitter")
          .eq("post_id", tweetId)
          .maybeSingle();

        if (existing) {
          results.push({ tweetId, status: "already_processed" });
          continue;
        }

        // Check daily launch limit per X author (3 per day)
        if (authorId) {
          const launchesToday = await getAuthorLaunchesToday(supabase, authorId);
          if (launchesToday >= DAILY_LAUNCH_LIMIT_PER_AUTHOR) {
            console.log(`[agent-scan-twitter] @${username} (${authorId}) hit daily limit: ${launchesToday}/${DAILY_LAUNCH_LIMIT_PER_AUTHOR}`);
            
            // Record the attempt as rate-limited
            await supabase.from("agent_social_posts").insert({
              platform: "twitter",
              post_id: tweetId,
              post_url: `https://x.com/${username || "i"}/status/${tweetId}`,
              post_author: username,
              post_author_id: authorId,
              wallet_address: "unknown",
              raw_content: normalizedText.slice(0, 1000),
              status: "failed",
              error_message: "Daily limit of 3 Agent launches per X account reached",
              processed_at: new Date().toISOString(),
            });

            results.push({ tweetId, status: "rate_limited", error: "Daily limit reached" });

            // Reply with rate limit message
            if (canPostReplies) {
              const rateLimitText = `🐟 Hey @${username}! There is a daily limit of 3 Agent launches per X account.\n\nPlease try again tomorrow! 🌅`;
              
              const rateLimitReply = await replyToTweet(
                tweetId,
                rateLimitText,
                twitterApiIoKey!,
                xAuthToken!,
                xCt0Token!,
                username
              );

              if (!rateLimitReply.success) {
                console.error(`[agent-scan-twitter] ❌ FAILED to send rate limit reply to @${username}:`, rateLimitReply.error);
              }
            }
            continue;
          }
        }

        // Process the tweet
        const processResponse = await fetch(
          `${supabaseUrl}/functions/v1/agent-process-post`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              platform: "twitter",
              postId: tweetId,
              postUrl: `https://x.com/${username || "i"}/status/${tweetId}`,
              postAuthor: username,
              postAuthorId: authorId,
              content: normalizedText,
            }),
          }
        );

        const processResult = await processResponse.json();

        if (processResult.success && processResult.mintAddress) {
          results.push({
            tweetId,
            status: "launched",
            mintAddress: processResult.mintAddress,
          });

          // Post success reply via twitterapi.io
          if (canPostReplies) {
            const replyText = `🐟 Token launched!\n\n$${processResult.mintAddress?.slice(0, 8)}... is now live on TUNA!\n\n🔗 Trade: ${processResult.tradeUrl}\n\nPowered by TUNA Agents - 80% of fees go to you!`;

            const replyResult = await replyToTweet(
              tweetId,
              replyText,
              twitterApiIoKey!,
              xAuthToken!,
              xCt0Token!,
              username
            );

            if (!replyResult.success) {
              console.error(`[agent-scan-twitter] ❌ FAILED to send launch success reply to @${username}:`, replyResult.error);
            }
          }
        } else {
          results.push({
            tweetId,
            status: "failed",
            error: processResult.error,
          });

          // Reply with format help if parsing failed
          if (canPostReplies && processResult.error?.includes("parse")) {
            const formatHelpText = `🐟 Hey @${username}! To launch your token, please use this format:\n\n!tunalaunch\nName: YourTokenName\nSymbol: $TICKER\nWallet: YourSolanaWallet\n\nAttach an image and run the command again!`;

            const helpReplyResult = await replyToTweet(
              tweetId,
              formatHelpText,
              twitterApiIoKey!,
              xAuthToken!,
              xCt0Token!,
              username
            );

            if (!helpReplyResult.success) {
              console.error(`[agent-scan-twitter] ❌ FAILED to send format help reply to @${username}:`, helpReplyResult.error);
            } else {
              console.log(`[agent-scan-twitter] ✅ Sent format help reply to @${username}`);
            }
          }
        }
      }

      console.log(`[agent-scan-twitter] Completed in ${Date.now() - startTime}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          tweetsFound: tweets.length,
          results,
          rateLimited,
          searchMethod,
          durationMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      await supabase.from("cron_locks").delete().eq("lock_name", lockName);
    }
  } catch (error) {
    console.error("[agent-scan-twitter] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
