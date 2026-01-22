import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io/twitter";
const MAX_REPLIES_PER_RUN = 3; // Limit to avoid rate limits and look human-like
const REPLY_COOLDOWN_MINUTES = 5; // Minimum time between replies

interface Tweet {
  id: string;
  text: string;
  author: {
    userName: string;
    name: string;
  };
  createdAt: string;
}

interface ExploreResponse {
  tweets: Tweet[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!twitterApiKey) {
      throw new Error("TWITTERAPI_IO_KEY not configured");
    }
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log("[twitter-auto-reply] 🚀 Starting auto-reply bot...");

    // Check cooldown - don't run if we replied recently
    const { data: lastReply } = await supabase
      .from("twitter_bot_replies")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lastReply) {
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

    // Fetch trending/explore tweets
    console.log("[twitter-auto-reply] 📡 Fetching explore tweets...");
    const exploreResponse = await fetch(`${TWITTERAPI_BASE}/trends/explore`, {
      method: "GET",
      headers: {
        "X-API-Key": twitterApiKey,
        "Content-Type": "application/json",
      },
    });

    if (!exploreResponse.ok) {
      const errorText = await exploreResponse.text();
      console.error("[twitter-auto-reply] ❌ Explore API error:", exploreResponse.status, errorText);
      throw new Error(`Failed to fetch explore tweets: ${exploreResponse.status}`);
    }

    const exploreData = await exploreResponse.json();
    const tweets: Tweet[] = exploreData.tweets || exploreData.data || [];
    console.log(`[twitter-auto-reply] 📥 Found ${tweets.length} tweets from explore`);

    if (tweets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No tweets found in explore", repliesSent: 0 }),
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
      t.author?.userName?.toLowerCase() !== "ai67x_fun"
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
        console.log(`[twitter-auto-reply] 💬 Generating reply for tweet ${tweet.id}...`);
        
        // Generate AI reply
        const aiResponse = await fetch("https://ai.lovable.dev/api/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: "openai/gpt-5-mini",
            messages: [
              {
                role: "system",
                content: `You are @ai67x_fun, a witty crypto/meme coin enthusiast on X (Twitter). 
Generate a SHORT, engaging reply (max 200 chars) to the tweet below. 

Rules:
- Be friendly, helpful, and slightly humorous
- Reference meme coins or crypto culture naturally when relevant
- Never be spammy, promotional, or robotic
- Don't use hashtags excessively (max 1 if any)
- Sound like a real person, not a bot
- Keep it concise and punchy
- If the tweet is about crypto/trading, add relevant insight
- If it's general content, make a clever observation

IMPORTANT: Just output the reply text, nothing else.`
              },
              {
                role: "user",
                content: `Tweet from @${tweet.author?.userName || "unknown"}: "${tweet.text}"`
              }
            ],
            max_tokens: 100,
            temperature: 0.8,
          }),
        });

        if (!aiResponse.ok) {
          throw new Error(`AI generation failed: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const replyText = aiData.choices?.[0]?.message?.content?.trim();

        if (!replyText) {
          throw new Error("Empty AI response");
        }

        console.log(`[twitter-auto-reply] 🤖 Generated reply: "${replyText.substring(0, 50)}..."`);

        // Post the reply via twitterapi.io
        const postResponse = await fetch(`${TWITTERAPI_BASE}/tweet/reply`, {
          method: "POST",
          headers: {
            "X-API-Key": twitterApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tweet_id: tweet.id,
            text: replyText,
          }),
        });

        if (!postResponse.ok) {
          const errorText = await postResponse.text();
          
          // Handle rate limits with exponential backoff
          if (postResponse.status === 429) {
            console.warn("[twitter-auto-reply] ⚠️ Rate limited, stopping this run");
            break;
          }
          
          throw new Error(`Reply post failed: ${postResponse.status} - ${errorText}`);
        }

        const postData = await postResponse.json();
        console.log(`[twitter-auto-reply] ✅ Reply posted successfully to tweet ${tweet.id}`);

        // Record the reply in database
        await supabase.from("twitter_bot_replies").insert({
          tweet_id: tweet.id,
          tweet_author: tweet.author?.userName,
          tweet_text: tweet.text?.substring(0, 500),
          reply_text: replyText,
          reply_id: postData.id || postData.tweet_id || null,
        });

        results.push({ tweetId: tweet.id, success: true });

        // Add random delay between replies (2-5 seconds) to look more human
        if (tweetsToReply.indexOf(tweet) < tweetsToReply.length - 1) {
          const delay = 2000 + Math.random() * 3000;
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
