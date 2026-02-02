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
    const totpCode = xTotpSecret ? await generateTotpCode(xTotpSecret) : undefined;
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
    console.log("[test] Logging in with username:", xAccountUsername);
    const loginBody: Record<string, string> = {
      user_name: xAccountUsername!,
      email: xAccountEmail!,
      password: xAccountPassword!,
      proxy: proxyUrl,
    };
    if (totpCode) {
      loginBody.totp_code = totpCode;
      console.log("[test] TOTP code generated:", totpCode);
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
    console.log("[test] Login response:", loginRes.status, loginText.slice(0, 500));
    
    const loginData = safeJsonParse(loginText);
    results.login = {
      status: loginRes.status,
      success: loginData?.status === "success",
      raw_response: loginText.slice(0, 300),
      has_cookies: !!loginData?.login_cookies,
      user_info: loginData?.user_info || loginData?.user || null,
    };

    const loginCookies = loginData?.login_cookies;
    if (!loginCookies) {
      return new Response(
        JSON.stringify({ success: false, error: "Login failed - no cookies returned", results, loginData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test different endpoint variations - try auth_session as some endpoints require it
    const endpoints = [
      {
        name: "create_tweet_v2 (auth_session)",
        url: "/twitter/create_tweet_v2",
        body: {
          tweet_text: testText,
          auth_session: loginCookies,
          proxy: proxyUrl,
        },
      },
      {
        name: "create_tweet_v2 (login_cookies)",
        url: "/twitter/create_tweet_v2",
        body: {
          tweet_text: testText,
          login_cookies: loginCookies,
          proxy: proxyUrl,
        },
      },
      {
        name: "create_tweet_v2 (cookies)",
        url: "/twitter/create_tweet_v2",
        body: {
          tweet_text: testText,
          cookies: loginCookies,
          proxy: proxyUrl,
        },
      },
      {
        name: "tweet/create (auth_session)",
        url: "/twitter/tweet/create",
        body: {
          text: testText,
          auth_session: loginCookies,
          proxy: proxyUrl,
        },
      },
      {
        name: "user/tweet (auth_session)",
        url: "/twitter/user/tweet",
        body: {
          text: testText,
          auth_session: loginCookies,
          proxy: proxyUrl,
        },
      },
      {
        name: "create_tweet (auth_session)",
        url: "/twitter/create_tweet",
        body: {
          tweet_text: testText,
          auth_session: loginCookies,
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
