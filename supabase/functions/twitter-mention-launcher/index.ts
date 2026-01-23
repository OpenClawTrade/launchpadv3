import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";
const MAX_LAUNCHES_PER_HOUR = 2; // Per X user
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MENTION_COOLDOWN_MINUTES = 2; // Between processing mentions

// Solana address regex (base58, 32-44 chars)
const SOLANA_ADDRESS_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

// Keywords that indicate token creation request
const LAUNCH_KEYWORDS = [
  "create", "launch", "make", "deploy", "mint", "generate", "build", "spawn",
  "coin", "token", "meme", "memecoin"
];

interface Tweet {
  id: string;
  text: string;
  author: {
    id: string;
    userName: string;
    name: string;
  };
  createdAt: string;
  mediaUrls?: string[];
  inReplyToId?: string;
  quotedTweet?: Tweet;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const TWITTERAPI_IO_KEY = Deno.env.get("TWITTERAPI_IO_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const X_AUTH_TOKEN = Deno.env.get("X_AUTH_TOKEN");
  const X_CT0_TOKEN = Deno.env.get("X_CT0_TOKEN");
  const TWITTER_PROXY = Deno.env.get("TWITTER_PROXY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const METEORA_API_URL = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");

  if (!TWITTERAPI_IO_KEY || !LOVABLE_API_KEY || !X_AUTH_TOKEN || !X_CT0_TOKEN) {
    console.error("[mention-launcher] ❌ Missing required API keys");
    return new Response(
      JSON.stringify({ success: false, error: "Missing API configuration" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { action, secret } = await req.json().catch(() => ({}));

    // Admin action to list mentions
    if (action === "list") {
      const adminSecret = Deno.env.get("TWITTER_BOT_ADMIN_SECRET");
      if (adminSecret && secret !== adminSecret) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: requests } = await supabase
        .from("x_pending_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: rateLimits } = await supabase
        .from("x_bot_rate_limits")
        .select("*")
        .order("launched_at", { ascending: false })
        .limit(50);

      return new Response(
        JSON.stringify({ success: true, requests, rateLimits }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cooldown since last mention processing
    const { data: lastRequest } = await supabase
      .from("x_pending_requests")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lastRequest) {
      const lastTime = new Date(lastRequest.created_at).getTime();
      const cooldownMs = MENTION_COOLDOWN_MINUTES * 60 * 1000;
      if (Date.now() - lastTime < cooldownMs) {
        const waitSecs = Math.ceil((cooldownMs - (Date.now() - lastTime)) / 1000);
        console.log(`[mention-launcher] ⏳ Cooldown active, wait ${waitSecs}s`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, waitSeconds: waitSecs }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("[mention-launcher] 🔍 Searching for @ai67x_fun mentions...");

    // Search for mentions of @ai67x_fun using multiple queries to catch more
    // Include quote tweets and various mention formats
    const searchQueries = [
      "@ai67x_fun",
      "to:ai67x_fun", 
      "\"ai67x_fun\"",
      "ai67x_fun -from:ai67x_fun",
    ];
    
    let allTweets: Tweet[] = [];
    const seenIds = new Set<string>();

    for (const query of searchQueries) {
      try {
        const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
        searchUrl.searchParams.set("query", query);
        searchUrl.searchParams.set("queryType", "Latest");

        const searchResponse = await fetch(searchUrl.toString(), {
          headers: { "X-API-Key": TWITTERAPI_IO_KEY },
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const tweets: Tweet[] = searchData.tweets || [];
          console.log(`[mention-launcher] 📊 Query "${query}" returned ${tweets.length} tweets`);
          
          for (const t of tweets) {
            if (!seenIds.has(t.id)) {
              seenIds.add(t.id);
              allTweets.push(t);
            }
          }
        } else {
          console.log(`[mention-launcher] ⚠️ Query "${query}" failed: ${searchResponse.status}`);
        }
      } catch (err) {
        console.log(`[mention-launcher] ⚠️ Query "${query}" error: ${err}`);
      }
    }

    // Also try to get mentions via user mentions endpoint (more reliable than search)
    try {
      const mentionsUrl = new URL(`${TWITTERAPI_BASE}/twitter/user/mentions`);
      mentionsUrl.searchParams.set("userName", "ai67x_fun");
      mentionsUrl.searchParams.set("count", "50");
      
      const mentionsResponse = await fetch(mentionsUrl.toString(), {
        headers: { "X-API-Key": TWITTERAPI_IO_KEY },
      });
      
      if (mentionsResponse.ok) {
        const mentionsData = await mentionsResponse.json();
        const mentionTweets: Tweet[] = mentionsData.tweets || mentionsData.data || [];
        console.log(`[mention-launcher] 📊 Mentions endpoint returned ${mentionTweets.length} tweets`);
        
        for (const t of mentionTweets) {
          if (t.id && !seenIds.has(t.id)) {
            seenIds.add(t.id);
            allTweets.push(t);
          }
        }
      } else {
        const errText = await mentionsResponse.text();
        console.log(`[mention-launcher] ⚠️ Mentions endpoint failed: ${mentionsResponse.status} - ${errText.slice(0, 200)}`);
      }
    } catch (err) {
      console.log(`[mention-launcher] ⚠️ Mentions endpoint error: ${err}`);
    }

    const tweets = allTweets;
    console.log(`[mention-launcher] 📊 Total unique mention tweets: ${tweets.length}`);
    
    // Log all tweet IDs for debugging
    if (tweets.length > 0) {
      console.log(`[mention-launcher] 📋 Tweet IDs: ${tweets.map(t => t.id).join(', ')}`);
    }

    if (tweets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No mentions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get already processed tweet IDs
    const tweetIds = tweets.map(t => t.id);
    const { data: processedTweets } = await supabase
      .from("x_pending_requests")
      .select("tweet_id")
      .in("tweet_id", tweetIds);
    
    const processedIds = new Set((processedTweets || []).map(t => t.tweet_id));

    // Also check twitter_bot_replies for any we've already replied to
    const { data: repliedTweets } = await supabase
      .from("twitter_bot_replies")
      .select("tweet_id")
      .in("tweet_id", tweetIds);
    
    const repliedIds = new Set((repliedTweets || []).map(t => t.tweet_id));

    // Only consider mentions from the last 30 minutes
    const MENTION_MAX_AGE_MINUTES = 30;
    const isRecentTweet = (tweet: Tweet): boolean => {
      if (!tweet.createdAt) return true;
      try {
        const tweetTime = new Date(tweet.createdAt);
        const cutoff = new Date(Date.now() - MENTION_MAX_AGE_MINUTES * 60 * 1000);
        return tweetTime >= cutoff;
      } catch {
        return true;
      }
    };

    // Filter to unprocessed mentions with launch intent
    const eligibleMentions = tweets.filter(t => {
      if (processedIds.has(t.id) || repliedIds.has(t.id)) {
        console.log(`[mention-launcher] ⏭️ Skipping ${t.id} - already processed/replied`);
        return false;
      }
      if (t.author?.userName?.toLowerCase() === "ai67x_fun") return false;
      if (!t.text || t.text.length < 10) return false;
      
      // Check if tweet is recent enough
      if (!isRecentTweet(t)) {
        console.log(`[mention-launcher] ⏰ Skipping ${t.id} - too old (>${MENTION_MAX_AGE_MINUTES} min)`);
        return false;
      }
      
      // Check for launch intent keywords
      const textLower = t.text.toLowerCase();
      const hasLaunchIntent = LAUNCH_KEYWORDS.some(keyword => textLower.includes(keyword));
      
      if (!hasLaunchIntent) {
        console.log(`[mention-launcher] 📝 Tweet ${t.id} by @${t.author?.userName}: "${t.text.slice(0, 80)}..." - NO launch keywords`);
      }
      
      return hasLaunchIntent;
    });

    console.log(`[mention-launcher] ✅ ${eligibleMentions.length} eligible mentions with launch intent`);

    if (eligibleMentions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No new launch requests" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process first eligible mention
    const mention = eligibleMentions[0];
    console.log(`[mention-launcher] 🎯 Processing mention from @${mention.author.userName}: "${mention.text.slice(0, 100)}..."`);

    // Check rate limit for this X user
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { data: userLaunches } = await supabase
      .from("x_bot_rate_limits")
      .select("launched_at")
      .eq("x_user_id", mention.author.id)
      .gte("launched_at", oneHourAgo);

    if (userLaunches && userLaunches.length >= MAX_LAUNCHES_PER_HOUR) {
      console.log(`[mention-launcher] ⚠️ Rate limit for @${mention.author.userName}: ${userLaunches.length} launches in last hour`);
      
      // Reply with rate limit message
      const rateLimitReply = `@${mention.author.userName} You've already launched ${userLaunches.length} tokens in the last hour. Please wait a bit before creating more! 🕐`;
      
      await postReply(mention.id, rateLimitReply, {
        TWITTERAPI_IO_KEY,
        X_AUTH_TOKEN,
        X_CT0_TOKEN,
        TWITTER_PROXY,
      });

      // Mark as processed
      await supabase.from("x_pending_requests").insert({
        tweet_id: mention.id,
        x_user_id: mention.author.id,
        x_username: mention.author.userName,
        original_tweet_text: mention.text,
        status: "rate_limited",
      });

      return new Response(
        JSON.stringify({ success: true, processed: 1, rateLimited: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract Solana address from tweet
    const solanaAddresses = mention.text.match(SOLANA_ADDRESS_REGEX) || [];
    const validSolanaAddress = solanaAddresses.find(addr => 
      addr.length >= 32 && addr.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr)
    );

    // Get image URL if present
    const imageUrl = mention.mediaUrls?.[0] || null;

    if (!validSolanaAddress) {
      console.log(`[mention-launcher] ⚠️ No Solana address in mention from @${mention.author.userName}`);
      
      // Reply asking for Solana address
      const noWalletReply = `@${mention.author.userName} In order to launch coin I need your solana address where to send fees for each swap`;
      
      const replyResult = await postReply(mention.id, noWalletReply, {
        TWITTERAPI_IO_KEY,
        X_AUTH_TOKEN,
        X_CT0_TOKEN,
        TWITTER_PROXY,
      });

      // Store as pending request
      await supabase.from("x_pending_requests").insert({
        tweet_id: mention.id,
        x_user_id: mention.author.id,
        x_username: mention.author.userName,
        original_tweet_text: mention.text,
        original_tweet_image_url: imageUrl,
        our_reply_tweet_id: replyResult?.tweetId || null,
        status: "pending",
      });

      return new Response(
        JSON.stringify({ success: true, processed: 1, pendingWallet: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[mention-launcher] 💰 Found Solana address: ${validSolanaAddress}`);

    // Generate token concept from tweet content using AI
    const tokenConcept = await generateTokenFromTweet(mention.text, imageUrl, LOVABLE_API_KEY);
    
    if (!tokenConcept) {
      console.error("[mention-launcher] ❌ Failed to generate token concept");
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[mention-launcher] 🎨 Generated token: ${tokenConcept.name} ($${tokenConcept.ticker})`);

    // Generate image if not provided
    let finalImageUrl = imageUrl;
    if (!finalImageUrl) {
      finalImageUrl = await generateTokenImage(tokenConcept.name, tokenConcept.description, LOVABLE_API_KEY);
    }

    // Create the token via fun-create
    const tokenResult = await createToken({
      name: tokenConcept.name,
      ticker: tokenConcept.ticker,
      description: tokenConcept.description,
      imageUrl: finalImageUrl,
      creatorWallet: validSolanaAddress,
      twitterUrl: `https://x.com/${mention.author.userName}/status/${mention.id}`,
      supabase,
      METEORA_API_URL,
    });

    if (!tokenResult.success) {
      console.error("[mention-launcher] ❌ Token creation failed:", tokenResult.error);
      
      // Reply with error
      const errorReply = `@${mention.author.userName} Sorry, there was an issue creating your token. Please try again later! 🙏`;
      await postReply(mention.id, errorReply, {
        TWITTERAPI_IO_KEY,
        X_AUTH_TOKEN,
        X_CT0_TOKEN,
        TWITTER_PROXY,
      });

      await supabase.from("x_pending_requests").insert({
        tweet_id: mention.id,
        x_user_id: mention.author.id,
        x_username: mention.author.userName,
        original_tweet_text: mention.text,
        status: "failed",
      });

      return new Response(
        JSON.stringify({ success: false, error: tokenResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[mention-launcher] 🚀 Token created! CA: ${tokenResult.mintAddress}`);

    // Reply with success and token details
    const successReply = `@${mention.author.userName} Your token is LIVE! 🚀

$${tokenConcept.ticker} - ${tokenConcept.name}
CA: ${tokenResult.mintAddress}

Trade: ${tokenResult.tradeUrl}

You'll receive 50% of all trading fees! 💰`;

    await postReply(mention.id, successReply, {
      TWITTERAPI_IO_KEY,
      X_AUTH_TOKEN,
      X_CT0_TOKEN,
      TWITTER_PROXY,
    });

    // Record the launch for rate limiting
    await supabase.from("x_bot_rate_limits").insert({
      x_user_id: mention.author.id,
      x_username: mention.author.userName,
    });

    // Mark request as completed
    await supabase.from("x_pending_requests").insert({
      tweet_id: mention.id,
      x_user_id: mention.author.id,
      x_username: mention.author.userName,
      original_tweet_text: mention.text,
      original_tweet_image_url: imageUrl,
      status: "completed",
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: 1,
        launched: true,
        token: {
          name: tokenConcept.name,
          ticker: tokenConcept.ticker,
          mintAddress: tokenResult.mintAddress,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[mention-launcher] ❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Generate token concept from tweet using AI
async function generateTokenFromTweet(
  tweetText: string,
  imageUrl: string | null,
  apiKey: string
): Promise<{ name: string; ticker: string; description: string } | null> {
  try {
    const prompt = `Based on this tweet requesting a meme token creation, generate a creative memecoin concept.

Tweet: "${tweetText}"
${imageUrl ? `(Tweet includes an image)` : ""}

Create a fun, memeable token inspired by the tweet's content, theme, or vibe.

REQUIREMENTS:
1. Name: Single word, catchy, max 12 chars (like Pepe, Doge, Wojak, Bonk)
2. Ticker: 3-5 uppercase letters derived from the name
3. Description: Fun, trendy description with 1-2 emojis, max 100 chars

Return ONLY valid JSON:
{"name": "TokenName", "ticker": "TICK", "description": "Fun description here 🚀"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a creative meme coin generator. Return only valid JSON, no markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      console.error("[mention-launcher] AI API error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[mention-launcher] No JSON in AI response:", content);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      name: parsed.name?.slice(0, 12) || "MemeToken",
      ticker: (parsed.ticker || parsed.name?.slice(0, 4) || "MEME").toUpperCase().slice(0, 5),
      description: parsed.description?.slice(0, 100) || "A fun meme coin! 🚀",
    };
  } catch (error) {
    console.error("[mention-launcher] generateTokenFromTweet error:", error);
    return null;
  }
}

// Generate token image using AI
async function generateTokenImage(
  name: string,
  description: string,
  apiKey: string
): Promise<string | null> {
  try {
    const prompt = `Create a simple meme mascot for "${name}" crypto token. ${description}. Cartoon style, expressive face, solid background, no text.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error("[mention-launcher] Image generation failed:", response.status);
      return null;
    }

    const data = await response.json();
    // Extract image URL from response
    const imageUrl = data.choices?.[0]?.message?.content;
    return imageUrl || null;
  } catch (error) {
    console.error("[mention-launcher] generateTokenImage error:", error);
    return null;
  }
}

// Create token via fun-create edge function
async function createToken(params: {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string | null;
  creatorWallet: string;
  twitterUrl: string;
  supabase: any;
  METEORA_API_URL: string | undefined;
}): Promise<{ success: boolean; mintAddress?: string; tradeUrl?: string; error?: string }> {
  try {
    if (!params.METEORA_API_URL) {
      return { success: false, error: "METEORA_API_URL not configured" };
    }

    const response = await fetch(`${params.METEORA_API_URL}/api/pool/create-fun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: params.name.slice(0, 32),
        ticker: params.ticker.toUpperCase().slice(0, 10),
        description: params.description,
        imageUrl: params.imageUrl,
        twitterUrl: params.twitterUrl,
        websiteUrl: "https://ai67x.fun",
        feeRecipientWallet: params.creatorWallet,
        serverSideSign: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[mention-launcher] Pool creation failed:", response.status, errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    if (!result.success || !result.mintAddress) {
      return { success: false, error: result.error || "Invalid response" };
    }

    return {
      success: true,
      mintAddress: result.mintAddress,
      tradeUrl: result.tradeUrl || `https://axiom.trade/meme/${result.dbcPoolAddress || result.mintAddress}`,
    };
  } catch (error) {
    console.error("[mention-launcher] createToken error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Post a reply to a tweet
async function postReply(
  tweetId: string,
  text: string,
  config: {
    TWITTERAPI_IO_KEY: string;
    X_AUTH_TOKEN: string;
    X_CT0_TOKEN: string;
    TWITTER_PROXY?: string;
  }
): Promise<{ success: boolean; tweetId?: string }> {
  try {
    const body: any = {
      text,
      reply: { in_reply_to_tweet_id: tweetId },
      auth_session: {
        auth_token: config.X_AUTH_TOKEN,
        ct0: config.X_CT0_TOKEN,
      },
    };

    if (config.TWITTER_PROXY) {
      body.proxy = config.TWITTER_PROXY;
    }

    const response = await fetch(`${TWITTERAPI_BASE}/twitter/tweet/create`, {
      method: "POST",
      headers: {
        "X-API-Key": config.TWITTERAPI_IO_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[mention-launcher] Reply failed:", response.status, errorText);
      return { success: false };
    }

    const result = await response.json();
    console.log("[mention-launcher] ✅ Reply posted:", result.data?.id);
    return { success: true, tweetId: result.data?.id };
  } catch (error) {
    console.error("[mention-launcher] postReply error:", error);
    return { success: false };
  }
}
