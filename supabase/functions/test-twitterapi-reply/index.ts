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
    
    // Decode base64 cookies to see what's inside
    let decodedCookies: any = null;
    let decodedCookiesRaw = "";
    if (cookies) {
      try {
        decodedCookiesRaw = atob(cookies);
        decodedCookies = safeJsonParse(decodedCookiesRaw);
      } catch (e) {
        decodedCookiesRaw = `(decode failed: ${e})`;
      }
    }
    
    const cookieKeys = decodedCookies ? Object.keys(decodedCookies) : [];
    const hasAuthToken = cookieKeys.some(k => k.includes("auth") || k === "ct0" || k.includes("twid"));
    
    results.login = {
      http_status: loginRes.status,
      api_status: loginData?.status,
      api_message: loginData?.message || loginData?.msg,
      has_cookies: !!cookies,
      cookies_length: cookies?.length,
      decoded_cookie_keys: cookieKeys,
      has_auth_tokens: hasAuthToken,
      raw_response: loginText.slice(0, 300),
    };

    // Even if cookies look like guest, try to tweet anyway
    if (!cookies) {
      const errorDetail = loginData?.detail || loginData?.message || loginData?.error || loginText.slice(0, 200);
      
      return new Response(
        JSON.stringify({
          success: false,
          login_actually_worked: false,
          diagnosis: `LOGIN_FAILED: ${errorDetail}`,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // SKIP verification - just try to tweet directly
    console.log("[test] === STEP 2: Skip verification, try tweet directly ===");
    
    // ========== STEP 3: Try to tweet directly ==========
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
        login_actually_worked: tweetSuccess,
        verified_username: tweetSuccess ? xAccountUsername : null,
        tweet_id: tweetId,
        has_auth_tokens: hasAuthToken,
        decoded_cookie_keys: cookieKeys,
        diagnosis: tweetSuccess ? null : (tweetData?.message || tweetData?.msg || "Tweet failed - check raw response"),
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
