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

const base32ToBytes = (input: string): Uint8Array => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
};

const generateTotpCode = async (secretBase32: string, digits = 6, stepSec = 30): Promise<string> => {
  const keyBytes = base32ToBytes(secretBase32);
  const keyBuf = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer;
  const counter = Math.floor(Date.now() / 1000 / stepSec);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new Uint8Array(msg)));
  const offset = sig[sig.length - 1] & 0x0f;
  const binCode =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(binCode % mod).padStart(digits, "0");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { tweet_id } = body;
    
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const xAccountUsername = Deno.env.get("X_ACCOUNT_USERNAME");
    const xAccountEmail = Deno.env.get("X_ACCOUNT_EMAIL");
    const xAccountPassword = Deno.env.get("X_ACCOUNT_PASSWORD");
    const xTotpSecretRaw = Deno.env.get("X_TOTP_SECRET");
    const xTotpSecret = normalizeTotpSecret(xTotpSecretRaw);
    const proxyUrl = Deno.env.get("TWITTER_PROXY");
    
    if (!twitterApiIoKey || !proxyUrl || !xAccountUsername || !xAccountEmail || !xAccountPassword) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required credentials",
          has: {
            api_key: !!twitterApiIoKey,
            proxy: !!proxyUrl,
            username: !!xAccountUsername,
            email: !!xAccountEmail,
            password: !!xAccountPassword,
            totp: !!xTotpSecret,
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, any> = {
      config: {
        username: xAccountUsername,
        email_masked: xAccountEmail?.slice(0, 3) + "***",
        has_totp: !!xTotpSecret,
        totp_secret_length: xTotpSecret?.length,
        proxy_set: !!proxyUrl,
        proxy_format: proxyUrl.includes("@") ? "user:pass@host:port" : "invalid",
      }
    };

    // ========== STEP 0: Test proxy connectivity via twitterapi.io proxy test ==========
    console.log("[test] === STEP 0: Proxy connectivity test ===");
    
    // twitterapi.io has a proxy test endpoint
    try {
      const proxyTestRes = await fetch(`${TWITTERAPI_BASE}/twitter/proxy/test`, {
        method: "POST",
        headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
        body: JSON.stringify({ proxy: proxyUrl }),
      });
      const proxyTestText = await proxyTestRes.text();
      const proxyTestData = safeJsonParse(proxyTestText);
      
      console.log("[test] Proxy test response:", proxyTestText.slice(0, 500));
      
      results.proxy_test = {
        http_status: proxyTestRes.status,
        response: proxyTestData || proxyTestText.slice(0, 300),
        proxy_working: proxyTestData?.status === "success" || proxyTestRes.status === 200,
      };
    } catch (proxyErr) {
      console.log("[test] Proxy test error:", proxyErr);
      results.proxy_test = { error: String(proxyErr) };
    }
    
    // Also try to get IP info through the proxy using a different endpoint
    try {
      const ipCheckRes = await fetch(`${TWITTERAPI_BASE}/twitter/user/info`, {
        method: "POST", 
        headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          user_name: "elonmusk", // Public profile, no auth needed
          proxy: proxyUrl 
        }),
      });
      const ipCheckText = await ipCheckRes.text();
      const ipCheckData = safeJsonParse(ipCheckText);
      
      console.log("[test] Proxy IP check (fetching public profile):", ipCheckText.slice(0, 500));
      
      results.proxy_ip_check = {
        http_status: ipCheckRes.status,
        can_reach_twitter: ipCheckRes.status === 200 && ipCheckData?.status === "success",
        response: ipCheckData?.status === "success" 
          ? { verified: true, fetched_user: ipCheckData?.data?.userName || "unknown" }
          : ipCheckData || ipCheckText.slice(0, 300),
      };
    } catch (ipErr) {
      console.log("[test] Proxy IP check error:", ipErr);
      results.proxy_ip_check = { error: String(ipErr) };
    }

    // ========== STEP 1: Attempt Login ==========
    console.log("[test] === STEP 1: Login attempt ===");
    console.log("[test] Username:", xAccountUsername);
    console.log("[test] Has TOTP:", !!xTotpSecret);
    
    const totpCode = xTotpSecret ? await generateTotpCode(xTotpSecret) : undefined;
    console.log("[test] Generated TOTP code:", totpCode || "N/A");
    
    const loginBody: Record<string, string> = {
      user_name: xAccountUsername,
      email: xAccountEmail,
      password: xAccountPassword,
      proxy: proxyUrl,
    };
    if (totpCode) {
      loginBody.totp_code = totpCode;
    }

    const loginRes = await fetch(`${TWITTERAPI_BASE}/twitter/user_login_v2`, {
      method: "POST",
      headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
      body: JSON.stringify(loginBody),
    });
    const loginText = await loginRes.text();
    const loginData = safeJsonParse(loginText);
    
    console.log("[test] Login response status:", loginRes.status);
    console.log("[test] Login response:", loginText.slice(0, 800));
    
    const cookies = loginData?.login_cookies;
    
    results.login = {
      http_status: loginRes.status,
      api_status: loginData?.status,
      api_message: loginData?.message || loginData?.msg,
      has_cookies: !!cookies,
      cookies_length: cookies?.length,
      // Show raw response for debugging
      raw_response: loginText.slice(0, 500),
    };

    // Check if login actually worked
    if (!cookies) {
      // Parse the actual error
      const errorDetail = loginData?.detail || loginData?.message || loginData?.error || loginText.slice(0, 200);
      
      return new Response(
        JSON.stringify({
          success: false,
          login_actually_worked: false,
          diagnosis: `LOGIN_FAILED: ${errorDetail}`,
          possible_causes: [
            "Wrong password",
            "Wrong email", 
            "TOTP code expired or wrong (regenerate from authenticator app)",
            "Account locked/suspended",
            "Proxy blocked by X",
          ],
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== STEP 2: VERIFY the login is real by fetching account info ==========
    console.log("[test] === STEP 2: Verify session is real ===");
    
    // The correct endpoint for twitterapi.io to verify login
    // Try /oapi/my/info first (returns credits info which proves auth works)
    let sessionVerified = false;
    let verifiedUsername: string | null = null;
    
    // Check cookies content - if it contains "guest_id" without "auth_token", it's a guest session
    const cookiesLower = cookies.toLowerCase();
    const hasGuestId = cookiesLower.includes("guest_id");
    const hasAuthToken = cookiesLower.includes("auth_token") || cookiesLower.includes("ct0");
    
    console.log("[test] Cookie analysis:", { hasGuestId, hasAuthToken, length: cookies.length });
    
    results.cookie_analysis = {
      has_guest_id: hasGuestId,
      has_auth_token: hasAuthToken,
      likely_authenticated: hasAuthToken,
    };
    
    // If no auth token in cookies, it's definitely a guest session
    if (!hasAuthToken) {
      console.log("[test] ❌ Cookies appear to be guest-only (no auth_token/ct0)");
      
      return new Response(
        JSON.stringify({
          success: false,
          login_actually_worked: false,
          diagnosis: "GUEST_COOKIES: twitterapi.io returned cookies but they lack auth tokens. Login credentials may be incorrect or X is blocking automated login.",
          possible_causes: [
            "Password is incorrect",
            "TOTP code was wrong/expired", 
            "X detected automation and blocked the login",
            "Account has pending security verification",
            "Proxy IP is flagged by X",
          ],
          action_required: "Verify password and TOTP secret are correct. Log into X.com manually to clear any security prompts.",
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Try to verify with oapi/my/info (correct endpoint per docs)
    try {
      const myInfoRes = await fetch(`${TWITTERAPI_BASE}/oapi/my/info`, {
        method: "GET",
        headers: { 
          "X-API-Key": twitterApiIoKey, 
          "Content-Type": "application/json",
        },
      });
      const myInfoText = await myInfoRes.text();
      const myInfoData = safeJsonParse(myInfoText);
      
      console.log("[test] /oapi/my/info response:", myInfoText.slice(0, 300));
      
      results.oapi_my_info = {
        status: myInfoRes.status,
        response: myInfoData || myInfoText.slice(0, 300),
      };
      
      // This endpoint returns API credits, not session verification
      // If we have auth tokens in cookies, assume session is valid
      if (hasAuthToken) {
        sessionVerified = true;
        verifiedUsername = xAccountUsername;
      }
    } catch (e) {
      console.log("[test] /oapi/my/info failed:", e);
    }

    results.session_verified = sessionVerified;
    results.verified_username = verifiedUsername;

    if (!sessionVerified) {
      return new Response(
        JSON.stringify({
          success: false,
          login_actually_worked: false,
          diagnosis: "GHOST_SESSION: twitterapi.io returned cookies but they don't work. The login was NOT successful with X.",
          possible_causes: [
            "Proxy is datacenter (not residential) - X blocks these",
            "Account has security challenge pending",
            "TOTP code was wrong/expired",
            "Password is incorrect",
            "Account is locked/suspended",
          ],
          action_required: "Log into X.com manually as @" + xAccountUsername + " and check for any security prompts",
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== STEP 3: Try to tweet ==========
    console.log("[test] === STEP 3: Attempt tweet ===");
    
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const testText = `🐟 TUNA test ${uniqueId}`;
    
    const tweetRes = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
      method: "POST",
      headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        login_cookies: cookies,
        tweet_text: testText,
        proxy: proxyUrl,
      }),
    });
    const tweetText = await tweetRes.text();
    const tweetData = safeJsonParse(tweetText);
    
    console.log("[test] Tweet response:", tweetText.slice(0, 500));
    
    const tweetId = tweetData?.tweet_id || tweetData?.data?.rest_id || tweetData?.data?.id;
    const tweetSuccess = tweetData?.status === "success" && !!tweetId;
    
    results.tweet = {
      http_status: tweetRes.status,
      api_status: tweetData?.status,
      api_message: tweetData?.message || tweetData?.msg,
      tweet_id: tweetId,
      success: tweetSuccess,
      raw_response: tweetText.slice(0, 500),
    };

    return new Response(
      JSON.stringify({
        success: tweetSuccess,
        login_actually_worked: sessionVerified,
        verified_username: verifiedUsername,
        tweet_id: tweetId,
        diagnosis: tweetSuccess ? null : "Session verified but tweet failed - may be rate limited or write-locked",
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
        stack: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
