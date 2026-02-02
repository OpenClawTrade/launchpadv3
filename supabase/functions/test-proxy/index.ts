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

    // Test 3: Test login with v2 (totp_secret field)
    const xUsername = Deno.env.get("X_ACCOUNT_USERNAME");
    const xEmail = Deno.env.get("X_ACCOUNT_EMAIL");
    const xPassword = Deno.env.get("X_ACCOUNT_PASSWORD");
    const xTotpSecretRaw = Deno.env.get("X_TOTP_SECRET");
    
    // Normalize TOTP secret
    const normalizeTotpSecret = (raw?: string | null): string | undefined => {
      if (!raw) return undefined;
      const trimmed = String(raw).trim();
      if (!trimmed) return undefined;
      if (trimmed.toLowerCase().startsWith("otpauth://")) {
        try {
          const url = new URL(trimmed);
          const secretParam = url.searchParams.get("secret");
          if (secretParam) return secretParam.replace(/\s|-/g, "").toUpperCase();
        } catch { /* fall through */ }
      }
      const secretMatch = trimmed.match(/secret\s*=\s*([A-Za-z2-7\s-]+)/i);
      const candidate = (secretMatch?.[1] ?? trimmed).replace(/\s|-/g, "").toUpperCase();
      return candidate || undefined;
    };
    
    const xTotpSecret = normalizeTotpSecret(xTotpSecretRaw);
    
    if (twitterApiIoKey && proxyUrl && xUsername && xEmail && xPassword) {
      // Test login_v2 with totp_secret
      try {
        const loginBodyV2: Record<string, string> = {
          user_name: xUsername,
          email: xEmail,
          password: xPassword,
          proxy: proxyUrl,
        };
        if (xTotpSecret) loginBodyV2.totp_secret = xTotpSecret;
        
        const resV2 = await fetch("https://api.twitterapi.io/twitter/user_login_v2", {
          method: "POST",
          headers: {
            "X-API-Key": twitterApiIoKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(loginBodyV2),
          signal: AbortSignal.timeout(30000),
        });
        const textV2 = await resV2.text();
        results.login_v2 = {
          status: resV2.status,
          response: textV2.slice(0, 500),
          totp_included: !!xTotpSecret,
        };
      } catch (e) {
        results.login_v2 = { error: e instanceof Error ? e.message : "Unknown error" };
      }

      // Test login_v3 with totp_code (different field name)
      try {
        const loginBodyV3: Record<string, string> = {
          user_name: xUsername,
          email: xEmail,
          password: xPassword,
          proxy: proxyUrl,
        };
        if (xTotpSecret) loginBodyV3.totp_code = xTotpSecret;
        
        const resV3 = await fetch("https://api.twitterapi.io/twitter/user_login_v3", {
          method: "POST",
          headers: {
            "X-API-Key": twitterApiIoKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(loginBodyV3),
          signal: AbortSignal.timeout(30000),
        });
        const textV3 = await resV3.text();
        results.login_v3 = {
          status: resV3.status,
          response: textV3.slice(0, 500),
          totp_included: !!xTotpSecret,
        };
      } catch (e) {
        results.login_v3 = { error: e instanceof Error ? e.message : "Unknown error" };
      }
    }

    // Show current credential status (masked)
    results.credentials_status = {
      username: xUsername ? `${xUsername.slice(0, 3)}***` : "NOT SET",
      email: xEmail ? `${xEmail.slice(0, 3)}***@***` : "NOT SET",
      password: xPassword ? "SET (hidden)" : "NOT SET",
      totp_secret: xTotpSecretRaw ? "SET (hidden)" : "NOT SET",
      totp_normalized: xTotpSecret ? `${xTotpSecret.slice(0, 4)}...` : "NOT SET",
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
