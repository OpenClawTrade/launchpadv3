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

// Search for mentions using twitterapi.io (session-based, reliable)
async function searchMentionsViaTwitterApiIo(
  query: string,
  apiKey: string
): Promise<Array<{
  id: string;
  text: string;
  author_id: string;
  author_username: string;
  created_at: string;
}>> {
  const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("queryType", "Latest");

  // Retry on errors with exponential backoff
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
      const backoffMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      console.warn(
        `[agent-scan-twitter] twitterapi.io rate limited (429). Retrying in ${backoffMs}ms (attempt ${attempt + 1}/3)`
      );
      await sleep(backoffMs);
      continue;
    }

    // Non-429 errors: fail fast
    console.error("[agent-scan-twitter] twitterapi.io search failed:", {
      status: response.status,
      body: lastBody,
    });
    throw new Error(
      `twitterapi.io search failed [${response.status}]: ${typeof lastBody === "string" ? lastBody : JSON.stringify(lastBody)}`
    );
  }

  // Still rate-limited after retries
  throw new Error(
    `TWITTERAPI_RATE_LIMITED [${lastStatus}]: ${typeof lastBody === "string" ? lastBody : JSON.stringify(lastBody)}`
  );
}

// Send reply using twitterapi.io (session-based posting)
async function replyToTweet(
  tweetId: string,
  text: string,
  apiKey: string,
  authToken: string,
  ct0Token: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
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
      console.error("[agent-scan-twitter] Reply failed:", error);
      return { success: false, error };
    }

    const data = await response.json();
    return { success: true, replyId: data.data?.id || data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // twitterapi.io credentials (session-based)
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0Token = Deno.env.get("X_CT0_TOKEN");

    if (!twitterApiIoKey) {
      return new Response(
        JSON.stringify({ success: false, error: "TWITTERAPI_IO_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const canPostReplies = !!(twitterApiIoKey && xAuthToken && xCt0Token);
    if (!canPostReplies) {
      console.log(
        "[agent-scan-twitter] Reply tokens not fully configured (X_AUTH_TOKEN + X_CT0_TOKEN) - will detect/process but skip replies"
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Acquire lock to prevent concurrent runs
    const lockName = "agent-scan-twitter-lock";
    const lockExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min
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
      // If we were rate-limited recently, skip to avoid repeated 429s
      const nowIso = new Date().toISOString();
      const { data: rlLock } = await supabase
        .from("cron_locks")
        .select("lock_name, expires_at")
        .eq("lock_name", rateLimitLockName)
        .gt("expires_at", nowIso)
        .maybeSingle();

      if (rlLock) {
        console.warn(
          `[agent-scan-twitter] Skipping scan due to active rate-limit cooldown until ${rlLock.expires_at}`
        );
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

      // Search using twitterapi.io (session-based, no OAuth required)
      console.log("[agent-scan-twitter] Searching via twitterapi.io...");
      let tweets: Awaited<ReturnType<typeof searchMentionsViaTwitterApiIo>> = [];
      let rateLimited = false;
      try {
        tweets = await searchMentionsViaTwitterApiIo(
          "(tunalaunch OR launchtuna) -is:retweet",
          twitterApiIoKey
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("TWITTERAPI_RATE_LIMITED") || msg.includes("[429]")) {
          rateLimited = true;
          console.warn("[agent-scan-twitter] Skipping scan due to twitterapi.io rate limit");
        } else {
          throw err;
        }
      }

      // Start a cooldown lock when rate-limited so we don't spam the API
      if (rateLimited) {
        const cooldownUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
        await supabase.from("cron_locks").delete().eq("lock_name", rateLimitLockName);
        await supabase.from("cron_locks").insert({
          lock_name: rateLimitLockName,
          expires_at: cooldownUntil,
          acquired_at: new Date().toISOString(),
        });
      }

      console.log(`[agent-scan-twitter] Found ${tweets.length} tweets via twitterapi.io`);
      if (tweets.length > 0) {
        const tweetIds = tweets.map((t) => t.id).slice(0, 5);
        console.log(`[agent-scan-twitter] Latest tweet IDs: ${tweetIds.join(", ")}`);
      }

      const results: Array<{
        tweetId: string;
        status: string;
        mintAddress?: string;
        error?: string;
      }> = [];

      for (const tweet of tweets) {
        const tweetId = tweet.id;
        const tweetText = tweet.text;
        // Support legacy/alias command (people frequently type !launchtuna)
        const normalizedText = tweetText.replace(/!launchtuna/gi, "!tunalaunch");
        const username = tweet.author_username;
        const authorId = tweet.author_id;

        // Validate this tweet actually contains the !tunalaunch command (not just "tunalaunch" as substring)
        if (!normalizedText.toLowerCase().includes("!tunalaunch")) {
          console.log(`[agent-scan-twitter] Skipping ${tweetId} - no !tunalaunch command found`);
          results.push({ tweetId, status: "skipped_no_command" });
          continue;
        }

        // Check if already processed
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

          // Only post reply if we have session tokens
            if (canPostReplies) {
            const replyText = `🐟 Token launched!\n\n$${processResult.mintAddress?.slice(0, 8)}... is now live on TUNA!\n\n🔗 Trade: ${processResult.tradeUrl}\n\nPowered by TUNA Agents - 80% of fees go to you!`;

            const replyResult = await replyToTweet(
              tweetId,
              replyText,
                twitterApiIoKey!,
              xAuthToken!,
              xCt0Token!
            );

            if (!replyResult.success) {
              console.warn(
                `[agent-scan-twitter] Failed to reply to ${tweetId}:`,
                replyResult.error
              );
            }
          }
        } else {
          results.push({
            tweetId,
            status: "failed",
            error: processResult.error,
          });

          // Reply with format instructions if parsing failed
          if (canPostReplies && processResult.error?.includes("parse")) {
            const formatHelpText = `🐟 Hey @${username}! To launch your token, please use this format:\n\n!tunalaunch\nName: YourTokenName\nSymbol: $TICKER\nWallet: YourSolanaWallet\n\nAttach an image and run the command again!`;

            const helpReplyResult = await replyToTweet(
              tweetId,
              formatHelpText,
              twitterApiIoKey!,
              xAuthToken!,
              xCt0Token!
            );

            if (helpReplyResult.success) {
              console.log(`[agent-scan-twitter] Sent format help reply to ${tweetId}`);
            } else {
              console.warn(
                `[agent-scan-twitter] Failed to send format help to ${tweetId}:`,
                helpReplyResult.error
              );
            }
          }
        }
      }

      console.log(
        `[agent-scan-twitter] Completed in ${Date.now() - startTime}ms`
      );

      return new Response(
        JSON.stringify({
          success: true,
          tweetsFound: tweets.length,
          results,
          rateLimited,
          durationMs: Date.now() - startTime,
          mode: "x_api_detection",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      // Release lock
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
