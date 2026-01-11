import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PublicKey } from '@solana/web3.js';
import { CpAmm, deriveTokenVaultAddress, derivePositionNftAccount } from '@meteora-ag/cp-amm-sdk';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PLATFORM_FEE_WALLET } from '../lib/config.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { getConnection, getTreasuryKeypair } from '../lib/solana.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Treasury claims fees from DAMM V2 LP positions (post-graduation)
// The treasury holds position NFTs and can claim accumulated trading fees
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method === 'GET') {
    // Get treasury positions and claimable fees
    try {
      const connection = getConnection();
      const treasury = getTreasuryKeypair();
      const cpAmm = new CpAmm(connection);
      
      // Get all positions held by treasury
      const positions = await cpAmm.getPositionsByUser(treasury.publicKey);
      
      const positionData = await Promise.all(positions.map(async pos => {
        // Get pool state for additional info
        const poolState = await cpAmm.fetchPoolState(pos.positionState.pool);
        
        return {
          position: pos.position.toBase58(),
          positionNftAccount: pos.positionNftAccount.toBase58(),
          pool: pos.positionState.pool.toBase58(),
          liquidity: pos.positionState.unlockedLiquidity.toString(),
          tokenAMint: poolState.tokenAMint.toBase58(),
          tokenBMint: poolState.tokenBMint.toBase58(),
          // Fee info from position state
          feeAOwed: pos.positionState.feeAPending?.toString() || '0',
          feeBOwed: pos.positionState.feeBPending?.toString() || '0',
        };
      }));
      
      return res.status(200).json({
        success: true,
        treasuryWallet: PLATFORM_FEE_WALLET,
        positionCount: positions.length,
        positions: positionData,
      });
      
    } catch (error) {
      console.error('[fees/claim-damm-fees] GET Error:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tokenId, dammPoolAddress, positionAddress } = req.body;

    console.log('[fees/claim-damm-fees] Request:', { tokenId, dammPoolAddress, positionAddress });

    if (!tokenId && !dammPoolAddress && !positionAddress) {
      return res.status(400).json({ 
        error: 'Either tokenId, dammPoolAddress, or positionAddress is required' 
      });
    }

    const supabase = getSupabaseClient();
    const connection = getConnection();
    const treasury = getTreasuryKeypair();
    const cpAmm = new CpAmm(connection);

    // Get token if tokenId provided
    let token = null;
    if (tokenId) {
      const { data } = await supabase
        .from('tokens')
        .select('*')
        .eq('id', tokenId)
        .single();
      token = data;
    } else if (dammPoolAddress) {
      const { data } = await supabase
        .from('tokens')
        .select('*')
        .eq('damm_pool_address', dammPoolAddress)
        .single();
      token = data;
    }

    if (token) {
      // Verify token is graduated
      if (token.status !== 'graduated' || token.migration_status !== 'damm_v2_active') {
        return res.status(400).json({ 
          error: 'Token has not graduated to DAMM V2 yet',
          currentStatus: token.status,
          migrationStatus: token.migration_status,
        });
      }
    }

    // Get treasury positions
    console.log('[fees/claim-damm-fees] Fetching treasury positions...');
    const positions = await cpAmm.getPositionsByUser(treasury.publicKey);
    
    if (positions.length === 0) {
      return res.status(400).json({ 
        error: 'No LP positions found for treasury wallet',
        treasuryWallet: PLATFORM_FEE_WALLET,
      });
    }

    // Find the correct position
    let targetPosition = null;
    const poolAddress = token?.damm_pool_address || token?.dbc_pool_address || dammPoolAddress;
    
    if (positionAddress) {
      // Find by specific position address
      targetPosition = positions.find(p => 
        p.position.toBase58() === positionAddress
      );
    } else if (poolAddress) {
      // Find by pool address
      targetPosition = positions.find(p => 
        p.positionState.pool.toBase58() === poolAddress
      );
    }

    if (!targetPosition) {
      return res.status(404).json({ 
        error: 'Position not found',
        searchedPool: poolAddress,
        searchedPosition: positionAddress,
        availablePositions: positions.map(p => ({
          position: p.position.toBase58(),
          pool: p.positionState.pool.toBase58(),
        })),
      });
    }

    // Get pool state for token info
    const poolPubkey = targetPosition.positionState.pool;
    const poolState = await cpAmm.fetchPoolState(poolPubkey);
    
    // Derive vault addresses
    const tokenAVault = deriveTokenVaultAddress(poolState.tokenAMint, poolPubkey);
    const tokenBVault = deriveTokenVaultAddress(poolState.tokenBMint, poolPubkey);
    
    // Build claim fee transaction using claimPositionFee
    console.log('[fees/claim-damm-fees] Building claim transaction...');
    
    const claimTx = await cpAmm.claimPositionFee({
      owner: treasury.publicKey,
      position: targetPosition.position,
      pool: poolPubkey,
      positionNftAccount: targetPosition.positionNftAccount,
      tokenAMint: poolState.tokenAMint,
      tokenBMint: poolState.tokenBMint,
      tokenAVault,
      tokenBVault,
      tokenAProgram: TOKEN_PROGRAM_ID,
      tokenBProgram: TOKEN_PROGRAM_ID,
      receiver: treasury.publicKey,
    });

    // Set recent blockhash + fee payer, then sign
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    claimTx.feePayer = treasury.publicKey;
    claimTx.recentBlockhash = blockhash;
    claimTx.sign(treasury);

    // Send transaction
    const signature = await connection.sendRawTransaction(claimTx.serialize());

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    console.log('[fees/claim-damm-fees] Fees claimed:', signature);

    // Record the claim in database
    if (token) {
      await supabase.from('fee_pool_claims').insert({
        token_id: token.id,
        pool_address: poolAddress,
        signature,
        claimed_at: new Date().toISOString(),
        processed: true,
        processed_at: new Date().toISOString(),
      });

      // Update system fee earner
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
            unclaimed_sol: 0,
            last_claimed_at: new Date().toISOString(),
          })
          .eq('id', systemEarner.id);
      }
    }

    return res.status(200).json({
      success: true,
      signature,
      poolAddress: poolPubkey.toBase58(),
      positionAddress: targetPosition.position.toBase58(),
      tokenId: token?.id,
      treasuryWallet: PLATFORM_FEE_WALLET,
    });

  } catch (error) {
    console.error('[fees/claim-damm-fees] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
