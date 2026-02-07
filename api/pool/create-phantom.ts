import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';
import { createMeteoraPool, createMeteoraPoolWithMint } from '../../lib/meteora.js';
import { PLATFORM_FEE_WALLET } from '../../lib/config.js';
import { getAvailableVanityAddress, releaseVanityAddress } from '../../lib/vanityGenerator.js';

// Jito tip accounts - tip must be in LAST transaction per Jito docs
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4bVmkzf6HbKBJv9fYfZxTdU',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

const JITO_TIP_LAMPORTS = 5_000_000; // 0.005 SOL tip for priority

/**
 * Add Jito tip instruction to the LAST transaction in bundle.
 * Per Jito docs: tips MUST be in the last tx to prevent theft and ensure proper auction.
 */
function addJitoTipToLastTransaction(
  transactions: Transaction[],
  feePayer: PublicKey,
  tipLamports: number = JITO_TIP_LAMPORTS
): void {
  if (transactions.length === 0) return;
  
  const tipAccount = new PublicKey(
    JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)]
  );
  
  const lastTx = transactions[transactions.length - 1];
  lastTx.add(
    SystemProgram.transfer({
      fromPubkey: feePayer,
      toPubkey: tipAccount,
      lamports: tipLamports,
    })
  );
  
  console.log(`[create-phantom] Added Jito tip (${tipLamports / 1e9} SOL) to last transaction`);
}

// Retry helper with exponential backoff for RPC rate limits
async function getBlockhashWithRetry(
  connection: Connection,
  maxRetries = 5,
  initialDelayMs = 1000
): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await connection.getLatestBlockhash('confirmed');
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check if it's a rate limit error
      if (errorMsg.includes('429') || errorMsg.includes('max usage reached')) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.warn(`[create-phantom] Rate limited (429). Retrying in ${delayMs}ms (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // Non-rate-limit error, throw immediately
        throw error;
      }
    }
  }
  throw new Error(`Failed to get recent blockhash after ${maxRetries} retries due to rate limiting.`);
}

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
      tradingFeeBps: rawFeeBps = 200, // Default 2%, range 10-1000 (0.1%-10%)
      devBuySol = 0, // Optional dev buy amount in SOL (atomic with pool creation)
    } = req.body;

    // Validate and constrain trading fee to valid range (10-1000 bps = 0.1%-10%)
    const MIN_FEE_BPS = 10;
    const MAX_FEE_BPS = 1000;
    const DEFAULT_FEE_BPS = 200;
    const tradingFeeBps = Math.max(MIN_FEE_BPS, Math.min(MAX_FEE_BPS, Math.round(Number(rawFeeBps) || DEFAULT_FEE_BPS)));
    // Validate dev buy amount (max 10 SOL to prevent abuse)
    const effectiveDevBuySol = Math.max(0, Math.min(10, Number(devBuySol) || 0));
    console.log('[create-phantom] Validated tradingFeeBps:', tradingFeeBps, 'from raw:', rawFeeBps);
    console.log('[create-phantom] Dev buy amount:', effectiveDevBuySol, 'SOL');

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

    // Try to get a pre-generated vanity address from pool
    let vanityKeypair: { id: string; publicKey: string; keypair: Keypair } | null = null;
    
    if (useVanityAddress) {
      try {
        vanityKeypair = await getAvailableVanityAddress('TNA');
        if (vanityKeypair) {
          vanityKeypairId = vanityKeypair.id;
          console.log('[create-phantom] 🎯 Using pool vanity mint address:', vanityKeypair.publicKey);
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
      devBuySol: effectiveDevBuySol,
      devBuySolType: typeof effectiveDevBuySol,
      devBuySolFromReq: devBuySol,
      useVanityAddress,
      hasPoolVanityKeypair: !!vanityKeypair,
    });
    
    let transactions: Transaction[];
    let mintKeypair: Keypair;
    let configKeypair: Keypair;
    let poolAddress: PublicKey;
    
    // Use pool vanity keypair if available, otherwise random
    if (vanityKeypair) {
      const result = await createMeteoraPoolWithMint({
        creatorWallet: phantomWallet, // Phantom wallet is the creator
        leftoverReceiverWallet: effectiveFeeRecipient,
        mintKeypair: vanityKeypair.keypair,
        name: name.slice(0, 32),
        ticker: ticker.toUpperCase().slice(0, 10),
        description: description || `${name} - A fun meme coin!`,
        imageUrl: imageUrl || undefined,
        initialBuySol: effectiveDevBuySol, // Dev buy amount (atomic with pool creation)
        tradingFeeBps, // Pass custom fee
        enableDevBuy: effectiveDevBuySol > 0, // Enable first swap with min fee for dev buy
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
        initialBuySol: effectiveDevBuySol, // Dev buy amount (atomic with pool creation)
        tradingFeeBps, // Pass custom fee
        enableDevBuy: effectiveDevBuySol > 0, // Enable first swap with min fee for dev buy
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
      isPoolVanity: !!vanityKeypair,
    });

    // === UPLOAD STATIC METADATA JSON TO STORAGE BEFORE RETURNING TXs ===
    // CRITICAL: External indexers (Solscan, Axiom, DEXTools) prefer static .json files
    console.log('[create-phantom] Uploading static metadata JSON to storage...');
    
    try {
      const tokenName = name.slice(0, 32);
      const tokenSymbol = ticker.toUpperCase().slice(0, 10);
      const tokenDescription = description || `${tokenName} - A fun meme coin!`;
      const tokenImage = imageUrl || '';
      const tokenWebsite = websiteUrl || `https://tuna.fun/t/${tokenSymbol}`;
      const tokenTwitter = twitterUrl || undefined;
      
      // Detect image MIME type
      const imageExt = tokenImage.split('.').pop()?.toLowerCase() || 'png';
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
      };
      const imageMimeType = mimeTypes[imageExt] || 'image/png';
      
      const metadataJson = {
        name: tokenName,
        symbol: tokenSymbol,
        description: tokenDescription,
        image: tokenImage,
        external_url: tokenWebsite,
        seller_fee_basis_points: 0,
        properties: {
          files: tokenImage ? [{ uri: tokenImage, type: imageMimeType }] : [],
          category: 'image',
          creators: [],
        },
        extensions: {
          website: tokenWebsite,
          twitter: tokenTwitter,
        },
      };
      
      const jsonPath = `token-metadata/${mintAddress}.json`;
      const jsonBlob = new Blob([JSON.stringify(metadataJson, null, 2)], { type: 'application/json' });
      
      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(jsonPath, jsonBlob, {
          contentType: 'application/json',
          upsert: true,
          cacheControl: '60',
        });
      
      if (uploadError) {
        console.warn('[create-phantom] ⚠️ Failed to upload static metadata:', uploadError.message);
      } else {
        console.log('[create-phantom] ✅ Static metadata JSON uploaded:', jsonPath);
      }
    } catch (metaUploadError) {
      console.warn('[create-phantom] ⚠️ Metadata upload error (non-fatal):', metaUploadError);
    }

    // For Phantom launches, we need to:
    // 1. Add Jito tip instruction to the LAST transaction (per Jito docs)
    // 2. Partially sign transactions with mint/config keypairs
    // 3. Return serialized transactions for Phantom to sign as fee payer
    
    const phantomPubkey = new PublicKey(phantomWallet);
    
    // CRITICAL: Add Jito tip to LAST transaction BEFORE setting blockhash/signing
    // This ensures the tip is embedded, not a separate tx (which Jito rejects)
    addJitoTipToLastTransaction(transactions, phantomPubkey, JITO_TIP_LAMPORTS);
    
    const serializedTransactions: string[] = [];

    // Build a map of available keypairs for partial signing
    const availableKeypairs: Map<string, Keypair> = new Map([
      [mintKeypair.publicKey.toBase58(), mintKeypair],
      [configKeypair.publicKey.toBase58(), configKeypair],
    ]);

    console.log('[create-phantom] Available partial signers:', Array.from(availableKeypairs.keys()));

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      // Fresh blockhash with retry for rate limits
      const latest = await getBlockhashWithRetry(connection);
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

    // Build transaction labels for better UX
    const txLabels: string[] = [];
    for (let i = 0; i < serializedTransactions.length; i++) {
      if (i === 0) txLabels.push("Create Config");
      else if (i === 1) txLabels.push("Create Pool");
      else if (i === 2 && effectiveDevBuySol > 0) txLabels.push(`Dev Buy (${effectiveDevBuySol} SOL)`);
      else txLabels.push(`Transaction ${i + 1}`);
    }

    return res.status(200).json({
      success: true,
      mintAddress,
      dbcPoolAddress,
      poolAddress: dbcPoolAddress,
      unsignedTransactions: serializedTransactions,
      txLabels, // Labels for each transaction step
      vanityKeypairId,
      requiresPhantomSignature: true,
      txCount: serializedTransactions.length,
      devBuyRequested: effectiveDevBuySol > 0,
      devBuySol: effectiveDevBuySol,
      jitoTipEmbedded: true, // Tip is embedded in last tx, no frontend tip needed
      jitoTipLamports: JITO_TIP_LAMPORTS,
      message: 'Transactions prepared with Jito tip embedded in last tx. Use sequential signAndSendTransaction for reliability.',
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
