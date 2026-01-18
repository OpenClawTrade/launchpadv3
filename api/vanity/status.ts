import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getVanityStats } from '../../lib/vanityGenerator.js';
import { createClient } from '@supabase/supabase-js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*').end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple auth check
  const authHeader = req.headers['x-vanity-secret'];
  const expectedSecret = process.env.TREASURY_PRIVATE_KEY?.slice(0, 16);
  
  if (!authHeader || authHeader !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const suffix = req.query.suffix as string | undefined;
    
    // Get overall stats
    const stats = await getVanityStats(suffix);
    
    // Get recent addresses
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let recentQuery = supabase
      .from('vanity_keypairs')
      .select('id, suffix, public_key, status, created_at, used_for_token_id')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (suffix) {
      recentQuery = recentQuery.eq('suffix', suffix.toLowerCase());
    }
    
    const { data: recentAddresses, error: recentError } = await recentQuery;
    
    if (recentError) {
      console.error('[vanity/status] Error fetching recent:', recentError);
    }
    
    // Get used addresses with token info
    const { data: usedAddresses, error: usedError } = await supabase
      .from('vanity_keypairs')
      .select(`
        id, 
        suffix, 
        public_key, 
        created_at,
        used_for_token_id,
        tokens:used_for_token_id (
          id,
          name,
          ticker,
          mint_address
        )
      `)
      .eq('status', 'used')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (usedError) {
      console.error('[vanity/status] Error fetching used:', usedError);
    }
    
    return res.status(200).json({
      success: true,
      stats,
      recentAddresses: recentAddresses?.map(a => ({
        id: a.id,
        suffix: a.suffix,
        publicKey: a.public_key,
        status: a.status,
        createdAt: a.created_at,
        usedForTokenId: a.used_for_token_id,
      })) || [],
      usedAddresses: usedAddresses?.map(a => ({
        id: a.id,
        suffix: a.suffix,
        publicKey: a.public_key,
        createdAt: a.created_at,
        token: a.tokens,
      })) || [],
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
