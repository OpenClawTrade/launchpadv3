import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// OAuth 1.0a signing
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

// Send reply to a tweet
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
    const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const accessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
    const meteoraApiUrl =
      Deno.env.get("METEORA_API_URL") ||
      Deno.env.get("VITE_METEORA_API_URL") ||
      "https://tunalaunch.vercel.app";

    if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
      console.log("[agent-scan-twitter] Twitter credentials not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Twitter credentials not configured",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      // Search for recent tweets with !tunalaunch
      const searchUrl = new URL("https://api.x.com/2/tweets/search/recent");
      searchUrl.searchParams.set("query", "!tunalaunch -is:retweet");
      searchUrl.searchParams.set("max_results", "20");
      searchUrl.searchParams.set("tweet.fields", "author_id,created_at,text");
      searchUrl.searchParams.set("expansions", "author_id");
      searchUrl.searchParams.set("user.fields", "username");

      const searchOAuth = generateOAuthHeader(
        "GET",
        "https://api.x.com/2/tweets/search/recent",
        consumerKey,
        consumerSecret,
        accessToken,
        accessTokenSecret
      );

      const searchResponse = await fetch(searchUrl.toString(), {
        headers: { Authorization: searchOAuth },
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error("[agent-scan-twitter] Search failed:", errorText);
        throw new Error(`Twitter search failed: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      const tweets = searchData.data || [];
      const users = searchData.includes?.users || [];

      console.log(`[agent-scan-twitter] Found ${tweets.length} tweets to process`);

      const results: Array<{
        tweetId: string;
        status: string;
        mintAddress?: string;
        error?: string;
      }> = [];

      for (const tweet of tweets) {
        const tweetId = tweet.id;
        const tweetText = tweet.text;
        const authorId = tweet.author_id;
        const author = users.find((u: { id: string }) => u.id === authorId);
        const username = author?.username || null;

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
          // Reply to the tweet with token info
          const replyText = `🐟 Token launched!\n\n$${processResult.mintAddress?.slice(0, 8)}... is now live on TUNA!\n\n🔗 Trade: ${processResult.tradeUrl}\n\nPowered by TUNA Agents - 80% of fees go to you!`;

          const replyResult = await replyToTweet(
            tweetId,
            replyText,
            consumerKey,
            consumerSecret,
            accessToken,
            accessTokenSecret
          );

          results.push({
            tweetId,
            status: "launched",
            mintAddress: processResult.mintAddress,
          });

          if (!replyResult.success) {
            console.warn(
              `[agent-scan-twitter] Failed to reply to ${tweetId}:`,
              replyResult.error
            );
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
