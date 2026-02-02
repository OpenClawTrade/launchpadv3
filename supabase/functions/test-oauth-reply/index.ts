import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const accessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
    
    if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing OAuth credentials",
          has: {
            consumerKey: !!consumerKey,
            consumerSecret: !!consumerSecret,
            accessToken: !!accessToken,
            accessTokenSecret: !!accessTokenSecret,
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const testText = `🐟 TUNA test reply via OAuth at ${new Date().toISOString().slice(11, 19)} UTC`;
    const url = "https://api.x.com/2/tweets";
    
    const body = JSON.stringify({
      text: testText,
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

    console.log("[test-oauth-reply] Sending reply via Official X API...");
    console.log("[test-oauth-reply] URL:", url);
    console.log("[test-oauth-reply] Body:", body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/json",
      },
      body,
    });

    const responseText = await response.text();
    console.log(`[test-oauth-reply] Response: ${response.status} - ${responseText}`);

    const data = safeJsonParse(responseText);
    
    if (response.ok && data?.data?.id) {
      return new Response(
        JSON.stringify({
          success: true,
          method: "official_xapi_oauth_1.0a",
          reply_id: data.data.id,
          tweet_id,
          test_text: testText,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        method: "official_xapi_oauth_1.0a",
        status: response.status,
        response: data || responseText,
        tweet_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[test-oauth-reply] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
