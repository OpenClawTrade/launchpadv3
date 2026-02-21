import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";
const MAX_LAUNCHES_PER_HOUR = 2;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MENTION_COOLDOWN_MINUTES = 1;

// Solana address regex (base58, 32-44 chars)
const SOLANA_ADDRESS_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

// Launch command patterns (case-insensitive)
const LAUNCH_COMMANDS = [/!clawmode/i];

// ============ t.co URL EXPANSION ============
// Twitter sometimes returns t.co shortlinks instead of expanded URLs.
// We must expand these BEFORE attempting to re-host the image.
async function expandTcoUrl(shortUrl: string): Promise<{ success: boolean; expandedUrl?: string; error?: string }> {
  // If not a t.co link, return as-is
  if (!shortUrl.includes('t.co/')) {
    return { success: true, expandedUrl: shortUrl };
  }
  
  console.log(`[mention-launcher] 🔗 Expanding t.co URL: ${shortUrl}`);
  
  try {
    // Use HEAD request to follow redirects without downloading content
    const response = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    
    // Get the final URL after all redirects
    const finalUrl = response.url;
    
    console.log(`[mention-launcher] 🔗 t.co expanded: ${shortUrl} → ${finalUrl}`);
    
    // Validate it's actually an image URL (Twitter media CDN)
    const isImageUrl = 
      finalUrl.includes('pbs.twimg.com') || 
      finalUrl.includes('/media/') ||
      finalUrl.includes('.jpg') ||
      finalUrl.includes('.png') ||
      finalUrl.includes('.gif') ||
      finalUrl.includes('.webp');
    
    if (!isImageUrl) {
      console.warn(`[mention-launcher] ⚠️ t.co expanded to non-image URL: ${finalUrl}`);
      return { success: false, error: `t.co link does not point to an image: ${finalUrl.slice(0, 60)}...` };
    }
    
    return { success: true, expandedUrl: finalUrl };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    console.error(`[mention-launcher] ❌ Failed to expand t.co URL: ${error}`);
    return { success: false, error: `Failed to expand t.co URL: ${error}` };
  }
}

// Validate image URL format before processing
function isValidImageUrl(url: string | null): boolean {
  if (!url || url.length < 10) return false;
  if (!url.startsWith('https://') && !url.startsWith('http://')) return false;
  
  // Reject raw t.co links - they must be expanded first
  if (url.includes('t.co/') && !url.includes('pbs.twimg.com')) {
    return false;
  }
  
  return true;
}

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

interface LaunchEventLogger {
  log: (stage: string, success: boolean, details?: Record<string, any>, errorMessage?: string) => Promise<void>;
}

function createEventLogger(supabase: any, postId: string, postAuthor: string | null): LaunchEventLogger {
  return {
    log: async (stage: string, success: boolean, details?: Record<string, any>, errorMessage?: string) => {
      try {
        await supabase.from("x_launch_events").insert({
          platform: "twitter",
          post_id: postId,
          post_author: postAuthor,
          stage,
          success,
          details: details || {},
          error_message: errorMessage || null,
        });
        console.log(`[mention-launcher] 📝 Event: ${stage} | success=${success}${errorMessage ? ` | error=${errorMessage}` : ""}`);
      } catch (err) {
        console.error(`[mention-launcher] Failed to log event:`, err);
      }
    },
  };
}

// Fetch and re-host an image to permanent storage
async function rehostImage(
  rawUrl: string,
  supabase: any,
  ticker: string
): Promise<{ success: boolean; hostedUrl?: string; contentType?: string; byteSize?: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Follow redirects (handles t.co shortlinks)
    const response = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status} fetching image` };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return { success: false, error: `Invalid content-type: ${contentType}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const byteSize = arrayBuffer.byteLength;

    if (byteSize > 5 * 1024 * 1024) {
      return { success: false, error: `Image too large: ${(byteSize / 1024 / 1024).toFixed(2)}MB` };
    }

    if (byteSize < 1000) {
      return { success: false, error: `Image too small: ${byteSize} bytes (likely error page)` };
    }

    // Determine extension
    let ext = "png";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
    else if (contentType.includes("gif")) ext = "gif";
    else if (contentType.includes("webp")) ext = "webp";

    const fileName = `x-launches/${Date.now()}-${ticker.toUpperCase()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(fileName, new Uint8Array(arrayBuffer), {
        contentType,
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    const { data: { publicUrl } } = supabase.storage.from("post-images").getPublicUrl(fileName);

    console.log(`[mention-launcher] ✅ Image rehosted in ${Date.now() - startTime}ms: ${publicUrl}`);

    return { success: true, hostedUrl: publicUrl, contentType, byteSize };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown fetch error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const TWITTERAPI_IO_KEY = Deno.env.get("TWITTERAPI_IO_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const X_FULL_COOKIE = Deno.env.get("X_FULL_COOKIE");
  const X_AUTH_TOKEN = Deno.env.get("X_AUTH_TOKEN");
  const X_CT0_TOKEN = Deno.env.get("X_CT0_TOKEN");
  const TWITTER_PROXY = Deno.env.get("TWITTER_PROXY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const METEORA_API_URL = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");

  const hasAuth = !!X_FULL_COOKIE || (!!X_AUTH_TOKEN && !!X_CT0_TOKEN);
  if (!TWITTERAPI_IO_KEY || !LOVABLE_API_KEY || !hasAuth) {
    console.error("[mention-launcher] ❌ Missing required API keys");
    return new Response(
      JSON.stringify({ success: false, error: "Missing API configuration" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // TEMPORARY HALT: Stop all launches and replies until this timestamp
  const HALT_UNTIL = new Date("2026-02-22T11:40:00Z"); // 15 hours from Feb 21 ~20:40 UTC
  if (Date.now() < HALT_UNTIL.getTime()) {
    const remainingMs = HALT_UNTIL.getTime() - Date.now();
    const remainingMins = Math.ceil(remainingMs / 60000);
    console.log(`[mention-launcher] ⏸️ TEMPORARY HALT active. Resumes in ${remainingMins} minutes (at ${HALT_UNTIL.toISOString()})`);
    return new Response(
      JSON.stringify({ success: true, halted: true, resumesAt: HALT_UNTIL.toISOString(), remainingMinutes: remainingMins }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

      const { data: events } = await supabase
        .from("x_launch_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      return new Response(
        JSON.stringify({ success: true, requests, rateLimits, events }),
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

    console.log("[mention-launcher] 🔍 Searching for !clawmode launches...");

    // Search for !clawmode command only
    const searchQueries = ["\"!clawmode\""];
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
        }
      } catch (err) {
        console.log(`[mention-launcher] ⚠️ Query "${query}" error: ${err}`);
      }
    }

    // Mentions endpoint removed - only search for !clawmode command

    const tweets = allTweets;
    console.log(`[mention-launcher] 📊 Total unique mention tweets: ${tweets.length}`);

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

    // Filter to unprocessed mentions with explicit launch command
    const eligibleMentions = tweets.filter(t => {
      if (processedIds.has(t.id) || repliedIds.has(t.id)) return false;
      if (["clawmode", "buildclaw", "openclaw", "buildtuna"].includes(t.author?.userName?.toLowerCase() || "")) return false;
      if (!t.text || t.text.length < 10) return false;
      if (!isRecentTweet(t)) return false;
      
      // STRICT: Require explicit !clawmode command only
      const hasLaunchCommand = LAUNCH_COMMANDS.some(pattern => pattern.test(t.text));
      
      if (!hasLaunchCommand) {
        console.log(`[mention-launcher] 📝 Tweet ${t.id} - no launch command found`);
      }
      
      return hasLaunchCommand;
    });

    console.log(`[mention-launcher] ✅ ${eligibleMentions.length} eligible mentions with launch command`);

    if (eligibleMentions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No new launch requests" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process first eligible mention
    const mention = eligibleMentions[0];
    const logger = createEventLogger(supabase, mention.id, mention.author?.userName || null);
    
    console.log(`[mention-launcher] 🎯 Processing mention from @${mention.author.userName}: "${mention.text.slice(0, 100)}..."`);

    // Log: Tweet detected
    await logger.log("detected", true, {
      tweet_text: mention.text.slice(0, 500),
      media_urls: mention.mediaUrls || [],
      created_at: mention.createdAt,
    });

    // Check rate limit for this X user
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { data: userLaunches } = await supabase
      .from("x_bot_rate_limits")
      .select("launched_at")
      .eq("x_user_id", mention.author.id)
      .gte("launched_at", oneHourAgo);

    if (userLaunches && userLaunches.length >= MAX_LAUNCHES_PER_HOUR) {
      await logger.log("rate_limited", false, { launches_count: userLaunches.length });
      
      const rateLimitReply = `@${mention.author.userName} You've already launched ${userLaunches.length} tokens in the last hour. Please wait a bit before creating more! 🕐

Launch your unique Solana Agent from Claw Mode`;
      
      await postReply(mention.id, rateLimitReply, null, {
        TWITTERAPI_IO_KEY,
        X_FULL_COOKIE,
        X_AUTH_TOKEN,
        X_CT0_TOKEN,
        TWITTER_PROXY,
      });

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

    // === STRICT IMAGE REQUIREMENT ===
    const rawImageUrl = mention.mediaUrls?.[0] || null;
    
    console.log(`[mention-launcher] 📷 Raw image URL from tweet: ${rawImageUrl || 'NONE'}`);
    
    if (!rawImageUrl) {
      await logger.log("image_missing", false, {}, "No image attached to tweet");
      
      const noImageReply = `@${mention.author.userName} Please attach an image to your tweet! 🖼️

To launch a token, reply again with:
• Your image attached
• !clawmode command

Launch your unique Solana Agent from Claw Mode`;
      
      await postReply(mention.id, noImageReply, null, {
        TWITTERAPI_IO_KEY,
        X_FULL_COOKIE,
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
        JSON.stringify({ success: false, error: "No image attached" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === EXPAND t.co SHORTLINKS ===
    // Twitter API sometimes returns t.co links in mediaUrls instead of expanded URLs
    let expandedImageUrl = rawImageUrl;
    
    if (rawImageUrl.includes('t.co/')) {
      const expansionResult = await expandTcoUrl(rawImageUrl);
      
      if (!expansionResult.success) {
        await logger.log("tco_expansion_failed", false, {
          raw_url: rawImageUrl,
          error: expansionResult.error,
        }, expansionResult.error);
        
        const tcoFailReply = `@${mention.author.userName} Sorry, we couldn't process the image link in your tweet. Please attach the image directly (not as a link)! 🖼️

Launch your unique Solana Agent from Claw Mode`;
        
        await postReply(mention.id, tcoFailReply, null, {
          TWITTERAPI_IO_KEY,
          X_FULL_COOKIE,
          X_AUTH_TOKEN,
          X_CT0_TOKEN,
          TWITTER_PROXY,
        });

        await supabase.from("x_pending_requests").insert({
          tweet_id: mention.id,
          x_user_id: mention.author.id,
          x_username: mention.author.userName,
          original_tweet_text: mention.text,
          original_tweet_image_url: rawImageUrl,
          status: "failed",
        });

        return new Response(
          JSON.stringify({ success: false, error: `t.co expansion failed: ${expansionResult.error}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      expandedImageUrl = expansionResult.expandedUrl!;
      console.log(`[mention-launcher] ✅ t.co expanded successfully: ${expandedImageUrl}`);
    }

    // Final validation before re-hosting
    if (!isValidImageUrl(expandedImageUrl)) {
      await logger.log("invalid_image_url", false, {
        raw_url: rawImageUrl,
        expanded_url: expandedImageUrl,
      }, "Image URL is invalid after expansion");
      
      const invalidUrlReply = `@${mention.author.userName} Sorry, the image in your tweet isn't in a supported format. Please attach a PNG, JPG, GIF, or WebP image directly! 🖼️

Launch your unique Solana Agent from Claw Mode`;
      
      await postReply(mention.id, invalidUrlReply, null, {
        TWITTERAPI_IO_KEY,
        X_FULL_COOKIE,
        X_AUTH_TOKEN,
        X_CT0_TOKEN,
        TWITTER_PROXY,
      });

      await supabase.from("x_pending_requests").insert({
        tweet_id: mention.id,
        x_user_id: mention.author.id,
        x_username: mention.author.userName,
        original_tweet_text: mention.text,
        original_tweet_image_url: rawImageUrl,
        status: "failed",
      });

      return new Response(
        JSON.stringify({ success: false, error: "Invalid image URL format" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logger.log("image_found", true, { 
      raw_url: rawImageUrl, 
      expanded_url: expandedImageUrl,
      was_tco: rawImageUrl !== expandedImageUrl,
    });

    // === RE-HOST IMAGE TO PERMANENT STORAGE ===
    // Generate token concept first to get ticker for filename
    const tokenConcept = await generateTokenFromTweet(mention.text, rawImageUrl, LOVABLE_API_KEY);
    
    if (!tokenConcept) {
      await logger.log("token_generation_failed", false, {}, "AI failed to generate token concept");
      
      await supabase.from("x_pending_requests").insert({
        tweet_id: mention.id,
        x_user_id: mention.author.id,
        x_username: mention.author.userName,
        original_tweet_text: mention.text,
        status: "failed",
      });

      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[mention-launcher] 🎨 Generated token: ${tokenConcept.name} ($${tokenConcept.ticker})`);

    // Re-host the attached image (use expanded URL, not raw t.co)
    console.log(`[mention-launcher] 📤 Re-hosting image: ${expandedImageUrl}`);
    const rehostResult = await rehostImage(expandedImageUrl, supabase, tokenConcept.ticker);
    
    if (!rehostResult.success) {
      await logger.log("image_upload_failed", false, {
        raw_url: rawImageUrl,
        expanded_url: expandedImageUrl,
        error: rehostResult.error,
      }, rehostResult.error);
      
      const uploadFailReply = `@${mention.author.userName} Sorry, we couldn't process your image. Please try again with a different image! 🖼️

Launch your unique Solana Agent from Claw Mode`;
      
      await postReply(mention.id, uploadFailReply, null, {
        TWITTERAPI_IO_KEY,
        X_FULL_COOKIE,
        X_AUTH_TOKEN,
        X_CT0_TOKEN,
        TWITTER_PROXY,
      });

      await supabase.from("x_pending_requests").insert({
        tweet_id: mention.id,
        x_user_id: mention.author.id,
        x_username: mention.author.userName,
        original_tweet_text: mention.text,
        original_tweet_image_url: rawImageUrl,
        status: "failed",
      });

      return new Response(
        JSON.stringify({ success: false, error: `Image upload failed: ${rehostResult.error}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hostedImageUrl = rehostResult.hostedUrl!;
    
    await logger.log("image_upload_ok", true, {
      raw_url: rawImageUrl,
      hosted_url: hostedImageUrl,
      content_type: rehostResult.contentType,
      byte_size: rehostResult.byteSize,
    });

    // Extract Solana address from tweet (optional - can claim via OAuth later)
    const solanaAddresses = mention.text.match(SOLANA_ADDRESS_REGEX) || [];
    const validSolanaAddress = solanaAddresses.find(addr => 
      addr.length >= 32 && addr.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr)
    );

    console.log(`[mention-launcher] 👤 Launch from @${mention.author.userName}${validSolanaAddress ? ` wallet ${validSolanaAddress}` : ' (walletless)'}`);

    // === CREATE TOKEN WITH MANDATORY SOCIALS ===
    const twitterUrl = `https://x.com/${mention.author.userName}/status/${mention.id}`;
    const websiteUrl = `https://clawmode.fun/t/${tokenConcept.ticker.toUpperCase()}`;

    // Final sanitization of description before token creation
    const sanitizedDescription = tokenConcept.description
      .replace(/https?:\/\/t\.co\/\S+/gi, '')
      .trim();
    
    const tokenResult = await createToken({
      name: tokenConcept.name,
      ticker: tokenConcept.ticker,
      description: sanitizedDescription,
      imageUrl: hostedImageUrl, // ALWAYS hosted URL, never raw
      creatorWallet: validSolanaAddress || null,
      creatorUsername: mention.author.userName,
      twitterUrl,
      websiteUrl,
      supabase,
      METEORA_API_URL,
    });

    if (!tokenResult.success) {
      await logger.log("create_token_failed", false, {
        hosted_image_url: hostedImageUrl,
        twitter_url: twitterUrl,
        website_url: websiteUrl,
      }, tokenResult.error);
      
      const errorReply = `@${mention.author.userName} Sorry, there was an issue creating your token. Please try again later! 🙏

Launch your unique Solana Agent from Claw Mode`;
      await postReply(mention.id, errorReply, null, {
        TWITTERAPI_IO_KEY,
        X_FULL_COOKIE,
        X_AUTH_TOKEN,
        X_CT0_TOKEN,
        TWITTER_PROXY,
      });

      await supabase.from("x_pending_requests").insert({
        tweet_id: mention.id,
        x_user_id: mention.author.id,
        x_username: mention.author.userName,
        original_tweet_text: mention.text,
        original_tweet_image_url: rawImageUrl,
        status: "failed",
      });

      return new Response(
        JSON.stringify({ success: false, error: tokenResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logger.log("create_token_ok", true, {
      mint_address: tokenResult.mintAddress,
      trade_url: tokenResult.tradeUrl,
      hosted_image_url: hostedImageUrl,
      twitter_url: twitterUrl,
      website_url: websiteUrl,
    });

    console.log(`[mention-launcher] 🚀 Token created! CA: ${tokenResult.mintAddress}`);

    // Reply with success (include hosted image)
    const successReply = `@${mention.author.userName} Your token is LIVE! 🚀

$${tokenConcept.ticker} - ${tokenConcept.name}
CA: ${tokenResult.mintAddress}

Trade: ${tokenResult.tradeUrl}

You'll receive 50-80% of all trading fees! 💰

Launch your unique Solana Agent from Claw Mode`;

    const replyResult = await postReply(mention.id, successReply, hostedImageUrl, {
      TWITTERAPI_IO_KEY,
      X_FULL_COOKIE,
      X_AUTH_TOKEN,
      X_CT0_TOKEN,
      TWITTER_PROXY,
    });

    await logger.log("reply_sent", replyResult.success, {
      reply_tweet_id: replyResult.tweetId,
    }, replyResult.success ? undefined : "Failed to post reply");

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
      original_tweet_image_url: rawImageUrl,
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
          hostedImageUrl,
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
    // Strip ALL t.co URLs from tweet text before AI processing to prevent pollution
    const cleanedTweetText = tweetText.replace(/https?:\/\/t\.co\/\S+/gi, '').trim();
    
    const prompt = `Based on this tweet requesting a meme token, create a short catchy memecoin.

Tweet: "${cleanedTweetText}"
${imageUrl ? `(Tweet includes an image)` : ""}

RULES:
1. Name: 1-2 short words, meme style. Max 10 chars total. Think: Pepe, Doge, Bonk, Moon Cat, Rug Rat
2. Ticker: 3-6 uppercase letters that MAKE SENSE from the name. Examples:
   - "Pepe" -> "PEPE"
   - "Moon Cat" -> "MOON"
   - "Crab King" -> "CRAB"
   - "Bonk" -> "BONK"
   - "Doge Lord" -> "DOGE"
3. NEVER use random letter combos (PPA, PNQR, PPCA, PCBA are BAD tickers)
4. Description: Fun one-liner with 1-2 emojis, max 80 chars. No URLs.

Return ONLY valid JSON:
{"name": "TokenName", "ticker": "TICK", "description": "Fun description 🚀"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a creative meme coin generator. Return only valid JSON, no markdown. NEVER include URLs in descriptions." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      console.error("[mention-launcher] AI API error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[mention-launcher] No JSON in AI response:", content);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Clean t.co URLs from AI-generated description as a fallback
    const cleanDescription = (parsed.description || "A fun meme coin! 🚀")
      .replace(/https?:\/\/t\.co\/\S+/gi, '')
      .replace(/\.\.\./g, '')
      .trim()
      .slice(0, 100);
    
    return {
      name: parsed.name?.slice(0, 10) || "MemeToken",
      ticker: (parsed.ticker || parsed.name?.split(/\s/)[0]?.replace(/[^A-Za-z]/g, '') || "MEME").toUpperCase().slice(0, 6),
      description: cleanDescription,
    };
  } catch (error) {
    console.error("[mention-launcher] generateTokenFromTweet error:", error);
    return null;
  }
}

// Create token via fun-create
async function createToken(params: {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  creatorWallet: string | null;
  creatorUsername: string;
  twitterUrl: string;
  websiteUrl: string;
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
        websiteUrl: params.websiteUrl,
        feeRecipientWallet: params.creatorWallet,
        creatorUsername: params.creatorUsername,
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

// Helper to parse cookie string into object
function parseCookieString(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = raw.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    const val = rest.join("=");
    if (val) out[k.trim()] = val.replace(/^['"]+|['"]+$/g, "").trim();
  }
  return out;
}

// Post a reply to a tweet (with optional media)
async function postReply(
  tweetId: string,
  text: string,
  mediaUrl: string | null,
  config: {
    TWITTERAPI_IO_KEY: string;
    X_FULL_COOKIE?: string;
    X_AUTH_TOKEN?: string;
    X_CT0_TOKEN?: string;
    TWITTER_PROXY?: string;
  }
): Promise<{ success: boolean; tweetId?: string }> {
  try {
    let loginCookies: Record<string, string>;
    if (config.X_FULL_COOKIE) {
      loginCookies = parseCookieString(config.X_FULL_COOKIE);
    } else if (config.X_AUTH_TOKEN && config.X_CT0_TOKEN) {
      loginCookies = {
        auth_token: config.X_AUTH_TOKEN,
        ct0: config.X_CT0_TOKEN,
      };
    } else {
      console.error("[mention-launcher] No auth available for reply");
      return { success: false };
    }

    const loginCookiesB64 = btoa(JSON.stringify(loginCookies));

    const body: any = {
      tweet_text: text,
      reply_to_tweet_id: tweetId,
      login_cookies: loginCookiesB64,
    };

    if (mediaUrl) {
      body.media_url = mediaUrl;
    }

    if (config.TWITTER_PROXY) {
      body.proxy = config.TWITTER_PROXY;
    }

    const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
      method: "POST",
      headers: {
        "X-API-Key": config.TWITTERAPI_IO_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    if (!response.ok || result.status === "error") {
      console.error("[mention-launcher] Reply failed:", response.status, responseText.slice(0, 300));
      return { success: false };
    }

    const createdTweetId = result.tweet_id || result.data?.id;
    console.log("[mention-launcher] ✅ Reply posted:", createdTweetId);
    return { success: true, tweetId: createdTweetId };
  } catch (error) {
    console.error("[mention-launcher] postReply error:", error);
    return { success: false };
  }
}
