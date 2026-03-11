import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "TWITTERAPI_IO_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get all active KOLs missing cached avatars
  const { data: kols, error: kolErr } = await supabase
    .from("kol_accounts")
    .select("id, username, profile_image_url, cached_avatar_url")
    .eq("is_active", true)
    .is("cached_avatar_url", null);

  if (kolErr) {
    return new Response(JSON.stringify({ error: kolErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = { total: kols?.length || 0, cached: 0, failed: 0, errors: [] as string[] };

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < (kols || []).length; i += batchSize) {
    const batch = kols!.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (kol) => {
      try {
        // Step 1: Get profile image URL from Twitter API if we don't have one
        let imgUrl = kol.profile_image_url;
        
        if (!imgUrl) {
          const twitterRes = await fetch(
            `https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(kol.username)}`,
            { headers: { "x-api-key": apiKey } }
          );
          
          if (!twitterRes.ok) {
            results.failed++;
            results.errors.push(`@${kol.username}: HTTP ${twitterRes.status}`);
            return;
          }
          
          const userData = await twitterRes.json();
          const user = userData?.data || userData;
          imgUrl = user?.profilePicture || user?.avatar || user?.profile_image_url_https;
          
          if (!imgUrl) {
            results.failed++;
            results.errors.push(`@${kol.username}: no avatar in API response`);
            return;
          }
        }

        // Use mini size (24x24) for fastest loading
        const miniUrl = imgUrl.replace(/_normal\./, "_mini.").replace(/_bigger\./, "_mini.");
        
        // Step 2: Download and cache in storage
        const avatarResp = await fetch(miniUrl);
        if (!avatarResp.ok) {
          // Try original URL if mini fails
          const fallbackResp = await fetch(imgUrl);
          if (!fallbackResp.ok) {
            results.failed++;
            results.errors.push(`@${kol.username}: avatar download failed`);
            return;
          }
          var blob = await fallbackResp.blob();
        } else {
          var blob = await avatarResp.blob();
        }

        const ext = imgUrl.includes(".png") ? "png" : "jpg";
        const path = `${kol.username}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("kol-avatars")
          .upload(path, blob, {
            contentType: blob.type || `image/${ext}`,
            upsert: true,
          });

        if (uploadErr) {
          results.failed++;
          results.errors.push(`@${kol.username}: upload error: ${uploadErr.message}`);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("kol-avatars")
          .getPublicUrl(path);

        if (!urlData?.publicUrl) {
          results.failed++;
          results.errors.push(`@${kol.username}: no public URL`);
          return;
        }

        // Step 3: Update kol_accounts with cached URL and profile_image_url
        await supabase
          .from("kol_accounts")
          .update({
            cached_avatar_url: urlData.publicUrl,
            profile_image_url: miniUrl,
          })
          .eq("id", kol.id);

        // Step 4: Backfill existing tweets for this KOL
        await supabase
          .from("kol_contract_tweets")
          .update({ kol_profile_image: urlData.publicUrl })
          .eq("kol_username", kol.username)
          .is("kol_profile_image", null);

        results.cached++;
        console.log(`[cache-kol-avatars] ✓ @${kol.username}`);
      } catch (e) {
        results.failed++;
        results.errors.push(`@${kol.username}: ${e.message}`);
      }
    }));

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < (kols || []).length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`[cache-kol-avatars] Done: ${results.cached}/${results.total} cached, ${results.failed} failed`);

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
