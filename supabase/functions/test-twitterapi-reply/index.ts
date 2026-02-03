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
    const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const proxyUrl = Deno.env.get("TWITTER_PROXY");
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0 = Deno.env.get("X_CT0_TOKEN") || Deno.env.get("X_CT0");
    
    if (!twitterApiKey || !proxyUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing TWITTERAPI_IO_KEY or TWITTER_PROXY",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!xAuthToken || !xCt0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing X_AUTH_TOKEN or X_CT0 - please add pre-authenticated cookies",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[test] Using pre-authenticated cookies");
    console.log("[test] API key prefix:", twitterApiKey?.slice(0, 8) + "...");
    console.log("[test] auth_token length:", xAuthToken?.length);
    console.log("[test] ct0 length:", xCt0?.length);

    // Test by posting a tweet
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const testText = `🐟 TUNA test ${uniqueId}`;
    
    // create_tweet_v2 requires login_cookies as base64
    const cookieObj = {
      auth_token: xAuthToken,
      ct0: xCt0,
    };
    const loginCookiesBase64 = btoa(JSON.stringify(cookieObj));
    
    console.log("[test] Trying /twitter/create_tweet_v2 with login_cookies...");
    
    const requestBody = {
      tweet_text: testText,
      login_cookies: loginCookiesBase64,
      proxy: proxyUrl,
    };
    
    console.log("[test] Request body keys:", Object.keys(requestBody));
    
    const tweetRes = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
      method: "POST",
      headers: { "X-API-Key": twitterApiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const tweetText = await tweetRes.text();
    const tweetData = safeJsonParse(tweetText);
    
    console.log("[test] Response status:", tweetRes.status);
    console.log("[test] Response:", tweetText.slice(0, 500));
    
    const tweetId = tweetData?.tweet_id || tweetData?.data?.rest_id || tweetData?.data?.id;
    const tweetSuccess = tweetData?.status === "success" && !!tweetId;
    
    if (tweetSuccess) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Tweet posted successfully with pre-auth cookies!",
          tweet_id: tweetId,
          tweet_url: `https://twitter.com/buildtuna/status/${tweetId}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: tweetData?.message || tweetData?.msg || "Tweet failed",
          raw_response: tweetText.slice(0, 500),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
