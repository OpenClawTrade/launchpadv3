import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "openai/gpt-5-mini";
const TWITTERAPI_IO_BASE = "https://api.twitterapi.io/twitter";
const STYLE_CACHE_DAYS = 7;

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

interface CachedStyle {
  id: string;
  twitter_username: string;
  writing_style: StyleFingerprint;
  learned_at: string;
  usage_count: number;
}

// Fetch tweets using twitterapi.io (cheaper than official API)
async function fetchTweetsViaTwitterApiIo(
  username: string,
  apiKey: string
): Promise<string[]> {
  const cleanUsername = username.replace("@", "");
  const url = `${TWITTERAPI_IO_BASE}/user/last_tweets?userName=${encodeURIComponent(cleanUsername)}&count=20`;

  try {
    console.log(`[agent-learn-style] Fetching tweets for @${cleanUsername} via twitterapi.io`);
    
    const response = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
      },
    });

    if (!response.ok) {
      console.error(`[agent-learn-style] twitterapi.io error: ${response.status}`);
      const errorText = await response.text();
      console.error("Error body:", errorText);
      return [];
    }

    const data = await response.json();
    const tweets = data.tweets || data.data || [];

    // Extract tweet text and filter out retweets and very short tweets
    return tweets
      .filter((t: any) => {
        const text = t.text || t.full_text || "";
        // Filter out retweets
        if (text.startsWith("RT @")) return false;
        // Filter out very short tweets
        const cleanText = text.replace(/https?:\/\/\S+/g, "").trim();
        return cleanText.length > 10;
      })
      .map((t: any) => t.text || t.full_text || "");
  } catch (error) {
    console.error("[agent-learn-style] Error fetching via twitterapi.io:", error);
    return [];
  }
}

// Extract style fingerprint using AI
async function extractStyleFingerprint(
  tweets: string[],
  lovableApiKey: string
): Promise<StyleFingerprint | null> {
  if (tweets.length < 5) {
    console.log("[agent-learn-style] Not enough tweets to analyze style");
    return null;
  }

  const tweetSample = tweets.slice(0, 20).join("\n---\n");

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
      console.error(`[agent-learn-style] AI API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error("[agent-learn-style] No content from AI response");
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
    console.error("[agent-learn-style] Error extracting style fingerprint:", error);
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

// Check if cached style is still valid
function isCacheValid(cachedStyle: CachedStyle): boolean {
  const learnedAt = new Date(cachedStyle.learned_at);
  const now = new Date();
  const daysSince = (now.getTime() - learnedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < STYLE_CACHE_DAYS;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentId, twitterUsername, isReply, parentAuthorUsername, subtunaId } = await req.json();

    if (!agentId) {
      return new Response(
        JSON.stringify({ success: false, error: "agentId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get agent info
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, name, twitter_handle, style_learned_at, style_source_username")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ success: false, error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which username to analyze
    // If reply, analyze parent author's style; otherwise analyze launcher's style
    const usernameToAnalyze = (isReply && parentAuthorUsername)
      ? parentAuthorUsername
      : (twitterUsername || agent.twitter_handle);

    if (!usernameToAnalyze) {
      console.log("[agent-learn-style] No username to analyze, using fallback");
      const fallbackStyle = getFallbackStyle(agent.name);
      
      await supabase
        .from("agents")
        .update({
          writing_style: fallbackStyle,
          style_source_username: null,
          style_learned_at: new Date().toISOString(),
        })
        .eq("id", agentId);

      return new Response(
        JSON.stringify({
          success: true,
          agentId,
          style: fallbackStyle,
          source: "fallback",
          cached: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanUsername = usernameToAnalyze.replace("@", "").toLowerCase();
    console.log(`[agent-learn-style] Target username: @${cleanUsername} (isReply: ${isReply})`);

    // Check style library cache first
    const { data: cachedStyle } = await supabase
      .from("twitter_style_library")
      .select("*")
      .eq("twitter_username", cleanUsername)
      .maybeSingle();

    let styleFingerprint: StyleFingerprint | null = null;
    let styleSource = "fallback";
    let usedCache = false;

    if (cachedStyle && isCacheValid(cachedStyle as CachedStyle)) {
      // Use cached style
      console.log(`[agent-learn-style] ✅ Using cached style for @${cleanUsername} (${cachedStyle.usage_count} previous uses)`);
      styleFingerprint = cachedStyle.writing_style as StyleFingerprint;
      styleSource = cleanUsername;
      usedCache = true;

      // Increment usage count
      await supabase
        .from("twitter_style_library")
        .update({
          usage_count: (cachedStyle.usage_count || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cachedStyle.id);
    } else if (twitterApiIoKey && lovableApiKey) {
      // Fetch fresh tweets and analyze
      console.log(`[agent-learn-style] Fetching fresh tweets for @${cleanUsername}`);
      
      const tweets = await fetchTweetsViaTwitterApiIo(cleanUsername, twitterApiIoKey);
      console.log(`[agent-learn-style] Fetched ${tweets.length} tweets for analysis`);

      if (tweets.length >= 5) {
        styleFingerprint = await extractStyleFingerprint(tweets, lovableApiKey);
        
        if (styleFingerprint) {
          styleSource = cleanUsername;

          // Save to style library (upsert)
          const { error: upsertError } = await supabase
            .from("twitter_style_library")
            .upsert({
              twitter_username: cleanUsername,
              writing_style: styleFingerprint,
              tweet_count: tweets.length,
              learned_at: new Date().toISOString(),
              usage_count: 1,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: "twitter_username",
            });

          if (upsertError) {
            console.error("[agent-learn-style] Failed to cache style:", upsertError);
          } else {
            console.log(`[agent-learn-style] ✅ Cached new style for @${cleanUsername}`);
          }
        }
      } else {
        console.log(`[agent-learn-style] Not enough tweets (${tweets.length}), using fallback`);
      }
    } else {
      console.log("[agent-learn-style] Missing API keys, using fallback");
    }

    // Use fallback if analysis failed
    if (!styleFingerprint) {
      styleFingerprint = getFallbackStyle(agent.name);
      styleSource = "fallback";
    }

    // Update agent with style info
    const twitterUrl = styleSource !== "fallback" ? `https://x.com/${styleSource}` : null;
    
    await supabase
      .from("agents")
      .update({
        writing_style: styleFingerprint,
        style_source_username: styleSource !== "fallback" ? styleSource : null,
        style_source_twitter_url: twitterUrl,
        style_learned_at: new Date().toISOString(),
      })
      .eq("id", agentId);

    // Update subtuna with style source if provided
    if (subtunaId && styleSource !== "fallback") {
      await supabase
        .from("subtuna")
        .update({
          style_source_username: styleSource,
        })
        .eq("id", subtunaId);
    }

    console.log(`[agent-learn-style] ✅ Style applied for ${agent.name} (source: @${styleSource}, cached: ${usedCache})`);

    return new Response(
      JSON.stringify({
        success: true,
        agentId,
        style: styleFingerprint,
        source: styleSource,
        cached: usedCache,
        twitterUrl,
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
