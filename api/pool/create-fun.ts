import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';
import { createMeteoraPool, executeMeteoraSwap } from '../lib/meteora.js';
import { PLATFORM_FEE_WALLET, TOTAL_SUPPLY, GRADUATION_THRESHOLD_SOL, TRADING_FEE_BPS } from '../lib/config.js';
import { 
  JITO_CONFIG, 
  getRandomTipAccount, 
  getRandomBlockEngine,
  getSniperKeypair,
} from '../lib/jito.js';

// Configuration
const INITIAL_VIRTUAL_SOL = 30;
const SNIPER_BUY_SOL = 0.5; // Sniper buys 0.5 SOL worth
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
    const { name, ticker, description, imageUrl, websiteUrl, twitterUrl, feeRecipientWallet, serverSideSign } = req.body;

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

    console.log('[create-fun] All pool transactions confirmed!', { signatures });

    // === SNIPER BUY PHASE ===
    let sniperTradeId: string | null = null;
    let sniperSignature: string | null = null;
    
    try {
      // Get sniper keypair
      const sniperKeypair = getSniperKeypair();
      const sniperWallet = sniperKeypair.publicKey.toBase58();
      console.log('[create-fun] Sniper wallet:', sniperWallet);

      // Record pending sniper trade
      const crypto = await import('crypto');
      sniperTradeId = crypto.randomUUID();
      
      await supabase.rpc('backend_create_sniper_trade', {
        p_token_id: null, // Will be set after token creation
        p_fun_token_id: null,
        p_mint_address: mintAddress,
        p_pool_address: dbcPoolAddress,
        p_buy_amount_sol: SNIPER_BUY_SOL,
      });

      // Build sniper buy transaction
      console.log('[create-fun] Building sniper buy transaction for', SNIPER_BUY_SOL, 'SOL');
      
      const { transaction: buyTx, estimatedOutput } = await executeMeteoraSwap({
        poolAddress: dbcPoolAddress,
        userWallet: sniperWallet,
        amount: SNIPER_BUY_SOL,
        isBuy: true,
        slippageBps: 5000, // 50% slippage for guaranteed execution
      });

      // Add priority fees and Jito tip
      const latest = await connection.getLatestBlockhash('confirmed');
      
      // Create tip instruction
      const tipIx = SystemProgram.transfer({
        fromPubkey: sniperKeypair.publicKey,
        toPubkey: getRandomTipAccount(),
        lamports: JITO_CONFIG.TIP_LAMPORTS,
      });

      // Create priority fee instructions
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: JITO_CONFIG.COMPUTE_UNITS });
      const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({ 
        microLamports: Math.floor((JITO_CONFIG.PRIORITY_FEE_LAMPORTS * 1_000_000) / JITO_CONFIG.COMPUTE_UNITS) 
      });

      // Build final transaction
      let sniperTx: Transaction;
      if (buyTx instanceof Transaction) {
        sniperTx = new Transaction();
        sniperTx.add(computeBudgetIx, priorityFeeIx);
        sniperTx.instructions.push(...buyTx.instructions);
        sniperTx.add(tipIx);
      } else {
        // Handle VersionedTransaction
        console.log('[create-fun] Buy transaction is VersionedTransaction, wrapping...');
        sniperTx = new Transaction();
        sniperTx.add(computeBudgetIx, priorityFeeIx, tipIx);
        // For versioned, we'll send separately
      }

      sniperTx.recentBlockhash = latest.blockhash;
      sniperTx.feePayer = sniperKeypair.publicKey;

      // Submit via Jito for priority execution
      console.log('[create-fun] Submitting sniper buy via Jito...');
      
      // Sign and serialize
      sniperTx.sign(sniperKeypair);
      const serializedTx = bs58.encode(sniperTx.serialize());

      // Submit to Jito
      const blockEngine = getRandomBlockEngine();
      const jitoResponse = await fetch(blockEngine, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [[serializedTx]],
        }),
      });

      const jitoResult = await jitoResponse.json();

      if (jitoResult.error) {
        console.error('[create-fun] Jito bundle error:', jitoResult.error);
        // Fallback to regular send
        console.log('[create-fun] Falling back to regular transaction send...');
        sniperSignature = await connection.sendRawTransaction(sniperTx.serialize(), {
          skipPreflight: true,
          preflightCommitment: 'confirmed',
        });
      } else {
        console.log('[create-fun] Jito bundle submitted:', jitoResult.result);
        sniperSignature = bs58.encode(sniperTx.signature!);
      }

      // Wait for confirmation
      if (sniperSignature) {
        try {
          await connection.confirmTransaction({
            signature: sniperSignature,
            blockhash: latest.blockhash,
            lastValidBlockHeight: latest.lastValidBlockHeight,
          }, 'confirmed');
          
          console.log('[create-fun] ✅ Sniper buy confirmed:', sniperSignature);
          
          // Update sniper trade record
          await supabase.rpc('backend_update_sniper_buy', {
            p_id: sniperTradeId,
            p_buy_signature: sniperSignature,
            p_tokens_received: estimatedOutput,
          });
        } catch (confirmError) {
          console.error('[create-fun] Sniper confirmation error:', confirmError);
        }
      }

      signatures.push(sniperSignature || 'pending');
      console.log('[create-fun] Sniper buy completed, tokens received:', estimatedOutput);
      
    } catch (sniperError) {
      console.error('[create-fun] Sniper buy failed:', sniperError);
      // Don't fail the entire launch, just log the error
      if (sniperTradeId) {
        await supabase.rpc('backend_fail_sniper_trade', {
          p_id: sniperTradeId,
          p_error_message: sniperError instanceof Error ? sniperError.message : 'Unknown error',
        });
      }
    }

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
      p_website_url: websiteUrl || 'https://ai67x.fun',
      p_twitter_url: twitterUrl || 'https://x.com/ai67x_fun',
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

    // Update sniper trade with token ID
    if (sniperTradeId) {
      await supabase.from('sniper_trades')
        .update({ token_id: tokenId })
        .eq('id', sniperTradeId);
    }

    // Create fee earner entry for platform
    await supabase.rpc('backend_create_fee_earner', {
      p_token_id: tokenId,
      p_earner_type: 'system',
      p_share_bps: 10000, // 100% goes to system (distributed via fun_distributions)
      p_wallet_address: PLATFORM_FEE_WALLET,
    });

    console.log('[create-fun] Token created successfully:', { tokenId, mintAddress, dbcPoolAddress, sniperSignature });

    return res.status(200).json({
      success: true,
      tokenId,
      mintAddress,
      dbcPoolAddress,
      poolAddress: dbcPoolAddress,
      creatorWallet: treasuryAddress,
      feeRecipientWallet,
      signatures,
      sniperBuy: sniperSignature ? {
        signature: sniperSignature,
        amountSol: SNIPER_BUY_SOL,
      } : null,
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
