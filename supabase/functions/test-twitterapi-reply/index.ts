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
    const { tweet_id } = await req.json();
    
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

    const testText = `🐟 TUNA test ${new Date().toISOString().slice(11, 19)} UTC`;
    const results: Record<string, any> = {};

    // Step 1: Login
    console.log("[test] Logging in...");
    const loginBody: Record<string, string> = {
      user_name: xAccountUsername!,
      email: xAccountEmail!,
      password: xAccountPassword!,
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
      success: loginData?.status === "success",
    };

    const loginCookies = loginData?.login_cookies;
    if (!loginCookies) {
      return new Response(
        JSON.stringify({ success: false, error: "Login failed", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test different endpoint variations
    const endpoints = [
      {
        name: "create_tweet_v2 (tweet_text + reply_to_tweet_id)",
        url: "/twitter/create_tweet_v2",
        body: {
          tweet_text: testText,
          reply_to_tweet_id: tweet_id,
          login_cookies: loginCookies,
          proxy: proxyUrl,
        },
      },
      {
        name: "create_tweet_v2 (text only)",
        url: "/twitter/create_tweet_v2",
        body: {
          tweet_text: testText + " [standalone]",
          login_cookies: loginCookies,
          proxy: proxyUrl,
        },
      },
      {
        name: "create_tweet (if exists)",
        url: "/twitter/create_tweet",
        body: {
          tweet_text: testText,
          reply_to_tweet_id: tweet_id,
          login_cookies: loginCookies,
          proxy: proxyUrl,
        },
      },
      {
        name: "tweet/reply",
        url: "/twitter/tweet/reply",
        body: {
          text: testText,
          tweet_id: tweet_id,
          login_cookies: loginCookies,
          proxy: proxyUrl,
        },
      },
      {
        name: "tweet/post",
        url: "/twitter/tweet/post",
        body: {
          text: testText,
          login_cookies: loginCookies,
          proxy: proxyUrl,
        },
      },
    ];

    for (const ep of endpoints) {
      console.log(`[test] Trying ${ep.name}...`);
      try {
        const response = await fetch(`${TWITTERAPI_BASE}${ep.url}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": twitterApiIoKey,
          },
          body: JSON.stringify(ep.body),
        });

        const responseText = await response.text();
        console.log(`[test] ${ep.name}: ${response.status} - ${responseText}`);

        const parsed = safeJsonParse(responseText);
        results[ep.name] = {
          status: response.status,
          response: parsed || responseText.slice(0, 300),
        };

        // Check if any succeeded
        if (response.status === 200 && parsed?.status === "success") {
          results.success = true;
          results.working_endpoint = ep.name;
        }
      } catch (e) {
        results[ep.name] = { error: e instanceof Error ? e.message : "Unknown error" };
      }
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
