import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";
const REPLY_SIGNATURE = "Tuna Launchpad for AI Agents on Solana.";

const stripQuotes = (v: string) => v.replace(/^['"]+|['"]+$/g, "").trim();

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

const buildLoginCookiesBase64 = (cookie: string): string | null => {
  if (!cookie) return null;
  
  const cookies = parseCookieString(cookie.trim());
  if (cookies.auth_token && cookies.ct0) {
    return btoa(JSON.stringify(cookies));
  }
  
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

  const systemPrompt = `You are a friendly crypto community member. Generate a short, conversational reply (max 200 chars before signature) to this tweet. Be relevant and add value. Do NOT be promotional or spammy. Sound human and authentic.`;

  const userPrompt = `Tweet by @${username}: "${tweetText.substring(0, 500)}"

End your reply with exactly: "${REPLY_SIGNATURE}"

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

    // Ensure signature is present
    if (reply && !reply.includes(REPLY_SIGNATURE)) {
      reply = reply.substring(0, 230) + " " + REPLY_SIGNATURE;
    }

    // Trim if too long
    if (reply && reply.length > 280) {
      const sigIndex = reply.lastIndexOf(REPLY_SIGNATURE);
      if (sigIndex > 0) {
        reply = reply.substring(0, 280 - REPLY_SIGNATURE.length - 1) + " " + REPLY_SIGNATURE;
      }
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
  cookie: string,
  proxy: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    const loginCookies = buildLoginCookiesBase64(cookie) ?? btoa(cookie);

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
          ...(proxy && { proxy }),
        }),
      },
      20000
    );

    const rawText = await response.text();
    const data = (() => {
      try {
        return JSON.parse(rawText);
      } catch {
        return null;
      }
    })();

    if (!response.ok) {
      const apiMsg =
        (data && (data.message || data.error || data.msg)) ||
        (rawText ? rawText.slice(0, 300) : null);
      return { success: false, error: apiMsg || `HTTP ${response.status}` };
    }

    const replyId = data?.data?.tweet?.rest_id || data?.tweet_id || data?.id;
    return { success: true, replyId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
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

      // Get cookie - prefer full_cookie, then construct from tokens
      let cookie = account.full_cookie_encrypted || "";
      if (!cookie && account.auth_token_encrypted && account.ct0_token_encrypted) {
        cookie = `auth_token=${account.auth_token_encrypted}; ct0=${account.ct0_token_encrypted}`;
      }

      if (!cookie) {
        debug.errors.push(`Account ${account.username}: No valid cookies`);
        await insertLog(supabase, account.id, "error", "error", `No valid cookies configured for @${account.username}`);
        continue;
      }

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

      // Author cooldown check
      const cooldownHours = rules.author_cooldown_hours || 6;
      const cooldownTime = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
      
      if (queuedTweet.tweet_author_id) {
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
          await insertLog(supabase, account.id, "skip", "warn", `Skipped @${author}: author cooldown active (${cooldownHours}h)`, {
            tweetId: queuedTweet.tweet_id,
            cooldownHours,
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
        cookie,
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
