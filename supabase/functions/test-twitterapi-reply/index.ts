import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

const safeJsonParse = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// OAuth 1.0a signing for official X.com API
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join("&");

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

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
    .map(
      (key) =>
        `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`
    )
    .join(", ");

  return `OAuth ${headerParts}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tweet_id } = await req.json();
    
    if (!tweet_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tweet_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const proxyUrl = Deno.env.get("TWITTER_PROXY");
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0 = Deno.env.get("X_CT0_TOKEN");

    const testText = `🧪 Test reply at ${new Date().toISOString().slice(11, 19)} UTC - checking twitterapi.io endpoints`;

    const results: Record<string, any> = {};

    // ===== METHOD 1: post_tweet with auth_session object =====
    if (twitterApiKey && xAuthToken && xCt0 && proxyUrl) {
      console.log("[test-twitter-reply] Testing METHOD 1: post_tweet with auth_session");
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/post_tweet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiKey,
        },
        body: JSON.stringify({
          tweet_text: testText + " [M1]",
          in_reply_to_tweet_id: tweet_id,
          auth_session: {
            auth_token: xAuthToken,
            ct0: xCt0,
          },
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-twitter-reply] M1 Response: ${response.status} - ${responseText}`);
      
      results.method1_post_tweet_auth_session = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    } else {
      results.method1_post_tweet_auth_session = { error: "Missing credentials" };
    }

    // ===== METHOD 2: create_tweet with auth_session =====
    if (twitterApiKey && xAuthToken && xCt0 && proxyUrl) {
      console.log("[test-twitter-reply] Testing METHOD 2: create_tweet with auth_session");
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiKey,
        },
        body: JSON.stringify({
          tweet_text: testText + " [M2]",
          in_reply_to_tweet_id: tweet_id,
          auth_session: {
            auth_token: xAuthToken,
            ct0: xCt0,
          },
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-twitter-reply] M2 Response: ${response.status} - ${responseText}`);
      
      results.method2_create_tweet_auth_session = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    }

    // ===== METHOD 3: create_tweet_v2 with login_cookies base64 =====
    if (twitterApiKey && xAuthToken && xCt0 && proxyUrl) {
      console.log("[test-twitter-reply] Testing METHOD 3: create_tweet_v2 with login_cookies");
      
      const cookieObj = { auth_token: xAuthToken, ct0: xCt0 };
      const loginCookiesBase64 = btoa(JSON.stringify(cookieObj));
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiKey,
        },
        body: JSON.stringify({
          tweet_text: testText + " [M3]",
          reply_to_tweet_id: tweet_id,
          login_cookies: loginCookiesBase64,
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-twitter-reply] M3 Response: ${response.status} - ${responseText}`);
      
      results.method3_create_tweet_v2 = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    }

    // ===== METHOD 5: create_tweet with cookie string format =====
    if (twitterApiKey && xAuthToken && xCt0 && proxyUrl) {
      console.log("[test-twitter-reply] Testing METHOD 5: create_tweet with cookie string");
      
      const cookieString = `auth_token=${xAuthToken}; ct0=${xCt0}`;
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiKey,
        },
        body: JSON.stringify({
          tweet_text: testText + " [M5]",
          in_reply_to_tweet_id: tweet_id,
          cookies: cookieString,
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-twitter-reply] M5 Response: ${response.status} - ${responseText}`);
      
      results.method5_cookie_string = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    }

    // ===== METHOD 4: Official X API OAuth 1.0a =====
    const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const accessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
    
    if (consumerKey && consumerSecret && accessToken && accessTokenSecret) {
      console.log("[test-twitter-reply] Testing METHOD 4: Official X API OAuth 1.0a");
      
      const url = "https://api.x.com/2/tweets";
      const body = JSON.stringify({
        text: testText + " [M4-OAuth]",
        reply: { in_reply_to_tweet_id: tweet_id },
      });

      const oauthHeader = generateOAuthHeader(
        "POST",
        url,
        consumerKey,
        consumerSecret,
        accessToken,
        accessTokenSecret
      );

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: oauthHeader,
            "Content-Type": "application/json",
          },
          body,
        });

        const responseText = await response.text();
        console.log(`[test-twitter-reply] M4 Response: ${response.status} - ${responseText}`);
        
        results.method4_official_xapi_oauth = {
          status: response.status,
          response: safeJsonParse(responseText) || responseText,
        };
      } catch (error) {
        results.method4_official_xapi_oauth = {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    } else {
      results.method4_official_xapi_oauth = { 
        error: "Missing TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, or TWITTER_ACCESS_TOKEN_SECRET" 
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        tweet_id,
        test_text: testText,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[test-twitter-reply] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
