import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../lib/supabase.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Fetch token data from DexScreener
async function fetchDexScreenerData(mintAddress: string) {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const pairs = data.pairs || [];
    
    if (pairs.length === 0) {
      return null;
    }
    
    // Find the best pool (highest liquidity)
    const bestPool = pairs.sort((a: any, b: any) => 
      (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];
    
    return {
      priceUsd: parseFloat(bestPool.priceUsd || '0'),
      volume24h: bestPool.volume?.h24 || 0,
      liquidity: bestPool.liquidity?.usd || 0,
      pairAddress: bestPool.pairAddress,
      dexId: bestPool.dexId,
      labels: bestPool.labels || [],
    };
  } catch (error) {
    console.error('DexScreener fetch error:', error);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  try {
    const supabase = getSupabaseClient();

    // Get all tokens
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('id, mint_address, status, migration_status, damm_pool_address');

    if (error) {
      throw error;
    }

    const results = [];

    for (const token of tokens || []) {
      try {
        // Fetch DexScreener data
        const dexData = await fetchDexScreenerData(token.mint_address);
        
        if (dexData) {
          const updates: any = {};

          // Check if token has graduated (has a DAMM V2 pool)
          if (dexData.labels?.includes('DYN2') && token.status !== 'graduated') {
            updates.status = 'graduated';
            updates.migration_status = 'graduated';
            updates.graduated_at = new Date().toISOString();
            updates.damm_pool_address = dexData.pairAddress;
            updates.bonding_curve_progress = 100;
          }

          // Update volume if significant
          if (dexData.volume24h > 0) {
            updates.volume_24h_sol = dexData.volume24h / (dexData.priceUsd || 1);
          }

          if (Object.keys(updates).length > 0) {
            await supabase
              .from('tokens')
              .update(updates)
              .eq('id', token.id);
          }

          results.push({
            tokenId: token.id,
            mintAddress: token.mint_address,
            updated: Object.keys(updates).length > 0,
            dexData,
          });
        }
      } catch (tokenError) {
        console.error(`Error syncing token ${token.id}:`, tokenError);
        results.push({
          tokenId: token.id,
          error: tokenError instanceof Error ? tokenError.message : 'Unknown error',
        });
      }
    }

    // Update 24h stats for all tokens
    await supabase.rpc('update_token_24h_stats');

    return res.status(200).json({
      success: true,
      synced: results.length,
      results,
    });

  } catch (error) {
    console.error('[data/sync] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
