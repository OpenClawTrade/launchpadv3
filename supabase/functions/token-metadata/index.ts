import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get mint address from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const mintAddress = pathParts[pathParts.length - 1];

    if (!mintAddress || mintAddress === 'token-metadata') {
      return new Response(
        JSON.stringify({ error: 'Mint address required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[token-metadata] Fetching metadata for:', mintAddress);

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch token from database
    const { data: token, error } = await supabase
      .from('tokens')
      .select('*')
      .eq('mint_address', mintAddress)
      .single();

    if (error || !token) {
      console.error('[token-metadata] Token not found:', mintAddress, error);
      return new Response(
        JSON.stringify({ error: 'Token not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Build Metaplex-standard metadata JSON
    // See: https://docs.metaplex.com/programs/token-metadata/token-standard
    const metadata: Record<string, unknown> = {
      name: token.name,
      symbol: token.ticker?.toUpperCase() || '',
      description: token.description || `${token.name} token on TRENCHES`,
      image: token.image_url || '',
      external_url: token.website_url || `https://trenches.to/token/${mintAddress}`,
      attributes: [
        {
          trait_type: 'Platform',
          value: 'TRENCHES',
        },
        {
          trait_type: 'Status',
          value: token.status || 'bonding',
        },
      ],
      properties: {
        files: token.image_url ? [
          {
            uri: token.image_url,
            type: 'image/png',
          },
        ] : [],
        category: 'image',
        creators: [
          {
            address: token.creator_wallet,
            share: 100,
          },
        ],
      },
    };

    // Add social links as extensions (following common patterns)
    const extensions: Record<string, string> = {};
    
    if (token.website_url) {
      extensions.website = token.website_url;
    }
    if (token.twitter_url) {
      extensions.twitter = token.twitter_url;
    }
    if (token.telegram_url) {
      extensions.telegram = token.telegram_url;
    }
    if (token.discord_url) {
      extensions.discord = token.discord_url;
    }

    if (Object.keys(extensions).length > 0) {
      metadata.extensions = extensions;
    }

    // Also add to properties.links for better compatibility
    const links: Record<string, string> = {};
    if (token.website_url) links.website = token.website_url;
    if (token.twitter_url) links.twitter = token.twitter_url;
    if (token.telegram_url) links.telegram = token.telegram_url;
    if (token.discord_url) links.discord = token.discord_url;
    
    if (Object.keys(links).length > 0) {
      (metadata.properties as Record<string, unknown>).links = links;
    }

    console.log('[token-metadata] Returning metadata for:', token.name);

    return new Response(
      JSON.stringify(metadata),
      { 
        status: 200, 
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        }
      }
    );

  } catch (error) {
    console.error('[token-metadata] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
