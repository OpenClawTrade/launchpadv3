// Test Twitter Community Join & Post
// Community: TUNALISHOUS (ID: 2018885865972367523)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";
const COMMUNITY_ID = "2018885865972367523"; // TUNALISHOUS

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    if (!apiKey) {
      throw new Error("TWITTERAPI_IO_KEY not configured");
    }

    const fullCookie = Deno.env.get("X_FULL_COOKIE");
    if (!fullCookie) {
      throw new Error("X_FULL_COOKIE not configured");
    }

    const proxyUrl = Deno.env.get("TWITTER_PROXY");
    if (!proxyUrl) {
      throw new Error("TWITTER_PROXY not configured");
    }

    // Parse cookies into object then base64 encode
    const loginCookiesObj: Record<string, string> = {};
    fullCookie.split(";").forEach((cookie) => {
      const [key, ...rest] = cookie.trim().split("=");
      if (key && rest.length > 0) {
        loginCookiesObj[key.trim()] = rest.join("=").trim();
      }
    });
    const loginCookies = btoa(JSON.stringify(loginCookiesObj));

    const { action = "info" } = await req.json().catch(() => ({}));
    const results: Record<string, unknown> = { action, communityId: COMMUNITY_ID };

    // ===== ACTION: Get Community Info =====
    if (action === "info") {
      console.log(`[test-community] Getting info for community ${COMMUNITY_ID}...`);
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/community/info?community_id=${COMMUNITY_ID}`, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      const responseText = await response.text();
      console.log(`[test-community] Info response: ${response.status} - ${responseText.slice(0, 500)}`);
      
      results.status = response.status;
      results.response = JSON.parse(responseText);
    }

    // ===== ACTION: Join Community =====
    if (action === "join") {
      console.log(`[test-community] Joining community ${COMMUNITY_ID}...`);
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/community/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          login_cookies: loginCookies,
          community_id: COMMUNITY_ID,
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-community] Join response: ${response.status} - ${responseText.slice(0, 500)}`);
      
      results.status = response.status;
      results.response = JSON.parse(responseText);
    }

    // ===== ACTION: Post to Community =====
    if (action === "post") {
      const body = await req.json().catch(() => ({}));
      const text = body.text || "🎣 Testing TUNA community posting! This should only appear in the community, not on the main timeline.";
      
      console.log(`[test-community] Posting to community ${COMMUNITY_ID}...`);
      console.log(`[test-community] Tweet text: ${text}`);
      
      // Try with community_id parameter
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          login_cookies: loginCookies,
          tweet_text: text,
          community_id: COMMUNITY_ID,
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-community] Post response: ${response.status} - ${responseText.slice(0, 500)}`);
      
      results.status = response.status;
      results.response = JSON.parse(responseText);
    }

    // ===== ACTION: Get Community Tweets =====
    if (action === "tweets") {
      console.log(`[test-community] Fetching tweets from community ${COMMUNITY_ID}...`);
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/community/tweets?community_id=${COMMUNITY_ID}&cursor=`, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      const responseText = await response.text();
      console.log(`[test-community] Tweets response: ${response.status} - ${responseText.slice(0, 500)}`);
      
      results.status = response.status;
      results.response = JSON.parse(responseText);
    }

    // ===== ACTION: List all endpoints (discovery) =====
    if (action === "discover") {
      console.log(`[test-community] Testing various community endpoints...`);
      
      const endpoints = [
        { name: "community/info", url: `/twitter/community/info?community_id=${COMMUNITY_ID}`, method: "GET" },
        { name: "community/tweets", url: `/twitter/community/tweets?community_id=${COMMUNITY_ID}`, method: "GET" },
        { name: "community/members", url: `/twitter/community/members?community_id=${COMMUNITY_ID}`, method: "GET" },
        { name: "community/moderators", url: `/twitter/community/moderators?community_id=${COMMUNITY_ID}`, method: "GET" },
      ];
      
      const endpointResults: Record<string, { status: number; sample: string }> = {};
      
      for (const ep of endpoints) {
        try {
          const response = await fetch(`${TWITTERAPI_BASE}${ep.url}`, {
            method: ep.method,
            headers: { "X-API-Key": apiKey },
          });
          const text = await response.text();
          endpointResults[ep.name] = { status: response.status, sample: text.slice(0, 200) };
        } catch (e) {
          endpointResults[ep.name] = { status: 0, sample: String(e) };
        }
      }
      
      results.endpoints = endpointResults;
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[test-community] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
