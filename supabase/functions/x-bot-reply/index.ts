import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

// Helper: Detect error payloads that come with HTTP 200
const isTwitterApiErrorPayload = (postData: any): boolean => {
  if (!postData || typeof postData !== "object") return true;
  if (postData.success === false) return true;
  if (postData.status === "error") return true;
  if (typeof postData.error === "string" && postData.error.length > 0) return true;
  if (typeof postData.msg === "string" && postData.msg.toLowerCase().includes("failed")) return true;
  return false;
};

// Helper: Extract reply ID from various API response structures
const extractReplyId = (postData: any): string | null => {
  return (
    postData?.data?.id ||
    postData?.data?.rest_id ||
    postData?.data?.tweet?.rest_id ||
    postData?.data?.create_tweet?.tweet_results?.result?.rest_id ||
    postData?.tweet_id ||
    postData?.id ||
    null
  );
};

// Minimal Base32 + TOTP generator
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
  const cryptoKey = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new Uint8Array(msg)));
  const offset = sig[sig.length - 1] & 0x0f;
  const binCode =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  return String(binCode % 10 ** digits).padStart(digits, "0");
};

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

// Logging helper
async function insertLog(
  supabase: SupabaseClient,
  accountId: string,
  logType: string,
  level: string,
  message: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.from("x_bot_account_logs").insert({
      account_id: accountId,
      log_type: logType,
      level,
      message,
      details,
    });
  } catch (e) {
    console.error("Failed to insert log:", e);
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Login via twitterapi.io user_login_v2 to get a login_cookie
async function loginViaApi(
  apiKey: string,
  email: string,
  password: string,
  proxy: string,
  username?: string,
  totpSecret?: string
): Promise<{ loginCookie: string | null; error?: string }> {
  try {
    const body: Record<string, string> = { email, password, proxy };
    if (username) body.user_name = username;
    
    if (totpSecret) {
      const totpCode = await generateTotpCode(totpSecret);
      body.totp_code = totpCode;
    }

    console.log(`[loginViaApi] Attempting login via user_login_v2...`);
    const response = await fetchWithTimeout(
      `${TWITTERAPI_BASE}/twitter/user_login_v2`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify(body),
      },
      30000
    );

    const text = await response.text();
    console.log(`[loginViaApi] Response status: ${response.status}, body (first 300): ${text.substring(0, 300)}`);
    
    const data = (() => { try { return JSON.parse(text); } catch { return null; } })();
    
    if (data?.login_cookie) {
      console.log(`[loginViaApi] Got login_cookie (length: ${data.login_cookie.length})`);
      return { loginCookie: data.login_cookie };
    }
    
    // Some responses return session instead
    if (data?.session) {
      console.log(`[loginViaApi] Got session (length: ${data.session.length})`);
      return { loginCookie: data.session };
    }

    return { loginCookie: null, error: data?.message || data?.error || text.substring(0, 200) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(`[loginViaApi] Exception: ${msg}`);
    return { loginCookie: null, error: msg };
  }
}

async function generateReply(
  tweetText: string,
  username: string,
  personaPrompt?: string | null
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return null;
  }

  const defaultSystemPrompt = `You're a knowledgeable crypto native with genuine opinions. Generate a reply (max 240 chars) to this tweet.

Rules:
- Have opinions. Commit to a take. No "it depends" hedging.
- Never open with "Great question", "I'd be happy to help", or "Absolutely". Just answer.
- Brevity is mandatory. If it fits in one sentence, one sentence is what they get.
- Humor is welcome. Natural wit, not forced jokes.
- Be honest but respectful. You can disagree without being dismissive or insulting.
- NO swearing. NO insults. NO calling people clueless, lazy, or grifters.
- If you think something is wrong, explain why constructively — don't attack the person.
- Sound human and conversational. No corporate drone energy. No sycophancy.
- Do NOT mention any specific launchpad, platform, agent, or product. You're just a person with opinions.
- Claw emojis (🦞🦀) are fine if it feels natural.
- Do NOT add taglines, signatures, hashtags, or calls to action.

Be the thoughtful reply you'd actually want to read. Confident, not aggressive. Sharp, not mean.`;

  const systemPrompt = personaPrompt || defaultSystemPrompt;

  const userPrompt = `Tweet by @${username}: "${tweetText.substring(0, 500)}"

Reply:`;

  try {
    const response = await fetchWithTimeout(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 100,
          temperature: 0.8,
        }),
      },
      15000
    );

    if (!response.ok) {
      console.error("AI API error:", response.status);
      return null;
    }

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content?.trim() || null;

    if (reply && reply.length > 280) {
      reply = reply.substring(0, 277) + "...";
    }

    return reply;
  } catch (e) {
    console.error("AI generation error:", e);
    return null;
  }
}

async function postReply(
  tweetId: string,
  replyText: string,
  apiKey: string,
  loginCookies: string,
  proxy: string
): Promise<{ success: boolean; replyId?: string; error?: string; rawResponse?: string }> {
  try {
    console.log(`[postReply] Posting reply to tweet ${tweetId}`);
    console.log(`[postReply] Using proxy: ${proxy ? "yes" : "no"}`);
    console.log(`[postReply] loginCookies length: ${loginCookies.length}`);

    const response = await fetchWithTimeout(
      `${TWITTERAPI_BASE}/twitter/create_tweet_v2`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          tweet_text: replyText,
          reply_to_tweet_id: tweetId,
          login_cookies: loginCookies,
          proxy,
        }),
      },
      20000
    );

    const rawText = await response.text();
    console.log(`[postReply] HTTP Status: ${response.status}`);
    console.log(`[postReply] Raw response (first 500 chars): ${rawText.substring(0, 500)}`);
    
    const data = (() => { try { return JSON.parse(rawText); } catch { return null; } })();

    if (!response.ok) {
      const apiMsg = (data && (data.message || data.error || data.msg)) || rawText?.slice(0, 300) || null;
      return { success: false, error: apiMsg || `HTTP ${response.status}`, rawResponse: rawText.substring(0, 500) };
    }

    if (isTwitterApiErrorPayload(data)) {
      const errorMsg = data?.message || data?.error || data?.msg || "API returned error payload with HTTP 200";
      return { success: false, error: errorMsg, rawResponse: rawText.substring(0, 500) };
    }

    const replyId = extractReplyId(data);
    if (!replyId) {
      return { success: false, error: "No reply ID returned", rawResponse: rawText.substring(0, 500) };
    }

    console.log(`[postReply] SUCCESS - Reply posted with ID: ${replyId}`);
    return { success: true, replyId, rawResponse: rawText.substring(0, 500) };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: errorMsg };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const debug = {
    accountsProcessed: 0,
    repliesSent: 0,
    skipped: 0,
    errors: [] as string[],
  };

  let supabase: SupabaseClient | null = null;

  try {
    const ENABLE_PROMO_MENTIONS = Deno.env.get("ENABLE_PROMO_MENTIONS");
    const ENABLE_X_POSTING = Deno.env.get("ENABLE_X_POSTING");

    if (ENABLE_X_POSTING !== "true" || ENABLE_PROMO_MENTIONS !== "true") {
      return new Response(JSON.stringify({ ok: true, reason: "Kill switch disabled", debug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TWITTERAPI_IO_KEY = Deno.env.get("TWITTERAPI_IO_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!TWITTERAPI_IO_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Missing API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get login credentials from env
    const xEmail = Deno.env.get("X_ACCOUNT_EMAIL");
    const xPassword = Deno.env.get("X_ACCOUNT_PASSWORD");
    const xTotpSecret = normalizeTotpSecret(Deno.env.get("X_TOTP_SECRET"));
    const envProxy = Deno.env.get("TWITTER_PROXY");

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Acquire lock
    const lockName = "x-bot-reply";
    await supabase.from("cron_locks").upsert({
      lock_name: lockName,
      acquired_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 55000).toISOString(),
    }, { onConflict: "lock_name" });

    // Get all active accounts
    const { data: accounts, error: accountsError } = await supabase
      .from("x_bot_accounts")
      .select(`
        id,
        username,
        proxy_url,
        socks5_urls,
        current_socks5_index,
        x_bot_account_rules (
          author_cooldown_hours,
          max_replies_per_thread,
          enabled,
          persona_prompt
        )
      `)
      .eq("is_active", true);

    if (accountsError) {
      debug.errors.push(`Accounts fetch error: ${accountsError.message}`);
      throw accountsError;
    }

    for (const account of accounts || []) {
      const rules = (account as any).x_bot_account_rules?.[0];
      if (!rules?.enabled) continue;

      debug.accountsProcessed++;

      // Get proxy - prefer socks5_urls with rotation, then proxy_url, then env
      let proxyUrl = account.proxy_url || envProxy || "";
      const socks5Urls = (account as any).socks5_urls || [];
      if (socks5Urls.length > 0) {
        const currentIndex = (account as any).current_socks5_index || 0;
        proxyUrl = socks5Urls[currentIndex % socks5Urls.length];
        await supabase
          .from("x_bot_accounts")
          .update({ current_socks5_index: (currentIndex + 1) % socks5Urls.length })
          .eq("id", account.id);
      }

      if (!proxyUrl) {
        debug.errors.push(`Account ${account.username}: No proxy configured`);
        await insertLog(supabase, account.id, "error", "error", `No proxy configured for @${account.username}`);
        continue;
      }

      if (!xEmail || !xPassword) {
        debug.errors.push(`Account ${account.username}: No X login credentials in env`);
        await insertLog(supabase, account.id, "error", "error", `Missing X_ACCOUNT_EMAIL or X_ACCOUNT_PASSWORD env vars`);
        continue;
      }

      // Login via twitterapi.io to get a fresh login_cookie
      const loginResult = await loginViaApi(TWITTERAPI_IO_KEY, xEmail, xPassword, proxyUrl, account.username, xTotpSecret);
      
      if (!loginResult.loginCookie) {
        debug.errors.push(`Account ${account.username}: Login failed: ${loginResult.error}`);
        await insertLog(supabase, account.id, "error", "error", `Login failed: ${loginResult.error}`, {
          proxy: proxyUrl.replace(/:[^:@]+@/, ':***@'),
        });
        continue;
      }

      console.log(`[x-bot-reply] Account ${account.username}: Login successful, got login_cookie`);

      // Get oldest pending tweet from queue
      const { data: queuedTweets, error: queueError } = await supabase
        .from("x_bot_account_queue")
        .select("*")
        .eq("account_id", account.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1);

      if (queueError) {
        debug.errors.push(`Queue error for ${account.username}: ${queueError.message}`);
        continue;
      }

      const queuedTweet = queuedTweets?.[0];
      if (!queuedTweet) {
        await insertLog(supabase, account.id, "reply", "info", `No pending tweets in queue for @${account.username}`);
        continue;
      }

      const author = queuedTweet.tweet_author || "user";

      await insertLog(supabase, account.id, "reply", "info", `Processing queued tweet by @${author}`, {
        tweetId: queuedTweet.tweet_id,
        matchType: queuedTweet.match_type,
      });

      // Mark as processing
      await supabase
        .from("x_bot_account_queue")
        .update({ status: "processing", processed_at: new Date().toISOString() })
        .eq("id", queuedTweet.id);

      // Author cooldown check
      const cooldownMinutes = rules.author_cooldown_minutes ?? 10;
      const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();
      
      if (queuedTweet.tweet_author_id && cooldownMinutes > 0) {
        const { count: recentReplies } = await supabase
          .from("x_bot_account_replies")
          .select("*", { count: "exact", head: true })
          .eq("account_id", account.id)
          .eq("tweet_author_id", queuedTweet.tweet_author_id)
          .gte("created_at", cooldownTime);

        if ((recentReplies || 0) > 0) {
          await supabase
            .from("x_bot_account_queue")
            .update({ status: "skipped" })
            .eq("id", queuedTweet.id);
          debug.skipped++;
          await insertLog(supabase, account.id, "skip", "warn", `Skipped @${author}: author cooldown active (${cooldownMinutes}m)`);
          continue;
        }
      }

      // Generate reply with persona prompt
      await insertLog(supabase, account.id, "reply", "info", `Generating AI reply for @${author}...`);
      
      const replyText = await generateReply(
        queuedTweet.tweet_text || "",
        queuedTweet.tweet_author || "user",
        rules.persona_prompt
      );

      if (!replyText) {
        debug.errors.push(`Failed to generate reply for ${account.username}`);
        await supabase.from("x_bot_account_queue").update({ status: "skipped" }).eq("id", queuedTweet.id);
        await insertLog(supabase, account.id, "error", "error", `Failed to generate reply for @${author}`);
        continue;
      }

      await insertLog(supabase, account.id, "reply", "info", `Generated reply (${replyText.length} chars)`);

      // Post reply using the login_cookie from API login
      const result = await postReply(
        queuedTweet.tweet_id,
        replyText,
        TWITTERAPI_IO_KEY,
        loginResult.loginCookie,
        proxyUrl
      );

      // Record in database
      await supabase.from("x_bot_account_replies").insert({
        account_id: account.id,
        tweet_id: queuedTweet.tweet_id,
        tweet_author: author,
        tweet_author_id: queuedTweet.tweet_author_id || null,
        tweet_text: queuedTweet.tweet_text,
        conversation_id: queuedTweet.conversation_id || queuedTweet.tweet_id,
        reply_id: result.replyId || null,
        reply_text: replyText,
        reply_type: "initial",
        status: result.success ? "success" : "failed",
        error_message: result.error || null,
      });

      // Update queue status
      await supabase
        .from("x_bot_account_queue")
        .update({ status: result.success ? "completed" : "failed" })
        .eq("id", queuedTweet.id);

      if (result.success) {
        debug.repliesSent++;
        await insertLog(supabase, account.id, "reply", "info", `Reply posted successfully to @${author}`, {
          tweetId: queuedTweet.tweet_id,
          replyId: result.replyId,
          replyPreview: replyText.substring(0, 80),
        });
      } else {
        debug.errors.push(`Reply failed for ${account.username}: ${result.error}`);
        await insertLog(supabase, account.id, "error", "error", `Reply failed: ${result.error}`, {
          tweetId: queuedTweet.tweet_id,
          error: result.error,
          rawResponse: result.rawResponse,
        });
      }
    }

    // Release lock
    await supabase.from("cron_locks").delete().eq("lock_name", lockName);

    return new Response(JSON.stringify({ ok: true, debug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    debug.errors.push(e instanceof Error ? e.message : "Unknown error");
    return new Response(JSON.stringify({ ok: false, debug }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
