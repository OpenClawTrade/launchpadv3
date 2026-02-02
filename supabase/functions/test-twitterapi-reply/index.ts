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
    const totpCode = xTotpSecret ? await generateTotpCode(xTotpSecret) : undefined;
    const proxyUrl = Deno.env.get("TWITTER_PROXY");
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0Token = Deno.env.get("X_CT0_TOKEN");
    
    if (!twitterApiIoKey || !proxyUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing TWITTERAPI_IO_KEY or TWITTER_PROXY" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const testText = `🐟 TUNA test ${new Date().toISOString().slice(11, 19)} UTC`;
    const results: Record<string, any> = {};
    let loginCookies: string | null = null;

    // Step 1: Login (unless skipped)
    if (!skip_login) {
      console.log("[test] Logging in with username:", xAccountUsername);
      const loginBody: Record<string, string> = {
        user_name: xAccountUsername!,
        email: xAccountEmail!,
        password: xAccountPassword!,
        proxy: proxyUrl,
      };
      if (totpCode) {
        loginBody.totp_code = totpCode;
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
        has_cookies: !!loginData?.login_cookies,
      };

      loginCookies = loginData?.login_cookies;
      if (!loginCookies) {
        return new Response(
          JSON.stringify({ success: false, error: "Login failed - no cookies returned", results, loginData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Comprehensive endpoint test - test ALL variations
    const endpoints = [
      // Group 1: create_tweet_v2 variations
      {
        name: "create_tweet_v2 + tweet_text + reply_to_tweet_id",
        url: "/twitter/create_tweet_v2",
        body: { tweet_text: testText, reply_to_tweet_id: tweet_id, login_cookies: loginCookies, proxy: proxyUrl },
      },
      {
        name: "create_tweet_v2 + tweet_text + in_reply_to_tweet_id",
        url: "/twitter/create_tweet_v2",
        body: { tweet_text: testText, in_reply_to_tweet_id: tweet_id, login_cookies: loginCookies, proxy: proxyUrl },
      },
      {
        name: "create_tweet_v2 + tweet_text + reply object",
        url: "/twitter/create_tweet_v2",
        body: { tweet_text: testText, reply: { in_reply_to_tweet_id: tweet_id }, login_cookies: loginCookies, proxy: proxyUrl },
      },
      
      // Group 2: reply_tweet endpoint (if exists)
      {
        name: "reply_tweet",
        url: "/twitter/reply_tweet",
        body: { tweet_text: testText, in_reply_to_tweet_id: tweet_id, login_cookies: loginCookies, proxy: proxyUrl },
      },
      
      // Group 3: tweet_reply endpoint (if exists)
      {
        name: "tweet_reply",
        url: "/twitter/tweet_reply",
        body: { text: testText, tweet_id: tweet_id, login_cookies: loginCookies, proxy: proxyUrl },
      },
      
      // Group 4: post_reply endpoint (if exists)
      {
        name: "post_reply",
        url: "/twitter/post_reply",
        body: { text: testText, reply_to: tweet_id, login_cookies: loginCookies, proxy: proxyUrl },
      },
      
      // Group 5: Using tweets/create for reply
      {
        name: "tweets/create + reply_to_tweet_id",
        url: "/twitter/tweets/create",
        body: { text: testText, reply_to_tweet_id: tweet_id, login_cookies: loginCookies, proxy: proxyUrl },
      },
    ];

    let foundWorking = false;

    for (const ep of endpoints) {
      if (foundWorking) break;
      
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
        console.log(`[test] ${ep.name}: ${response.status} - ${responseText.slice(0, 200)}`);

        const parsed = safeJsonParse(responseText);
        results[ep.name] = {
          status: response.status,
          response: parsed || responseText.slice(0, 300),
        };

        // Check for success
        const replyId = parsed?.tweet_id || parsed?.id || parsed?.data?.id || parsed?.data?.rest_id || 
                       parsed?.data?.create_tweet?.tweet_results?.result?.rest_id;
        
        // Success conditions: 
        // 1. Got a tweet ID back
        // 2. Status 200 without error indicators
        const isError = parsed?.status === "error" || parsed?.success === false;
        
        if (response.status === 200 && replyId && !isError) {
          results.success = true;
          results.working_endpoint = ep.name;
          results.reply_id = replyId;
          foundWorking = true;
          console.log(`[test] ✅ SUCCESS with ${ep.name}, reply_id: ${replyId}`);
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
        working_endpoint: results.working_endpoint || null,
        reply_id: results.reply_id || null,
        endpoints_tested: endpoints.length,
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
