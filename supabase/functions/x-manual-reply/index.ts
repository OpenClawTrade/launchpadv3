const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

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

// buildLoginCookiesBase64FromEnv, safeJsonParse, extractCreatedTweetId removed
// - using launcher's direct parseCookieString + btoa pattern

async function requireAdmin(req: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return { ok: false, status: 401, error: "Missing Authorization" };

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return { ok: false, status: 500, error: "Backend not configured" };

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.3");
  const supabase = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    return { ok: false, status: 401, error: "Invalid session" };
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });

  if (roleError) return { ok: false, status: 500, error: "Role check failed" };
  if (isAdmin !== true) return { ok: false, status: 403, error: "Admin required" };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {

    // Emergency kill-switch: disable ALL X posting/replying unless explicitly enabled.
    // Default behavior: OFF.
    if (Deno.env.get("ENABLE_X_POSTING") !== "true") {
      return new Response(JSON.stringify({ success: false, error: "X posting is currently disabled" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = await requireAdmin(req);
    if (!admin.ok) {
      return new Response(JSON.stringify({ success: false, error: admin.error }), {
        status: admin.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tweet_id, text } = await req.json();
    if (!tweet_id || !text) {
      return new Response(JSON.stringify({ success: false, error: "tweet_id and text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const proxyUrl = Deno.env.get("TWITTER_PROXY");
    const xFullCookie = Deno.env.get("X_FULL_COOKIE");

    if (!apiKey || !xFullCookie) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing credentials",
          has_api_key: !!apiKey,
          has_cookie: !!xFullCookie,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Use the exact same cookie handling as the working twitter-mention-launcher
    const loginCookies = parseCookieString(xFullCookie);
    const loginCookiesB64 = btoa(JSON.stringify(loginCookies));

    const body: any = {
      tweet_text: String(text).slice(0, 280),
      reply_to_tweet_id: String(tweet_id),
      login_cookies: loginCookiesB64,
    };

    if (proxyUrl) {
      body.proxy = proxyUrl;
    }

    const res = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await res.text();
    let json: any;
    try {
      json = JSON.parse(responseText);
    } catch {
      json = { raw: responseText };
    }

    // Check both HTTP status AND result.status === "error" (API returns 200 on some failures)
    if (!res.ok || json.status === "error") {
      return new Response(
        JSON.stringify({
          success: false,
          error: json?.message || json?.error || `HTTP ${res.status}`,
          details: responseText.slice(0, 500),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const createdTweetId = json?.tweet_id || json?.data?.id;

    return new Response(
      JSON.stringify({
        success: true,
        tweet_id,
        created_tweet_id: createdTweetId,
        response: json,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
