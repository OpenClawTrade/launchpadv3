import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, resumeCursor, mode } = await req.json();
    if (!username) {
      return new Response(JSON.stringify({ error: "username is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TWITTERAPI_IO_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const targetUsername = username.replace("@", "").toLowerCase();

    if (mode === "verified") {
      return await fetchVerifiedFollowers(targetUsername, apiKey, supabase, resumeCursor);
    }

    return await fetchAllFollowers(targetUsername, apiKey, supabase, resumeCursor);
  } catch (error) {
    console.error("fetch-x-followers error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/** Safely fetch + parse JSON from a response, handling connection drops */
async function safeReadJson(response: Response, pageNum: number): Promise<any | null> {
  let text: string;
  try {
    text = await response.text();
  } catch (readErr) {
    console.error(`Body read error on page ${pageNum}:`, readErr);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (parseErr) {
    console.error(`JSON parse error on page ${pageNum}, body length=${text.length}`);
    // Try to recover truncated JSON array
    const lastBrace = text.lastIndexOf("}");
    if (lastBrace > 0) {
      try {
        const repaired = text.substring(0, lastBrace + 1) + "]";
        const obj = JSON.parse(repaired);
        console.log(`Recovered truncated JSON on page ${pageNum}`);
        return obj;
      } catch { /* fall through */ }
    }
    return null;
  }
}

function mapFollowerRecord(f: any, targetUsername: string) {
  const isBlue = f.isBlueVerified === true || f.is_blue_verified === true || f.blue_verified === true;
  const isGold = f.isGoldVerified === true || f.is_gold_verified === true;
  const isVerifiedGeneric = f.isVerified === true || f.verified === true;

  let verificationType = "unverified";
  if (isGold) verificationType = "gold";
  else if (isBlue) verificationType = "blue";
  else if (isVerifiedGeneric) verificationType = "blue";

  return {
    target_username: targetUsername,
    twitter_user_id: f.id || f.userId || f.rest_id || String(f.id_str || ""),
    username: f.userName || f.username || f.screen_name || "",
    display_name: f.name || f.displayName || "",
    profile_picture: f.profilePicture || f.avatar || f.profile_image_url_https || "",
    description: f.description || f.bio || "",
    follower_count: parseInt(f.followers || f.followersCount || f.followers_count || "0") || 0,
    following_count: parseInt(f.following || f.followingCount || f.friends_count || "0") || 0,
    statuses_count: parseInt(f.statusesCount || f.statuses_count || f.tweets || "0") || 0,
    verification_type: verificationType,
    is_blue_verified: isBlue || isVerifiedGeneric,
    is_gold_verified: isGold,
    location: f.location || "",
    created_at_twitter: f.createdAt || f.created_at || null,
    scanned_at: new Date().toISOString(),
  };
}

async function upsertBatch(supabase: any, records: any[], pageNum: number) {
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    const { error: upsertError } = await supabase
      .from("x_follower_scans")
      .upsert(batch, { onConflict: "target_username,twitter_user_id" });
    if (upsertError) {
      console.error(`Upsert error on page ${pageNum}, batch ${i}:`, upsertError);
    }
  }
}

async function fetchAllFollowers(
  targetUsername: string,
  apiKey: string,
  supabase: any,
  resumeCursor: string | null
) {
  let cursor: string | null = resumeCursor || null;
  let totalFetched = 0;
  let pageNum = 0;
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 45000;

  while (true) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log(`Hit time limit after ${pageNum} pages, returning with resume cursor`);
      return new Response(
        JSON.stringify({ success: true, partial: true, timedOut: true, resumeCursor: cursor, totalFetched, pagesScanned: pageNum }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    pageNum++;
    let url = `https://api.twitterapi.io/twitter/user/followers?userName=${targetUsername}&count=200`;
    if (cursor) url += `&cursor=${cursor}`;

    console.log(`Fetching page ${pageNum}, cursor: ${cursor ? cursor.substring(0, 20) + "..." : "none"}`);

    let response: Response;
    try {
      response = await fetch(url, { headers: { "X-API-Key": apiKey } });
    } catch (fetchErr) {
      console.error(`Network error on page ${pageNum}:`, fetchErr);
      return new Response(
        JSON.stringify({ success: true, partial: true, error: `Network error on page ${pageNum}`, totalFetched, resumeCursor: cursor, pagesScanned: pageNum }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unreadable");
      console.error(`API error on page ${pageNum}: ${response.status} ${errorText}`);
      return new Response(
        JSON.stringify({ success: true, partial: true, error: `API error on page ${pageNum}: ${response.status}`, totalFetched, resumeCursor: cursor, pagesScanned: pageNum }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await safeReadJson(response, pageNum);
    if (!data) {
      console.error(`Failed to read response on page ${pageNum}, returning partial`);
      return new Response(
        JSON.stringify({ success: true, partial: true, error: `Body read error on page ${pageNum}`, totalFetched, resumeCursor: cursor, pagesScanned: pageNum }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const followers = data.followers || data.users || [];
    if (!followers.length) {
      console.log(`No more followers on page ${pageNum}, stopping.`);
      break;
    }

    if (pageNum === 1 && followers.length > 0) {
      const sample = followers[0];
      console.log(`Sample keys: ${Object.keys(sample).join(", ")}`);
      console.log(`Sample verified: isBlueVerified=${sample.isBlueVerified}, verified=${sample.verified}`);
    }

    const records = followers.map((f: any) => mapFollowerRecord(f, targetUsername));
    totalFetched += records.length;
    await upsertBatch(supabase, records, pageNum);

    console.log(`Page ${pageNum}: fetched ${records.length}, total: ${totalFetched}`);

    const hasNextPage = data.has_next_page === true || data.hasNextPage === true;
    const nextCursor = data.next_cursor || data.cursor || null;
    if (!hasNextPage || !nextCursor) {
      console.log("No more pages, scan complete.");
      break;
    }

    cursor = nextCursor;
    await new Promise((r) => setTimeout(r, 200));
  }

  return new Response(
    JSON.stringify({ success: true, partial: false, totalFetched, pagesScanned: pageNum }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function resolveUserId(username: string, apiKey: string): Promise<string | null> {
  try {
    const url = `https://api.twitterapi.io/twitter/user/info?userName=${username}`;
    const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
    if (!res.ok) {
      console.error(`Failed to resolve userId for ${username}: ${res.status}`);
      await res.text().catch(() => {});
      return null;
    }
    const data = await res.json();
    const userId = data?.data?.id || data?.id || null;
    console.log(`Resolved ${username} -> userId: ${userId}`);
    return userId;
  } catch (err) {
    console.error(`Error resolving userId:`, err);
    return null;
  }
}

async function fetchVerifiedFollowers(
  targetUsername: string,
  apiKey: string,
  supabase: any,
  resumeCursor: string | null
) {
  // The verifiedFollowers endpoint requires user_id, not userName
  const userId = await resolveUserId(targetUsername, apiKey);
  if (!userId) {
    return new Response(
      JSON.stringify({ error: `Could not resolve user_id for @${targetUsername}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let cursor: string | null = resumeCursor || null;
  let totalFetched = 0;
  let blueCount = 0;
  let goldCount = 0;
  let pageNum = 0;
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 45000;

  while (true) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      return new Response(
        JSON.stringify({ success: true, partial: true, timedOut: true, resumeCursor: cursor, totalFetched, blueCount, goldCount, pagesScanned: pageNum, mode: "verified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    pageNum++;
    let url = `https://api.twitterapi.io/twitter/user/verifiedFollowers?user_id=${userId}`;
    if (cursor) url += `&cursor=${cursor}`;

    console.log(`[verified] Fetching page ${pageNum}`);

    let response: Response;
    try {
      response = await fetch(url, { headers: { "X-API-Key": apiKey } });
    } catch (fetchErr) {
      console.error(`[verified] Network error page ${pageNum}:`, fetchErr);
      return new Response(
        JSON.stringify({ success: true, partial: true, error: `Network error on page ${pageNum}`, totalFetched, blueCount, goldCount, resumeCursor: cursor, pagesScanned: pageNum, mode: "verified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unreadable");
      console.error(`[verified] API error page ${pageNum}: ${response.status} ${errorText}`);
      return new Response(
        JSON.stringify({ success: true, partial: true, error: `API error on page ${pageNum}`, totalFetched, blueCount, goldCount, resumeCursor: cursor, pagesScanned: pageNum, mode: "verified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await safeReadJson(response, pageNum);
    if (!data) {
      return new Response(
        JSON.stringify({ success: true, partial: true, error: `Body read error on page ${pageNum}`, totalFetched, blueCount, goldCount, resumeCursor: cursor, pagesScanned: pageNum, mode: "verified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const followers = data.followers || [];
    if (!followers.length) {
      console.log(`[verified] No more on page ${pageNum}`);
      break;
    }

    if (pageNum === 1 && followers.length > 0) {
      console.log(`[verified] Sample keys: ${Object.keys(followers[0]).join(", ")}`);
    }

    const records = followers.map((f: any) => {
      const isGold = f.isGoldVerified === true || f.is_gold_verified === true;
      const verificationType = isGold ? "gold" : "blue";
      if (isGold) goldCount++;
      else blueCount++;

      return {
        target_username: targetUsername,
        twitter_user_id: f.id || f.userId || f.rest_id || "",
        username: f.userName || f.username || f.screen_name || "",
        display_name: f.name || f.displayName || "",
        profile_picture: f.profilePicture || f.avatar || f.profile_image_url_https || "",
        description: f.description || f.bio || "",
        follower_count: parseInt(f.followers || f.followersCount || f.followers_count || "0") || 0,
        following_count: parseInt(f.following || f.followingCount || f.friends_count || "0") || 0,
        statuses_count: parseInt(f.statusesCount || f.statuses_count || f.tweets || "0") || 0,
        verification_type: verificationType,
        is_blue_verified: !isGold,
        is_gold_verified: isGold,
        location: f.location || "",
        created_at_twitter: f.createdAt || f.created_at || null,
        scanned_at: new Date().toISOString(),
      };
    });

    totalFetched += records.length;
    await upsertBatch(supabase, records, pageNum);

    console.log(`[verified] Page ${pageNum}: ${records.length} verified, total: ${totalFetched}`);

    const hasNextPage = data.has_next_page === true || data.hasNextPage === true;
    const nextCursor = data.next_cursor || data.cursor || null;
    if (!hasNextPage || !nextCursor) break;
    cursor = nextCursor;
    await new Promise((r) => setTimeout(r, 200));
  }

  return new Response(
    JSON.stringify({ success: true, partial: false, totalFetched, blueCount, goldCount, pagesScanned: pageNum, mode: "verified" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
