import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PLATFORM_FEE_WALLET, CREATOR_FEE_SHARE, SYSTEM_FEE_SHARE } from '../lib/config';
import { getSupabaseClient, acquireClaimLock, releaseClaimLock } from '../lib/supabase';
import { transferSol, getTreasuryKeypair, getBalance } from '../lib/solana';

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

    const unclaimedAmount = earner.unclaimed_sol || 0;

    if (unclaimedAmount < 0.001) {
      return res.status(400).json({ 
        error: 'Minimum 0.001 SOL required to claim',
        unclaimedAmount,
      });
    }

    // Acquire claim lock
    const lockAcquired = await acquireClaimLock(tokenId);
    if (!lockAcquired) {
      return res.status(409).json({ 
        error: 'Another claim is in progress. Please try again.' 
      });
    }

    try {
      let signature: string;

      // Check if treasury has enough balance
      const treasury = getTreasuryKeypair();
      const treasuryBalance = await getBalance(treasury.publicKey.toBase58());

      if (treasuryBalance >= unclaimedAmount + 0.001) { // +0.001 for tx fee
        // Transfer SOL from treasury to claimer
        signature = await transferSol(walletAddress, unclaimedAmount);
        console.log('[fees/claim] SOL transferred:', { signature, amount: unclaimedAmount });
      } else {
        // Insufficient treasury balance - record claim without transfer
        signature = `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        console.log('[fees/claim] Treasury insufficient, marking as pending:', { 
          treasuryBalance, 
          unclaimedAmount 
        });
      }

      // Record fee claim
      await supabase.from('fee_claims').insert({
        fee_earner_id: earner.id,
        amount_sol: unclaimedAmount,
        signature,
      });

      // Reset unclaimed balance
      await supabase
        .from('fee_earners')
        .update({
          unclaimed_sol: 0,
          last_claimed_at: new Date().toISOString(),
        })
        .eq('id', earner.id);

      // Release lock
      await releaseClaimLock(tokenId);

      console.log('[fees/claim] Success:', { signature, claimedAmount: unclaimedAmount });

      return res.status(200).json({
        success: true,
        claimedAmount: unclaimedAmount,
        signature,
        isPending: signature.startsWith('pending_'),
      });

    } catch (innerError) {
      // Release lock on error
      await releaseClaimLock(tokenId);
      throw innerError;
    }

  } catch (error) {
    console.error('[fees/claim] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
