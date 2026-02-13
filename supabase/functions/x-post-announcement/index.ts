import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

const stripQuotes = (v: string) => v.replace(/^['"]+|['"]+$/g, "").trim();

function parseCookieString(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    const val = rest.join("=");
    if (val) out[k.trim()] = stripQuotes(val);
  }
  return out;
}

function buildLoginCookies(args: { xFullCookie?: string | null; xAuthToken?: string | null; xCt0Token?: string | null }): string | null {
  if (args.xFullCookie) {
    const cookies = parseCookieString(args.xFullCookie);
    if (Object.keys(cookies).length === 0) return null;
    return btoa(JSON.stringify(cookies));
  }
  if (args.xAuthToken && args.xCt0Token) {
    return btoa(JSON.stringify({ auth_token: stripQuotes(args.xAuthToken), ct0: stripQuotes(args.xCt0Token) }));
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });

  try {
    const { tweet_text } = await req.json();
    if (!tweet_text) throw new Error("tweet_text required");

    const loginCookies = buildLoginCookies({
      xFullCookie: Deno.env.get("X_FULL_COOKIE"),
      xAuthToken: Deno.env.get("X_AUTH_TOKEN"),
      xCt0Token: Deno.env.get("X_CT0_TOKEN") || Deno.env.get("X_CT0"),
    });

    if (!loginCookies) throw new Error("Missing X cookies");

    const res = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
      method: "POST",
      headers: { "X-API-Key": Deno.env.get("TWITTERAPI_IO_KEY")!, "Content-Type": "application/json" },
      body: JSON.stringify({
        login_cookies: loginCookies,
        tweet_text: tweet_text,
        proxy: Deno.env.get("TWITTER_PROXY")!,
      }),
    });

    const responseText = await res.text();
    console.log("[x-post-announcement] Response:", responseText.slice(0, 500));

    return new Response(responseText, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
