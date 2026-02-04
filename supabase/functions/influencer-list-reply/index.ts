import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limits: 20 replies per hour = ~4 per 10-minute cycle
const MAX_REPLIES_PER_RUN = 4;
const TWEET_RECENCY_MINUTES = 60; // Look at tweets from last hour

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWITTERAPI_IO_KEY = Deno.env.get("TWITTERAPI_IO_KEY");
    const X_FULL_COOKIE = Deno.env.get("X_FULL_COOKIE");
    const TWITTER_PROXY = Deno.env.get("TWITTER_PROXY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ENABLE_INFLUENCER_REPLIES = Deno.env.get("ENABLE_INFLUENCER_REPLIES") !== "false";

    if (!TWITTERAPI_IO_KEY || !X_FULL_COOKIE || !LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing required environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

      return new Response(
        JSON.stringify({ 
          config, 
          recentReplies, 
          repliesLastHour: hourlyCount,
          enabled: ENABLE_INFLUENCER_REPLIES 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ENABLE_INFLUENCER_REPLIES) {
      console.log("Influencer replies disabled via kill switch");
      return new Response(
        JSON.stringify({ message: "Influencer replies disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active list config
    const { data: config, error: configError } = await supabase
      .from("influencer_list_config")
      .select("*")
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      console.log("No active influencer list config found");
      return new Response(
        JSON.stringify({ message: "No active list config" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check hourly rate limit (20 per hour)
    const { count: hourlyCount } = await supabase
      .from("influencer_replies")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if ((hourlyCount || 0) >= 20) {
      console.log("Hourly rate limit reached (20/hour)");
      return new Response(
        JSON.stringify({ message: "Hourly rate limit reached", count: hourlyCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maxReplies = Math.min(config.max_replies_per_run || MAX_REPLIES_PER_RUN, 20 - (hourlyCount || 0));

    // Fetch list members
    console.log(`Fetching members from list ${config.list_id}...`);
    const membersResponse = await fetch(
      `https://api.twitterapi.io/twitter/list/members?listId=${config.list_id}`,
      { headers: { "X-API-Key": TWITTERAPI_IO_KEY } }
    );

    if (!membersResponse.ok) {
      const errorText = await membersResponse.text();
      console.error("Failed to fetch list members:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch list members", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const membersData = await membersResponse.json();
    const members = membersData.users || membersData.members || [];
    console.log(`Found ${members.length} members in list`);

    if (members.length === 0) {
      return new Response(
        JSON.stringify({ message: "No members found in list" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get already replied tweet IDs
    const { data: existingReplies } = await supabase
      .from("influencer_replies")
      .select("tweet_id")
      .eq("list_id", config.list_id);

    const repliedTweetIds = new Set((existingReplies || []).map(r => r.tweet_id));

    // Collect eligible tweets from all members
    const eligibleTweets: any[] = [];
    const cutoffTime = Date.now() - TWEET_RECENCY_MINUTES * 60 * 1000;

    for (const member of members) {
      const username = member.userName || member.username || member.screen_name;
      if (!username) continue;

      try {
        const tweetsResponse = await fetch(
          `https://api.twitterapi.io/twitter/user/last_tweets?userName=${username}`,
          { headers: { "X-API-Key": TWITTERAPI_IO_KEY } }
        );

        if (!tweetsResponse.ok) continue;

        const tweetsData = await tweetsResponse.json();
        const tweets = tweetsData.tweets || [];

        for (const tweet of tweets) {
          const tweetId = tweet.id || tweet.id_str;
          if (!tweetId || repliedTweetIds.has(tweetId)) continue;

          // Check recency
          const tweetDate = new Date(tweet.createdAt || tweet.created_at).getTime();
          if (tweetDate < cutoffTime) continue;

          // Determine tweet type
          let tweetType = "original";
          const isRetweet = tweet.isRetweet || tweet.retweeted_status || tweet.text?.startsWith("RT @");
          const isReply = tweet.isReply || tweet.in_reply_to_status_id || tweet.inReplyToId;

          if (isRetweet) {
            if (!config.include_retweets) continue;
            tweetType = "retweet";
          } else if (isReply) {
            if (!config.include_replies) continue;
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
        }
      } catch (err) {
        console.error(`Error fetching tweets for ${username}:`, err);
      }
    }

    console.log(`Found ${eligibleTweets.length} eligible tweets`);

    if (eligibleTweets.length === 0) {
      return new Response(
        JSON.stringify({ message: "No eligible tweets to reply to" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sort by engagement and take top N
    eligibleTweets.sort((a, b) => b.engagement - a.engagement);
    const tweetsToReply = eligibleTweets.slice(0, maxReplies);

    const results: any[] = [];

    for (const tweet of tweetsToReply) {
      try {
        // Generate AI reply
        const prompt = `You are replying to a crypto influencer's tweet. Generate a short, engaging reply (max 250 chars) that:
- Is relevant and adds value to the conversation
- Is friendly and professional, not spammy
- Can subtly mention TUNA.fun as a meme coin launchpad if naturally fits (not forced)
- Feels authentic, not like a bot

Tweet by @${tweet.username}: "${tweet.text}"

Reply (max 250 chars):`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        });

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
        const postResponse = await fetch("https://api.twitterapi.io/twitter/tweet/create_v2", {
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
        });

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

        // Small delay between replies
        await new Promise(r => setTimeout(r, 2000));

      } catch (err) {
        console.error(`Error processing tweet ${tweet.id}:`, err);
        results.push({
          success: false,
          tweetId: tweet.id,
          error: String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Influencer reply error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
