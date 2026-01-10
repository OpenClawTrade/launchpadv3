import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PLATFORM_FEE_WALLET } from '../lib/config';
import { getSupabaseClient } from '../lib/supabase';
import { claimPartnerFees, getClaimableFees } from '../lib/meteora';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Treasury claims fees from Meteora DBC pools (pre-graduation)
// This is called by the treasury to collect accumulated 2% trading fees
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method === 'GET') {
    // Get claimable fees for a pool
    try {
      const { poolAddress } = req.query;
      
      if (!poolAddress || typeof poolAddress !== 'string') {
        return res.status(400).json({ error: 'poolAddress query parameter required' });
      }
      
      const fees = await getClaimableFees(poolAddress);
      
      return res.status(200).json({
        success: true,
        poolAddress,
        claimableSol: fees.partnerQuoteFee,
        claimableTokens: fees.partnerBaseFee,
        totalTradingFee: fees.totalTradingFee,
      });
      
    } catch (error) {
      console.error('[fees/claim-from-pool] GET Error:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { poolAddress, tokenId } = req.body;

    console.log('[fees/claim-from-pool] Request:', { poolAddress, tokenId });

    if (!poolAddress) {
      return res.status(400).json({ error: 'poolAddress is required' });
    }

    const supabase = getSupabaseClient();

    // Get token if tokenId provided
    let token = null;
    if (tokenId) {
      const { data } = await supabase
        .from('tokens')
        .select('*')
        .eq('id', tokenId)
        .single();
      token = data;
    } else {
      // Find by pool address
      const { data } = await supabase
        .from('tokens')
        .select('*')
        .eq('dbc_pool_address', poolAddress)
        .single();
      token = data;
    }

    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }

    // Check if pool is graduated (can't claim from DBC after migration)
    if (token.status === 'graduated' && token.migration_status === 'damm_v2_active') {
      return res.status(400).json({ 
        error: 'Pool has graduated. Use DAMM V2 claim endpoint.',
        useEndpoint: '/api/fees/claim-damm-fees',
      });
    }

    // Claim fees from Meteora pool
    console.log('[fees/claim-from-pool] Claiming fees from pool...');
    
    const { signature, claimedSol } = await claimPartnerFees(poolAddress);
    
    console.log('[fees/claim-from-pool] Fees claimed:', { signature, claimedSol });

    // Record the claim in fee_pool_claims table
    await supabase.from('fee_pool_claims').insert({
      token_id: token.id,
      pool_address: poolAddress,
      signature,
      claimed_sol: claimedSol,
      claimed_at: new Date().toISOString(),
      processed: true,
      processed_at: new Date().toISOString(),
    });

    // Update system fee earner to reflect claimed amount
    const { data: systemEarner } = await supabase
      .from('fee_earners')
      .select('*')
      .eq('token_id', token.id)
      .eq('earner_type', 'system')
      .single();

    if (systemEarner) {
      // Reset unclaimed since we just claimed from pool
      await supabase
        .from('fee_earners')
        .update({
          unclaimed_sol: 0,
          last_claimed_at: new Date().toISOString(),
        })
        .eq('id', systemEarner.id);
    }

    return res.status(200).json({
      success: true,
      signature,
      claimedSol,
      poolAddress,
      tokenId: token.id,
      treasuryWallet: PLATFORM_FEE_WALLET,
    });

  } catch (error) {
    console.error('[fees/claim-from-pool] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
