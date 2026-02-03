import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

// --- Cookie helpers (for using X_FULL_COOKIE without re-login) ---
const stripQuotes = (v: string) => v.replace(/^['"]+|['"]+$/g, "").trim();

function parseCookieString(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = raw.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    const val = rest.join("=");
    if (val) out[k.trim()] = stripQuotes(val);
  }
  return out;
}

function buildLoginCookiesBase64FromEnv(args: {
  xFullCookie?: string | null;
  xAuthToken?: string | null;
  xCt0Token?: string | null;
}): string | null {
  // twitterapi.io expects login_cookies as base64(JSON cookies)
  if (args.xFullCookie) {
    const cookies = parseCookieString(args.xFullCookie);
    if (Object.keys(cookies).length === 0) return null;
    return btoa(JSON.stringify(cookies));
  }

  if (args.xAuthToken && args.xCt0Token) {
    return btoa(
      JSON.stringify({
        auth_token: stripQuotes(args.xAuthToken),
        ct0: stripQuotes(args.xCt0Token),
      })
    );
  }

  return null;
}

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

// Reply to tweet using official X.com API v2 with OAuth 1.0a
async function replyViaOfficialApi(
  tweetId: string,
  text: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  const url = "https://api.x.com/2/tweets";

  const body = JSON.stringify({
    text,
    reply: { in_reply_to_tweet_id: tweetId },
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
    console.log(`[agent-scan-twitter] 📥 Official X API reply response: ${response.status} - ${responseText.slice(0, 300)}`);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${responseText}` };
    }

    const data = JSON.parse(responseText);
    const replyId = data.data?.id;
    
    if (replyId) {
      return { success: true, replyId };
    }
    return { success: false, error: `No reply ID in response: ${responseText}` };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

type TweetResult = {
  id: string;
  text: string;
  author_id: string;
  author_username: string;
  created_at: string;
  media_url?: string; // Attached image URL from tweet
};

// Search for mentions using Official X API v2 with Bearer Token (App-only auth)
async function searchMentionsViaOfficialApi(
  query: string,
  bearerToken: string
): Promise<TweetResult[]> {
  const searchUrl = new URL("https://api.x.com/2/tweets/search/recent");
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("max_results", "100");
  searchUrl.searchParams.set("tweet.fields", "created_at,author_id,attachments");
  searchUrl.searchParams.set("expansions", "author_id,attachments.media_keys");
  searchUrl.searchParams.set("user.fields", "username");
  searchUrl.searchParams.set("media.fields", "url,preview_image_url,type");

  const response = await fetch(searchUrl.toString(), {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[agent-scan-twitter] X API error:", response.status, errorText);
    throw new Error(`X_API_ERROR [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  const tweets = data.data || [];
  const users = data.includes?.users || [];
  const media = data.includes?.media || [];

  // Build username map
  const userMap: Record<string, string> = {};
  for (const user of users) {
    userMap[user.id] = user.username;
  }

  // Build media map (media_key -> url)
  const mediaMap: Record<string, string> = {};
  for (const m of media) {
    // For photos, use url; for videos, use preview_image_url
    const mediaUrl = m.url || m.preview_image_url;
    if (m.media_key && mediaUrl) {
      mediaMap[m.media_key] = mediaUrl;
    }
  }

  return tweets.map((t: any) => {
    // Get first media URL from attachments
    let mediaUrl: string | undefined;
    const mediaKeys = t.attachments?.media_keys || [];
    for (const key of mediaKeys) {
      if (mediaMap[key]) {
        mediaUrl = mediaMap[key];
        break;
      }
    }

    return {
      id: t.id,
      text: t.text,
      author_id: t.author_id || "",
      author_username: userMap[t.author_id] || "",
      created_at: t.created_at || "",
      media_url: mediaUrl,
    };
  });
}

// Fallback: Search using twitterapi.io (session-based)
async function searchMentionsViaTwitterApiIo(
  query: string,
  apiKey: string
): Promise<TweetResult[]> {
  const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("queryType", "Latest");

  let lastStatus = 0;
  let lastBody: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(searchUrl.toString(), {
      headers: { "X-API-Key": apiKey },
    });

    lastStatus = response.status;
    const raw = await response.text();
    try {
      lastBody = raw ? JSON.parse(raw) : null;
    } catch {
      lastBody = { raw };
    }

    if (response.ok) {
      const data = lastBody;
      const tweets: Array<{
        id: string;
        text: string;
        author?: { id: string; userName: string };
        createdAt?: string;
        extendedEntities?: { media?: Array<{ media_url_https?: string; type?: string }> };
        entities?: { media?: Array<{ media_url_https?: string; type?: string }> };
        mediaUrls?: string[];
      }> = data?.tweets || [];

      return tweets.map((t) => {
        // Extract media URL from various possible locations in twitterapi.io response
        let mediaUrl: string | undefined;
        
        // Try extendedEntities first (preferred for high quality)
        const extMedia = t.extendedEntities?.media || t.entities?.media || [];
        for (const m of extMedia) {
          if (m.media_url_https && (m.type === "photo" || !m.type)) {
            mediaUrl = m.media_url_https;
            break;
          }
        }
        
        // Fallback to mediaUrls array if present
        if (!mediaUrl && t.mediaUrls && t.mediaUrls.length > 0) {
          mediaUrl = t.mediaUrls[0];
        }

        return {
          id: t.id,
          text: t.text,
          author_id: t.author?.id || "",
          author_username: t.author?.userName || "",
          created_at: t.createdAt || "",
          media_url: mediaUrl,
        };
      });
    }

    if (response.status === 429) {
      const backoffMs = 1000 * Math.pow(2, attempt);
      console.warn(`[agent-scan-twitter] twitterapi.io rate limited. Retrying in ${backoffMs}ms`);
      await sleep(backoffMs);
      continue;
    }

    throw new Error(`twitterapi.io search failed [${response.status}]`);
  }

  throw new Error(`TWITTERAPI_RATE_LIMITED [${lastStatus}]`);
}

// Dynamic login to get fresh cookies
interface LoginCredentials {
  apiKey: string;
  username: string;
  email: string;
  password: string;
  totpSecret?: string;
  proxyUrl: string;
}

async function getLoginCookies(creds: LoginCredentials): Promise<string | null> {
  console.log("[agent-scan-twitter] 🔐 Attempting dynamic login...");

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
  console.log(`[agent-scan-twitter] 🔐 Login v2 response: ${loginAttempt.res.status}`);

  const loginIsAuthError = (payload: any): boolean => {
    const msg = String(payload?.message ?? payload?.msg ?? payload?.error ?? "").toLowerCase();
    return msg.includes("authentication error") || msg.includes("login failed") || msg.includes("challenge");
  };

  // Fallback to v3 if v2 fails
  if (!loginAttempt.res.ok || (loginAttempt.data?.status === "error" && loginIsAuthError(loginAttempt.data))) {
    console.log("[agent-scan-twitter] 🛟 Falling back to login v3...");
    const v3Body: Record<string, string> = totpCode ? { totp_code: totpCode } : {};
    loginAttempt = await doLogin("/twitter/user_login_v3", Object.keys(v3Body).length > 0 ? v3Body : undefined);
    console.log(`[agent-scan-twitter] 🔐 Login v3 response: ${loginAttempt.res.status}`);
  }

  if (!loginAttempt.res.ok) {
    console.error("[agent-scan-twitter] ❌ Login failed:", loginAttempt.text.slice(0, 500));
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
    console.error("[agent-scan-twitter] ❌ No cookies in login response:", JSON.stringify(loginData).slice(0, 500));
    return null;
  }

  console.log("[agent-scan-twitter] ✅ Login successful, got cookies");
  return loginCookies;
}

// Send reply - tries Official X API first, then twitterapi.io fallbacks
async function replyToTweet(
  tweetId: string,
  text: string,
  apiKey: string,
  loginCookies: string,
  proxyUrl: string,
  username?: string,
  authSession?: { authToken: string; ct0: string },
  oauthCreds?: { consumerKey: string; consumerSecret: string; accessToken: string; accessTokenSecret: string }
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    console.log(`[agent-scan-twitter] 📤 Attempting reply to @${username || "unknown"} (tweet ${tweetId})`);

    // ATTEMPT 0: Official X API with OAuth 1.0a (highest priority - most reliable)
    if (oauthCreds?.consumerKey && oauthCreds?.accessToken) {
      console.log("[agent-scan-twitter] Trying Official X API (OAuth 1.0a)...");
      const oauthResult = await replyViaOfficialApi(
        tweetId,
        text,
        oauthCreds.consumerKey,
        oauthCreds.consumerSecret,
        oauthCreds.accessToken,
        oauthCreds.accessTokenSecret
      );
      
      if (oauthResult.success && oauthResult.replyId) {
        console.log(`[agent-scan-twitter] ✅ Reply sent via Official X API to @${username || "unknown"}: ${oauthResult.replyId}`);
        return oauthResult;
      }
      console.warn(`[agent-scan-twitter] ⚠️ Official X API reply failed: ${oauthResult.error}`);
    }

    const isTwitterApiErrorPayload = (payload: any): boolean => {
      if (!payload || typeof payload !== "object") return true;
      if (payload.success === false) return true;
      if (payload.status === "error") return true;
      if (typeof payload.error === "string" && payload.error.length > 0) return true;
      if (typeof payload.msg === "string" && payload.msg.toLowerCase().includes("failed")) return true;
      return false;
    };

    const extractReplyId = (payload: any): string | null => {
      return (
        payload?.data?.id ||
        payload?.data?.rest_id ||
        payload?.data?.create_tweet?.tweet_results?.result?.rest_id ||
        payload?.tweet_id ||
        payload?.id ||
        null
      );
    };

    // twitterapi.io changed endpoints; /twitter/tweet/create started returning 404.
    // Use the currently working endpoints (create_tweet_v2 / post_tweet).

    const tryCreateTweetV2 = async (): Promise<{ ok: boolean; replyId?: string; error?: string }> => {
      if (!loginCookies) return { ok: false, error: "Missing login_cookies" };

      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          login_cookies: loginCookies,
          tweet_text: text,
          reply_to_tweet_id: tweetId,
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[agent-scan-twitter] 📥 Reply API response (create_tweet_v2): ${response.status} - ${responseText.slice(0, 300)}`);

      if (!response.ok) return { ok: false, error: `HTTP ${response.status}: ${responseText}` };
      const data = safeJsonParse(responseText) || {};
      if (isTwitterApiErrorPayload(data)) {
        const errMsg = data?.error || data?.msg || data?.message || responseText;
        return { ok: false, error: String(errMsg) };
      }
      const replyId = extractReplyId(data);
      if (!replyId) return { ok: false, error: `No reply id returned (response: ${responseText.slice(0, 300)})` };
      return { ok: true, replyId };
    };

    const tryPostTweetLoginCookies = async (): Promise<{ ok: boolean; replyId?: string; error?: string }> => {
      if (!loginCookies) return { ok: false, error: "Missing login_cookies" };

      const response = await fetch(`${TWITTERAPI_BASE}/twitter/post_tweet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          login_cookies: loginCookies,
          tweet_text: text,
          in_reply_to_tweet_id: tweetId,
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[agent-scan-twitter] 📥 Reply API response (post_tweet login_cookies): ${response.status} - ${responseText.slice(0, 300)}`);

      if (!response.ok) return { ok: false, error: `HTTP ${response.status}: ${responseText}` };
      const data = safeJsonParse(responseText) || {};
      if (isTwitterApiErrorPayload(data)) {
        const errMsg = data?.error || data?.msg || data?.message || responseText;
        return { ok: false, error: String(errMsg) };
      }
      const replyId = extractReplyId(data);
      if (!replyId) return { ok: false, error: `No reply id returned (response: ${responseText.slice(0, 300)})` };
      return { ok: true, replyId };
    };

    const tryPostTweetAuthSession = async (): Promise<{ ok: boolean; replyId?: string; error?: string }> => {
      if (!authSession?.authToken || !authSession?.ct0) {
        return { ok: false, error: "Missing auth_session (X_AUTH_TOKEN / X_CT0_TOKEN)" };
      }

      const response = await fetch(`${TWITTERAPI_BASE}/twitter/post_tweet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          tweet_text: text,
          in_reply_to_tweet_id: tweetId,
          auth_session: {
            auth_token: authSession.authToken,
            ct0: authSession.ct0,
          },
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[agent-scan-twitter] 📥 Reply API response (post_tweet auth_session): ${response.status} - ${responseText.slice(0, 300)}`);

      if (!response.ok) return { ok: false, error: `HTTP ${response.status}: ${responseText}` };
      const data = safeJsonParse(responseText) || {};
      if (isTwitterApiErrorPayload(data)) {
        const errMsg = data?.error || data?.msg || data?.message || responseText;
        return { ok: false, error: String(errMsg) };
      }
      const replyId = extractReplyId(data);
      if (!replyId) return { ok: false, error: `No reply id returned (response: ${responseText.slice(0, 300)})` };
      return { ok: true, replyId };
    };
    
    // Attempt 1: create_tweet_v2 (best)
    const v2Attempt = await tryCreateTweetV2();
    if (v2Attempt.ok && v2Attempt.replyId) {
      console.log(`[agent-scan-twitter] ✅ Reply sent to @${username || "unknown"}: ${v2Attempt.replyId}`);
      return { success: true, replyId: v2Attempt.replyId };
    }
    console.warn(`[agent-scan-twitter] ⚠️ create_tweet_v2 failed: ${v2Attempt.error}`);

    // Attempt 2: post_tweet with login_cookies
    const postAttempt = await tryPostTweetLoginCookies();
    if (postAttempt.ok && postAttempt.replyId) {
      console.log(`[agent-scan-twitter] ✅ Reply sent to @${username || "unknown"}: ${postAttempt.replyId}`);
      return { success: true, replyId: postAttempt.replyId };
    }
    console.warn(`[agent-scan-twitter] ⚠️ post_tweet failed: ${postAttempt.error}`);

    // Attempt 3 (fallback): post_tweet with auth_session
    if (authSession) {
      console.warn(`[agent-scan-twitter] ⚠️ Cookie methods failed, trying post_tweet with auth_session...`);
      const fallback = await tryPostTweetAuthSession();
      if (fallback.ok && fallback.replyId) {
        console.log(`[agent-scan-twitter] ✅ Reply sent (fallback) to @${username || "unknown"}: ${fallback.replyId}`);
        return { success: true, replyId: fallback.replyId };
      }
      return { success: false, error: `All attempts failed. Last error: ${fallback.error}` };
    }

    return { success: false, error: `All attempts failed. Last error: ${postAttempt.error}` };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[agent-scan-twitter] ❌ REPLY EXCEPTION to @${username || "unknown"} (tweet ${tweetId}):`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

// Check how many launches an X author has done in last 24 hours
// deno-lint-ignore no-explicit-any
async function getAuthorLaunchesToday(
  supabase: any,
  postAuthorId: string
): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { count } = await supabase
    .from("agent_social_posts")
    .select("id", { count: "exact", head: true })
    .eq("platform", "twitter")
    .eq("post_author_id", postAuthorId)
    .eq("status", "completed")
    .gte("processed_at", oneDayAgo);
  
  return count || 0;
}

const DAILY_LAUNCH_LIMIT_PER_AUTHOR = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Official X API Bearer Token (preferred for searching)
    const xBearerToken = Deno.env.get("X_BEARER_TOKEN");
    
    // Official X API OAuth 1.0a credentials (preferred for replies)
    const twitterConsumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const twitterConsumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const twitterAccessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const twitterAccessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
    
    const oauthCreds = (twitterConsumerKey && twitterConsumerSecret && twitterAccessToken && twitterAccessTokenSecret)
      ? {
          consumerKey: twitterConsumerKey,
          consumerSecret: twitterConsumerSecret,
          accessToken: twitterAccessToken,
          accessTokenSecret: twitterAccessTokenSecret,
        }
      : undefined;
    
    // twitterapi.io credentials for posting via dynamic login (fallback)
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const xAccountUsername = Deno.env.get("X_ACCOUNT_USERNAME");
    const xAccountEmail = Deno.env.get("X_ACCOUNT_EMAIL");
    const xAccountPassword = Deno.env.get("X_ACCOUNT_PASSWORD");
    const xTotpSecretRaw = Deno.env.get("X_TOTP_SECRET");
    const xTotpSecret = normalizeTotpSecret(xTotpSecretRaw);
    const proxyUrl = Deno.env.get("TWITTER_PROXY");

    // Preferred session cookie header (no re-login).
    const xFullCookie = Deno.env.get("X_FULL_COOKIE");

    // Legacy session tokens (fallback posting method)
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0Token = Deno.env.get("X_CT0_TOKEN");

    // Need at least one search method
    if (!xBearerToken && !twitterApiIoKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No search credentials configured. Need X_BEARER_TOKEN or TWITTERAPI_IO_KEY" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if we can post replies (OAuth preferred, then static cookies, then dynamic login, then auth_session)
    const canPostRepliesWithOAuth = !!(oauthCreds);
    const canPostRepliesWithStaticCookies = !!(
      twitterApiIoKey &&
      proxyUrl &&
      (xFullCookie || (xAuthToken && xCt0Token))
    );
    const canPostRepliesWithDynamicLogin = !!(
      twitterApiIoKey &&
      xAccountUsername &&
      xAccountEmail &&
      xAccountPassword &&
      proxyUrl
    );
    const canPostRepliesWithAuthSession = !!(twitterApiIoKey && xAuthToken && xCt0Token && proxyUrl);
    const canPostReplies =
      canPostRepliesWithOAuth ||
      canPostRepliesWithStaticCookies ||
      canPostRepliesWithDynamicLogin ||
      canPostRepliesWithAuthSession;

    const replyAuthSession = canPostRepliesWithAuthSession
      ? { authToken: xAuthToken!, ct0: xCt0Token! }
      : undefined;
    let loginCookies: string | null = null;
    
    if (!canPostReplies) {
      console.log(
        "[agent-scan-twitter] Reply credentials not configured - will detect/process but skip replies"
      );
    } else if (canPostRepliesWithOAuth) {
      console.log("[agent-scan-twitter] Will use Official X API (OAuth 1.0a) for replies");
    } else if (canPostRepliesWithStaticCookies) {
      console.log("[agent-scan-twitter] Will use X_FULL_COOKIE (static session) for replies (no dynamic login)");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Acquire lock to prevent concurrent runs
    const lockName = "agent-scan-twitter-lock";
    const lockExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const rateLimitLockName = "agent-scan-twitter-rate-limit";

    // Clean up expired locks
    await supabase.from("cron_locks").delete().lt("expires_at", new Date().toISOString());

    const { error: lockError } = await supabase.from("cron_locks").insert({
      lock_name: lockName,
      expires_at: lockExpiry,
    });

    if (lockError) {
      console.log("[agent-scan-twitter] Another instance running, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "lock held" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      // Check rate-limit cooldown
      const nowIso = new Date().toISOString();
      const { data: rlLock } = await supabase
        .from("cron_locks")
        .select("lock_name, expires_at")
        .eq("lock_name", rateLimitLockName)
        .gt("expires_at", nowIso)
        .maybeSingle();

      if (rlLock) {
        console.warn(`[agent-scan-twitter] Skipping due to rate-limit cooldown until ${rlLock.expires_at}`);
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: "rate_limit_cooldown",
            cooldownUntil: rlLock.expires_at,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try Official X API first (Bearer Token), fallback to twitterapi.io
      const searchQuery = "(tunalaunch OR launchtuna) -is:retweet";
      let tweets: TweetResult[] = [];
      let rateLimited = false;
      let searchMethod = "none";

      if (xBearerToken) {
        try {
          console.log("[agent-scan-twitter] Searching via Official X API (Bearer Token)...");
          tweets = await searchMentionsViaOfficialApi(searchQuery, xBearerToken);
          searchMethod = "official_x_api";
          console.log(`[agent-scan-twitter] Found ${tweets.length} tweets via Official X API`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn("[agent-scan-twitter] Official X API failed:", msg);
          
          // Check if rate limited
          if (msg.includes("[429]")) {
            rateLimited = true;
          }
          
          // Try fallback if twitterapi.io is configured
          if (twitterApiIoKey && !rateLimited) {
            try {
              console.log("[agent-scan-twitter] Falling back to twitterapi.io...");
              tweets = await searchMentionsViaTwitterApiIo(searchQuery, twitterApiIoKey);
              searchMethod = "twitterapi_io_fallback";
              console.log(`[agent-scan-twitter] Found ${tweets.length} tweets via twitterapi.io fallback`);
            } catch (fallbackErr) {
              const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
              if (fallbackMsg.includes("RATE_LIMITED") || fallbackMsg.includes("[429]")) {
                rateLimited = true;
              } else {
                throw fallbackErr;
              }
            }
          }
        }
      } else if (twitterApiIoKey) {
        // No Bearer Token, use twitterapi.io directly
        try {
          console.log("[agent-scan-twitter] Searching via twitterapi.io...");
          tweets = await searchMentionsViaTwitterApiIo(searchQuery, twitterApiIoKey);
          searchMethod = "twitterapi_io";
          console.log(`[agent-scan-twitter] Found ${tweets.length} tweets via twitterapi.io`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("RATE_LIMITED") || msg.includes("[429]")) {
            rateLimited = true;
          } else {
            throw err;
          }
        }
      }

      // Set cooldown if rate-limited
      if (rateLimited) {
        const cooldownUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase.from("cron_locks").delete().eq("lock_name", rateLimitLockName);
        await supabase.from("cron_locks").insert({
          lock_name: rateLimitLockName,
          expires_at: cooldownUntil,
          acquired_at: new Date().toISOString(),
        });
        console.warn("[agent-scan-twitter] Rate limited, cooldown set until", cooldownUntil);
      }

      // Get the latest processed tweet timestamp to skip older ones
      const { data: latestProcessed } = await supabase
        .from("agent_social_posts")
        .select("post_id, created_at")
        .eq("platform", "twitter")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Strip any suffixes like _final, _retry from post_id for comparison
      const rawProcessedId = latestProcessed?.post_id;
      const latestProcessedId = rawProcessedId?.replace(/_(final|retry)$/i, '') || null;
      
      if (tweets.length > 0) {
        const tweetIds = tweets.map((t) => t.id).slice(0, 5);
        console.log(`[agent-scan-twitter] Latest tweet IDs: ${tweetIds.join(", ")}`);
        if (latestProcessedId) {
          console.log(`[agent-scan-twitter] Last processed tweet ID: ${latestProcessedId}`);
        }
      }

      const results: Array<{
        tweetId: string;
        status: string;
        mintAddress?: string;
        error?: string;
      }> = [];

      // Prepare login cookies for twitterapi.io replies if needed.
      // Prefer static cookies derived from X_FULL_COOKIE (no re-login) over dynamic login.
      if ((canPostRepliesWithStaticCookies || canPostRepliesWithDynamicLogin) && tweets.length > 0) {
        if (canPostRepliesWithStaticCookies) {
          loginCookies = buildLoginCookiesBase64FromEnv({
            xFullCookie,
            xAuthToken,
            xCt0Token,
          });
          if (!loginCookies) {
            console.error("[agent-scan-twitter] ❌ Failed to build login cookies from env - will process but may skip cookie-based replies");
          }
        } else if (canPostRepliesWithDynamicLogin) {
          console.log("[agent-scan-twitter] 🔐 Getting login cookies via dynamic login (fallback)...");
          loginCookies = await getLoginCookies({
            apiKey: twitterApiIoKey!,
            username: xAccountUsername!,
            email: xAccountEmail!,
            password: xAccountPassword!,
            totpSecret: xTotpSecret,
            proxyUrl: proxyUrl!,
          });

          if (!loginCookies) {
            console.error("[agent-scan-twitter] ❌ Failed to get login cookies - will process but skip replies");
          }
        }
      }

      // Sort tweets by ID descending (newest first) to process in order
      const sortedTweets = [...tweets].sort((a, b) => {
        // Tweet IDs are snowflake IDs - larger = newer
        return BigInt(b.id) > BigInt(a.id) ? 1 : -1;
      });

      for (const tweet of sortedTweets) {
        const tweetId = tweet.id;
        const tweetText = tweet.text;
        const normalizedText = tweetText.replace(/!launchtuna/gi, "!tunalaunch");
        const username = tweet.author_username;
        const authorId = tweet.author_id;
        
        // Validate media URL - must be actual image URL, not t.co shortlink
        let mediaUrl = tweet.media_url; // Attached image from tweet
        if (mediaUrl) {
          // t.co links are redirects, not actual images - skip them
          if (mediaUrl.startsWith("https://t.co/") || mediaUrl.startsWith("http://t.co/")) {
            console.log(`[agent-scan-twitter] ⚠️ Skipping t.co shortlink for ${tweetId}: ${mediaUrl}`);
            mediaUrl = undefined;
          }
          // Only accept known image hosts
          else if (!mediaUrl.includes("pbs.twimg.com") && 
                   !mediaUrl.includes("abs.twimg.com") &&
                   !mediaUrl.includes("video.twimg.com") &&
                   !mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            console.log(`[agent-scan-twitter] ⚠️ Unknown image host for ${tweetId}: ${mediaUrl.slice(0, 60)}`);
            // Keep it but log warning - might still work
          }
        }

        // Validate command presence
        if (!normalizedText.toLowerCase().includes("!tunalaunch")) {
          console.log(`[agent-scan-twitter] Skipping ${tweetId} - no !tunalaunch command`);
          results.push({ tweetId, status: "skipped_no_command" });
          continue;
        }

        // Check if already processed (double-check)
        const { data: existing } = await supabase
          .from("agent_social_posts")
          .select("id, status")
          .eq("platform", "twitter")
          .eq("post_id", tweetId)
          .maybeSingle();

        if (existing) {
          // Catch-up: if it previously failed and we never replied (because reply creds were missing), send a one-time help reply.
          if (existing.status === "failed" && canPostReplies && username) {
            const { data: alreadyReplied } = await supabase
              .from("twitter_bot_replies")
              .select("id")
              .eq("tweet_id", tweetId)
              .maybeSingle();

            if (!alreadyReplied) {
              const helpText = `🐟 Hey @${username}! Your !tunalaunch is missing required fields.\n\n❌ Token name (add: name: YourTokenName)\n❌ Ticker symbol (add: symbol: TICKER)\n\nExample:\n!tunalaunch\nname: My Token\nsymbol: MTK\n[Attach your token image]`;

              const replyResult = await replyToTweet(
                tweetId,
                helpText,
                twitterApiIoKey || "",
                loginCookies || "",
                proxyUrl || "",
                username,
                replyAuthSession,
                oauthCreds
              );

              if (replyResult.success && replyResult.replyId) {
                await supabase.from("twitter_bot_replies").insert({
                  tweet_id: tweetId,
                  tweet_author: username,
                  tweet_text: normalizedText.slice(0, 500),
                  reply_text: helpText.slice(0, 500),
                  reply_id: replyResult.replyId,
                });
                console.log(`[agent-scan-twitter] ✅ Catch-up reply sent to @${username} for ${tweetId}`);
              } else {
                console.error(`[agent-scan-twitter] ❌ FAILED to send catch-up reply to @${username}:`, replyResult.error);
              }
            }
          }

          results.push({ tweetId, status: "already_processed" });
          continue;
        }

        // Skip tweets older than or equal to the last processed one (only if not already in DB)
        if (latestProcessedId && BigInt(tweetId) <= BigInt(latestProcessedId)) {
          console.log(`[agent-scan-twitter] Skipping ${tweetId} - older than last processed`);
          results.push({ tweetId, status: "skipped_already_seen" });
          continue;
        }

        // Check daily launch limit per X author (3 per day)
        if (authorId) {
          const launchesToday = await getAuthorLaunchesToday(supabase, authorId);
          if (launchesToday >= DAILY_LAUNCH_LIMIT_PER_AUTHOR) {
            console.log(`[agent-scan-twitter] @${username} (${authorId}) hit daily limit: ${launchesToday}/${DAILY_LAUNCH_LIMIT_PER_AUTHOR}`);
            
            // Record the attempt as rate-limited
            await supabase.from("agent_social_posts").insert({
              platform: "twitter",
              post_id: tweetId,
              post_url: `https://x.com/${username || "i"}/status/${tweetId}`,
              post_author: username,
              post_author_id: authorId,
              wallet_address: "unknown",
              raw_content: normalizedText.slice(0, 1000),
              status: "failed",
              error_message: "Daily limit of 10 Agent launches per X account reached",
              processed_at: new Date().toISOString(),
            });

            results.push({ tweetId, status: "rate_limited", error: "Daily limit reached" });

            // Reply with rate limit message
            if (canPostReplies) {
              const rateLimitText = `🐟 Hey @${username}! There is a daily limit of 10 Agent launches per X account.\n\nPlease try again tomorrow! 🌅`;
              
              const rateLimitReply = await replyToTweet(
                tweetId,
                rateLimitText,
                twitterApiIoKey || "",
                loginCookies || "",
                proxyUrl || "",
                username,
                replyAuthSession,
                oauthCreds
              );

              if (!rateLimitReply.success) {
                console.error(`[agent-scan-twitter] ❌ FAILED to send rate limit reply to @${username}:`, rateLimitReply.error);
              }
            }
            continue;
          }
        }

        // Process the tweet - include media URL if present
        if (mediaUrl) {
          console.log(`[agent-scan-twitter] 📷 Tweet ${tweetId} has attached image: ${mediaUrl.slice(0, 60)}...`);
        }
        
        const processResponse = await fetch(
          `${supabaseUrl}/functions/v1/agent-process-post`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              platform: "twitter",
              postId: tweetId,
              postUrl: `https://x.com/${username || "i"}/status/${tweetId}`,
              postAuthor: username,
              postAuthorId: authorId,
              content: normalizedText,
              mediaUrl: mediaUrl || null, // Pass attached image from tweet
            }),
          }
        );

        const processResult = await processResponse.json();

        if (processResult.success && processResult.mintAddress) {
          results.push({
            tweetId,
            status: "launched",
            mintAddress: processResult.mintAddress,
          });

          // Post success reply
          if (canPostReplies) {
            const replyText = `🐟 Token launched!\n\n$${processResult.mintAddress?.slice(0, 8)}... is now live on TUNA!\n\n🔗 Trade: ${processResult.tradeUrl}\n\nPowered by TUNA Agents - 80% of fees go to you!`;

            const replyResult = await replyToTweet(
              tweetId,
              replyText,
              twitterApiIoKey || "",
              loginCookies || "",
              proxyUrl || "",
              username,
              replyAuthSession,
              oauthCreds
            );

            if (!replyResult.success) {
              console.error(`[agent-scan-twitter] ❌ FAILED to send launch success reply to @${username}:`, replyResult.error);
            }
          }
        } else {
          results.push({
            tweetId,
            status: "failed",
            error: processResult.error,
          });

          // Reply to user when launch is blocked (missing image, parse error, etc.)
          if (canPostReplies && processResult.shouldReply && processResult.replyText) {
            // Use the specific reply text from agent-process-post (e.g., missing image)
            const replyResult = await replyToTweet(
              tweetId,
              processResult.replyText,
              twitterApiIoKey || "",
              loginCookies || "",
              proxyUrl || "",
              username,
              replyAuthSession,
              oauthCreds
            );

            if (!replyResult.success) {
              console.error(`[agent-scan-twitter] ❌ FAILED to send blocked launch reply to @${username}:`, replyResult.error);
            } else {
              console.log(`[agent-scan-twitter] ✅ Sent blocked launch reply to @${username}`);
            }
          } else if (canPostReplies && processResult.error?.includes("parse")) {
            // Fallback: format help for parsing errors
            const formatHelpText = `🐟 Hey @${username}! To launch your token, please use this format:\n\n!tunalaunch\nName: YourTokenName\nSymbol: $TICKER\n\nDon't forget to attach an image!`;

            const helpReplyResult = await replyToTweet(
              tweetId,
              formatHelpText,
              twitterApiIoKey || "",
              loginCookies || "",
              proxyUrl || "",
              username,
              replyAuthSession,
              oauthCreds
            );

            if (!helpReplyResult.success) {
              console.error(`[agent-scan-twitter] ❌ FAILED to send format help reply to @${username}:`, helpReplyResult.error);
            } else {
              console.log(`[agent-scan-twitter] ✅ Sent format help reply to @${username}`);
            }
          }
        }
      }

      console.log(`[agent-scan-twitter] Completed in ${Date.now() - startTime}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          tweetsFound: tweets.length,
          results,
          rateLimited,
          searchMethod,
          durationMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      await supabase.from("cron_locks").delete().eq("lock_name", lockName);
    }
  } catch (error) {
    console.error("[agent-scan-twitter] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
