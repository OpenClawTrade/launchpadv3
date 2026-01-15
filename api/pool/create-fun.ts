import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';
import { createMeteoraPool } from '../lib/meteora.js';
import { PLATFORM_FEE_WALLET, TOTAL_SUPPLY, GRADUATION_THRESHOLD_SOL, TRADING_FEE_BPS } from '../lib/config.js';

// Configuration
// Treasury address is derived from TREASURY_PRIVATE_KEY - no hardcoding
const INITIAL_VIRTUAL_SOL = 30;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Get treasury keypair from env
function getTreasuryKeypair(): Keypair {
  const raw = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!raw) {
    throw new Error('TREASURY_PRIVATE_KEY not configured');
  }

  try {
    // JSON array format: "[1,2,3,...]"
    if (raw.startsWith('[')) {
      const keyArray = JSON.parse(raw);
      const bytes = new Uint8Array(keyArray);
      if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
      if (bytes.length === 32) return Keypair.fromSeed(bytes);
      throw new Error(`Invalid key length: ${bytes.length}`);
    }

    // Base58 encoded (either 64-byte secretKey or 32-byte seed)
    const decoded: Uint8Array = bs58.decode(raw);
    if (decoded.length === 64) return Keypair.fromSecretKey(decoded);
    if (decoded.length === 32) return Keypair.fromSeed(decoded);
    throw new Error(`Invalid key length: ${decoded.length}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    throw new Error(`Invalid TREASURY_PRIVATE_KEY format (${msg})`);
  }
}

// Get Supabase client
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*').end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, ticker, description, imageUrl, feeRecipientWallet, serverSideSign } = req.body;

    if (!name || !ticker) {
      return res.status(400).json({ error: 'Missing required fields: name, ticker' });
    }

    if (!serverSideSign) {
      return res.status(400).json({ error: 'This endpoint requires serverSideSign=true' });
    }

    console.log('[create-fun] Creating fun token:', { name, ticker, feeRecipientWallet });

    const treasuryKeypair = getTreasuryKeypair();
    const treasuryAddress = treasuryKeypair.publicKey.toBase58();
    console.log('[create-fun] Treasury wallet derived from key:', treasuryAddress);
    
    const supabase = getSupabase();
    const rpcUrl = process.env.HELIUS_RPC_URL;

    if (!rpcUrl) {
      throw new Error('HELIUS_RPC_URL not configured');
    }

    const connection = new Connection(rpcUrl, 'confirmed');

    // Create real Meteora pool using the existing SDK integration
    // Treasury wallet is the "creator" for on-chain purposes
    console.log('[create-fun] Creating real Meteora DBC pool...');
    
    const { transactions, mintKeypair, configKeypair, poolAddress } = await createMeteoraPool({
      creatorWallet: treasuryAddress, // Treasury signs everything
      name: name.slice(0, 32),
      ticker: ticker.toUpperCase().slice(0, 10),
      description: description || `${name} - A fun meme coin!`,
      imageUrl: imageUrl || undefined,
      initialBuySol: 0, // No dev buy for fun tokens
    });

    const mintAddress = mintKeypair.publicKey.toBase58();
    const dbcPoolAddress = poolAddress.toBase58();
    
    console.log('[create-fun] Pool transactions prepared:', {
      mintAddress,
      dbcPoolAddress,
      txCount: transactions.length,
    });

    // Sign and send all transactions with treasury keypair (fully server-side)
    const signatures: string[] = [];

    // Build a map of available keypairs for signing
    const availableKeypairs: Map<string, Keypair> = new Map([
      [treasuryKeypair.publicKey.toBase58(), treasuryKeypair],
      [mintKeypair.publicKey.toBase58(), mintKeypair],
      [configKeypair.publicKey.toBase58(), configKeypair],
    ]);

    console.log('[create-fun] Available signers:', Array.from(availableKeypairs.keys()));

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      // Fresh blockhash to avoid expiration
      const latest = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = latest.blockhash;
      tx.feePayer = treasuryKeypair.publicKey;

      // Compile message to determine required signers
      const message = tx.compileMessage();
      const requiredSignerPubkeys = message.accountKeys
        .slice(0, message.header.numRequiredSignatures)
        .map((k) => k.toBase58());

      console.log(`[create-fun] Tx ${i + 1}/${transactions.length} requires signers:`, requiredSignerPubkeys);

      // Check for missing signers
      const missingSigners = requiredSignerPubkeys.filter((pk) => !availableKeypairs.has(pk));
      if (missingSigners.length > 0) {
        throw new Error(
          `Tx ${i + 1} requires unknown signer(s): ${missingSigners.join(', ')} | we have: ${Array.from(availableKeypairs.keys()).join(', ')}`
        );
      }

      // Collect ONLY the keypairs that this transaction actually needs
      const signersForThisTx: Keypair[] = requiredSignerPubkeys
        .map((pk) => availableKeypairs.get(pk))
        .filter((kp): kp is Keypair => kp !== undefined);

      console.log(`[create-fun] Tx ${i + 1} will be signed by:`, signersForThisTx.map(kp => kp.publicKey.toBase58()));

      try {
        // Sign with ONLY the required keypairs (prevents "unknown signer" error)
        tx.sign(...signersForThisTx);

        console.log(`[create-fun] Sending transaction ${i + 1}/${transactions.length}...`);

        const signature = await connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        const confirmation = await connection.confirmTransaction(
          {
            signature,
            blockhash: latest.blockhash,
            lastValidBlockHeight: latest.lastValidBlockHeight,
          },
          'confirmed'
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction ${i + 1} failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
        }

        signatures.push(signature);
        console.log(`[create-fun] ✅ Transaction ${i + 1} confirmed:`, signature);
      } catch (txError) {
        console.error(`[create-fun] ❌ Transaction ${i + 1} failed:`, txError);
        const msg = txError instanceof Error ? txError.message : 'Unknown error';
        throw new Error(`On-chain transaction ${i + 1} failed: ${msg}`);
      }
    }

    console.log('[create-fun] All transactions confirmed!', { signatures });

    // Calculate initial values
    const virtualSol = INITIAL_VIRTUAL_SOL;
    const virtualToken = TOTAL_SUPPLY;
    const initialPrice = virtualSol / virtualToken;

    // Generate a UUID for the token
    const crypto = await import('crypto');
    const tokenId = crypto.randomUUID();

    // Insert token into main tokens table (so it can be traded)
    const { error: tokenError } = await supabase.rpc('backend_create_token', {
      p_id: tokenId,
      p_mint_address: mintAddress,
      p_name: name.slice(0, 32),
      p_ticker: ticker.toUpperCase().slice(0, 10),
      p_creator_wallet: treasuryAddress, // Treasury is the on-chain creator
      p_dbc_pool_address: dbcPoolAddress,
      p_description: description || `${name} - A fun meme coin!`,
      p_image_url: imageUrl || null,
      p_virtual_sol_reserves: virtualSol,
      p_virtual_token_reserves: virtualToken,
      p_total_supply: TOTAL_SUPPLY,
      p_price_sol: initialPrice,
      p_market_cap_sol: virtualSol,
      p_graduation_threshold_sol: GRADUATION_THRESHOLD_SOL,
      p_system_fee_bps: TRADING_FEE_BPS, // 2% platform fee
      p_creator_fee_bps: 0, // No creator fee (handled separately via fun_distributions)
    });

    if (tokenError) {
      console.error('[create-fun] Token creation error:', tokenError);
      throw new Error(`Failed to create token: ${tokenError.message}`);
    }

    // Create fee earner entry for platform
    await supabase.rpc('backend_create_fee_earner', {
      p_token_id: tokenId,
      p_earner_type: 'system',
      p_share_bps: 10000, // 100% goes to system (distributed via fun_distributions)
      p_wallet_address: PLATFORM_FEE_WALLET,
    });

    console.log('[create-fun] Token created successfully:', { tokenId, mintAddress, dbcPoolAddress });

    return res.status(200).json({
      success: true,
      tokenId,
      mintAddress,
      dbcPoolAddress,
      poolAddress: dbcPoolAddress,
      creatorWallet: treasuryAddress,
      feeRecipientWallet,
      signatures,
      solscanUrl: `https://solscan.io/token/${mintAddress}`,
      tradeUrl: `https://axiom.trade/meme/${mintAddress}`,
    });

  } catch (error) {
    console.error('[create-fun] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
