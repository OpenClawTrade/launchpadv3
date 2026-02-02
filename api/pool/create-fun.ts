import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionConfirmationStatus,
} from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';
import { createMeteoraPool, createMeteoraPoolWithMint } from '../../lib/meteora.js';
import { PLATFORM_FEE_WALLET, TOTAL_SUPPLY, GRADUATION_THRESHOLD_SOL, TRADING_FEE_BPS } from '../../lib/config.js';
import { getAvailableVanityAddress, markVanityAddressUsed, releaseVanityAddress } from '../../lib/vanityGenerator.js';

const VERSION = "v2.0.0"; // Major version bump: now confirms transactions before DB insert

// Configuration
const INITIAL_VIRTUAL_SOL = 30;
const MAX_LAUNCH_RETRIES = 2;
const TX_CONFIRMATION_TIMEOUT_MS = 45000; // 45 seconds per transaction
const PRIORITY_FEE_MICROLAMPORTS = 500000; // 5x higher for reliability

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

// Helper: sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry blockhash fetch with exponential backoff (1s, 2s, 4s, 8s, 16s)
async function getBlockhashWithRetry(connection: Connection, maxRetries = 5): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  let lastError: Error | null = null;
  const baseDelayMs = 1000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await connection.getLatestBlockhash('confirmed');
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Unknown error');
      const is429 = lastError.message.includes('429') || lastError.message.includes('max usage');
      console.log(`[create-fun] Blockhash attempt ${i + 1}/${maxRetries} failed (429: ${is429}):`, lastError.message);
      
      if (i < maxRetries - 1) {
        const delayMs = baseDelayMs * Math.pow(2, i);
        console.log(`[create-fun] Waiting ${delayMs}ms before retry...`);
        await sleep(delayMs);
      }
    }
  }
  throw lastError || new Error('Failed to get blockhash after ' + maxRetries + ' retries');
}

// Confirm transaction with timeout and retries
async function confirmTransaction(
  connection: Connection,
  signature: string,
  commitment: TransactionConfirmationStatus = 'confirmed',
  timeoutMs: number = TX_CONFIRMATION_TIMEOUT_MS
): Promise<void> {
  const startTime = Date.now();
  const maxRetries = 5;
  const baseDelayMs = 1000;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) {
        throw new Error(`Transaction confirmation timeout after ${timeoutMs}ms`);
      }
      
      const remainingTime = timeoutMs - elapsed;
      
      // Use confirmTransaction API with timeout
      const result = await Promise.race([
        connection.getSignatureStatus(signature, { searchTransactionHistory: true }),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('RPC timeout')), Math.min(remainingTime, 10000))
        )
      ]);
      
      if (result && result.value) {
        const status = result.value;
        
        // Check for error
        if (status.err) {
          throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
        }
        
        // Check confirmation level
        if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
          console.log(`[create-fun] TX confirmed: ${signature.slice(0, 16)}... (${status.confirmationStatus})`);
          return;
        }
        
        // Still processing
        if (status.confirmationStatus === 'processed') {
          console.log(`[create-fun] TX processed, waiting for confirmation...`);
        }
      }
      
      // Wait before next check
      await sleep(baseDelayMs * Math.pow(1.5, attempt));
      
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Unknown error');
      
      // If it's a hard failure, throw immediately
      if (error.message.includes('Transaction failed on-chain')) {
        throw error;
      }
      
      console.log(`[create-fun] Confirmation attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
      
      if (attempt < maxRetries - 1) {
        await sleep(baseDelayMs * Math.pow(2, attempt));
      }
    }
  }
  
  // Final check
  const finalStatus = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
  if (finalStatus?.value?.confirmationStatus === 'confirmed' || finalStatus?.value?.confirmationStatus === 'finalized') {
    console.log(`[create-fun] TX confirmed on final check: ${signature.slice(0, 16)}...`);
    return;
  }
  
  throw new Error(`Transaction not confirmed after ${maxRetries} attempts: ${signature}`);
}

// Verify pool exists on-chain
async function verifyPoolExists(connection: Connection, poolAddress: PublicKey): Promise<boolean> {
  try {
    const accountInfo = await connection.getAccountInfo(poolAddress);
    return accountInfo !== null && accountInfo.data.length > 0;
  } catch (e) {
    console.log(`[create-fun] Pool verification failed:`, e instanceof Error ? e.message : e);
    return false;
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
  const startTime = Date.now();

  try {
    const { 
      name, ticker, description, imageUrl, websiteUrl, twitterUrl, 
      telegramUrl, discordUrl,
      feeRecipientWallet, serverSideSign, useVanityAddress = false,
      jobId, apiAccountId,
      feeMode
    } = req.body;

    // Validate fee mode
    const validFeeModes = ['creator', 'holder_rewards'];
    const tokenFeeMode = validFeeModes.includes(feeMode) ? feeMode : 'creator';

    console.log(`[create-fun][${VERSION}] Request received`, { name, ticker, useVanityAddress, apiAccountId, feeMode: tokenFeeMode, elapsed: Date.now() - startTime });

    if (!name || !ticker) {
      return res.status(400).json({ error: 'Missing required fields: name, ticker' });
    }

    if (!serverSideSign) {
      return res.status(400).json({ error: 'This endpoint requires serverSideSign=true' });
    }

    console.log(`[create-fun][${VERSION}] Starting token creation`, { name, ticker, elapsed: Date.now() - startTime });

    const treasuryKeypair = getTreasuryKeypair();
    const treasuryAddress = treasuryKeypair.publicKey.toBase58();
    
    const supabase = getSupabase();
    const rpcUrl = process.env.HELIUS_RPC_URL;

    if (!rpcUrl) {
      throw new Error('HELIUS_RPC_URL not configured');
    }

    const connection = new Connection(rpcUrl, 'confirmed');

    // Try to get a vanity address for the mint
    let vanityKeypair: { id: string; publicKey: string; keypair: Keypair } | null = null;
    
    if (useVanityAddress) {
      console.log(`[create-fun][${VERSION}] Vanity lookup starting...`, { elapsed: Date.now() - startTime });
      try {
        vanityKeypair = await getAvailableVanityAddress('TNA');
        if (vanityKeypair) {
          vanityKeypairId = vanityKeypair.id;
          console.log(`[create-fun][${VERSION}] Using vanity mint`, { publicKey: vanityKeypair.publicKey, elapsed: Date.now() - startTime });
        } else {
          console.log(`[create-fun][${VERSION}] No vanity available, using random`, { elapsed: Date.now() - startTime });
        }
      } catch (vanityError) {
        console.log(`[create-fun][${VERSION}] Vanity lookup failed, using random`, { error: vanityError, elapsed: Date.now() - startTime });
      }
    } else {
      console.log(`[create-fun][${VERSION}] Vanity DISABLED, using random mint`, { elapsed: Date.now() - startTime });
    }

    // === MAIN LAUNCH LOOP WITH RETRIES ===
    let lastError: Error | null = null;
    let signatures: string[] = [];
    let mintAddress: string = '';
    let dbcPoolAddress: string = '';
    let mintKeypair: Keypair | null = null;
    let configKeypair: Keypair | null = null;
    let poolAddress: PublicKey | null = null;

    for (let attempt = 0; attempt < MAX_LAUNCH_RETRIES; attempt++) {
      try {
        console.log(`[create-fun][${VERSION}] Launch attempt ${attempt + 1}/${MAX_LAUNCH_RETRIES}`, { elapsed: Date.now() - startTime });
        
        // Fetch fresh blockhash for each attempt
        console.log(`[create-fun][${VERSION}] Fetching blockhash...`, { elapsed: Date.now() - startTime });
        const latestBlockhash = await getBlockhashWithRetry(connection);
        console.log(`[create-fun][${VERSION}] Blockhash fetched`, { elapsed: Date.now() - startTime });

        // Create Meteora pool transactions
        console.log(`[create-fun][${VERSION}] Creating pool transactions...`, { elapsed: Date.now() - startTime });
        
        let transactions: Transaction[];
        
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

        mintAddress = mintKeypair.publicKey.toBase58();
        dbcPoolAddress = poolAddress.toBase58();
        
        console.log(`[create-fun][${VERSION}] Pool prepared`, { mintAddress, dbcPoolAddress, txCount: transactions.length, elapsed: Date.now() - startTime });

        // Build keypair map for signing
        const availableKeypairs: Map<string, Keypair> = new Map([
          [treasuryKeypair.publicKey.toBase58(), treasuryKeypair],
          [mintKeypair.publicKey.toBase58(), mintKeypair],
          [configKeypair.publicKey.toBase58(), configKeypair],
        ]);

        signatures = [];

        // === SEQUENTIAL TRANSACTION EXECUTION WITH CONFIRMATION ===
        for (let i = 0; i < transactions.length; i++) {
          const tx = transactions[i];

          // Use fresh blockhash
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

          console.log(`[create-fun][${VERSION}] Sending tx ${i + 1}/${transactions.length}...`, { elapsed: Date.now() - startTime });

          // Send transaction with higher priority
          const signature = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false, // Enable preflight for better error detection
            preflightCommitment: 'confirmed',
            maxRetries: 5,
          });

          signatures.push(signature);
          console.log(`[create-fun][${VERSION}] Tx ${i + 1} sent, waiting for confirmation...`, { sig: signature.slice(0, 16), elapsed: Date.now() - startTime });

          // CRITICAL: Wait for confirmation before proceeding to next transaction
          await confirmTransaction(connection, signature, 'confirmed', TX_CONFIRMATION_TIMEOUT_MS);
          
          console.log(`[create-fun][${VERSION}] Tx ${i + 1} CONFIRMED`, { sig: signature.slice(0, 16), elapsed: Date.now() - startTime });
        }

        // === VERIFY POOL EXISTS ON-CHAIN ===
        console.log(`[create-fun][${VERSION}] Verifying pool exists on-chain...`, { elapsed: Date.now() - startTime });
        
        // Wait a moment for state propagation
        await sleep(1000);
        
        const poolExists = await verifyPoolExists(connection, poolAddress);
        if (!poolExists) {
          throw new Error(`Pool account not found on-chain after confirmation: ${dbcPoolAddress}`);
        }
        
        console.log(`[create-fun][${VERSION}] ✅ Pool verified on-chain`, { poolAddress: dbcPoolAddress, elapsed: Date.now() - startTime });
        
        // Success! Break out of retry loop
        lastError = null;
        break;
        
      } catch (e) {
        lastError = e instanceof Error ? e : new Error('Unknown error');
        console.error(`[create-fun][${VERSION}] Launch attempt ${attempt + 1} failed:`, lastError.message);
        
        if (attempt < MAX_LAUNCH_RETRIES - 1) {
          const backoffMs = 2000 * Math.pow(2, attempt);
          console.log(`[create-fun][${VERSION}] Retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
        }
      }
    }

    // If all retries failed, throw the last error
    if (lastError) {
      throw lastError;
    }

    console.log(`[create-fun][${VERSION}] All transactions confirmed`, { count: signatures.length, elapsed: Date.now() - startTime });

    // === DATABASE OPERATIONS (only after on-chain confirmation) ===
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
      p_website_url: websiteUrl || null,
      p_twitter_url: twitterUrl || null,
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
      console.error(`[create-fun][${VERSION}] Token creation error`, { error: tokenError, elapsed: Date.now() - startTime });
      throw new Error(`Failed to create token: ${tokenError.message}`);
    }

    console.log(`[create-fun][${VERSION}] Token saved to DB`, { tokenId, elapsed: Date.now() - startTime });

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
    }).then(({ error }) => {
      if (error) console.log('[create-fun] Fee earner creation failed:', error);
    });

    // If launched via API, attribute token to API account for fee distribution
    if (apiAccountId) {
      console.log(`[create-fun][${VERSION}] Attributing token to API account`, { apiAccountId, elapsed: Date.now() - startTime });
      supabase.rpc('backend_attribute_token_to_api', {
        p_token_id: tokenId,
        p_api_account_id: apiAccountId,
      }).then(({ error }) => {
        if (error) console.log('[create-fun] API attribution failed:', error);
        else console.log(`[create-fun] Token ${tokenId} attributed to API account ${apiAccountId}`);
      });
    }

    // Trigger sniper buy (fire-and-forget, non-blocking)
    const supabaseUrl = process.env.SUPABASE_URL || 'https://ptwytypavumcrbofspno.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0d3l0eXBhdnVtY3Jib2ZzcG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTIyODksImV4cCI6MjA4MjQ4ODI4OX0.7FFIiwQTgqIQn4lzyDHPTsX-6PD5MPqgZSdVVsH9A44';
    
    const sniperClient = createClient(supabaseUrl, supabaseAnonKey);
    sniperClient.functions.invoke('fun-sniper-buy', {
      body: { poolAddress: dbcPoolAddress, mintAddress, tokenId, funTokenId: null },
    }).catch(err => console.log(`[create-fun][${VERSION}] Sniper fire-and-forget`, { error: err?.message }));

    console.log(`[create-fun][${VERSION}] SUCCESS`, { tokenId, mintAddress, totalElapsed: Date.now() - startTime });

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
      // New: indicate this was a confirmed launch
      confirmed: true,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[create-fun][${VERSION}] Error`, { error: errorMessage, elapsed: Date.now() - startTime });
    
    // Release vanity address on error
    if (vanityKeypairId) {
      releaseVanityAddress(vanityKeypairId).catch(e => 
        console.log(`[create-fun][${VERSION}] Failed to release vanity`, { error: e })
      );
    }
    
    // Return specific error for better debugging
    return res.status(500).json({
      success: false,
      error: errorMessage,
      confirmed: false,
    });
  }
}
