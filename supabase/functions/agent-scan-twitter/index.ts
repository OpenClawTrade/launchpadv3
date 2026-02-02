import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    
    // twitterapi.io for both reading and posting
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0Token = Deno.env.get("X_CT0_TOKEN");

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

    // Check if we have session tokens for posting replies
    const canPostReplies = xAuthToken && xCt0Token;
    if (!canPostReplies) {
      console.log("[agent-scan-twitter] X session tokens not configured - will process but skip replies");
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

          // Only post reply if we have session tokens
          if (canPostReplies) {
            const replyText = `🐟 Token launched!\n\n$${processResult.mintAddress?.slice(0, 8)}... is now live on TUNA!\n\n🔗 Trade: ${processResult.tradeUrl}\n\nPowered by TUNA Agents - 80% of fees go to you!`;

            const replyResult = await replyToTweet(
              tweetId,
              replyText,
              twitterApiIoKey,
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
              twitterApiIoKey,
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
