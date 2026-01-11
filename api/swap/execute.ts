import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PublicKey } from '@solana/web3.js';
import { 
  TRADING_FEE_BPS, 
  CREATOR_FEE_SHARE, 
  SYSTEM_FEE_SHARE,
  GRADUATION_THRESHOLD_SOL,
  TOTAL_SUPPLY,
} from '../lib/config.js';
import { getSupabaseClient, getTokenByMint } from '../lib/supabase.js';
import { getConnection } from '../lib/solana.js';
import { executeMeteoraSwap, getPoolState, migratePool, serializeTransaction } from '../lib/meteora.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

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
    const { 
      mintAddress, 
      userWallet, 
      amount, 
      isBuy, 
      slippageBps = 500,
      profileId,
    } = req.body;

    console.log('[swap/execute] Request:', { mintAddress, userWallet, amount, isBuy });

    if (!mintAddress || !userWallet || amount === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: mintAddress, userWallet, amount' 
      });
    }

    const supabase = getSupabaseClient();

    // Get token from database
    const token = await getTokenByMint(mintAddress);
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }

    if (token.status === 'graduated') {
      return res.status(400).json({ 
        error: 'Token has graduated. Trade on DEX.',
        jupiterUrl: `https://jup.ag/swap/SOL-${mintAddress}`,
      });
    }

    // Check if pool address exists
    if (!token.dbc_pool_address) {
      return res.status(400).json({ error: 'Pool not initialized on-chain' });
    }

    // For sells, verify user has enough tokens
    if (!isBuy) {
      const { data: holding } = await supabase
        .from('token_holdings')
        .select('balance')
        .eq('token_id', token.id)
        .eq('wallet_address', userWallet)
        .single();
      
      if (!holding || holding.balance < amount) {
        return res.status(400).json({ error: 'Insufficient token balance' });
      }
    }

    // Execute swap on Meteora
    console.log('[swap/execute] Executing Meteora swap...');
    
    const { transaction, estimatedOutput } = await executeMeteoraSwap({
      poolAddress: token.dbc_pool_address,
      userWallet,
      amount,
      isBuy,
      slippageBps,
    });

    // Get updated pool state from chain
    const poolState = await getPoolState(token.dbc_pool_address);
    if (!poolState) {
      throw new Error('Failed to get pool state');
    }

    // Calculate fees - 100% of 2% goes to treasury
    const solAmount = isBuy ? amount : estimatedOutput;
    const totalFee = (solAmount * TRADING_FEE_BPS) / 10000;
    const systemFee = totalFee * SYSTEM_FEE_SHARE; // 100% of fee
    const creatorFee = totalFee * CREATOR_FEE_SHARE; // 0% (kept for DB compatibility)

    const tokensOut = isBuy ? estimatedOutput : 0;
    const solOut = isBuy ? 0 : estimatedOutput;
    const tokenAmount = isBuy ? estimatedOutput : amount;

    // Update database with on-chain state
    const bondingProgress = Math.min(100, (poolState.virtualSolReserves / GRADUATION_THRESHOLD_SOL) * 100);
    const shouldGraduate = poolState.isMigrated || poolState.virtualSolReserves >= GRADUATION_THRESHOLD_SOL;
    const newStatus = shouldGraduate ? 'graduated' : 'bonding';
    const newPrice = poolState.price;
    const marketCap = poolState.marketCap;

    // Calculate 24h volume
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTxs } = await supabase
      .from('launchpad_transactions')
      .select('sol_amount')
      .eq('token_id', token.id)
      .gte('created_at', twentyFourHoursAgo);
    
    const volume24h = (recentTxs || []).reduce((sum, tx) => sum + Number(tx.sol_amount), 0) + solAmount;

    // Update token state in database
    await supabase
      .from('tokens')
      .update({
        virtual_sol_reserves: poolState.virtualSolReserves,
        virtual_token_reserves: poolState.virtualTokenReserves,
        real_sol_reserves: poolState.virtualSolReserves - 30, // Real = Virtual - Initial
        price_sol: newPrice,
        bonding_curve_progress: bondingProgress,
        market_cap_sol: marketCap,
        volume_24h_sol: volume24h,
        status: newStatus,
        graduated_at: shouldGraduate && !token.graduated_at ? new Date().toISOString() : token.graduated_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', token.id);

    // Record price history
    await supabase.from('token_price_history').insert({
      token_id: token.id,
      price_sol: newPrice,
      market_cap_sol: marketCap,
      volume_sol: solAmount,
      interval_type: '1m',
      timestamp: new Date().toISOString(),
    });

    // Serialize transaction for client signing
    const serializedTransaction = serializeTransaction(transaction);

    // Generate a placeholder signature (real signature comes after client signs)
    const signature = `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Record transaction
    await supabase.from('launchpad_transactions').insert({
      token_id: token.id,
      user_wallet: userWallet,
      user_profile_id: profileId || null,
      transaction_type: isBuy ? 'buy' : 'sell',
      sol_amount: solAmount,
      token_amount: tokenAmount,
      price_per_token: newPrice,
      system_fee_sol: systemFee,
      creator_fee_sol: creatorFee,
      signature,
    });

    // Update token holdings
    if (isBuy) {
      const { data: existingHolding } = await supabase
        .from('token_holdings')
        .select('*')
        .eq('token_id', token.id)
        .eq('wallet_address', userWallet)
        .single();

      if (existingHolding) {
        await supabase
          .from('token_holdings')
          .update({
            balance: existingHolding.balance + tokensOut,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingHolding.id);
      } else {
        await supabase.from('token_holdings').insert({
          token_id: token.id,
          wallet_address: userWallet,
          profile_id: profileId || null,
          balance: tokensOut,
        });
      }
    } else {
      // Sell: reduce balance
      const { data: existingHolding } = await supabase
        .from('token_holdings')
        .select('*')
        .eq('token_id', token.id)
        .eq('wallet_address', userWallet)
        .single();

      if (existingHolding) {
        const newBalance = Math.max(0, existingHolding.balance - amount);
        await supabase
          .from('token_holdings')
          .update({
            balance: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingHolding.id);
      }
    }

    // Note: Creator fee is 0 - no update needed for creator earner
    // All fees go to system/treasury

    // Track system/platform fees - receives 100% of 2%
    if (systemFee > 0) {
      const { data: systemEarner } = await supabase
        .from('fee_earners')
        .select('*')
        .eq('token_id', token.id)
        .eq('earner_type', 'system')
        .single();

      if (systemEarner) {
        await supabase
          .from('fee_earners')
          .update({
            unclaimed_sol: (systemEarner.unclaimed_sol || 0) + systemFee,
            total_earned_sol: (systemEarner.total_earned_sol || 0) + systemFee,
          })
          .eq('id', systemEarner.id);
      }
    }


    // Update holder count
    const { count: holderCount } = await supabase
      .from('token_holdings')
      .select('*', { count: 'exact', head: true })
      .eq('token_id', token.id)
      .gt('balance', 0);

    await supabase
      .from('tokens')
      .update({ holder_count: holderCount || 0 })
      .eq('id', token.id);

    // If graduated, trigger migration
    if (shouldGraduate && !token.graduated_at) {
      console.log('[swap/execute] Token graduated, triggering migration...');
      try {
        const migrationSigs = await migratePool(token.dbc_pool_address);
        console.log('[swap/execute] Migration complete:', migrationSigs);
        
        await supabase
          .from('tokens')
          .update({ 
            migration_status: 'damm_v2_active',
            damm_pool_address: token.dbc_pool_address, // DAMM uses same address post-migration
          })
          .eq('id', token.id);
      } catch (migrationError) {
        console.error('[swap/execute] Migration error:', migrationError);
        // Don't fail the swap, migration can be retried
      }
    }

    console.log('[swap/execute] Success:', { tokensOut, solOut, newPrice, graduated: shouldGraduate });

    return res.status(200).json({
      success: true,
      transaction: serializedTransaction,
      tokensOut: isBuy ? tokensOut : 0,
      solOut: isBuy ? 0 : solOut,
      newPrice,
      bondingProgress,
      graduated: shouldGraduate,
      marketCap,
      signature,
    });

  } catch (error) {
    console.error('[swap/execute] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
