import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function percentEncode(input: string): string {
  // OAuth 1.0a requires RFC3986 encoding (encodeURIComponent + a few extra chars)
  return encodeURIComponent(input).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function createNonce(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function toBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return toBase64(sig);
}

async function buildOAuth1Header(opts: {
  method: string;
  url: string;
  queryParams: Record<string, string>;
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: opts.consumerKey,
    oauth_nonce: createNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: opts.accessToken,
    oauth_version: "1.0",
  };

  // Base string includes both OAuth params + query params
  const allParams: Array<[string, string]> = [];
  for (const [k, v] of Object.entries({ ...oauthParams, ...opts.queryParams })) {
    allParams.push([percentEncode(k), percentEncode(v)]);
  }
  allParams.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const paramString = allParams.map(([k, v]) => `${k}=${v}`).join("&");

  const baseUrl = new URL(opts.url);
  baseUrl.search = "";
  baseUrl.hash = "";

  const baseString = [
    opts.method.toUpperCase(),
    percentEncode(baseUrl.toString()),
    percentEncode(paramString),
  ].join("&");

  const signingKey = `${percentEncode(opts.consumerSecret)}&${percentEncode(opts.accessTokenSecret)}`;
  const signature = await hmacSha1Base64(signingKey, baseString);

  oauthParams.oauth_signature = signature;

  const headerParams = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(", ");

  return `OAuth ${headerParams}`;
}

// Search for mentions using official X API (reliable indexing)
async function searchMentionsViaXApi(
  query: string,
  creds: {
    consumerKey: string;
    consumerSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  }
): Promise<Array<{
  id: string;
  text: string;
  author_id: string;
  author_username: string;
  created_at: string;
}>> {
  const url = new URL("https://api.x.com/2/tweets/search/recent");
  const queryParams: Record<string, string> = {
    query,
    max_results: "25",
    "tweet.fields": "created_at,author_id,text",
    expansions: "author_id",
    "user.fields": "username",
  };

  for (const [k, v] of Object.entries(queryParams)) {
    url.searchParams.set(k, v);
  }

  // Retry on 429 with exponential backoff (X API rate limits)
  let lastStatus = 0;
  let lastBody: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const authHeader = await buildOAuth1Header({
      method: "GET",
      url: url.toString(),
      queryParams,
      consumerKey: creds.consumerKey,
      consumerSecret: creds.consumerSecret,
      accessToken: creds.accessToken,
      accessTokenSecret: creds.accessTokenSecret,
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "User-Agent": "TUNA Agents (Lovable Cloud)",
      },
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
      const users: Array<{ id: string; username: string }> = data?.includes?.users || [];
      const userMap = new Map(users.map((u) => [u.id, u.username]));

      const tweets: Array<{ id: string; text: string; author_id: string; created_at: string }> = data?.data || [];
      return tweets.map((t) => ({
        id: t.id,
        text: t.text,
        author_id: t.author_id,
        author_username: userMap.get(t.author_id) || "",
        created_at: t.created_at,
      }));
    }

    if (response.status === 429) {
      const backoffMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      console.warn(
        `[agent-scan-twitter] X API rate limited (429). Retrying in ${backoffMs}ms (attempt ${attempt + 1}/3)`
      );
      await sleep(backoffMs);
      continue;
    }

    // Non-429 errors: fail fast
    console.error("[agent-scan-twitter] X API search failed:", {
      status: response.status,
      body: lastBody,
    });
    throw new Error(
      `X API search failed [${response.status}]: ${typeof lastBody === "string" ? lastBody : JSON.stringify(lastBody)}`
    );
  }

  // Still rate-limited after retries
  throw new Error(
    `X_API_RATE_LIMITED [${lastStatus}]: ${typeof lastBody === "string" ? lastBody : JSON.stringify(lastBody)}`
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

    // Official X API credentials (OAuth 1.0a)
    const twitterConsumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const twitterConsumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const twitterAccessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const twitterAccessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");

    if (!twitterConsumerKey) {
      return new Response(
        JSON.stringify({ success: false, error: "TWITTER_CONSUMER_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!twitterConsumerSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "TWITTER_CONSUMER_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!twitterAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "TWITTER_ACCESS_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!twitterAccessTokenSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "TWITTER_ACCESS_TOKEN_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reply posting is still session-based (optional)
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0Token = Deno.env.get("X_CT0_TOKEN");
    const canPostReplies = !!(twitterApiIoKey && xAuthToken && xCt0Token);
    if (!canPostReplies) {
      console.log(
        "[agent-scan-twitter] Reply tokens not fully configured (TWITTERAPI_IO_KEY + X_AUTH_TOKEN + X_CT0_TOKEN) - will detect/process but skip replies"
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

      // Official X API detection (no twitterapi.io reads)
      // Broad search to avoid any edge-case parsing around punctuation.
      console.log("[agent-scan-twitter] Searching via official X API...");
      let tweets: Awaited<ReturnType<typeof searchMentionsViaXApi>> = [];
      let rateLimited = false;
      try {
        tweets = await searchMentionsViaXApi("(tunalaunch OR launchtuna) -is:retweet", {
          consumerKey: twitterConsumerKey,
          consumerSecret: twitterConsumerSecret,
          accessToken: twitterAccessToken,
          accessTokenSecret: twitterAccessTokenSecret,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("X_API_RATE_LIMITED") || msg.includes("[429]")) {
          rateLimited = true;
          console.warn("[agent-scan-twitter] Skipping scan due to X API rate limit");
        } else {
          throw err;
        }
      }

      // Start a cooldown lock when rate-limited so we don't spam the X API
      if (rateLimited) {
        const cooldownUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
        await supabase.from("cron_locks").delete().eq("lock_name", rateLimitLockName);
        await supabase.from("cron_locks").insert({
          lock_name: rateLimitLockName,
          expires_at: cooldownUntil,
          acquired_at: new Date().toISOString(),
        });
      }

      console.log(`[agent-scan-twitter] Found ${tweets.length} tweets via official X API`);
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
