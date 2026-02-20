import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Fetch from Twitter API
    const bearerToken = Deno.env.get('X_BEARER_TOKEN');
    if (!bearerToken) {
      return new Response(JSON.stringify({ error: 'Twitter API not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const twitterRes = await fetch(
      `https://api.x.com/2/users/by/username/${cleanUsername}?user.fields=profile_image_url,verified,verified_type`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );

    if (!twitterRes.ok) {
      const errText = await twitterRes.text();
      console.error('Twitter API error:', twitterRes.status, errText);
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

    const twitterData = await twitterRes.json();
    const user = twitterData.data;

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get higher-res image by replacing _normal with _200x200
    const profileImageUrl = (user.profile_image_url || '').replace('_normal', '_200x200');
    const verified = user.verified || false;
    const verifiedType = user.verified_type || null;

    // Update cache
    await supabase.from('twitter_profile_cache').upsert({
      username: cleanUsername.toLowerCase(),
      profile_image_url: profileImageUrl,
      verified,
      verified_type: verifiedType,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'username' });

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
