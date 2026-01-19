import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getVanityStats } from '../../lib/vanityGenerator.js';
import { createClient } from '@supabase/supabase-js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-vanity-secret',
};

function applyCors(res: VercelResponse) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
}

// Get Supabase client using anon key (works with SECURITY DEFINER functions)
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple auth check
  const authHeader = req.headers['x-vanity-secret'];
  const expectedSecret = '123456';

  if (!authHeader || authHeader !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const suffix = req.query.suffix as string | undefined;

    // Get overall stats using SECURITY DEFINER function
    const stats = await getVanityStats(suffix);

    const supabase = getSupabaseClient();

    // Get recent addresses using SECURITY DEFINER function
    const { data: recentData, error: recentError } = await supabase.rpc('backend_get_recent_vanity_keypairs', {
      p_suffix: suffix?.toLowerCase() || null,
      p_limit: 20,
    });

    if (recentError) {
      console.error('[vanity/status] Error fetching recent:', recentError);
    }

    // Get used addresses with token info using SECURITY DEFINER function
    const { data: usedData, error: usedError } = await supabase.rpc('backend_get_used_vanity_keypairs', {
      p_limit: 10,
    });

    if (usedError) {
      console.error('[vanity/status] Error fetching used:', usedError);
    }

    return res.status(200).json({
      success: true,
      stats,
      recentAddresses: (recentData || []).map((a: any) => ({
        id: a.id,
        suffix: a.suffix,
        publicKey: a.public_key,
        status: a.status,
        createdAt: a.created_at,
        usedForTokenId: a.used_for_token_id,
      })),
      usedAddresses: (usedData || []).map((a: any) => ({
        id: a.id,
        suffix: a.suffix,
        publicKey: a.public_key,
        createdAt: a.created_at,
        token: a.token_id
          ? {
              id: a.token_id,
              name: a.token_name,
              ticker: a.token_ticker,
              mint_address: a.mint_address,
            }
          : null,
      })),
      summary: {
        message: `${stats.available} vanity addresses available for token launches`,
        suffixBreakdown: stats.suffixes,
      },
    });
  } catch (error) {
    console.error('[vanity/status] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
