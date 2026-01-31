import type { VercelRequest, VercelResponse } from '@vercel/node';
import { claimPartnerFees, getClaimableFees } from '../../lib/meteora.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { PLATFORM_FEE_WALLET } from '../../lib/config.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-treasury-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Minimum SOL to claim (to avoid dust transactions)
const MIN_CLAIM_SOL = 0.001;

// Rate limiting delay between claims (ms)
const CLAIM_DELAY_MS = 500;

/**
 * Treasury Batch Claim API
 * 
 * POST: Claim fees from multiple pools in sequence
 * GET: Get claimable fees for multiple pools
 * 
 * This endpoint uses the TREASURY_PRIVATE_KEY which is only available in Vercel environment
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  const startTime = Date.now();

  // Basic auth check - require a header to prevent unauthorized access
  const treasurySecret = req.headers['x-treasury-secret'];
  const expectedSecret = process.env.TREASURY_CLAIM_SECRET || 'tuna-treasury-2024';
  
  if (treasurySecret !== expectedSecret) {
    console.warn('[treasury/claim-batch] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    // Get claimable fees for multiple pools
    try {
      const poolAddresses = req.query.pools;
      
      if (!poolAddresses) {
        return res.status(400).json({ error: 'pools query parameter required (comma-separated)' });
      }
      
      const pools = typeof poolAddresses === 'string' 
        ? poolAddresses.split(',').map(p => p.trim())
        : Array.isArray(poolAddresses) ? poolAddresses : [];

      if (pools.length === 0) {
        return res.status(400).json({ error: 'No pool addresses provided' });
      }

      console.log(`[treasury/claim-batch] GET: Checking ${pools.length} pools`);

      const results: Array<{
        poolAddress: string;
        claimableSol: number;
        error?: string;
      }> = [];

      for (const poolAddress of pools) {
        try {
          const fees = await getClaimableFees(poolAddress);
          results.push({
            poolAddress,
            claimableSol: fees.partnerQuoteFee,
          });
        } catch (error) {
          results.push({
            poolAddress,
            claimableSol: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const totalClaimable = results.reduce((sum, r) => sum + r.claimableSol, 0);

      return res.status(200).json({
        success: true,
        totalClaimableSol: totalClaimable,
        pools: results,
        duration: Date.now() - startTime,
      });

    } catch (error) {
      console.error('[treasury/claim-batch] GET Error:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { poolAddresses, dryRun = false } = req.body;

    if (!poolAddresses || !Array.isArray(poolAddresses) || poolAddresses.length === 0) {
      return res.status(400).json({ error: 'poolAddresses array is required' });
    }

    console.log(`[treasury/claim-batch] POST: Processing ${poolAddresses.length} pools (dryRun: ${dryRun})`);

    const supabase = getSupabaseClient();

    // Get registered tokens for tracking
    const { data: funTokens } = await supabase
      .from('fun_tokens')
      .select('id, mint_address, dbc_pool_address, name, ticker');
    
    const { data: tokens } = await supabase
      .from('tokens')
      .select('id, mint_address, dbc_pool_address, name, ticker');

    const poolToToken = new Map<string, { id: string; name: string; ticker: string; table: string }>();
    
    (funTokens || []).forEach((t) => {
      if (t.dbc_pool_address) {
        poolToToken.set(t.dbc_pool_address, { 
          id: t.id, 
          name: t.name, 
          ticker: t.ticker, 
          table: 'fun_tokens' 
        });
      }
    });

    (tokens || []).forEach((t) => {
      if (t.dbc_pool_address) {
        poolToToken.set(t.dbc_pool_address, { 
          id: t.id, 
          name: t.name, 
          ticker: t.ticker, 
          table: 'tokens' 
        });
      }
    });

    const results: Array<{
      poolAddress: string;
      mintAddress?: string;
      tokenName?: string;
      isRegistered: boolean;
      claimableSol: number;
      claimedSol: number;
      signature?: string;
      error?: string;
      skipped?: boolean;
    }> = [];

    let totalClaimed = 0;
    let successCount = 0;

    // Process pools sequentially to avoid rate limiting
    for (const poolAddress of poolAddresses) {
      const tokenInfo = poolToToken.get(poolAddress);
      const isRegistered = !!tokenInfo;

      try {
        // First check claimable amount
        let claimableSol = 0;
        try {
          const fees = await getClaimableFees(poolAddress);
          claimableSol = fees.partnerQuoteFee;
        } catch (feeError) {
          console.log(`[treasury/claim-batch] Fee check failed for ${poolAddress}:`, feeError);
          results.push({
            poolAddress,
            tokenName: tokenInfo?.name,
            isRegistered,
            claimableSol: 0,
            claimedSol: 0,
            error: `Fee check failed: ${feeError instanceof Error ? feeError.message : 'Unknown'}`,
          });
          continue;
        }

        // Skip if below minimum
        if (claimableSol < MIN_CLAIM_SOL) {
          results.push({
            poolAddress,
            tokenName: tokenInfo?.name,
            isRegistered,
            claimableSol,
            claimedSol: 0,
            skipped: true,
            error: `Below minimum (${claimableSol.toFixed(6)} < ${MIN_CLAIM_SOL})`,
          });
          continue;
        }

        // Dry run - just report what would be claimed
        if (dryRun) {
          results.push({
            poolAddress,
            tokenName: tokenInfo?.name,
            isRegistered,
            claimableSol,
            claimedSol: 0,
            skipped: true,
            error: 'Dry run - not claimed',
          });
          continue;
        }

        // Claim the fees
        console.log(`[treasury/claim-batch] Claiming ${claimableSol.toFixed(6)} SOL from ${tokenInfo?.name || poolAddress}`);
        
        const { signature, claimedSol } = await claimPartnerFees(poolAddress);

        console.log(`[treasury/claim-batch] ✅ Claimed ${claimedSol.toFixed(6)} SOL - TX: ${signature}`);

        // Record in treasury_fee_claims table
        const { error: insertError } = await supabase.rpc('backend_insert_treasury_claim', {
          p_pool_address: poolAddress,
          p_mint_address: null, // Could be populated from pool state if needed
          p_token_name: tokenInfo?.name || null,
          p_claimed_sol: claimedSol,
          p_signature: signature,
          p_is_registered: isRegistered,
        });

        if (insertError) {
          console.error(`[treasury/claim-batch] Failed to record claim:`, insertError);
        }

        // If registered in fun_tokens, update total_fees_earned
        if (isRegistered && tokenInfo?.table === 'fun_tokens') {
          await supabase
            .from('fun_fee_claims')
            .insert({
              fun_token_id: tokenInfo.id,
              pool_address: poolAddress,
              claimed_sol: claimedSol,
              signature,
              claimed_at: new Date().toISOString(),
            });
        }

        results.push({
          poolAddress,
          tokenName: tokenInfo?.name,
          isRegistered,
          claimableSol,
          claimedSol,
          signature,
        });

        totalClaimed += claimedSol;
        successCount++;

        // Rate limiting delay
        await new Promise((resolve) => setTimeout(resolve, CLAIM_DELAY_MS));

      } catch (error) {
        console.error(`[treasury/claim-batch] Error claiming from ${poolAddress}:`, error);
        results.push({
          poolAddress,
          tokenName: tokenInfo?.name,
          isRegistered,
          claimableSol: 0,
          claimedSol: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[treasury/claim-batch] Complete: ${successCount}/${poolAddresses.length} claims, ${totalClaimed.toFixed(6)} SOL total, ${duration}ms`);

    return res.status(200).json({
      success: true,
      summary: {
        processed: poolAddresses.length,
        successful: successCount,
        totalClaimedSol: totalClaimed,
        dryRun,
      },
      results,
      treasuryWallet: PLATFORM_FEE_WALLET,
      duration,
    });

  } catch (error) {
    console.error('[treasury/claim-batch] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    });
  }
}
