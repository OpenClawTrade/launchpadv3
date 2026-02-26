import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CACHE_TTL_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();
    if (!username) {
      return new Response(JSON.stringify({ error: 'username required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanUsername = username.replace(/^@/, '').trim();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Check cache first
    const { data: cached } = await supabase
      .from('twitter_profile_cache')
      .select('*')
      .eq('username', cleanUsername.toLowerCase())
      .maybeSingle();

    if (cached) {
      const updatedAt = new Date(cached.updated_at).getTime();
      const now = Date.now();
      const ttl = CACHE_TTL_HOURS * 60 * 60 * 1000;
      if (now - updatedAt < ttl) {
        return new Response(JSON.stringify({
          username: cleanUsername,
          profileImageUrl: cached.profile_image_url,
          verified: cached.verified,
          verifiedType: cached.verified_type,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch from twitterapi.io (same as other functions)
    const apiKey = Deno.env.get('TWITTERAPI_IO_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'TWITTERAPI_IO_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const twitterRes = await fetch(
      `https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(cleanUsername)}`,
      { headers: { 'X-API-Key': apiKey } },
    );

    if (!twitterRes.ok) {
      const errText = await twitterRes.text();
      console.error('twitterapi.io error:', twitterRes.status, errText);
      // Return cached data if available even if stale
      if (cached) {
        return new Response(JSON.stringify({
          username: cleanUsername,
          profileImageUrl: cached.profile_image_url,
          verified: cached.verified,
          verifiedType: cached.verified_type,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Twitter API error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const responseData = await twitterRes.json();
    const user = responseData?.data || responseData;

    if (!user || (!user.userName && !user.username)) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract profile data from twitterapi.io response format
    const profileImageUrl = (user.profilePicture || user.avatar || user.profile_image_url_https || '')
      .replace('_normal', '_200x200');
    const isBlue = user.isBlueVerified === true || user.is_blue_verified === true;
    const isGold = user.isGoldVerified === true || user.is_gold_verified === true;
    const verified = isBlue || isGold || user.isVerified === true || user.verified === true;
    let verifiedType: string | null = null;
    if (isGold) verifiedType = 'gold';
    else if (isBlue || verified) verifiedType = 'blue';

    // Update cache
    await supabase.from('twitter_profile_cache').upsert({
      username: cleanUsername.toLowerCase(),
      profile_image_url: profileImageUrl,
      verified,
      verified_type: verifiedType,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'username' });

    // Also update any fun_tokens that have this username in their twitter_url
    await supabase
      .from('fun_tokens')
      .update({
        twitter_avatar_url: profileImageUrl,
        twitter_verified: verified,
        twitter_verified_type: verifiedType || 'none',
      })
      .ilike('twitter_url', `%/${cleanUsername}/%`);

    return new Response(JSON.stringify({
      username: cleanUsername,
      profileImageUrl,
      verified,
      verifiedType,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
