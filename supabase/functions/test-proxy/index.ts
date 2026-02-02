const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const proxyUrl = Deno.env.get("TWITTER_PROXY");
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");
    
    const results: Record<string, any> = {
      proxy_configured: !!proxyUrl,
      proxy_url_format: proxyUrl ? proxyUrl.replace(/:[^:@]+@/, ':***@') : null, // mask password
    };

    // Test 1: Direct fetch to Twitter (without proxy) to see if it's reachable
    try {
      const directRes = await fetch("https://twitter.com", {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      results.direct_twitter_access = {
        status: directRes.status,
        ok: directRes.ok,
      };
    } catch (e) {
      results.direct_twitter_access = {
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }

    // Test 2: Check twitterapi.io health
    if (twitterApiIoKey) {
      try {
        const healthRes = await fetch("https://api.twitterapi.io/twitter/user/info?userName=buildtuna", {
          headers: { "X-API-Key": twitterApiIoKey },
          signal: AbortSignal.timeout(10000),
        });
        const healthText = await healthRes.text();
        results.twitterapi_health = {
          status: healthRes.status,
          response: healthText.slice(0, 500),
        };
      } catch (e) {
        results.twitterapi_health = {
          error: e instanceof Error ? e.message : "Unknown error",
        };
      }
    }

    // Test 3: Test proxy with twitterapi.io login (just check if proxy is accepted)
    if (twitterApiIoKey && proxyUrl) {
      try {
        // Just test with a minimal login attempt to see proxy response
        const testRes = await fetch("https://api.twitterapi.io/twitter/user_login_v2", {
          method: "POST",
          headers: {
            "X-API-Key": twitterApiIoKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_name: "test_proxy_check",
            email: "test@test.com",
            password: "test",
            proxy: proxyUrl,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const testText = await testRes.text();
        results.proxy_login_test = {
          status: testRes.status,
          response: testText.slice(0, 500),
        };
      } catch (e) {
        results.proxy_login_test = {
          error: e instanceof Error ? e.message : "Unknown error",
        };
      }
    }

    // Show current credential status (masked)
    const xUsername = Deno.env.get("X_ACCOUNT_USERNAME");
    const xEmail = Deno.env.get("X_ACCOUNT_EMAIL");
    const xPassword = Deno.env.get("X_ACCOUNT_PASSWORD");
    const xTotp = Deno.env.get("X_TOTP_SECRET");

    results.credentials_status = {
      username: xUsername ? `${xUsername.slice(0, 3)}***` : "NOT SET",
      email: xEmail ? `${xEmail.slice(0, 3)}***@***` : "NOT SET",
      password: xPassword ? "SET (hidden)" : "NOT SET",
      totp_secret: xTotp ? "SET (hidden)" : "NOT SET",
    };

    return new Response(
      JSON.stringify(results, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
