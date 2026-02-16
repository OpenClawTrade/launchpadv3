import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Connection,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import BN from 'bn.js';
import { CpAmm } from '@meteora-ag/cp-amm-sdk';

// Retry helper for RPC rate limits
async function getBlockhashWithRetry(
  connection: Connection,
  maxRetries = 5,
  initialDelayMs = 1000
): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await connection.getLatestBlockhash('confirmed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('429') || errorMsg.includes('max usage reached')) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.warn(`[remove-fun-lp] Rate limited. Retrying in ${delayMs}ms (${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Failed to get blockhash after ${maxRetries} retries`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { poolAddress, phantomWallet } = req.body;

    if (!poolAddress || !phantomWallet) {
      return res.status(400).json({ error: 'Missing required fields: poolAddress, phantomWallet' });
    }

    let poolPubkey: PublicKey;
    let ownerPubkey: PublicKey;
    try {
      poolPubkey = new PublicKey(poolAddress);
      ownerPubkey = new PublicKey(phantomWallet);
    } catch {
      return res.status(400).json({ error: 'Invalid poolAddress or phantomWallet' });
    }

    const rpcUrl = process.env.HELIUS_RPC_URL;
    if (!rpcUrl) throw new Error('HELIUS_RPC_URL not configured');
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log('[remove-fun-lp] Removing LP from pool:', poolAddress, 'owner:', phantomWallet);

    const cpAmm = new CpAmm(connection);

    // Fetch pool state
    const poolState = await cpAmm.fetchPoolState(poolPubkey);
    if (!poolState) {
      return res.status(404).json({ error: 'Pool not found or not a CP-AMM pool' });
    }

    // Find positions owned by this wallet
    const positions = await cpAmm.getAllPositionsByPool(poolPubkey);
    
    // Filter positions owned by the user
    const userPositions = positions.filter(
      (pos) => pos.account?.pool?.toBase58() === poolPubkey.toBase58()
    );

    if (userPositions.length === 0) {
      return res.status(404).json({ 
        error: 'No LP position found for your wallet in this pool. Make sure you are the pool creator.' 
      });
    }

    console.log('[remove-fun-lp] Found', userPositions.length, 'position(s) for user');

    // Use the first position
    const position = userPositions[0];

    // Build remove liquidity + close position transaction
    const removeTx = await cpAmm.removeAllLiquidityAndClosePosition({
      owner: ownerPubkey,
      position: position.publicKey,
      positionNftAccount: getAssociatedTokenAddressSync(
        position.account.nftMint,
        ownerPubkey
      ),
      poolState,
      positionState: position.account,
      tokenAAmountThreshold: new BN(0),
      tokenBAmountThreshold: new BN(0),
      vestings: [],
      currentPoint: poolState.sqrtPrice,
    });

    // Set blockhash and fee payer
    const latest = await getBlockhashWithRetry(connection);
    
    removeTx.recentBlockhash = latest.blockhash;
    removeTx.feePayer = ownerPubkey;

    const serialized = removeTx.serialize({ 
      requireAllSignatures: false, 
      verifySignatures: false 
    });

    console.log('[remove-fun-lp] ✅ Remove LP transaction prepared');

    return res.status(200).json({
      success: true,
      unsignedTransaction: serialized.toString('base64'),
      message: 'Sign this transaction to remove all liquidity and get your SOL back.',
    });
  } catch (error) {
    console.error('[remove-fun-lp] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: msg });
  }
}
