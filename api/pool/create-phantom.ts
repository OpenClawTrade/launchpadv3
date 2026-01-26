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
import { PLATFORM_FEE_WALLET } from '../../lib/config.js';
import { getAvailableVanityAddress, releaseVanityAddress } from '../../lib/vanityGenerator.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Get Supabase client
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(url, key);
}

// Get treasury keypair (still needed for partial signing)
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*').end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let vanityKeypairId: string | null = null;

  try {
    const { 
      name, 
      ticker, 
      description, 
      imageUrl, 
      websiteUrl, 
      twitterUrl, 
      phantomWallet,
      feeRecipientWallet,
      useVanityAddress = true,
      tradingFeeBps = 200, // Default 2%, range 10-1000 (0.1%-10%)
    } = req.body;

    if (!name || !ticker || !phantomWallet) {
      return res.status(400).json({ error: 'Missing required fields: name, ticker, phantomWallet' });
    }

    // Validate phantomWallet is a valid Solana address
    try {
      new PublicKey(phantomWallet);
    } catch {
      return res.status(400).json({ error: 'Invalid phantomWallet address' });
    }

    console.log('[create-phantom] Creating Phantom-signed token:', { name, ticker, phantomWallet, useVanityAddress });

    const treasuryKeypair = getTreasuryKeypair();
    const supabase = getSupabase();
    const rpcUrl = process.env.HELIUS_RPC_URL;

    if (!rpcUrl) {
      throw new Error('HELIUS_RPC_URL not configured');
    }

    const connection = new Connection(rpcUrl, 'confirmed');

    // Try to get a vanity address for the mint
    let vanityKeypair: { id: string; publicKey: string; keypair: Keypair } | null = null;
    
    if (useVanityAddress) {
      try {
        vanityKeypair = await getAvailableVanityAddress('67x');
        if (vanityKeypair) {
          vanityKeypairId = vanityKeypair.id;
          console.log('[create-phantom] 🎯 Using vanity mint address:', vanityKeypair.publicKey);
        } else {
          console.log('[create-phantom] No vanity address available, using random mint');
        }
      } catch (vanityError) {
        console.error('[create-phantom] Failed to get vanity address:', vanityError);
      }
    }

    // For Phantom launches, we use the Phantom wallet as the fee recipient
    // This means 100% of trading fees go to the user's Phantom wallet
    const effectiveFeeRecipient = feeRecipientWallet || phantomWallet;

    console.log('[create-phantom] Creating Meteora DBC pool...', {
      name: name.slice(0, 32),
      ticker: ticker.toUpperCase().slice(0, 10),
      phantomWallet,
      feeRecipientWallet: effectiveFeeRecipient,
      tradingFeeBps,
      useVanityAddress,
      hasVanityKeypair: !!vanityKeypair,
    });
    
    let transactions: Transaction[];
    let mintKeypair: Keypair;
    let configKeypair: Keypair;
    let poolAddress: PublicKey;
    
    if (vanityKeypair) {
      const result = await createMeteoraPoolWithMint({
        creatorWallet: phantomWallet, // Phantom wallet is the creator
        leftoverReceiverWallet: effectiveFeeRecipient,
        mintKeypair: vanityKeypair.keypair,
        name: name.slice(0, 32),
        ticker: ticker.toUpperCase().slice(0, 10),
        description: description || `${name} - A fun meme coin!`,
        imageUrl: imageUrl || undefined,
        initialBuySol: 0,
        tradingFeeBps, // Pass custom fee
      });
      transactions = result.transactions;
      mintKeypair = vanityKeypair.keypair;
      configKeypair = result.configKeypair;
      poolAddress = result.poolAddress;
    } else {
      const result = await createMeteoraPool({
        creatorWallet: phantomWallet, // Phantom wallet is the creator  
        leftoverReceiverWallet: effectiveFeeRecipient,
        name: name.slice(0, 32),
        ticker: ticker.toUpperCase().slice(0, 10),
        description: description || `${name} - A fun meme coin!`,
        imageUrl: imageUrl || undefined,
        initialBuySol: 0,
        tradingFeeBps, // Pass custom fee
      });
      transactions = result.transactions;
      mintKeypair = result.mintKeypair;
      configKeypair = result.configKeypair;
      poolAddress = result.poolAddress;
    }

    const mintAddress = mintKeypair.publicKey.toBase58();
    const dbcPoolAddress = poolAddress.toBase58();
    
    console.log('[create-phantom] Pool transactions prepared:', {
      mintAddress,
      dbcPoolAddress,
      txCount: transactions.length,
      isVanity: !!vanityKeypair,
    });

    // For Phantom launches, we need to:
    // 1. Partially sign transactions with mint/config keypairs
    // 2. Return serialized transactions for Phantom to sign as fee payer
    
    const phantomPubkey = new PublicKey(phantomWallet);
    const serializedTransactions: string[] = [];

    // Build a map of available keypairs for partial signing
    const availableKeypairs: Map<string, Keypair> = new Map([
      [mintKeypair.publicKey.toBase58(), mintKeypair],
      [configKeypair.publicKey.toBase58(), configKeypair],
    ]);

    console.log('[create-phantom] Available partial signers:', Array.from(availableKeypairs.keys()));

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      // Fresh blockhash
      const latest = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = latest.blockhash;
      tx.feePayer = phantomPubkey; // Phantom wallet pays fees

      // Compile message to determine required signers
      const message = tx.compileMessage();
      const requiredSignerPubkeys = message.accountKeys
        .slice(0, message.header.numRequiredSignatures)
        .map((k) => k.toBase58());

      console.log(`[create-phantom] Tx ${i + 1}/${transactions.length} requires signers:`, requiredSignerPubkeys);

      // Find which keypairs we can sign with (exclude Phantom wallet - that comes later)
      const localSigners: Keypair[] = requiredSignerPubkeys
        .filter((pk) => availableKeypairs.has(pk))
        .map((pk) => availableKeypairs.get(pk)!)
        .filter((kp): kp is Keypair => kp !== undefined);

      console.log(`[create-phantom] Tx ${i + 1} will be partially signed by:`, localSigners.map(kp => kp.publicKey.toBase58()));

      // Partially sign with our keypairs (Phantom signs the rest)
      if (localSigners.length > 0) {
        tx.partialSign(...localSigners);
      }

      // Serialize for Phantom to complete signing
      const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
      serializedTransactions.push(serialized);
    }

    console.log('[create-phantom] Returning unsigned transactions for Phantom signing');

    // Mark vanity as used (will be released if user doesn't complete)
    if (vanityKeypairId) {
      // We'll mark as "reserved" - frontend will confirm used after successful tx
      console.log('[create-phantom] Vanity address reserved:', vanityKeypairId);
    }

    return res.status(200).json({
      success: true,
      mintAddress,
      dbcPoolAddress,
      poolAddress: dbcPoolAddress,
      unsignedTransactions: serializedTransactions,
      vanityKeypairId,
      requiresPhantomSignature: true,
      txCount: serializedTransactions.length,
      message: 'Transactions prepared. Please sign with Phantom wallet.',
    });

  } catch (error) {
    console.error('[create-phantom] Error:', error);

    // Release vanity address on error
    if (vanityKeypairId) {
      try {
        await releaseVanityAddress(vanityKeypairId);
        console.log('[create-phantom] Released vanity address after error:', vanityKeypairId);
      } catch (releaseErr) {
        console.error('[create-phantom] Failed to release vanity:', releaseErr);
      }
    }

    const msg = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ 
      success: false, 
      error: msg 
    });
  }
}
