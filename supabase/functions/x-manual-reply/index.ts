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
      }),
    );
  }

  return null;
}

const safeJsonParse = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const extractCreatedTweetId = (payload: any): string | null => {
  return payload?.tweet_id || payload?.data?.id || payload?.id || null;
};

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
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0Token = Deno.env.get("X_CT0_TOKEN") || Deno.env.get("X_CT0");
    const loginCookies = buildLoginCookiesBase64FromEnv({
      xFullCookie,
      xAuthToken,
      xCt0Token,
    });

    if (!apiKey || !proxyUrl || !loginCookies) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing credentials",
          has_api_key: !!apiKey,
          has_proxy: !!proxyUrl,
          has_login_cookies: !!loginCookies,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const res = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login_cookies: loginCookies,
        tweet_text: String(text).slice(0, 280),
        reply_to_tweet_id: String(tweet_id),
        proxy: proxyUrl,
      }),
    });

    const responseText = await res.text();
    const json = safeJsonParse(responseText);
    const createdTweetId = extractCreatedTweetId(json);

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `HTTP ${res.status}`,
          details: (json ?? responseText)?.toString?.() ?? responseText,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        tweet_id,
        created_tweet_id: createdTweetId,
        response: json ?? responseText,
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
