import { createHmac, randomBytes } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generate OAuth 1.0a signature for Twitter API
 */
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");

  return signature;
}

/**
 * Generate OAuth 1.0a Authorization header
 */
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
    oauth_nonce: randomBytes(16).toString("hex"),
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

  const headerValue = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${headerValue}`;
}

/**
 * Test Twitter API credentials by fetching authenticated user info.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const accessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");

    // Check if credentials are configured
    const configured = !!(consumerKey && consumerSecret && accessToken && accessTokenSecret);

    if (!configured) {
      const missing: string[] = [];
      if (!consumerKey) missing.push("TWITTER_CONSUMER_KEY");
      if (!consumerSecret) missing.push("TWITTER_CONSUMER_SECRET");
      if (!accessToken) missing.push("TWITTER_ACCESS_TOKEN");
      if (!accessTokenSecret) missing.push("TWITTER_ACCESS_TOKEN_SECRET");

      return new Response(
        JSON.stringify({
          success: false,
          credentialsConfigured: false,
          missing,
          message: "Twitter credentials not fully configured",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test credentials by getting authenticated user
    const apiUrl = "https://api.x.com/2/users/me";
    const authHeader = generateOAuthHeader(
      "GET",
      apiUrl,
      consumerKey,
      consumerSecret,
      accessToken,
      accessTokenSecret
    );

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[agent-twitter-test] API error:", response.status, errorText);

      return new Response(
        JSON.stringify({
          success: false,
          credentialsConfigured: true,
          error: `Twitter API error: ${response.status}`,
          details: errorText,
          message: "Credentials configured but API request failed. Check permissions.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    console.log("[agent-twitter-test] ✅ Credentials verified for @" + data.data?.username);

    return new Response(
      JSON.stringify({
        success: true,
        credentialsConfigured: true,
        accountInfo: {
          id: data.data?.id,
          username: data.data?.username,
          name: data.data?.name,
          description: data.data?.description,
        },
        permissions: "read_write", // Assumed if we got here
        message: `✅ Connected as @${data.data?.username}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agent-twitter-test] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
