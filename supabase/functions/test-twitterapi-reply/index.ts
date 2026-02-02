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

const normalizeTotpSecret = (raw?: string | null): string | undefined => {
  if (!raw) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;

  if (trimmed.toLowerCase().startsWith("otpauth://")) {
    try {
      const url = new URL(trimmed);
      const secretParam = url.searchParams.get("secret");
      if (secretParam) {
        return secretParam.replace(/\s|-/g, "").toUpperCase();
      }
    } catch {
      // fall through
    }
  }

  const secretMatch = trimmed.match(/secret\s*=\s*([A-Za-z2-7\s-]+)/i);
  const candidate = (secretMatch?.[1] ?? trimmed).replace(/\s|-/g, "").toUpperCase();
  return candidate || undefined;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tweet_id, skip_login } = await req.json();
    
    if (!tweet_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tweet_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const xAccountUsername = Deno.env.get("X_ACCOUNT_USERNAME");
    const xAccountEmail = Deno.env.get("X_ACCOUNT_EMAIL");
    const xAccountPassword = Deno.env.get("X_ACCOUNT_PASSWORD");
    const xTotpSecretRaw = Deno.env.get("X_TOTP_SECRET");
    const xTotpSecret = normalizeTotpSecret(xTotpSecretRaw);
    const proxyUrl = Deno.env.get("TWITTER_PROXY");

    if (!twitterApiIoKey || !proxyUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing TWITTERAPI_IO_KEY or TWITTER_PROXY" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const testText = `🐟 TUNA reply test at ${new Date().toISOString().slice(11, 19)} UTC`;
    const results: Record<string, any> = {};

    // Step 1: Login to get cookies
    let loginCookies: string | null = null;
    
    if (!skip_login && xAccountUsername && xAccountEmail && xAccountPassword) {
      console.log("[twitterapi-test] Logging in...");
      
      const loginBody: Record<string, string> = {
        user_name: xAccountUsername,
        email: xAccountEmail,
        password: xAccountPassword,
        proxy: proxyUrl,
      };
      if (xTotpSecret) {
        loginBody.totp_secret = xTotpSecret;
      }

      const loginRes = await fetch(`${TWITTERAPI_BASE}/twitter/user_login_v2`, {
        method: "POST",
        headers: {
          "X-API-Key": twitterApiIoKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginBody),
      });

      const loginText = await loginRes.text();
      const loginData = safeJsonParse(loginText);
      
      results.login = {
        status: loginRes.status,
        response: loginData,
      };

      loginCookies = loginData?.login_cookies || loginData?.cookies || loginData?.data?.login_cookies;
      
      if (!loginCookies) {
        console.log("[twitterapi-test] No cookies, login response:", loginText.slice(0, 500));
      } else {
        console.log("[twitterapi-test] Got login cookies");
      }
    }

    // Step 2: Try create_tweet_v2 with login_cookies
    if (loginCookies) {
      console.log("[twitterapi-test] Trying create_tweet_v2...");
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiIoKey,
        },
        body: JSON.stringify({
          tweet_text: testText,
          reply_to_tweet_id: tweet_id,
          login_cookies: loginCookies,
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[twitterapi-test] create_tweet_v2: ${response.status} - ${responseText}`);
      
      results.create_tweet_v2 = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };

      // Check if successful
      const data = safeJsonParse(responseText);
      const tweetId = data?.data?.id || 
                      data?.data?.rest_id || 
                      data?.data?.create_tweet?.tweet_results?.result?.rest_id;
      
      if (tweetId) {
        results.success = true;
        results.reply_id = tweetId;
      }
    }

    // Step 3: Try standalone tweet (not reply) to test if posting works at all
    if (loginCookies && !results.success) {
      console.log("[twitterapi-test] Trying standalone tweet...");
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiIoKey,
        },
        body: JSON.stringify({
          tweet_text: `🐟 TUNA standalone test at ${new Date().toISOString().slice(11, 19)} UTC`,
          login_cookies: loginCookies,
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[twitterapi-test] standalone tweet: ${response.status} - ${responseText}`);
      
      results.standalone_tweet = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    }

    return new Response(
      JSON.stringify({
        success: results.success || false,
        tweet_id,
        test_text: testText,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[twitterapi-test] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
