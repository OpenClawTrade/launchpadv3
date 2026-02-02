import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "openai/gpt-5-mini";
const TWITTER_API_BASE = "https://api.x.com/2";

interface StyleFingerprint {
  tone: string;
  emoji_frequency: string;
  preferred_emojis: string[];
  avg_sentence_length: string;
  capitalization: string;
  common_phrases: string[];
  vocabulary_style: string;
  punctuation_style: string;
  sample_voice: string;
  language: string;
  tweet_count_analyzed: number;
}

// Generate OAuth 1.0a signature for Twitter API
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");

  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
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
    .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(", ");

  return `OAuth ${headerParts}`;
}

// Fetch user ID from username
async function getUserIdFromUsername(
  username: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<string | null> {
  const cleanUsername = username.replace("@", "");
  const url = `${TWITTER_API_BASE}/users/by/username/${cleanUsername}`;

  try {
    const authHeader = generateOAuthHeader(
      "GET",
      url,
      consumerKey,
      consumerSecret,
      accessToken,
      accessTokenSecret
    );

    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      console.error(`Twitter user lookup failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.data?.id || null;
  } catch (error) {
    console.error("Error fetching Twitter user ID:", error);
    return null;
  }
}

// Fetch tweets from user timeline
async function fetchUserTweets(
  userId: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<string[]> {
  const baseUrl = `${TWITTER_API_BASE}/users/${userId}/tweets`;
  const queryParams = new URLSearchParams({
    max_results: "20", // Reduced from 100 to 20 for faster analysis
    "tweet.fields": "text,created_at",
    exclude: "retweets,replies",
  });

  const fullUrl = `${baseUrl}?${queryParams.toString()}`;

  try {
    const authHeader = generateOAuthHeader(
      "GET",
      baseUrl,
      consumerKey,
      consumerSecret,
      accessToken,
      accessTokenSecret
    );

    const response = await fetch(fullUrl, {
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      console.error(`Twitter tweets fetch failed: ${response.status}`);
      const errorText = await response.text();
      console.error("Error body:", errorText);
      return [];
    }

    const data = await response.json();
    const tweets = data.data || [];

    // Filter out tweets that are mostly links or very short
    return tweets
      .map((t: { text: string }) => t.text)
      .filter((text: string) => {
        const cleanText = text.replace(/https?:\/\/\S+/g, "").trim();
        return cleanText.length > 10;
      });
  } catch (error) {
    console.error("Error fetching tweets:", error);
    return [];
  }
}

// Extract style fingerprint using AI
async function extractStyleFingerprint(
  tweets: string[],
  lovableApiKey: string
): Promise<StyleFingerprint | null> {
  if (tweets.length < 5) {
    console.log("Not enough tweets to analyze style");
    return null;
  }

  const tweetSample = tweets.slice(0, 100).join("\n---\n");

  const systemPrompt = `You are an expert at analyzing writing styles. You will be given a collection of tweets from a single user and must extract a detailed writing style fingerprint that can be used to generate new content in their exact voice.

Return ONLY valid JSON with no additional text.`;

  const userPrompt = `Analyze these ${tweets.length} tweets and extract a writing style fingerprint.

Tweets:
${tweetSample}

Return JSON with these exact fields:
{
  "tone": "(one of: formal, casual, professional, meme_lord, enthusiastic, cynical, analytical, friendly, aggressive)",
  "emoji_frequency": "(one of: none, low, medium, high)",
  "preferred_emojis": ["top 5 most used emojis as array, empty if none"],
  "avg_sentence_length": "(one of: short, medium, long)",
  "capitalization": "(one of: standard, lowercase_only, caps_for_emphasis, all_caps, mixed)",
  "common_phrases": ["5-10 phrases or expressions they repeat"],
  "vocabulary_style": "(one of: crypto_native, professional, casual, academic, meme_heavy, technical)",
  "punctuation_style": "(one of: minimal, standard, exclamation_heavy, ellipsis_heavy, question_heavy)",
  "sample_voice": "Write a sample 15-word message in their EXACT style about a new crypto project",
  "language": "(primary language detected, e.g. english, spanish)"
}`;

  try {
    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error(`AI API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error("No content from AI response");
      return null;
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = content;
    if (content.includes("```json")) {
      jsonStr = content.split("```json")[1].split("```")[0].trim();
    } else if (content.includes("```")) {
      jsonStr = content.split("```")[1].split("```")[0].trim();
    }

    const fingerprint = JSON.parse(jsonStr) as StyleFingerprint;
    fingerprint.tweet_count_analyzed = tweets.length;

    return fingerprint;
  } catch (error) {
    console.error("Error extracting style fingerprint:", error);
    return null;
  }
}

// Generate fallback style for when Twitter API fails
function getFallbackStyle(agentName: string): StyleFingerprint {
  return {
    tone: "casual",
    emoji_frequency: "medium",
    preferred_emojis: ["🔥", "🚀", "💪"],
    avg_sentence_length: "short",
    capitalization: "standard",
    common_phrases: ["let's go", "wagmi", "this is it"],
    vocabulary_style: "crypto_native",
    punctuation_style: "exclamation_heavy",
    sample_voice: `${agentName} here! Excited to share this new project with the community! 🔥`,
    language: "english",
    tweet_count_analyzed: 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support reply context: if isReply=true, analyze parentAuthorUsername instead
    const { agentId, twitterUsername, isReply, parentAuthorUsername } = await req.json();

    if (!agentId) {
      return new Response(
        JSON.stringify({ success: false, error: "agentId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const twitterConsumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const twitterConsumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const twitterAccessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const twitterAccessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get agent info
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, name, twitter_handle, style_learned_at")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ success: false, error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: max 1 style refresh per day
    if (agent.style_learned_at) {
      const lastLearned = new Date(agent.style_learned_at);
      const hoursSince = (Date.now() - lastLearned.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Style already learned recently. Try again in 24 hours.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // If this is a reply to someone else's post, analyze that person's tweets
    // Otherwise analyze the launcher's tweets
    const usernameToAnalyze = (isReply && parentAuthorUsername) 
      ? parentAuthorUsername 
      : (twitterUsername || agent.twitter_handle);
    
    let styleFingerprint: StyleFingerprint | null = null;
    let styleSource = "fallback";

    console.log(`[agent-learn-style] Analyzing: ${usernameToAnalyze} (isReply: ${isReply})`);

    // Try to fetch and analyze Twitter style if credentials available
    if (
      usernameToAnalyze &&
      twitterConsumerKey &&
      twitterConsumerSecret &&
      twitterAccessToken &&
      twitterAccessTokenSecret &&
      lovableApiKey
    ) {
      console.log(`[agent-learn-style] Analyzing style for @${usernameToAnalyze}`);

      // Get Twitter user ID
      const userId = await getUserIdFromUsername(
        usernameToAnalyze,
        twitterConsumerKey,
        twitterConsumerSecret,
        twitterAccessToken,
        twitterAccessTokenSecret
      );

      if (userId) {
        // Fetch tweets
        const tweets = await fetchUserTweets(
          userId,
          twitterConsumerKey,
          twitterConsumerSecret,
          twitterAccessToken,
          twitterAccessTokenSecret
        );

        console.log(`[agent-learn-style] Fetched ${tweets.length} tweets for analysis`);

        if (tweets.length >= 5) {
          // Extract style using AI
          styleFingerprint = await extractStyleFingerprint(tweets, lovableApiKey);
          if (styleFingerprint) {
            styleSource = usernameToAnalyze.replace("@", "");
          }
        } else {
          console.log(`[agent-learn-style] Not enough tweets (${tweets.length}), using fallback`);
        }
      } else {
        console.log(`[agent-learn-style] Could not find Twitter user: ${usernameToAnalyze}`);
      }
    } else {
      console.log("[agent-learn-style] Twitter credentials or username not available, using fallback");
    }

    // Use fallback if Twitter analysis failed
    if (!styleFingerprint) {
      styleFingerprint = getFallbackStyle(agent.name);
      styleSource = "fallback";
    }

    // Save to database
    const { error: updateError } = await supabase
      .from("agents")
      .update({
        writing_style: styleFingerprint,
        style_source_username: styleSource !== "fallback" ? styleSource : null,
        style_learned_at: new Date().toISOString(),
      })
      .eq("id", agentId);

    if (updateError) {
      console.error("[agent-learn-style] Failed to save style:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save style" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agent-learn-style] ✅ Style learned for ${agent.name} (source: ${styleSource})`);

    return new Response(
      JSON.stringify({
        success: true,
        agentId,
        style: styleFingerprint,
        source: styleSource,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agent-learn-style] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
