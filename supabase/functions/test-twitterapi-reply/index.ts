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

    // ========== TEST 1: V2 Login + create_tweet_v2 ==========
    console.log("[test] === TEST 1: V2 Login + create_tweet_v2 ===");
    const totpCodeV2 = xTotpSecret ? await generateTotpCode(xTotpSecret) : undefined;
    
    const loginV2Body: Record<string, string> = {
      user_name: xAccountUsername,
      email: xAccountEmail,
      password: xAccountPassword,
      proxy: proxyUrl,
    };
    if (totpCodeV2) loginV2Body.totp_code = totpCodeV2;

    const loginV2Res = await fetch(`${TWITTERAPI_BASE}/twitter/user_login_v2`, {
      method: "POST",
      headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
      body: JSON.stringify(loginV2Body),
    });
    const loginV2Data = safeJsonParse(await loginV2Res.text());
    const cookiesV2 = loginV2Data?.login_cookies;
    
    results.login_v2 = {
      status: loginV2Res.status,
      success: !!cookiesV2,
      msg: loginV2Data?.message,
    };

    if (cookiesV2) {
      console.log("[test] V2 login success, trying create_tweet_v2...");
      const tweetV2Res = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          login_cookies: cookiesV2,
          tweet_text: testText,
          proxy: proxyUrl,
        }),
      });
      const tweetV2Text = await tweetV2Res.text();
      const tweetV2Data = safeJsonParse(tweetV2Text);
      console.log("[test] create_tweet_v2 response:", tweetV2Text.slice(0, 300));
      
      const tweetId = tweetV2Data?.tweet_id || tweetV2Data?.data?.rest_id;
      tweetTests.push({
        name: "V2: login_v2 + create_tweet_v2",
        status: tweetV2Res.status,
        success: tweetV2Data?.status === "success" && !!tweetId,
        response: tweetV2Data,
        tweet_id: tweetId,
      });
    }

    // ========== TEST 2: V3 Login + send_tweet_v3 ==========
    console.log("[test] === TEST 2: V3 Login + send_tweet_v3 ===");
    // V3 needs fresh TOTP code (time may have passed)
    const totpCodeV3 = xTotpSecret ? await generateTotpCode(xTotpSecret) : undefined;
    
    const loginV3Body: Record<string, string> = {
      user_name: xAccountUsername,
      email: xAccountEmail,
      password: xAccountPassword,
      proxy: proxyUrl,
    };
    if (totpCodeV3) loginV3Body.totp_code = totpCodeV3;

    const loginV3Res = await fetch(`${TWITTERAPI_BASE}/twitter/user_login_v3`, {
      method: "POST",
      headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
      body: JSON.stringify(loginV3Body),
    });
    const loginV3Text = await loginV3Res.text();
    const loginV3Data = safeJsonParse(loginV3Text);
    console.log("[test] V3 login response:", loginV3Text.slice(0, 500));
    
    const cookiesV3 = loginV3Data?.login_cookies || loginV3Data?.cookies;
    
    results.login_v3 = {
      status: loginV3Res.status,
      success: !!cookiesV3 || loginV3Data?.status === "success",
      msg: loginV3Data?.message || loginV3Data?.msg,
      has_cookies: !!cookiesV3,
    };

    // V3 send_tweet uses user_name, not just cookies
    console.log("[test] Trying send_tweet_v3 with user_name...");
    const tweetV3Res = await fetch(`${TWITTERAPI_BASE}/twitter/send_tweet_v3`, {
      method: "POST",
      headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        user_name: xAccountUsername,
        tweet_text: testText + " v3",
        proxy: proxyUrl,
      }),
    });
    const tweetV3Text = await tweetV3Res.text();
    const tweetV3Data = safeJsonParse(tweetV3Text);
    console.log("[test] send_tweet_v3 response:", tweetV3Text.slice(0, 500));
    
    const tweetIdV3 = tweetV3Data?.tweet_id || tweetV3Data?.data?.rest_id || tweetV3Data?.data?.id;
    tweetTests.push({
      name: "V3: send_tweet_v3 (async)",
      status: tweetV3Res.status,
      success: tweetV3Data?.status === "success" || !!tweetIdV3,
      response: tweetV3Data,
      tweet_id: tweetIdV3,
    });

    // ========== TEST 3: Check if proxy is the issue - try without proxy ==========
    // Note: This will likely fail but helps diagnose
    console.log("[test] === TEST 3: Diagnostic - V2 tweet without proxy (expect fail) ===");
    if (cookiesV2) {
      const noProxyRes = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: { "X-API-Key": twitterApiIoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          login_cookies: cookiesV2,
          tweet_text: testText + " noproxy",
          // No proxy - see what error we get
        }),
      });
      const noProxyText = await noProxyRes.text();
      const noProxyData = safeJsonParse(noProxyText);
      console.log("[test] No-proxy response:", noProxyText.slice(0, 300));
      
      tweetTests.push({
        name: "DIAGNOSTIC: V2 without proxy",
        status: noProxyRes.status,
        success: false,
        response: noProxyData,
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
