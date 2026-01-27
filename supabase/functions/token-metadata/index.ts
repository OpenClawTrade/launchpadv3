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

    // Token interface for both tables
    interface TokenData {
      name: string;
      ticker: string;
      description?: string;
      image_url?: string;
      website_url?: string;
      twitter_url?: string;
      telegram_url?: string;
      discord_url?: string;
      status?: string;
      creator_wallet: string;
    }

    // Fetch token from database - check tokens, fun_tokens, and pending_token_metadata
    let token: TokenData | null = null;
    let tokenSource = 'tokens';
    
    // First try the tokens table (launchpad tokens)
    const { data: launchpadToken, error: launchpadError } = await supabase
      .from('tokens')
      .select('*')
      .eq('mint_address', mintAddress)
      .maybeSingle();

    if (launchpadToken && !launchpadError) {
      token = launchpadToken as TokenData;
      tokenSource = 'tokens';
    } else {
      // If not found, check the fun_tokens table (FUN launcher tokens)
      const { data: funToken, error: funError } = await supabase
        .from('fun_tokens')
        .select('*')
        .eq('mint_address', mintAddress)
        .maybeSingle();
      
      if (funToken && !funError) {
        token = funToken as TokenData;
        tokenSource = 'fun_tokens';
      } else {
        // Finally, check pending_token_metadata (Phantom launch in-flight)
        const { data: pendingToken, error: pendingError } = await supabase
          .from('pending_token_metadata')
          .select('*')
          .eq('mint_address', mintAddress)
          .maybeSingle();
        
        if (pendingToken && !pendingError) {
          console.log('[token-metadata] Found pending metadata for:', mintAddress);
          token = {
            name: pendingToken.name,
            ticker: pendingToken.ticker,
            description: pendingToken.description,
            image_url: pendingToken.image_url,
            website_url: pendingToken.website_url,
            twitter_url: pendingToken.twitter_url,
            telegram_url: pendingToken.telegram_url,
            discord_url: pendingToken.discord_url,
            status: 'launching',
            creator_wallet: pendingToken.creator_wallet || '',
          };
          tokenSource = 'pending_token_metadata';
        }
      }
    }

    // If token not found anywhere, return a fallback
    if (!token) {
      console.log('[token-metadata] Token not in any table, returning generic fallback:', mintAddress);
      
      const fallbackMetadata = {
        name: 'New Token',
        symbol: 'TOKEN',
        description: 'Token launching on RIFT #RIFT',
        image: '',
        external_url: `https://rift.fun/token/${mintAddress}`,
        tags: ['Meme', 'RIFT'],
        attributes: [
          { trait_type: 'Platform', value: 'RIFT' },
          { trait_type: 'Status', value: 'launching' },
        ],
        properties: {
          files: [],
          category: 'image',
          creators: [],
        },
      };
      
      return new Response(
        JSON.stringify(fallbackMetadata),
        { 
          status: 200, 
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache, no-store',
          }
        }
      );
    }

    console.log(`[token-metadata] Found token in ${tokenSource}:`, token.name, 'website:', token.website_url, 'twitter:', token.twitter_url);

    // Build Metaplex-standard metadata JSON
    // See: https://docs.metaplex.com/programs/token-metadata/token-standard
    // Append #RIFT hashtag for Solscan visibility
    const baseDescription = token.description || `${token.name} token`;
    const descriptionWithTag = baseDescription.includes('#RIFT') 
      ? baseDescription 
      : `${baseDescription} #RIFT`;

    const metadata: Record<string, unknown> = {
      name: token.name,
      symbol: token.ticker?.toUpperCase() || '',
      description: descriptionWithTag,
      image: token.image_url || '',
      external_url: token.website_url || `https://rift.fun/token/${mintAddress}`,
      // Tags array for Solscan tag chips
      tags: ['Meme', 'RIFT'],
      attributes: [
        {
          trait_type: 'Platform',
          value: 'RIFT',
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
