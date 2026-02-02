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
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0Token = Deno.env.get("X_CT0_TOKEN");

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

    // Step 2: Try create_tweet_v2 with login_cookies (original format)
    if (loginCookies) {
      console.log("[twitterapi-test] Trying create_tweet_v2 (tweet_text field)...");
      
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
      console.log(`[twitterapi-test] create_tweet_v2 (tweet_text): ${response.status} - ${responseText}`);
      
      results.method1_create_tweet_v2_tweet_text = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    }

    // Step 3: Try with X_AUTH_TOKEN + X_CT0_TOKEN directly (auth_session object)
    if (xAuthToken && xCt0Token) {
      console.log("[twitterapi-test] Trying create_tweet_v2 with auth_session tokens...");
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiIoKey,
        },
        body: JSON.stringify({
          tweet_text: testText + " [auth_session]",
          reply_to_tweet_id: tweet_id,
          auth_session: {
            auth_token: xAuthToken,
            ct0: xCt0Token,
          },
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[twitterapi-test] auth_session: ${response.status} - ${responseText}`);
      
      results.method2_auth_session = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    }

    // Step 4: Try with cookies string format (auth_token=xxx; ct0=xxx)
    if (xAuthToken && xCt0Token) {
      console.log("[twitterapi-test] Trying create_tweet_v2 with cookie string...");
      
      const cookieString = `auth_token=${xAuthToken}; ct0=${xCt0Token}`;
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiIoKey,
        },
        body: JSON.stringify({
          tweet_text: testText + " [cookie_string]",
          reply_to_tweet_id: tweet_id,
          login_cookies: cookieString,
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[twitterapi-test] cookie_string: ${response.status} - ${responseText}`);
      
      results.method3_cookie_string = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    }

    // Step 5: Try standalone with auth_session (no reply) to isolate if posting works at all
    if (xAuthToken && xCt0Token) {
      console.log("[twitterapi-test] Trying standalone with auth_session...");
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiIoKey,
        },
        body: JSON.stringify({
          tweet_text: `🐟 TUNA standalone ${new Date().toISOString().slice(11, 19)} UTC`,
          auth_session: {
            auth_token: xAuthToken,
            ct0: xCt0Token,
          },
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[twitterapi-test] standalone_auth_session: ${response.status} - ${responseText}`);
      
      results.method4_standalone_auth_session = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    }

    // Step 6: Try standalone with login_cookies
    if (loginCookies) {
      console.log("[twitterapi-test] Trying standalone with login_cookies...");
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiIoKey,
        },
        body: JSON.stringify({
          tweet_text: `🐟 TUNA standalone ${new Date().toISOString().slice(11, 19)} UTC [login_cookies]`,
          login_cookies: loginCookies,
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[twitterapi-test] standalone_login_cookies: ${response.status} - ${responseText}`);
      
      results.method5_standalone_login_cookies = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    }

    return new Response(
      JSON.stringify({
        success: false,
        tweet_id,
        test_text: testText,
        results,
        has_auth_tokens: !!(xAuthToken && xCt0Token),
        has_login_cookies: !!loginCookies,
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
