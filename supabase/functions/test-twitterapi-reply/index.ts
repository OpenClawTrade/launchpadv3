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

    const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const proxyUrl = Deno.env.get("TWITTER_PROXY");
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0 = Deno.env.get("X_CT0_TOKEN");

    if (!twitterApiKey || !proxyUrl || !xAuthToken || !xCt0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing credentials",
          has_api_key: !!twitterApiKey,
          has_proxy: !!proxyUrl,
          has_auth_token: !!xAuthToken,
          has_ct0: !!xCt0,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const testText = `🐟 Test reply at ${new Date().toISOString().slice(11, 19)} UTC`;
    const results: Record<string, any> = {};

    // ===== METHOD 1: create_tweet with text field =====
    console.log("[test] METHOD 1: create_tweet with text field");
    const res1 = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": twitterApiKey,
      },
      body: JSON.stringify({
        text: testText + " [M1]",
        in_reply_to_tweet_id: tweet_id,
        auth_session: { auth_token: xAuthToken, ct0: xCt0 },
        proxy: proxyUrl,
      }),
    });
    const txt1 = await res1.text();
    console.log(`[test] M1: ${res1.status} - ${txt1}`);
    results.m1_text_field = { status: res1.status, response: safeJsonParse(txt1) || txt1 };

    // ===== METHOD 2: create_tweet with tweet_text field =====
    console.log("[test] METHOD 2: create_tweet with tweet_text field");
    const res2 = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": twitterApiKey,
      },
      body: JSON.stringify({
        tweet_text: testText + " [M2]",
        in_reply_to_tweet_id: tweet_id,
        auth_session: { auth_token: xAuthToken, ct0: xCt0 },
        proxy: proxyUrl,
      }),
    });
    const txt2 = await res2.text();
    console.log(`[test] M2: ${res2.status} - ${txt2}`);
    results.m2_tweet_text_field = { status: res2.status, response: safeJsonParse(txt2) || txt2 };

    // ===== METHOD 3: tweet/create endpoint =====
    console.log("[test] METHOD 3: tweet/create");
    const res3 = await fetch(`${TWITTERAPI_BASE}/twitter/tweet/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": twitterApiKey,
      },
      body: JSON.stringify({
        text: testText + " [M3]",
        in_reply_to_tweet_id: tweet_id,
        auth_session: { auth_token: xAuthToken, ct0: xCt0 },
        proxy: proxyUrl,
      }),
    });
    const txt3 = await res3.text();
    console.log(`[test] M3: ${res3.status} - ${txt3}`);
    results.m3_tweet_create = { status: res3.status, response: safeJsonParse(txt3) || txt3 };

    // ===== METHOD 4: post/tweet endpoint =====
    console.log("[test] METHOD 4: post/tweet");
    const res4 = await fetch(`${TWITTERAPI_BASE}/twitter/post/tweet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": twitterApiKey,
      },
      body: JSON.stringify({
        text: testText + " [M4]",
        in_reply_to_tweet_id: tweet_id,
        auth_session: { auth_token: xAuthToken, ct0: xCt0 },
        proxy: proxyUrl,
      }),
    });
    const txt4 = await res4.text();
    console.log(`[test] M4: ${res4.status} - ${txt4}`);
    results.m4_post_tweet = { status: res4.status, response: safeJsonParse(txt4) || txt4 };

    // ===== METHOD 5: standalone tweet (no reply) =====
    console.log("[test] METHOD 5: standalone tweet");
    const res5 = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": twitterApiKey,
      },
      body: JSON.stringify({
        text: `🐟 TUNA standalone ${Date.now().toString(36)}`,
        auth_session: { auth_token: xAuthToken, ct0: xCt0 },
        proxy: proxyUrl,
      }),
    });
    const txt5 = await res5.text();
    console.log(`[test] M5: ${res5.status} - ${txt5}`);
    results.m5_standalone = { status: res5.status, response: safeJsonParse(txt5) || txt5 };

    return new Response(
      JSON.stringify({ success: true, tweet_id, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[test] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
