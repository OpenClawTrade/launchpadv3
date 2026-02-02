import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac } from "node:crypto";

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

// OAuth 1.0a signing for official X.com API
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join("&");

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  const hmac = createHmac("sha1", signingKey);
  hmac.update(signatureBase);
  return hmac.digest("base64");
}

function generateOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    consumerSecret,
    accessTokenSecret
  );

  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`
    )
    .join(", ");

  return `OAuth ${headerParts}`;
}

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

// Dynamic login to get fresh cookies
async function getLoginCookies(creds: {
  apiKey: string;
  username: string;
  email: string;
  password: string;
  totpSecret?: string;
  proxyUrl: string;
}): Promise<string | null> {
  console.log("[test-twitter-reply] 🔐 Attempting dynamic login...");

  const totpCode = creds.totpSecret ? await generateTotpCode(creds.totpSecret) : undefined;

  const loginBody: Record<string, string> = {
    user_name: creds.username,
    email: creds.email,
    password: creds.password,
    proxy: creds.proxyUrl,
  };
  if (totpCode) loginBody.totp_code = totpCode;

  const doLogin = async (endpoint: string, bodyOverrides?: Record<string, string>) => {
    const body = { ...loginBody, ...bodyOverrides };
    const res = await fetch(`${TWITTERAPI_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "X-API-Key": creds.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const data = safeJsonParse(text) ?? { raw: text };
    return { res, text, data };
  };

  // Try login v2 first
  let loginAttempt = await doLogin("/twitter/user_login_v2");
  console.log(`[test-twitter-reply] 🔐 Login v2 response: ${loginAttempt.res.status}`);

  const loginIsAuthError = (payload: any): boolean => {
    const msg = String(payload?.message ?? payload?.msg ?? payload?.error ?? "").toLowerCase();
    return msg.includes("authentication error") || msg.includes("login failed") || msg.includes("challenge");
  };

  // Fallback to v3 if v2 fails
  if (!loginAttempt.res.ok || (loginAttempt.data?.status === "error" && loginIsAuthError(loginAttempt.data))) {
    console.log("[test-twitter-reply] 🛟 Falling back to login v3...");
    const v3Body: Record<string, string> = totpCode ? { totp_code: totpCode } : {};
    loginAttempt = await doLogin("/twitter/user_login_v3", Object.keys(v3Body).length > 0 ? v3Body : undefined);
    console.log(`[test-twitter-reply] 🔐 Login v3 response: ${loginAttempt.res.status}`);
  }

  if (!loginAttempt.res.ok) {
    console.error("[test-twitter-reply] ❌ Login failed:", loginAttempt.text.slice(0, 500));
    return null;
  }

  const loginData = loginAttempt.data;
  const loginCookies =
    loginData.login_cookies ||
    loginData.cookies ||
    loginData.cookie ||
    loginData?.data?.login_cookies ||
    loginData?.data?.cookies;

  if (!loginCookies) {
    console.error("[test-twitter-reply] ❌ No cookies in login response:", JSON.stringify(loginData).slice(0, 500));
    return null;
  }

  console.log("[test-twitter-reply] ✅ Login successful, got cookies");
  return loginCookies;
}

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
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0Token = Deno.env.get("X_CT0_TOKEN");

    const testText = `🧪 Test reply at ${new Date().toISOString().slice(11, 19)} UTC - checking twitterapi.io endpoints`;

    const results: Record<string, any> = {};

    // ===== METHOD 1: create_tweet_v2 with login_cookies =====
    if (twitterApiIoKey && xAccountUsername && xAccountEmail && xAccountPassword && proxyUrl) {
      console.log("[test-twitter-reply] Testing METHOD 1: create_tweet_v2 with login_cookies");
      
      const loginCookies = await getLoginCookies({
        apiKey: twitterApiIoKey,
        username: xAccountUsername,
        email: xAccountEmail,
        password: xAccountPassword,
        totpSecret: xTotpSecret,
        proxyUrl,
      });

      if (loginCookies) {
        const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": twitterApiIoKey,
          },
          body: JSON.stringify({
            tweet_text: testText + " [M1]",
            reply_to_tweet_id: tweet_id,
            login_cookies: loginCookies,
            proxy: proxyUrl,
          }),
        });

        const responseText = await response.text();
        console.log(`[test-twitter-reply] M1 Response: ${response.status} - ${responseText}`);
        
        results.method1_create_tweet_v2 = {
          status: response.status,
          response: safeJsonParse(responseText) || responseText,
        };
      } else {
        results.method1_create_tweet_v2 = { error: "Login failed - no cookies" };
      }
    } else {
      results.method1_create_tweet_v2 = { error: "Missing credentials for dynamic login" };
    }

    // ===== METHOD 2: post_tweet with auth_session =====
    if (twitterApiIoKey && xAuthToken && xCt0Token && proxyUrl) {
      console.log("[test-twitter-reply] Testing METHOD 2: post_tweet with auth_session");
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/post_tweet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiIoKey,
        },
        body: JSON.stringify({
          tweet_text: testText + " [M2]",
          in_reply_to_tweet_id: tweet_id,
          auth_session: {
            auth_token: xAuthToken,
            ct0: xCt0Token,
          },
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-twitter-reply] M2 Response: ${response.status} - ${responseText}`);
      
      results.method2_post_tweet_auth_session = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    } else {
      results.method2_post_tweet_auth_session = { error: "Missing X_AUTH_TOKEN or X_CT0_TOKEN" };
    }

    // ===== METHOD 3: post_tweet with login_cookies =====
    if (twitterApiIoKey && xAccountUsername && xAccountEmail && xAccountPassword && proxyUrl) {
      console.log("[test-twitter-reply] Testing METHOD 3: post_tweet with login_cookies");
      
      const loginCookies = await getLoginCookies({
        apiKey: twitterApiIoKey,
        username: xAccountUsername,
        email: xAccountEmail,
        password: xAccountPassword,
        totpSecret: xTotpSecret,
        proxyUrl,
      });

      if (loginCookies) {
        const response = await fetch(`${TWITTERAPI_BASE}/twitter/post_tweet`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": twitterApiIoKey,
          },
          body: JSON.stringify({
            tweet_text: testText + " [M3]",
            in_reply_to_tweet_id: tweet_id,
            login_cookies: loginCookies,
            proxy: proxyUrl,
          }),
        });

        const responseText = await response.text();
        console.log(`[test-twitter-reply] M3 Response: ${response.status} - ${responseText}`);
        
        results.method3_post_tweet_login_cookies = {
          status: response.status,
          response: safeJsonParse(responseText) || responseText,
        };
      } else {
        results.method3_post_tweet_login_cookies = { error: "Login failed - no cookies" };
      }
    } else {
      results.method3_post_tweet_login_cookies = { error: "Missing credentials for dynamic login" };
    }

    // ===== METHOD 4: create_tweet with auth_session object =====
    if (twitterApiIoKey && xAuthToken && xCt0Token && proxyUrl) {
      console.log("[test-twitter-reply] Testing METHOD 4: create_tweet with auth_session (tweet_text field)");
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiIoKey,
        },
        body: JSON.stringify({
          tweet_text: testText + " [M4]",
          in_reply_to_tweet_id: tweet_id,
          auth_session: {
            auth_token: xAuthToken,
            ct0: xCt0Token,
          },
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-twitter-reply] M4 Response: ${response.status} - ${responseText}`);
      
      results.method4_create_tweet_auth_session = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    }
    
    // ===== METHOD 5: create_tweet with login_cookies (from dynamic login) =====
    if (twitterApiIoKey && xAccountUsername && xAccountEmail && xAccountPassword && proxyUrl) {
      console.log("[test-twitter-reply] Testing METHOD 5: create_tweet with login_cookies (tweet_text field)");
      
      const loginCookies = await getLoginCookies({
        apiKey: twitterApiIoKey,
        username: xAccountUsername,
        email: xAccountEmail,
        password: xAccountPassword,
        totpSecret: xTotpSecret,
        proxyUrl,
      });

      if (loginCookies) {
        const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": twitterApiIoKey,
          },
          body: JSON.stringify({
            tweet_text: testText + " [M5]",
            in_reply_to_tweet_id: tweet_id,
            login_cookies: loginCookies,
            proxy: proxyUrl,
          }),
        });

        const responseText = await response.text();
        console.log(`[test-twitter-reply] M5 Response: ${response.status} - ${responseText}`);
        
        results.method5_create_tweet_login_cookies = {
          status: response.status,
          response: safeJsonParse(responseText) || responseText,
        };
      } else {
        results.method5_create_tweet_login_cookies = { error: "Login failed" };
      }
    }
    
    // ===== METHOD 6: standalone tweet test (no reply) =====
    if (twitterApiIoKey && xAuthToken && xCt0Token && proxyUrl) {
      console.log("[test-twitter-reply] Testing METHOD 6: standalone tweet");
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": twitterApiIoKey,
        },
        body: JSON.stringify({
          tweet_text: `🐟 TUNA standalone test at ${new Date().toISOString().slice(11, 19)} UTC`,
          auth_session: {
            auth_token: xAuthToken,
            ct0: xCt0Token,
          },
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-twitter-reply] M6 Response: ${response.status} - ${responseText}`);
      
      results.method6_standalone_tweet = {
        status: response.status,
        response: safeJsonParse(responseText) || responseText,
      };
    }

    // ===== METHOD 7: Official X API OAuth 1.0a =====
    const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const accessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
    
    if (consumerKey && consumerSecret && accessToken && accessTokenSecret) {
      console.log("[test-twitter-reply] Testing METHOD 7: Official X API OAuth 1.0a");
      
      const url = "https://api.x.com/2/tweets";
      const body = JSON.stringify({
        text: testText + " [M7-OAuth]",
        reply: { in_reply_to_tweet_id: tweet_id },
      });

      const oauthHeader = generateOAuthHeader(
        "POST",
        url,
        consumerKey,
        consumerSecret,
        accessToken,
        accessTokenSecret
      );

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: oauthHeader,
            "Content-Type": "application/json",
          },
          body,
        });

        const responseText = await response.text();
        console.log(`[test-twitter-reply] M7 Response: ${response.status} - ${responseText}`);
        
        results.method7_official_xapi_oauth = {
          status: response.status,
          response: safeJsonParse(responseText) || responseText,
        };
      } catch (error) {
        results.method7_official_xapi_oauth = {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    } else {
      results.method7_official_xapi_oauth = { 
        error: "Missing TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, or TWITTER_ACCESS_TOKEN_SECRET" 
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        tweet_id,
        test_text: testText,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[test-twitter-reply] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
