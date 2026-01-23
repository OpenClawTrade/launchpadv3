import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";
const MAX_REPLIES_PER_RUN = 1; // One reply per run
const REPLY_COOLDOWN_MINUTES = 3; // Run every 3 minutes

// Crypto-related search terms to find relevant tweets
const SEARCH_QUERIES = [
  "crypto meme coin",
  "solana degen",
  "memecoin launch",
  "$SOL pump",
  "web3 meme",
];

interface Tweet {
  id: string;
  text: string;
  author: {
    userName: string;
    name: string;
  };
  createdAt: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for action-based calls
    let body: { action?: string; secret?: string; force?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // No body or not JSON - continue with default "run" action
    }

    const { action, secret } = body;

    // Admin actions require secret validation
    const adminSecret = Deno.env.get("TWITTER_BOT_ADMIN_SECRET") || Deno.env.get("API_ENCRYPTION_KEY");
    
    if (action === "list") {
      // List recent replies - requires valid secret
      if (!secret || secret !== adminSecret) {
        return new Response(
          JSON.stringify({ error: "unauthorized" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: replies, error } = await supabase
        .from("twitter_bot_replies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      return new Response(
        JSON.stringify({ replies: replies || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For "run" action, validate secret if provided (allows cron to run without secret)
    if (action === "run" && secret && secret !== adminSecret) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this is a force run (bypasses cooldown)
    const forceRun = body.force === true;

    // Continue with bot run logic
    const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!twitterApiKey) {
      throw new Error("TWITTERAPI_IO_KEY not configured");
    }
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log("[twitter-auto-reply] 🚀 Starting auto-reply bot...");

    // Check cooldown - don't run if we replied recently
    const { data: lastReply } = await supabase
      .from("twitter_bot_replies")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lastReply && !forceRun) {
      const lastReplyTime = new Date(lastReply.created_at);
      const cooldownEnd = new Date(lastReplyTime.getTime() + REPLY_COOLDOWN_MINUTES * 60 * 1000);
      if (new Date() < cooldownEnd) {
        const waitSeconds = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
        console.log(`[twitter-auto-reply] ⏳ Cooldown active, waiting ${waitSeconds}s`);
        return new Response(
          JSON.stringify({ success: true, message: `Cooldown active, ${waitSeconds}s remaining`, repliesSent: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    if (forceRun) {
      console.log("[twitter-auto-reply] 🔓 Force run - bypassing cooldown");
    }

    // Get X account credentials for login_v2 flow
    const xAccountEmail = Deno.env.get("X_ACCOUNT_EMAIL");
    const xAccountPassword = Deno.env.get("X_ACCOUNT_PASSWORD");
    const xTotpSecret = Deno.env.get("X_TOTP_SECRET"); // Optional for 2FA
    const proxyUrl = Deno.env.get("TWITTER_PROXY");

    if (!xAccountEmail || !xAccountPassword) {
      throw new Error("X_ACCOUNT_EMAIL or X_ACCOUNT_PASSWORD not configured");
    }
    if (!proxyUrl) {
      throw new Error("TWITTER_PROXY not configured");
    }

    // Step 1: Login via user_login_v2 to get fresh cookies
    console.log("[twitter-auto-reply] 🔐 Logging in via user_login_v2...");
    
    const loginBody: Record<string, string> = {
      email: xAccountEmail,
      password: xAccountPassword,
      proxy: proxyUrl,
    };
    if (xTotpSecret) {
      loginBody.totp_secret = xTotpSecret;
    }

    const loginResponse = await fetch(`${TWITTERAPI_BASE}/twitter/user_login_v2`, {
      method: "POST",
      headers: {
        "X-API-Key": twitterApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginBody),
    });

    const loginText = await loginResponse.text();
    console.log(`[twitter-auto-reply] 🔐 Login response: ${loginResponse.status} - ${loginText.slice(0, 500)}`);

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} - ${loginText}`);
    }

    let loginData: any;
    try {
      loginData = JSON.parse(loginText);
    } catch {
      throw new Error(`Failed to parse login response: ${loginText}`);
    }

    // Extract login_cookies from response
    const loginCookies = loginData.login_cookies || loginData.cookies || loginData.cookie;
    if (!loginCookies) {
      throw new Error(`No login_cookies in response: ${JSON.stringify(loginData)}`);
    }

    console.log("[twitter-auto-reply] ✅ Login successful, got cookies");

    // Pick a random search query
    const searchQuery = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
    console.log(`[twitter-auto-reply] 🔍 Searching for: "${searchQuery}"`);

    // Fetch tweets via search endpoint
    const searchUrl = `${TWITTERAPI_BASE}/twitter/tweet/advanced_search?query=${encodeURIComponent(searchQuery)}&queryType=Latest`;
    console.log("[twitter-auto-reply] 📡 Fetching tweets...");
    
    const searchResponse = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "X-API-Key": twitterApiKey,
        "Content-Type": "application/json",
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("[twitter-auto-reply] ❌ Search API error:", searchResponse.status, errorText);
      
      // If rate limited, just exit gracefully
      if (searchResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: true, message: "Rate limited, will retry later", repliesSent: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Failed to search tweets: ${searchResponse.status} - ${errorText}`);
    }

    const searchData = await searchResponse.json();
    const tweets: Tweet[] = searchData.tweets || searchData.data || [];
    console.log(`[twitter-auto-reply] 📥 Found ${tweets.length} tweets`);

    if (tweets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No tweets found", repliesSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get already replied tweet IDs to avoid duplicates
    const { data: repliedTweets } = await supabase
      .from("twitter_bot_replies")
      .select("tweet_id")
      .order("created_at", { ascending: false })
      .limit(500);

    const repliedIds = new Set((repliedTweets || []).map(r => r.tweet_id));
    
    // Filter out already replied tweets and our own tweets
    const eligibleTweets = tweets.filter(t => 
      !repliedIds.has(t.id) && 
      t.author?.userName?.toLowerCase() !== "ai67x_fun" &&
      t.text && 
      t.text.length > 20 // Skip very short tweets
    );

    console.log(`[twitter-auto-reply] ✅ ${eligibleTweets.length} eligible tweets after filtering`);

    if (eligibleTweets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No new tweets to reply to", repliesSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process up to MAX_REPLIES_PER_RUN tweets
    const tweetsToReply = eligibleTweets.slice(0, MAX_REPLIES_PER_RUN);
    const results: { tweetId: string; success: boolean; error?: string }[] = [];

    for (const tweet of tweetsToReply) {
      try {
        console.log(`[twitter-auto-reply] 💬 Generating reply for tweet ${tweet.id} by @${tweet.author?.userName}...`);
        console.log(`[twitter-auto-reply] 📝 Tweet: "${tweet.text.substring(0, 100)}..."`);
        
        // Generate AI reply using Lovable AI gateway
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are a real person casually chatting about crypto on X. You're knowledgeable but chill.

Generate a SHORT reply (max 160 chars) that sounds like a genuine human response.

STRICT RULES:
- NO hashtags (like #crypto, #sol, etc.)
- NO cashtags (like $SOL, $BTC, etc.)  
- NO links or URLs
- NO emojis whatsoever
- Write like you're texting a friend, not posting content
- Be conversational, ask questions, share opinions
- Use lowercase naturally, don't overcapitalize
- Sound curious, skeptical, excited, or thoughtful - pick one mood
- Short sentences. Natural pauses. Real talk.
- Never sound promotional or like you're selling something

BAD examples (don't do this):
- "Great point! 🚀 Check out $SOL #crypto"
- "This is amazing! Love the energy!"
- "Bullish on this one! 💎🙌"

GOOD examples (do this):
- "wait you actually made money on that? teach me your ways"
- "been burned too many times to trust early launches tbh"
- "ngl this whole cycle has been wild"
- "so are we just ignoring what happened last week or"

Output ONLY the reply text. No quotes, no explanation.`
              },
              {
                role: "user",
                content: `Tweet from @${tweet.author?.userName || "unknown"}: "${tweet.text}"`
              }
            ],
            max_tokens: 80,
            temperature: 0.85,
          }),
        });

        if (!aiResponse.ok) {
          const aiError = await aiResponse.text();
          throw new Error(`AI generation failed: ${aiResponse.status} - ${aiError}`);
        }

        const aiData = await aiResponse.json();
        const replyText = aiData.choices?.[0]?.message?.content?.trim()?.replace(/^["']|["']$/g, '');

        if (!replyText) {
          throw new Error("Empty AI response");
        }

        console.log(`[twitter-auto-reply] 🤖 Generated reply: "${replyText}"`);

        // Post the reply via twitterapi.io with proxy
        // Wait 5+ seconds between requests
        await new Promise((resolve) => setTimeout(resolve, 6000));

        const extractReplyId = (postData: any): string | null => {
          return (
            postData?.data?.id ||
            postData?.data?.rest_id ||
            postData?.data?.create_tweet?.tweet_results?.result?.rest_id ||
            postData?.tweet_id ||
            postData?.id ||
            null
          );
        };

        const isTwitterApiErrorPayload = (postData: any): boolean => {
          // twitterapi.io sometimes returns HTTP 200 with { success:false, status:'error', ... }
          if (!postData || typeof postData !== "object") return true;
          if (postData.success === false) return true;
          if (postData.status === "error") return true;
          if (typeof postData.error === "string" && postData.error.length > 0) return true;
          if (typeof postData.msg === "string" && postData.msg.toLowerCase().includes("failed")) return true;
          return false;
        };

        // twitterapi.io docs: /twitter/create_tweet_v2 expects login_cookies (from user_login_v2)
        const postAttempts: Array<{ name: string; url: string; body: any }> = [
          {
            name: "create_tweet_v2",
            url: `${TWITTERAPI_BASE}/twitter/create_tweet_v2`,
            body: {
              login_cookies: loginCookies,
              tweet_text: replyText,
              reply_to_tweet_id: tweet.id,
              proxy: proxyUrl,
            },
          },
        ];

        let replyId: string | null = null;
        let lastPostError: string | null = null;

        console.log(`[twitter-auto-reply] 📤 Posting reply to tweet ${tweet.id}...`);

        for (const attempt of postAttempts) {
          console.log(`[twitter-auto-reply] ↪️  Trying twitterapi endpoint: ${attempt.name}`);

          const postResponse = await fetch(attempt.url, {
            method: "POST",
            headers: {
              "X-API-Key": twitterApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(attempt.body),
          });

          const postText = await postResponse.text();
          console.log(
            `[twitter-auto-reply] 📥 Twitter API response (${attempt.name}): ${postResponse.status} - ${postText.slice(0, 300)}`
          );

          // Handle rate limits immediately
          if (postResponse.status === 429) {
            lastPostError = "Rate limited";
            break;
          }

          if (!postResponse.ok) {
            lastPostError = `HTTP ${postResponse.status}: ${postText}`;
            continue;
          }

          let postData: any = null;
          try {
            postData = JSON.parse(postText);
          } catch {
            postData = { raw: postText };
          }

          if (isTwitterApiErrorPayload(postData)) {
            lastPostError =
              postData?.error || postData?.msg || (typeof postText === "string" ? postText : "Unknown API error");
            continue;
          }

          replyId = extractReplyId(postData);
          if (!replyId) {
            lastPostError = `No reply id returned (response: ${postText.slice(0, 300)})`;
            continue;
          }

          console.log(`[twitter-auto-reply] ✅ Reply posted successfully to tweet ${tweet.id}, reply_id: ${replyId}`);
          break;
        }

        if (!replyId) {
          throw new Error(`Reply post failed: ${lastPostError || "Unknown error"}`);
        }

        // Record the reply in database
        await supabase.from("twitter_bot_replies").insert({
          tweet_id: tweet.id,
          tweet_author: tweet.author?.userName,
          tweet_text: tweet.text?.substring(0, 500),
          reply_text: replyText,
          reply_id: replyId,
        });

        results.push({ tweetId: tweet.id, success: true });

        // Add longer delay between replies to respect rate limits
        if (tweetsToReply.indexOf(tweet) < tweetsToReply.length - 1) {
          const delay = 8000 + Math.random() * 4000; // 8-12 seconds
          console.log(`[twitter-auto-reply] ⏳ Waiting ${Math.round(delay/1000)}s before next reply...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        console.error(`[twitter-auto-reply] ❌ Error replying to ${tweet.id}:`, error);
        results.push({ 
          tweetId: tweet.id, 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[twitter-auto-reply] 🎉 Completed: ${successCount}/${results.length} replies sent`);

    return new Response(
      JSON.stringify({
        success: true,
        repliesSent: successCount,
        searchQuery,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[twitter-auto-reply] ❌ Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
