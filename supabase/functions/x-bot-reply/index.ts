import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";


const stripQuotes = (v: string) => v.replace(/^['"]+|['"]+$/g, "").trim();

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

const parseCookieString = (raw: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const parts = raw.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    const val = rest.join("=");
    if (val) out[k.trim()] = stripQuotes(val);
  }
  return out;
};

// Build login cookies base64 from various formats
const buildLoginCookiesBase64 = (args: {
  fullCookie?: string | null;
  authToken?: string | null;
  ct0Token?: string | null;
}): string | null => {
  const { fullCookie, authToken, ct0Token } = args;

  // Priority 1: Full cookie header from browser
  if (fullCookie && fullCookie.trim()) {
    const cookies = parseCookieString(fullCookie.trim());
    if (cookies.auth_token && cookies.ct0) {
      console.log(`[buildLoginCookiesBase64] Using full_cookie - found auth_token and ct0`);
      return btoa(JSON.stringify(cookies));
    }
    console.log(`[buildLoginCookiesBase64] full_cookie parsed but missing auth_token or ct0`);
  }

  // Priority 2: Individual tokens
  if (authToken && ct0Token) {
    const authVal = stripQuotes(authToken.trim());
    const ct0Val = stripQuotes(ct0Token.trim());
    if (authVal && ct0Val) {
      console.log(`[buildLoginCookiesBase64] Using individual tokens (auth_token length: ${authVal.length}, ct0 length: ${ct0Val.length})`);
      return btoa(JSON.stringify({ auth_token: authVal, ct0: ct0Val }));
    }
  }

  console.log(`[buildLoginCookiesBase64] No valid cookies found`);
  return null;
};

interface AccountWithCredentials {
  id: string;
  username: string;
  full_cookie_encrypted: string | null;
  auth_token_encrypted: string | null;
  ct0_token_encrypted: string | null;
  proxy_url: string | null;
  rules: {
    author_cooldown_hours: number;
    max_replies_per_thread: number;
  } | null;
}

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

async function generateReply(
  tweetText: string,
  username: string
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return null;
  }

  const systemPrompt = `You're a knowledgeable crypto native with genuine opinions. Generate a reply (max 240 chars) to this tweet.

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

    // Trim if too long
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
  loginCookiesBase64: string,
  proxy: string
): Promise<{ success: boolean; replyId?: string; error?: string; rawResponse?: string }> {
  try {
    console.log(`[postReply] Posting reply to tweet ${tweetId}`);
    console.log(`[postReply] Using proxy: ${proxy ? "yes" : "no"}`);
    console.log(`[postReply] loginCookiesBase64 length: ${loginCookiesBase64.length}`);

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
          login_cookies: loginCookiesBase64,
          ...(proxy && { proxy }),
        }),
      },
      20000
    );

    const rawText = await response.text();
    console.log(`[postReply] HTTP Status: ${response.status}`);
    console.log(`[postReply] Raw response (first 500 chars): ${rawText.substring(0, 500)}`);
    
    const data = (() => {
      try {
        return JSON.parse(rawText);
      } catch {
        console.log(`[postReply] Failed to parse response as JSON`);
        return null;
      }
    })();

    // Check HTTP status first
    if (!response.ok) {
      const apiMsg =
        (data && (data.message || data.error || data.msg)) ||
        (rawText ? rawText.slice(0, 300) : null);
      console.log(`[postReply] HTTP error: ${apiMsg || response.status}`);
      return { success: false, error: apiMsg || `HTTP ${response.status}`, rawResponse: rawText.substring(0, 500) };
    }

    // Check for error payloads that come with HTTP 200
    if (isTwitterApiErrorPayload(data)) {
      const errorMsg = data?.message || data?.error || data?.msg || "API returned error payload with HTTP 200";
      console.log(`[postReply] Error payload detected: ${errorMsg}`);
      return { success: false, error: errorMsg, rawResponse: rawText.substring(0, 500) };
    }

    // Extract reply ID using comprehensive helper
    const replyId = extractReplyId(data);
    console.log(`[postReply] Extracted replyId: ${replyId || "NULL"}`);
    
    // Only return success if we have a valid reply ID
    if (!replyId) {
      console.log(`[postReply] No reply ID found in response - treating as failure`);
      return { 
        success: false, 
        error: "No reply ID returned - tweet may not have been created", 
        rawResponse: rawText.substring(0, 500) 
      };
    }

    console.log(`[postReply] SUCCESS - Reply posted with ID: ${replyId}`);
    return { success: true, replyId, rawResponse: rawText.substring(0, 500) };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    console.log(`[postReply] Exception: ${errorMsg}`);
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

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Acquire lock
    const lockName = "x-bot-reply";
    await supabase.from("cron_locks").upsert({
      lock_name: lockName,
      acquired_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 55000).toISOString(),
    }, { onConflict: "lock_name" });

    // Get all active accounts with credentials
    const { data: accounts, error: accountsError } = await supabase
      .from("x_bot_accounts")
      .select(`
        id,
        username,
        full_cookie_encrypted,
        auth_token_encrypted,
        ct0_token_encrypted,
        proxy_url,
        socks5_urls,
        current_socks5_index,
        x_bot_account_rules (
          author_cooldown_hours,
          max_replies_per_thread,
          enabled
        )
      `)
      .eq("is_active", true);

    if (accountsError) {
      debug.errors.push(`Accounts fetch error: ${accountsError.message}`);
      throw accountsError;
    }

    // Process one tweet per account per run (to avoid rate limits)
    for (const account of accounts || []) {
      const rules = (account as any).x_bot_account_rules?.[0];
      if (!rules?.enabled) continue;

      // Build login cookies using the proper base64 format
      const loginCookies = buildLoginCookiesBase64({
        fullCookie: account.full_cookie_encrypted,
        authToken: account.auth_token_encrypted,
        ct0Token: account.ct0_token_encrypted,
      });

      if (!loginCookies) {
        debug.errors.push(`Account ${account.username}: No valid cookies`);
        await insertLog(supabase, account.id, "error", "error", `No valid cookies configured for @${account.username}. Check that full_cookie or auth_token+ct0 are properly set.`, {
          hasFullCookie: !!account.full_cookie_encrypted,
          hasAuthToken: !!account.auth_token_encrypted,
          hasCt0Token: !!account.ct0_token_encrypted,
        });
        continue;
      }

      console.log(`[x-bot-reply] Account ${account.username}: loginCookies built successfully`);

      debug.accountsProcessed++;

      // Get oldest pending tweet from queue for this account
      const { data: queuedTweets, error: queueError } = await supabase
        .from("x_bot_account_queue")
        .select("*")
        .eq("account_id", account.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1);

      if (queueError) {
        debug.errors.push(`Queue error for ${account.username}: ${queueError.message}`);
        await insertLog(supabase, account.id, "error", "error", `Queue fetch error: ${queueError.message}`);
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

      // Author cooldown check (in minutes)
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
          await insertLog(supabase, account.id, "skip", "warn", `Skipped @${author}: author cooldown active (${cooldownMinutes}m)`, {
            tweetId: queuedTweet.tweet_id,
            cooldownMinutes,
          });
          continue;
        }
      }

      // Generate reply
      await insertLog(supabase, account.id, "reply", "info", `Generating AI reply for @${author}...`);
      
      const username = queuedTweet.tweet_author || "user";
      const replyText = await generateReply(queuedTweet.tweet_text || "", username);

      if (!replyText) {
        debug.errors.push(`Failed to generate reply for ${account.username}`);
        await supabase
          .from("x_bot_account_queue")
          .update({ status: "skipped" })
          .eq("id", queuedTweet.id);
        await insertLog(supabase, account.id, "error", "error", `Failed to generate reply for @${author}`, {
          tweetId: queuedTweet.tweet_id,
        });
        continue;
      }

      await insertLog(supabase, account.id, "reply", "info", `Generated reply (${replyText.length} chars)`, {
        tweetId: queuedTweet.tweet_id,
        replyLength: replyText.length,
      });

      // Get proxy - prefer socks5_urls with rotation, then proxy_url
      let proxyUrl = account.proxy_url || "";
      const socks5Urls = (account as any).socks5_urls || [];
      if (socks5Urls.length > 0) {
        const currentIndex = (account as any).current_socks5_index || 0;
        proxyUrl = socks5Urls[currentIndex % socks5Urls.length];
        
        // Rotate to next proxy for next run
        await supabase
          .from("x_bot_accounts")
          .update({ current_socks5_index: (currentIndex + 1) % socks5Urls.length })
          .eq("id", account.id);
      }

      // Post reply
      const result = await postReply(
        queuedTweet.tweet_id,
        replyText,
        TWITTERAPI_IO_KEY,
        loginCookies,
        proxyUrl
      );

      // Record in database
      await supabase.from("x_bot_account_replies").insert({
        account_id: account.id,
        tweet_id: queuedTweet.tweet_id,
        tweet_author: username,
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
