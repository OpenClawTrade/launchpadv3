import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';
import { createMeteoraPool, createMeteoraPoolWithMint } from '../../lib/meteora.js';
import { PLATFORM_FEE_WALLET, TOTAL_SUPPLY, GRADUATION_THRESHOLD_SOL, TRADING_FEE_BPS } from '../../lib/config.js';
import { getAvailableVanityAddress, markVanityAddressUsed, releaseVanityAddress } from '../../lib/vanityGenerator.js';

// Configuration
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
    if (raw.startsWith('[')) {
      const keyArray = JSON.parse(raw);
      const bytes = new Uint8Array(keyArray);
      if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
      if (bytes.length === 32) return Keypair.fromSeed(bytes);
      throw new Error(`Invalid key length: ${bytes.length}`);
    }

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

// Retry blockhash fetch with exponential backoff
async function getBlockhashWithRetry(connection: Connection, maxRetries = 3): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await connection.getLatestBlockhash('confirmed');
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Unknown error');
      console.log(`[create-fun] Blockhash attempt ${i + 1} failed:`, lastError.message);
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
      }
    }
  }
  throw lastError || new Error('Failed to get blockhash');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*').end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let vanityKeypairId: string | null = null;
  const startTime = Date.now();

  try {
    const { 
      name, ticker, description, imageUrl, websiteUrl, twitterUrl, 
      feeRecipientWallet, serverSideSign, useVanityAddress = true,
      jobId
    } = req.body;

    if (!name || !ticker) {
      return res.status(400).json({ error: 'Missing required fields: name, ticker' });
    }

    if (!serverSideSign) {
      return res.status(400).json({ error: 'This endpoint requires serverSideSign=true' });
    }

    console.log('[create-fun] Starting token creation:', { name, ticker, elapsed: Date.now() - startTime });

    const treasuryKeypair = getTreasuryKeypair();
    const treasuryAddress = treasuryKeypair.publicKey.toBase58();
    
    const supabase = getSupabase();
    const rpcUrl = process.env.HELIUS_RPC_URL;

    if (!rpcUrl) {
      throw new Error('HELIUS_RPC_URL not configured');
    }

    const connection = new Connection(rpcUrl, 'confirmed');

    // === PRE-FETCH BLOCKHASH ONCE (saves ~1-2s per tx) ===
    console.log('[create-fun] Fetching blockhash...', { elapsed: Date.now() - startTime });
    const latestBlockhash = await getBlockhashWithRetry(connection);
    console.log('[create-fun] Blockhash fetched:', { elapsed: Date.now() - startTime });

    // Try to get a vanity address for the mint
    let vanityKeypair: { id: string; publicKey: string; keypair: Keypair } | null = null;
    
    if (useVanityAddress) {
      try {
        vanityKeypair = await getAvailableVanityAddress('67x');
        if (vanityKeypair) {
          vanityKeypairId = vanityKeypair.id;
          console.log('[create-fun] Using vanity mint:', vanityKeypair.publicKey, { elapsed: Date.now() - startTime });
        }
      } catch (vanityError) {
        console.log('[create-fun] Vanity address unavailable, using random');
      }
    }

    // Create Meteora pool transactions
    console.log('[create-fun] Creating pool transactions...', { elapsed: Date.now() - startTime });
    
    let transactions: Transaction[];
    let mintKeypair: Keypair;
    let configKeypair: Keypair;
    let poolAddress: PublicKey;
    
    if (vanityKeypair) {
      const result = await createMeteoraPoolWithMint({
        creatorWallet: treasuryAddress,
        leftoverReceiverWallet: feeRecipientWallet || treasuryAddress,
        mintKeypair: vanityKeypair.keypair,
        name: name.slice(0, 32),
        ticker: ticker.toUpperCase().slice(0, 10),
        description: description || `${name} - A fun meme coin!`,
        imageUrl: imageUrl || undefined,
        initialBuySol: 0,
      });
      transactions = result.transactions;
      mintKeypair = vanityKeypair.keypair;
      configKeypair = result.configKeypair;
      poolAddress = result.poolAddress;
    } else {
      const result = await createMeteoraPool({
        creatorWallet: treasuryAddress,
        leftoverReceiverWallet: feeRecipientWallet || treasuryAddress,
        name: name.slice(0, 32),
        ticker: ticker.toUpperCase().slice(0, 10),
        description: description || `${name} - A fun meme coin!`,
        imageUrl: imageUrl || undefined,
        initialBuySol: 0,
      });
      transactions = result.transactions;
      mintKeypair = result.mintKeypair;
      configKeypair = result.configKeypair;
      poolAddress = result.poolAddress;
    }

    const mintAddress = mintKeypair.publicKey.toBase58();
    const dbcPoolAddress = poolAddress.toBase58();
    
    console.log('[create-fun] Pool prepared:', { mintAddress, dbcPoolAddress, txCount: transactions.length, elapsed: Date.now() - startTime });

    // Build keypair map for signing
    const availableKeypairs: Map<string, Keypair> = new Map([
      [treasuryKeypair.publicKey.toBase58(), treasuryKeypair],
      [mintKeypair.publicKey.toBase58(), mintKeypair],
      [configKeypair.publicKey.toBase58(), configKeypair],
    ]);

    const signatures: string[] = [];

    // Sign and send all transactions using the PRE-FETCHED blockhash
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      // Use pre-fetched blockhash (no additional RPC call!)
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = treasuryKeypair.publicKey;

      const message = tx.compileMessage();
      const requiredSignerPubkeys = message.accountKeys
        .slice(0, message.header.numRequiredSignatures)
        .map((k) => k.toBase58());

      const missingSigners = requiredSignerPubkeys.filter((pk) => !availableKeypairs.has(pk));
      if (missingSigners.length > 0) {
        throw new Error(`Tx ${i + 1} requires unknown signer(s): ${missingSigners.join(', ')}`);
      }

      const signersForThisTx: Keypair[] = requiredSignerPubkeys
        .map((pk) => availableKeypairs.get(pk))
        .filter((kp): kp is Keypair => kp !== undefined);

      tx.sign(...signersForThisTx);

      console.log(`[create-fun] Sending tx ${i + 1}/${transactions.length}...`, { elapsed: Date.now() - startTime });

      // Send WITHOUT confirmation - fire and forget
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
        preflightCommitment: 'processed',
        maxRetries: 3,
      });

      signatures.push(signature);
      console.log(`[create-fun] Tx ${i + 1} sent:`, signature.slice(0, 16) + '...', { elapsed: Date.now() - startTime });

      // Small delay between transactions for ordering
      if (i < transactions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log('[create-fun] All transactions sent!', { signatures, elapsed: Date.now() - startTime });

    // === DATABASE OPERATIONS (fast) ===
    const virtualSol = INITIAL_VIRTUAL_SOL;
    const virtualToken = TOTAL_SUPPLY;
    const initialPrice = virtualSol / virtualToken;
    const crypto = await import('crypto');
    const tokenId = crypto.randomUUID();

    // Insert token into database
    const { error: tokenError } = await supabase.rpc('backend_create_token', {
      p_id: tokenId,
      p_mint_address: mintAddress,
      p_name: name.slice(0, 32),
      p_ticker: ticker.toUpperCase().slice(0, 10),
      p_creator_wallet: treasuryAddress,
      p_dbc_pool_address: dbcPoolAddress,
      p_description: description || `${name} - A fun meme coin!`,
      p_image_url: imageUrl || null,
      p_website_url: websiteUrl || 'https://ai67x.fun',
      p_twitter_url: twitterUrl || 'https://x.com/ai67x_fun',
      p_virtual_sol_reserves: virtualSol,
      p_virtual_token_reserves: virtualToken,
      p_total_supply: TOTAL_SUPPLY,
      p_price_sol: initialPrice,
      p_market_cap_sol: virtualSol,
      p_graduation_threshold_sol: GRADUATION_THRESHOLD_SOL,
      p_system_fee_bps: TRADING_FEE_BPS,
      p_creator_fee_bps: 0,
    });

    if (tokenError) {
      console.error('[create-fun] Token creation error:', tokenError);
      throw new Error(`Failed to create token: ${tokenError.message}`);
    }

    console.log('[create-fun] Token saved to DB:', { tokenId, elapsed: Date.now() - startTime });

    // Mark vanity address as used (fire-and-forget)
    if (vanityKeypair) {
      markVanityAddressUsed(vanityKeypair.id, tokenId).catch(e => 
        console.log('[create-fun] Failed to mark vanity used:', e)
      );
    }

    // Create fee earner entry (fire-and-forget)
    supabase.rpc('backend_create_fee_earner', {
      p_token_id: tokenId,
      p_earner_type: 'system',
      p_share_bps: 10000,
      p_wallet_address: PLATFORM_FEE_WALLET,
    }).catch(e => console.log('[create-fun] Fee earner creation failed:', e));

    // Trigger sniper buy (fire-and-forget, non-blocking)
    const supabaseUrl = process.env.SUPABASE_URL || 'https://ptwytypavumcrbofspno.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0d3l0eXBhdnVtY3Jib2ZzcG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTIyODksImV4cCI6MjA4MjQ4ODI4OX0.7FFIiwQTgqIQn4lzyDHPTsX-6PD5MPqgZSdVVsH9A44';
    
    const sniperClient = createClient(supabaseUrl, supabaseAnonKey);
    sniperClient.functions.invoke('fun-sniper-buy', {
      body: { poolAddress: dbcPoolAddress, mintAddress, tokenId, funTokenId: null },
    }).catch(err => console.log('[create-fun] Sniper fire-and-forget:', err?.message));

    console.log('[create-fun] SUCCESS!', { tokenId, elapsed: Date.now() - startTime });

    return res.status(200).json({
      success: true,
      tokenId,
      mintAddress,
      dbcPoolAddress,
      poolAddress: dbcPoolAddress,
      creatorWallet: treasuryAddress,
      feeRecipientWallet,
      signatures,
      vanityMint: vanityKeypair ? { suffix: '67x', address: vanityKeypair.publicKey } : null,
      solscanUrl: `https://solscan.io/token/${mintAddress}`,
      tradeUrl: `https://axiom.trade/meme/${dbcPoolAddress || mintAddress}?chain=sol`,
    });

  } catch (error) {
    console.error('[create-fun] Error:', error, { elapsed: Date.now() - startTime });
    
    // Release vanity address on error
    if (vanityKeypairId) {
      releaseVanityAddress(vanityKeypairId).catch(e => 
        console.log('[create-fun] Failed to release vanity:', e)
      );
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
