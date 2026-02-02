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
    const { tweet_id, no_proxy } = await req.json();
    
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

    if (!twitterApiIoKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing TWITTERAPI_IO_KEY" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const testText = `🐟 TUNA test ${new Date().toISOString().slice(11, 19)} UTC`;
    const results: Record<string, any> = {
      proxy_url: proxyUrl ? proxyUrl.replace(/:[^:@]+@/, ':***@') : "NOT SET",
      no_proxy_mode: !!no_proxy,
    };

    // Login WITH proxy
    if (!no_proxy && proxyUrl && xAccountUsername && xAccountEmail && xAccountPassword) {
      console.log("[test] Login WITH proxy...");
      
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
      results.login_with_proxy = {
        status: loginRes.status,
        success: loginData?.status === "success",
        message: loginData?.message,
      };

      const loginCookies = loginData?.login_cookies;
      
      if (loginCookies) {
        // Try posting WITH proxy
        const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": twitterApiIoKey,
          },
          body: JSON.stringify({
            tweet_text: testText + " [with-proxy]",
            reply_to_tweet_id: tweet_id,
            login_cookies: loginCookies,
            proxy: proxyUrl,
          }),
        });

        const responseText = await response.text();
        console.log(`[test] Post with proxy: ${response.status} - ${responseText}`);
        
        results.post_with_proxy = {
          status: response.status,
          response: safeJsonParse(responseText) || responseText,
        };
      }
    }

    // Login WITHOUT proxy (if requested)
    if (no_proxy && xAccountUsername && xAccountEmail && xAccountPassword) {
      console.log("[test] Login WITHOUT proxy...");
      
      const loginBody: Record<string, string> = {
        user_name: xAccountUsername,
        email: xAccountEmail,
        password: xAccountPassword,
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
      results.login_no_proxy = {
        status: loginRes.status,
        success: loginData?.status === "success",
        message: loginData?.message,
      };

      const loginCookies = loginData?.login_cookies;
      
      if (loginCookies) {
        // Try posting WITHOUT proxy
        const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": twitterApiIoKey,
          },
          body: JSON.stringify({
            tweet_text: testText + " [no-proxy]",
            reply_to_tweet_id: tweet_id,
            login_cookies: loginCookies,
          }),
        });

        const responseText = await response.text();
        console.log(`[test] Post without proxy: ${response.status} - ${responseText}`);
        
        results.post_no_proxy = {
          status: response.status,
          response: safeJsonParse(responseText) || responseText,
        };
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        tweet_id,
        test_text: testText,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[test] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
