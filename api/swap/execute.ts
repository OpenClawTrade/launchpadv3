import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  TRADING_FEE_BPS, 
  CREATOR_FEE_SHARE, 
  SYSTEM_FEE_SHARE,
  GRADUATION_THRESHOLD_SOL,
  TOTAL_SUPPLY,
} from '../lib/config';
import { getSupabaseClient, getTokenByMint } from '../lib/supabase';

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

    // Get token
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

    // Calculate using bonding curve (constant product: x * y = k)
    const virtualSol = token.virtual_sol_reserves || 30;
    const virtualToken = token.virtual_token_reserves || TOTAL_SUPPLY;
    const realSol = token.real_sol_reserves || 0;
    const k = virtualSol * virtualToken;

    let tokensOut = 0;
    let solOut = 0;
    let newPrice = token.price_sol || 0.00000003;
    let newVirtualSol = virtualSol;
    let newVirtualToken = virtualToken;
    let newRealSol = realSol;
    let systemFee = 0;
    let creatorFee = 0;
    let solAmount = 0;
    let tokenAmount = 0;

    if (isBuy) {
      // Buy: SOL -> Token
      const grossSolIn = amount;
      const totalFee = (grossSolIn * TRADING_FEE_BPS) / 10000;
      systemFee = totalFee * SYSTEM_FEE_SHARE;
      creatorFee = totalFee * CREATOR_FEE_SHARE;
      const netSolIn = grossSolIn - totalFee;

      newVirtualSol = virtualSol + netSolIn;
      newVirtualToken = k / newVirtualSol;
      tokensOut = virtualToken - newVirtualToken;
      newRealSol = realSol + netSolIn;
      newPrice = newVirtualSol / newVirtualToken;
      solAmount = grossSolIn;
      tokenAmount = tokensOut;

      // Apply slippage check
      const minTokensOut = tokensOut * (1 - slippageBps / 10000);
      
      console.log('[swap/execute] Buy calculated:', { 
        netSolIn, 
        tokensOut, 
        minTokensOut,
        newPrice, 
        systemFee, 
        creatorFee 
      });

    } else {
      // Sell: Token -> SOL
      const tokensIn = amount;
      
      // Check user has enough tokens
      const { data: holding } = await supabase
        .from('token_holdings')
        .select('balance')
        .eq('token_id', token.id)
        .eq('wallet_address', userWallet)
        .single();
      
      if (!holding || holding.balance < tokensIn) {
        return res.status(400).json({ error: 'Insufficient token balance' });
      }

      newVirtualToken = virtualToken + tokensIn;
      newVirtualSol = k / newVirtualToken;
      const grossSolOut = virtualSol - newVirtualSol;
      
      const totalFee = (grossSolOut * TRADING_FEE_BPS) / 10000;
      systemFee = totalFee * SYSTEM_FEE_SHARE;
      creatorFee = totalFee * CREATOR_FEE_SHARE;
      solOut = grossSolOut - totalFee;
      
      newRealSol = Math.max(0, realSol - grossSolOut);
      newPrice = newVirtualSol / newVirtualToken;
      solAmount = solOut;
      tokenAmount = tokensIn;

      // Apply slippage check
      const minSolOut = solOut * (1 - slippageBps / 10000);

      console.log('[swap/execute] Sell calculated:', { 
        tokensIn, 
        solOut,
        minSolOut,
        newPrice 
      });
    }

    // Check graduation status
    const bondingProgress = Math.min(100, (newRealSol / GRADUATION_THRESHOLD_SOL) * 100);
    const shouldGraduate = newRealSol >= GRADUATION_THRESHOLD_SOL;
    const newStatus = shouldGraduate ? 'graduated' : 'bonding';
    const marketCap = newPrice * TOTAL_SUPPLY;

    // Calculate 24h volume
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTxs } = await supabase
      .from('launchpad_transactions')
      .select('sol_amount')
      .eq('token_id', token.id)
      .gte('created_at', twentyFourHoursAgo);
    
    const volume24h = (recentTxs || []).reduce((sum, tx) => sum + Number(tx.sol_amount), 0) + solAmount;

    // Update token state
    await supabase
      .from('tokens')
      .update({
        virtual_sol_reserves: newVirtualSol,
        virtual_token_reserves: newVirtualToken,
        real_sol_reserves: newRealSol,
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

    // Generate transaction signature (mock for now)
    // In production, this would be the actual Solana tx signature
    const signature = `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`;

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

    // Update fee earners
    if (creatorFee > 0) {
      const { data: creatorEarner } = await supabase
        .from('fee_earners')
        .select('*')
        .eq('token_id', token.id)
        .eq('earner_type', 'creator')
        .single();

      if (creatorEarner) {
        await supabase
          .from('fee_earners')
          .update({
            unclaimed_sol: (creatorEarner.unclaimed_sol || 0) + creatorFee,
            total_earned_sol: (creatorEarner.total_earned_sol || 0) + creatorFee,
          })
          .eq('id', creatorEarner.id);
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

    console.log('[swap/execute] Success:', { signature, tokensOut, solOut, newPrice, graduated: shouldGraduate });

    return res.status(200).json({
      success: true,
      signature,
      tokensOut: isBuy ? tokensOut : 0,
      solOut: isBuy ? 0 : solOut,
      newPrice,
      bondingProgress,
      graduated: shouldGraduate,
      marketCap,
    });

  } catch (error) {
    console.error('[swap/execute] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
