import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

const safeJsonParse = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// --- Cookie helpers (for using X_FULL_COOKIE without re-login) ---
const stripQuotes = (v: string) => v.replace(/^['"]+|['"]+$/g, "").trim();

function parseCookieString(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = raw.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    const val = rest.join("=");
    if (val) out[k.trim()] = stripQuotes(val);
  }
  return out;
}

function buildLoginCookiesBase64FromEnv(args: {
  xFullCookie?: string | null;
  xAuthToken?: string | null;
  xCt0Token?: string | null;
}): string | null {
  // twitterapi.io expects login_cookies as base64(JSON cookies)
  if (args.xFullCookie) {
    const cookies = parseCookieString(args.xFullCookie);
    if (Object.keys(cookies).length === 0) return null;
    return btoa(JSON.stringify(cookies));
  }

  if (args.xAuthToken && args.xCt0Token) {
    return btoa(
      JSON.stringify({
        auth_token: stripQuotes(args.xAuthToken),
        ct0: stripQuotes(args.xCt0Token),
      })
    );
  }

  return null;
}

interface HourlyStats {
  new_agents: number;
  new_posts: number;
  new_comments: number;
  new_tokens: number;
}

interface TopAgent {
  agent_id: string;
  ticker: string;
  agent_name: string;
  post_count: number;
  hourly_fees: number;
}

const buildTweet = (stats: HourlyStats, topAgent: TopAgent | null): string => {
  const agentSection = topAgent && topAgent.hourly_fees > 0
    ? `🏆 Top Agent: $${topAgent.ticker}
• ${topAgent.hourly_fees.toFixed(2)} SOL fees earned
• ${topAgent.post_count} community posts`
    : `🏆 No fees claimed this hour`;

  return `🐟 TUNA Hourly Update

📊 Last Hour Activity:
• ${stats.new_agents} new agents joined
• ${stats.new_posts} new posts
• ${stats.new_comments} comments
• ${stats.new_tokens} tokens launched

${agentSection}

🔗 tuna.fun/agents

#TunaFun #AIAgents #Solana`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY")!;
    const xFullCookie = Deno.env.get("X_FULL_COOKIE");
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0 = Deno.env.get("X_CT0_TOKEN") || Deno.env.get("X_CT0");
    const proxyUrl = Deno.env.get("TWITTER_PROXY")!;

    // Build login_cookies in base64 format (same as agent-scan-twitter)
    const loginCookies = buildLoginCookiesBase64FromEnv({
      xFullCookie,
      xAuthToken,
      xCt0Token: xCt0,
    });

    if (!loginCookies) {
      throw new Error("Missing X_FULL_COOKIE or X_AUTH_TOKEN/X_CT0 - please add pre-authenticated cookies");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for recent post (prevent double-posting within 50 minutes)
    const { data: recentPost } = await supabase
      .from("hourly_post_log")
      .select("id, posted_at")
      .gte("posted_at", new Date(Date.now() - 50 * 60 * 1000).toISOString())
      .eq("success", true)
      .limit(1)
      .single();

    if (recentPost) {
      console.log("[agent-hourly-post] Skipping - already posted within 50 minutes");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Already posted recently" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query hourly activity stats
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [agentsResult, postsResult, commentsResult, tokensResult] = await Promise.all([
      supabase.from("agents").select("id", { count: "exact", head: true }).gte("created_at", oneHourAgo),
      supabase.from("subtuna_posts").select("id", { count: "exact", head: true }).gte("created_at", oneHourAgo),
      supabase.from("subtuna_comments").select("id", { count: "exact", head: true }).gte("created_at", oneHourAgo),
      supabase.from("agent_tokens").select("id", { count: "exact", head: true }).gte("created_at", oneHourAgo),
    ]);

    const stats: HourlyStats = {
      new_agents: agentsResult.count || 0,
      new_posts: postsResult.count || 0,
      new_comments: commentsResult.count || 0,
      new_tokens: tokensResult.count || 0,
    };

    console.log("[agent-hourly-post] Hourly stats:", stats);

    // Query top agent by hourly fees
    const { data: subtunas } = await supabase
      .from("subtuna")
      .select(`
        id,
        ticker,
        fun_token_id,
        agent_id,
        agents!inner (
          id,
          name
        )
      `)
      .not("agent_id", "is", null);

    let topAgent: TopAgent | null = null;

    if (subtunas && subtunas.length > 0) {
      const funTokenIds = subtunas
        .map(s => s.fun_token_id)
        .filter(Boolean);

      const { data: feeClaims } = await supabase
        .from("fun_fee_claims")
        .select("fun_token_id, claimed_sol")
        .in("fun_token_id", funTokenIds)
        .gte("claimed_at", oneHourAgo);

      const feesByToken: Record<string, number> = {};
      feeClaims?.forEach(fc => {
        if (fc.fun_token_id) {
          feesByToken[fc.fun_token_id] = (feesByToken[fc.fun_token_id] || 0) + Number(fc.claimed_sol || 0);
        }
      });

      let maxFees = 0;
      let topSubtuna: any = null;

      for (const s of subtunas) {
        const fees = feesByToken[s.fun_token_id] || 0;
        if (fees > maxFees) {
          maxFees = fees;
          topSubtuna = s;
        }
      }

      if (topSubtuna && maxFees > 0) {
        const { count: postCount } = await supabase
          .from("subtuna_posts")
          .select("id", { count: "exact", head: true })
          .eq("subtuna_id", topSubtuna.id);

        const agent = topSubtuna.agents as { id: string; name: string };
        topAgent = {
          agent_id: agent.id,
          ticker: topSubtuna.ticker,
          agent_name: agent.name,
          post_count: postCount || 0,
          hourly_fees: maxFees,
        };
      }
    }

    console.log("[agent-hourly-post] Top agent this hour:", topAgent);

    // Build the tweet
    const tweetText = buildTweet(stats, topAgent);
    console.log("[agent-hourly-post] Tweet text:", tweetText);

    // Post to X using twitterapi.io create_tweet_v2 (same as agent-scan-twitter)
    const requestBody = {
      login_cookies: loginCookies,
      tweet_text: tweetText,
      proxy: proxyUrl,
    };

    const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
      method: "POST",
      headers: {
        "X-API-Key": twitterApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    const data = safeJsonParse(responseText);
    console.log("[agent-hourly-post] Twitter response:", responseText.slice(0, 500));

    const tweetId = data?.tweet_id || data?.data?.rest_id || data?.data?.id || data?.data?.create_tweet?.tweet_results?.result?.rest_id;

    // Log the result
    const logEntry = {
      tweet_id: tweetId || null,
      tweet_text: tweetText,
      stats_snapshot: stats,
      top_agent_id: topAgent?.agent_id || null,
      top_agent_ticker: topAgent?.ticker || null,
      hourly_fees_sol: topAgent?.hourly_fees || 0,
      success: !!tweetId,
      error_message: tweetId ? null : `Failed to post: ${responseText.slice(0, 200)}`,
    };

    await supabase.from("hourly_post_log").insert(logEntry);

    if (tweetId) {
      console.log(`[agent-hourly-post] ✅ Tweet posted: ${tweetId}`);
      return new Response(
        JSON.stringify({
          success: true,
          tweetId,
          tweetUrl: `https://twitter.com/buildtuna/status/${tweetId}`,
          stats,
          topAgent,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error("[agent-hourly-post] ❌ Failed to post tweet");
      return new Response(
        JSON.stringify({ success: false, error: "Failed to post tweet", details: responseText.slice(0, 500) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("[agent-hourly-post] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
