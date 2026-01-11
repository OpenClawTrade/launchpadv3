import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PLATFORM_FEE_WALLET } from '../lib/config.js';
import { getSupabaseClient } from '../lib/supabase.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Legacy fee claim endpoint - now redirects to pool-based claiming
// All fees (2%) go directly to treasury wallet via Meteora's on-chain fee system
// This endpoint is kept for backward compatibility but creators no longer receive fees
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tokenId, walletAddress, profileId } = req.body;

    console.log('[fees/claim] Request:', { tokenId, walletAddress, profileId });

    if (!tokenId || !walletAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields: tokenId, walletAddress' 
      });
    }

    const supabase = getSupabaseClient();

    // Find fee earner record
    let earner = null;
    
    // Try by wallet address first
    const { data: earnerByWallet } = await supabase
      .from('fee_earners')
      .select('*')
      .eq('token_id', tokenId)
      .eq('wallet_address', walletAddress)
      .single();
    
    if (earnerByWallet) {
      earner = earnerByWallet;
    } else if (profileId) {
      // Try by profile ID
      const { data: earnerByProfile } = await supabase
        .from('fee_earners')
        .select('*')
        .eq('token_id', tokenId)
        .eq('profile_id', profileId)
        .single();
      
      if (earnerByProfile) {
        earner = earnerByProfile;
      }
    }

    if (!earner) {
      return res.status(404).json({ error: 'You are not a fee earner for this token' });
    }

    // Check if this is a creator trying to claim
    if (earner.earner_type === 'creator') {
      return res.status(400).json({ 
        error: 'Creator fees are no longer distributed. All trading fees go to platform treasury.',
        info: 'The 2% trading fee is collected by the treasury wallet for platform operations.',
        treasuryWallet: PLATFORM_FEE_WALLET,
      });
    }

    // Check if this is the system/treasury
    if (earner.earner_type === 'system') {
      // Get token to find pool address
      const { data: token } = await supabase
        .from('tokens')
        .select('*')
        .eq('id', tokenId)
        .single();

      if (!token) {
        return res.status(404).json({ error: 'Token not found' });
      }

      // Redirect to appropriate claim endpoint
      if (token.status === 'graduated' && token.migration_status === 'damm_v2_active') {
        return res.status(400).json({
          error: 'Use the DAMM V2 claim endpoint for graduated tokens',
          redirect: '/api/fees/claim-damm-fees',
          poolAddress: token.damm_pool_address || token.dbc_pool_address,
        });
      } else {
        return res.status(400).json({
          error: 'Use the pool claim endpoint for active tokens',
          redirect: '/api/fees/claim-from-pool',
          poolAddress: token.dbc_pool_address,
        });
      }
    }

    return res.status(400).json({ 
      error: 'Unknown earner type',
      earnerType: earner.earner_type,
    });

  } catch (error) {
    console.error('[fees/claim] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
