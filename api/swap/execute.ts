import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PublicKey } from '@solana/web3.js';
import { 
  TRADING_FEE_BPS, 
  CREATOR_FEE_SHARE, 
  SYSTEM_FEE_SHARE,
  GRADUATION_THRESHOLD_SOL,
  TOTAL_SUPPLY,
} from '../../lib/config.js';
import { getSupabaseClient, getTokenByMint } from '../../lib/supabase.js';
import { getConnection } from '../../lib/solana.js';
import { executeMeteoraSwap, getPoolState, migratePool, serializeTransaction } from '../../lib/meteora.js';

// API fee split (for tokens created via API)
const API_USER_FEE_SHARE = 0.75; // 1.5% to API user (75% of 2%)
const PLATFORM_FEE_SHARE = 0.25; // 0.5% to platform (25% of 2%)

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

    // Check if this token was launched via API (has api_account_id)
    // We need to query the original table to get api_account_id
    let apiAccountId: string | null = null;
    let apiUserFeeWallet: string | null = null;
    
    // Check fun_tokens first (most common for API launches)
    const { data: funToken } = await supabase
      .from('fun_tokens')
      .select('api_account_id')
      .eq('mint_address', mintAddress)
      .maybeSingle();
    
    if (funToken?.api_account_id) {
      apiAccountId = funToken.api_account_id;
      // Get the API user's fee wallet
      const { data: apiAccount } = await supabase
        .from('api_accounts')
        .select('fee_wallet_address')
        .eq('id', apiAccountId)
        .single();
      apiUserFeeWallet = apiAccount?.fee_wallet_address || null;
    } else {
      // Check tokens table
      const { data: regularToken } = await supabase
        .from('tokens')
        .select('api_account_id')
        .eq('mint_address', mintAddress)
        .maybeSingle();
      
      if (regularToken?.api_account_id) {
        apiAccountId = regularToken.api_account_id;
        const { data: apiAccount } = await supabase
          .from('api_accounts')
          .select('fee_wallet_address')
          .eq('id', apiAccountId)
          .single();
        apiUserFeeWallet = apiAccount?.fee_wallet_address || null;
      }
    }

    console.log('[swap/execute] API context:', { apiAccountId, hasApiWallet: !!apiUserFeeWallet });

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

    // Calculate fees - split between API user and platform if API-launched token
    const solAmount = isBuy ? amount : estimatedOutput;
    const totalFee = (solAmount * TRADING_FEE_BPS) / 10000;
    
    let systemFee: number;
    let apiUserFee = 0;
    let platformFee: number;
    
    if (apiAccountId) {
      // API-launched token: split fee 75/25
      apiUserFee = totalFee * API_USER_FEE_SHARE; // 1.5% to API user
      platformFee = totalFee * PLATFORM_FEE_SHARE; // 0.5% to platform
      systemFee = platformFee; // For backward compatibility with fee_earners table
    } else {
      // Regular token: 100% to platform
      systemFee = totalFee * SYSTEM_FEE_SHARE;
      platformFee = systemFee;
    }
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

    // Update token state in database using RPC function
    const { error: stateError } = await supabase.rpc('backend_update_token_state', {
      p_token_id: token.id,
      p_virtual_sol_reserves: poolState.virtualSolReserves,
      p_virtual_token_reserves: poolState.virtualTokenReserves,
      p_real_sol_reserves: poolState.virtualSolReserves - 30, // Real = Virtual - Initial
      p_real_token_reserves: poolState.virtualTokenReserves,
      p_price_sol: newPrice,
      p_market_cap_sol: marketCap,
      p_bonding_curve_progress: bondingProgress,
      p_volume_delta: solAmount,
    });

    if (stateError) {
      console.error('[swap/execute] Token state update error:', stateError);
    }

    // Handle graduation status update separately (if graduated)
    if (shouldGraduate && !token.graduated_at) {
      await supabase
        .from('tokens')
        .update({
          status: 'graduated',
          graduated_at: new Date().toISOString(),
        })
        .eq('id', token.id);
    }

    // Record price history (using direct insert since this is a new record with no RLS issues)
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

    // Record transaction using RPC function
    const { error: txError } = await supabase.rpc('backend_record_transaction', {
      p_token_id: token.id,
      p_user_wallet: userWallet,
      p_transaction_type: isBuy ? 'buy' : 'sell',
      p_sol_amount: solAmount,
      p_token_amount: tokenAmount,
      p_price_per_token: newPrice,
      p_signature: signature,
      p_system_fee_sol: systemFee,
      p_creator_fee_sol: creatorFee,
      p_user_profile_id: profileId || null,
    });

    if (txError) {
      console.error('[swap/execute] Transaction record error:', txError);
    }

    // Update token holdings using RPC function
    const balanceDelta = isBuy ? tokensOut : -amount;
    const { error: holdingsError } = await supabase.rpc('backend_upsert_token_holding', {
      p_token_id: token.id,
      p_wallet_address: userWallet,
      p_balance_delta: balanceDelta,
      p_profile_id: profileId || null,
    });

    if (holdingsError) {
      console.error('[swap/execute] Holdings update error:', holdingsError);
    }

    // Update system/platform fees using RPC function
    if (systemFee > 0) {
      const { error: feeError } = await supabase.rpc('backend_update_fee_earner', {
        p_token_id: token.id,
        p_earner_type: 'system',
        p_fee_amount: systemFee,
      });

      if (feeError) {
        console.error('[swap/execute] Fee earner update error:', feeError);
      }
    }

    // Record API fee distribution if this is an API-launched token
    if (apiAccountId && apiUserFee > 0) {
      console.log('[swap/execute] Recording API fee distribution:', { apiAccountId, apiUserFee, platformFee });
      
      const { error: feeDistError } = await supabase.from('api_fee_distributions').insert({
        api_account_id: apiAccountId,
        token_id: token.id,
        total_fee_sol: apiUserFee + platformFee,
        api_user_share: apiUserFee,
        platform_share: platformFee,
        status: 'pending',
      });

      if (feeDistError) {
        console.error('[swap/execute] API fee distribution insert error:', feeDistError);
      } else {
        // Update API account total fees earned
        const { data: currentAcc } = await supabase
          .from('api_accounts')
          .select('total_fees_earned')
          .eq('id', apiAccountId)
          .single();

        if (currentAcc) {
          await supabase
            .from('api_accounts')
            .update({
              total_fees_earned: (currentAcc.total_fees_earned || 0) + apiUserFee,
              updated_at: new Date().toISOString(),
            })
            .eq('id', apiAccountId);
        }
      }
    }

    // Update holder count using RPC function
    await supabase.rpc('backend_update_holder_count', { p_token_id: token.id });

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
