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

interface TestResult {
  name: string;
  status: number;
  success: boolean;
  response: any;
  tweet_id?: string;
}

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
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, any> = {
      config: {
        username: xAccountUsername,
        has_totp: !!xTotpSecret,
        proxy_set: !!proxyUrl,
      }
    };

    const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const testText = `🐟 TUNA test ${uniqueId}`;
    const tweetTests: TestResult[] = [];

    // ========== TEST 1: V2 Login WITH proxy + create_tweet_v2 ==========
    console.log("[test] === TEST 1: V2 Login WITH proxy ===");
    const totpCodeV2 = xTotpSecret ? await generateTotpCode(xTotpSecret) : undefined;
    
    const loginV2WithProxyBody: Record<string, string> = {
      user_name: xAccountUsername,
      email: xAccountEmail,
      password: xAccountPassword,
      proxy: proxyUrl,
    };
    if (totpCodeV2) loginV2WithProxyBody.totp_code = totpCodeV2;

    const loginV2WithProxyRes = await fetch(`${TWITTERAPI_BASE}/twitter/user_login_v2`, {
      method: "POST",
      headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
      body: JSON.stringify(loginV2WithProxyBody),
    });
    const loginV2WithProxyData = safeJsonParse(await loginV2WithProxyRes.text());
    const cookiesWithProxy = loginV2WithProxyData?.login_cookies;
    
    results.login_with_proxy = {
      status: loginV2WithProxyRes.status,
      success: !!cookiesWithProxy,
      msg: loginV2WithProxyData?.message,
    };

    if (cookiesWithProxy) {
      console.log("[test] Login with proxy success, trying tweet...");
      const tweetRes = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          login_cookies: cookiesWithProxy,
          tweet_text: testText,
          proxy: proxyUrl,
        }),
      });
      const tweetText = await tweetRes.text();
      const tweetData = safeJsonParse(tweetText);
      console.log("[test] Tweet with proxy response:", tweetText.slice(0, 300));
      
      const tweetId = tweetData?.tweet_id || tweetData?.data?.rest_id;
      tweetTests.push({
        name: "WITH_PROXY: login + tweet",
        status: tweetRes.status,
        success: tweetData?.status === "success" && !!tweetId,
        response: tweetData,
        tweet_id: tweetId,
      });
    }

    // ========== TEST 2: V2 Login WITHOUT proxy ==========
    console.log("[test] === TEST 2: V2 Login WITHOUT proxy ===");
    const totpCodeNoProxy = xTotpSecret ? await generateTotpCode(xTotpSecret) : undefined;
    
    const loginNoProxyBody: Record<string, string> = {
      user_name: xAccountUsername,
      email: xAccountEmail,
      password: xAccountPassword,
      // NO PROXY - this tests if twitterapi.io can work without our proxy
    };
    if (totpCodeNoProxy) loginNoProxyBody.totp_code = totpCodeNoProxy;

    const loginNoProxyRes = await fetch(`${TWITTERAPI_BASE}/twitter/user_login_v2`, {
      method: "POST",
      headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
      body: JSON.stringify(loginNoProxyBody),
    });
    const loginNoProxyText = await loginNoProxyRes.text();
    const loginNoProxyData = safeJsonParse(loginNoProxyText);
    const cookiesNoProxy = loginNoProxyData?.login_cookies;
    
    console.log("[test] Login WITHOUT proxy response:", loginNoProxyText.slice(0, 500));
    
    results.login_without_proxy = {
      status: loginNoProxyRes.status,
      success: !!cookiesNoProxy,
      msg: loginNoProxyData?.message || loginNoProxyData?.msg,
      detail: loginNoProxyData?.detail,
    };

    if (cookiesNoProxy) {
      console.log("[test] Login without proxy success! Trying tweet without proxy...");
      const tweetNoProxyRes = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          login_cookies: cookiesNoProxy,
          tweet_text: testText + " noproxy",
          // NO PROXY
        }),
      });
      const tweetNoProxyText = await tweetNoProxyRes.text();
      const tweetNoProxyData = safeJsonParse(tweetNoProxyText);
      console.log("[test] Tweet without proxy response:", tweetNoProxyText.slice(0, 300));
      
      const tweetId = tweetNoProxyData?.tweet_id || tweetNoProxyData?.data?.rest_id;
      tweetTests.push({
        name: "WITHOUT_PROXY: login + tweet",
        status: tweetNoProxyRes.status,
        success: tweetNoProxyData?.status === "success" && !!tweetId,
        response: tweetNoProxyData,
        tweet_id: tweetId,
      });
    } else {
      tweetTests.push({
        name: "WITHOUT_PROXY: login failed",
        status: loginNoProxyRes.status,
        success: false,
        response: loginNoProxyData,
      });
    }

    // ========== TEST 3: Use cookies from proxy login, but tweet without proxy ==========
    if (cookiesWithProxy) {
      console.log("[test] === TEST 3: Proxy-login cookies + tweet without proxy ===");
      const mixedRes = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          login_cookies: cookiesWithProxy,
          tweet_text: testText + " mixed",
          // NO PROXY - but using cookies from proxy login
        }),
      });
      const mixedText = await mixedRes.text();
      const mixedData = safeJsonParse(mixedText);
      console.log("[test] Mixed (proxy cookies, no proxy tweet) response:", mixedText.slice(0, 300));
      
      tweetTests.push({
        name: "MIXED: proxy-login cookies + no-proxy tweet",
        status: mixedRes.status,
        success: false, // This likely fails, just for diagnostics
        response: mixedData,
      });
    }

    results.tweet_tests = tweetTests;

    // Find working method
    const workingTest = tweetTests.find(t => t.success);
    const success = !!workingTest;

    return new Response(
      JSON.stringify({
        success,
        working_method: workingTest?.name || null,
        tweet_id: workingTest?.tweet_id || null,
        diagnosis: !success ? getDiagnosis(tweetTests, results) : null,
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

function getDiagnosis(tests: TestResult[], results: Record<string, any>): string {
  const v2Response = tests.find(t => t.name.includes("V2"))?.response;
  const v3Response = tests.find(t => t.name.includes("V3"))?.response;
  
  // Check for specific V3 async status
  if (v3Response?.status === "pending" || v3Response?.task_id) {
    return "V3_PENDING: V3 request submitted but async - may need polling. Check task_id.";
  }
  
  // Check if it's a proxy issue
  if (v2Response?.message?.includes("400")) {
    return `ACCOUNT_OR_PROXY_BLOCKED: Login works but posting fails with 400. This typically means:\n` +
           `1) The @${results.config?.username} account has a security hold - log into X.com manually\n` +
           `2) The proxy IP is flagged/datacenter - need residential proxy\n` +
           `3) Account needs phone/email verification on X.com`;
  }
  
  if (v3Response?.message?.includes("insufficient")) {
    return "INSUFFICIENT_CREDITS: twitterapi.io account may need credits.";
  }
  
  return "UNKNOWN_FAILURE: Check full response details.";
}
