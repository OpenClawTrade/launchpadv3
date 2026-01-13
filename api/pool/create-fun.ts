import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';

// Configuration
const TREASURY_WALLET = '7UiXCtz3wxjiKS2W3LQsJcs6GqwfuDbeEcRhaAVwcHB2';
const TOKEN_SUPPLY = 1_000_000_000;
const VIRTUAL_SOL = 30;
const VIRTUAL_TOKENS = 1_000_000_000;
const INITIAL_PRICE = VIRTUAL_SOL / VIRTUAL_TOKENS;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Get treasury keypair from env
function getTreasuryKeypair(): Keypair {
  const privateKey = process.env.TREASURY_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('TREASURY_PRIVATE_KEY not configured');
  }

  try {
    if (privateKey.startsWith('[')) {
      const keyArray = JSON.parse(privateKey);
      return Keypair.fromSecretKey(new Uint8Array(keyArray));
    } else {
      // Base58 encoded
      const bs58 = require('bs58');
      const decoded = bs58.decode(privateKey);
      return Keypair.fromSecretKey(decoded);
    }
  } catch (e) {
    throw new Error('Invalid TREASURY_PRIVATE_KEY format');
  }
}

// Get Supabase client
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
    const supabase = getSupabase();
    const rpcUrl = process.env.HELIUS_RPC_URL;

    if (!rpcUrl) {
      throw new Error('HELIUS_RPC_URL not configured');
    }

    const connection = new Connection(rpcUrl, 'confirmed');

    // For now, we'll create a mock token since full Meteora integration 
    // requires complex pool setup. In production, this would call createMeteoraPool
    
    // Generate a unique mint address
    const mintKeypair = Keypair.generate();
    const mintAddress = mintKeypair.publicKey.toBase58();

    console.log('[create-fun] Generated mint address:', mintAddress);

    // In production: Create actual Meteora pool here
    // const { transactions, poolAddress } = await createMeteoraPool({...});
    // Sign and send all transactions with treasury keypair

    // For now, insert into database with mock data
    const tokenId = crypto.randomUUID();
    
    // Insert token into main tokens table (so it can be traded)
    const { error: tokenError } = await supabase.rpc('backend_create_token', {
      p_id: tokenId,
      p_mint_address: mintAddress,
      p_name: name.slice(0, 32),
      p_ticker: ticker.toUpperCase().slice(0, 10),
      p_creator_wallet: TREASURY_WALLET, // Treasury is the on-chain creator
      p_description: description || `${name} - A fun meme coin!`,
      p_image_url: imageUrl || null,
      p_virtual_sol_reserves: VIRTUAL_SOL,
      p_virtual_token_reserves: VIRTUAL_TOKENS,
      p_total_supply: TOKEN_SUPPLY,
      p_price_sol: INITIAL_PRICE,
      p_market_cap_sol: VIRTUAL_SOL,
      p_system_fee_bps: 200, // 2% platform fee
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
      p_wallet_address: TREASURY_WALLET,
    });

    console.log('[create-fun] Token created successfully:', tokenId);

    return res.status(200).json({
      success: true,
      tokenId,
      mintAddress,
      dbcPoolAddress: null, // Will be set when real pool is created
      creatorWallet: TREASURY_WALLET,
      feeRecipientWallet,
    });

  } catch (error) {
    console.error('[create-fun] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
