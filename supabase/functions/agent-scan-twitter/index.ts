import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// OAuth 1.0a signing for official X.com API (used ONLY for posting)
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join("&");

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  const hmac = createHmac("sha1", signingKey);
  hmac.update(signatureBase);
  return hmac.digest("base64");
}

function generateOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    consumerSecret,
    accessTokenSecret
  );

  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`
    )
    .join(", ");

  return `OAuth ${headerParts}`;
}

// Search for mentions using twitterapi.io (cheap reads)
async function searchMentionsViaTwitterApiIo(
  apiKey: string,
  query: string
): Promise<Array<{
  id: string;
  text: string;
  author_id: string;
  author_username: string;
  created_at: string;
}>> {
  const url = new URL("https://api.twitterapi.io/twitter/tweet/advanced_search");
  url.searchParams.set("query", query);
  url.searchParams.set("queryType", "Latest");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[agent-scan-twitter] twitterapi.io search failed:", error);
    throw new Error(`twitterapi.io search failed: ${response.status}`);
  }

  const data = await response.json();
  const tweets = data.tweets || [];

  return tweets.map((tweet: {
    id: string;
    text: string;
    author?: { id: string; userName: string };
    createdAt: string;
  }) => ({
    id: tweet.id,
    text: tweet.text,
    author_id: tweet.author?.id || "",
    author_username: tweet.author?.userName || "",
    created_at: tweet.createdAt,
  }));
}

// Send reply using official X.com API (requires OAuth 1.0a)
async function replyToTweet(
  tweetId: string,
  text: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  const url = "https://api.x.com/2/tweets";

  const body = JSON.stringify({
    text,
    reply: { in_reply_to_tweet_id: tweetId },
  });

  const oauthHeader = generateOAuthHeader(
    "POST",
    url,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[agent-scan-twitter] Reply failed:", error);
      return { success: false, error };
    }

    const data = await response.json();
    return { success: true, replyId: data.data?.id };
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
    
    // twitterapi.io for cheap mention monitoring
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");
    
    // Official X.com API only for posting replies
    const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const accessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
    const meteoraApiUrl =
      Deno.env.get("METEORA_API_URL") ||
      Deno.env.get("VITE_METEORA_API_URL") ||
      "https://tunalaunch.vercel.app";

    if (!twitterApiIoKey) {
      console.log("[agent-scan-twitter] TWITTERAPI_IO_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "TWITTERAPI_IO_KEY not configured",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if we have official API credentials for posting replies
    const canPostReplies = consumerKey && consumerSecret && accessToken && accessTokenSecret;
    if (!canPostReplies) {
      console.log("[agent-scan-twitter] Official X.com API not configured - will process but skip replies");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Acquire lock to prevent concurrent runs
    const lockName = "agent-scan-twitter-lock";
    const lockExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

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
      // Use twitterapi.io for cheap mention detection (saves ~70% API costs)
      console.log("[agent-scan-twitter] Searching via twitterapi.io...");
      const tweets = await searchMentionsViaTwitterApiIo(
        twitterApiIoKey,
        "!tunalaunch -is:retweet"
      );

      console.log(`[agent-scan-twitter] Found ${tweets.length} tweets via twitterapi.io`);

      const results: Array<{
        tweetId: string;
        status: string;
        mintAddress?: string;
        error?: string;
      }> = [];

      for (const tweet of tweets) {
        const tweetId = tweet.id;
        const tweetText = tweet.text;
        const username = tweet.author_username;
        const authorId = tweet.author_id;

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
              content: tweetText,
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

          // Only post reply if we have official X.com API credentials
          if (canPostReplies) {
            const replyText = `🐟 Token launched!\n\n$${processResult.mintAddress?.slice(0, 8)}... is now live on TUNA!\n\n🔗 Trade: ${processResult.tradeUrl}\n\nPowered by TUNA Agents - 80% of fees go to you!`;

            const replyResult = await replyToTweet(
              tweetId,
              replyText,
              consumerKey!,
              consumerSecret!,
              accessToken!,
              accessTokenSecret!
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
          durationMs: Date.now() - startTime,
          mode: "hybrid_twitterapi_io",
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
