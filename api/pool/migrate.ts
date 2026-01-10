import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient, getTokenByMint } from '../lib/supabase';
import { migratePool, getPoolState } from '../lib/meteora';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Manual migration endpoint for graduated tokens
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
    const { mintAddress } = req.body;

    console.log('[pool/migrate] Request:', { mintAddress });

    if (!mintAddress) {
      return res.status(400).json({ error: 'mintAddress is required' });
    }

    const supabase = getSupabaseClient();

    // Get token
    const token = await getTokenByMint(mintAddress);
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }

    if (!token.dbc_pool_address) {
      return res.status(400).json({ error: 'Pool not initialized on-chain' });
    }

    // Check current pool state
    const poolState = await getPoolState(token.dbc_pool_address);
    if (!poolState) {
      return res.status(400).json({ error: 'Failed to get pool state' });
    }

    if (poolState.isMigrated) {
      return res.status(400).json({ 
        error: 'Pool already migrated',
        dammPoolAddress: token.damm_pool_address || token.dbc_pool_address,
      });
    }

    // Check if eligible for migration (85 SOL threshold)
    if (poolState.virtualSolReserves < 85) {
      return res.status(400).json({ 
        error: 'Token has not reached graduation threshold',
        currentSol: poolState.virtualSolReserves,
        requiredSol: 85,
      });
    }

    // Execute migration
    console.log('[pool/migrate] Migrating pool...');
    const signatures = await migratePool(token.dbc_pool_address);
    console.log('[pool/migrate] Migration complete:', signatures);

    // Update database
    await supabase
      .from('tokens')
      .update({
        status: 'graduated',
        migration_status: 'damm_v2_active',
        damm_pool_address: token.dbc_pool_address,
        graduated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', token.id);

    return res.status(200).json({
      success: true,
      signatures,
      dammPoolAddress: token.dbc_pool_address,
      message: 'Pool successfully migrated to DAMM V2',
    });

  } catch (error) {
    console.error('[pool/migrate] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
