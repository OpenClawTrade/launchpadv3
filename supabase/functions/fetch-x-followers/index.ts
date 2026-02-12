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
    const { username, resumeCursor } = await req.json();
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
    let cursor: string | null = resumeCursor || null;
    let totalFetched = 0;
    let blueCount = 0;
    let goldCount = 0;
    let unverifiedCount = 0;
    let pageNum = 0;
    const startTime = Date.now();
    const MAX_RUNTIME_MS = 45000; // 45 seconds max to avoid client timeout

    while (true) {
      // Check wall-clock time
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`Hit time limit after ${pageNum} pages, returning with resume cursor`);
        return new Response(
          JSON.stringify({
            success: true,
            partial: true,
            timedOut: true,
            resumeCursor: cursor,
            totalFetched,
            blueCount,
            goldCount,
            unverifiedCount,
            pagesScanned: pageNum,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      pageNum++;
      let url = `https://api.twitterapi.io/twitter/user/followers?userName=${targetUsername}&count=200`;
      if (cursor) {
        url += `&cursor=${cursor}`;
      }

      console.log(`Fetching page ${pageNum}, cursor: ${cursor ? cursor.substring(0, 20) + "..." : "none"}`);

      const response = await fetch(url, {
        headers: { "X-API-Key": apiKey },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error on page ${pageNum}: ${response.status} ${errorText}`);
        // Save progress so far and return partial results
        return new Response(
          JSON.stringify({
            success: true,
            partial: true,
            error: `API error on page ${pageNum}: ${response.status}`,
            totalFetched,
            blueCount,
            goldCount,
            unverifiedCount,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const followers = data.followers || data.users || [];

      if (!followers.length) {
        console.log(`No more followers on page ${pageNum}, stopping.`);
        break;
      }

      // Map and categorize followers
      const records = followers.map((f: any) => {
        let verificationType = "unverified";
        const isBlue = f.isBlueVerified === true;
        const isGold = f.isGoldVerified === true;

        if (isGold) {
          verificationType = "gold";
          goldCount++;
        } else if (isBlue) {
          verificationType = "blue";
          blueCount++;
        } else {
          unverifiedCount++;
        }

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
          is_blue_verified: isBlue,
          is_gold_verified: isGold,
          location: f.location || "",
          created_at_twitter: f.createdAt || f.created_at || null,
          scanned_at: new Date().toISOString(),
        };
      });

      totalFetched += records.length;

      // Upsert in batches of 100
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error: upsertError } = await supabase
          .from("x_follower_scans")
          .upsert(batch, { onConflict: "target_username,twitter_user_id" });

        if (upsertError) {
          console.error(`Upsert error on page ${pageNum}, batch ${i}:`, upsertError);
        }
      }

      console.log(`Page ${pageNum}: fetched ${records.length}, total: ${totalFetched}`);

      // Check for next page
      const hasNextPage = data.has_next_page === true || data.hasNextPage === true;
      const nextCursor = data.next_cursor || data.cursor || null;

      if (!hasNextPage || !nextCursor) {
        console.log("No more pages, scan complete.");
        break;
      }

      cursor = nextCursor;

      // Delay between pages to avoid throttling
      await new Promise((r) => setTimeout(r, 200));
    }

    return new Response(
      JSON.stringify({
        success: true,
        partial: false,
        totalFetched,
        blueCount,
        goldCount,
        unverifiedCount,
        pagesScanned: pageNum,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
