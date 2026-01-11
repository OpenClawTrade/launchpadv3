import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Keypair, PublicKey } from '@solana/web3.js';
import { 
  PLATFORM_FEE_WALLET, 
  INITIAL_VIRTUAL_SOL, 
  TOTAL_SUPPLY,
  GRADUATION_THRESHOLD_SOL,
  TOKEN_DECIMALS,
  TRADING_FEE_BPS,
} from '../lib/config.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { getConnection, serializeTransaction } from '../lib/solana.js';
import { createMeteoraPool, getRequiredSigners, serializeTransaction as serializeMeteoraTransaction } from '../lib/meteora.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// UUID v5 implementation for Privy ID to UUID mapping
const UUID_V5_NAMESPACE_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

async function sha1(data: Uint8Array): Promise<Uint8Array> {
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha1');
  hash.update(data);
  return new Uint8Array(hash.digest());
}

async function uuidV5(name: string, namespaceUuid: string): Promise<string> {
  const namespaceBytes = uuidToBytes(namespaceUuid);
  const nameBytes = new TextEncoder().encode(name);
  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length);
  combined.set(namespaceBytes, 0);
  combined.set(nameBytes, namespaceBytes.length);
  const hash = await sha1(combined);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return bytesToUuid(hash.slice(0, 16));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      creatorWallet,
      privyUserId,
      name,
      ticker,
      description,
      imageUrl,
      websiteUrl,
      twitterUrl,
      telegramUrl,
      discordUrl,
      initialBuySol = 0,
    } = req.body;

    console.log('[pool/create] Request:', { creatorWallet, name, ticker, initialBuySol });

    if (!creatorWallet || !name || !ticker) {
      return res.status(400).json({ error: 'creatorWallet, name, and ticker are required' });
    }

    const supabase = getSupabaseClient();

    // Get creator profile ID
    let creatorId: string | null = null;
    if (privyUserId) {
      creatorId = await uuidV5(privyUserId, UUID_V5_NAMESPACE_DNS);
    }

    // Create real Meteora pool
    console.log('[pool/create] Creating Meteora pool...');
    
    const { transactions, mintKeypair, configKeypair, poolAddress } = await createMeteoraPool({
      creatorWallet,
      name,
      ticker: ticker.toUpperCase(),
      description,
      imageUrl,
      websiteUrl,
      twitterUrl,
      telegramUrl,
      discordUrl,
      initialBuySol,
    });

    const mintAddress = mintKeypair.publicKey.toBase58();
    const dbcPoolAddress = poolAddress.toBase58();
    
    console.log('[pool/create] Meteora pool created:', { mintAddress, dbcPoolAddress });

    // Calculate initial price
    const virtualSol = INITIAL_VIRTUAL_SOL;
    const virtualToken = TOTAL_SUPPLY;
    const initialPrice = virtualSol / virtualToken;

    // Generate a UUID for the token
    const crypto = await import('crypto');
    const tokenId = crypto.randomUUID();

    // Create token record using RPC function (bypasses RLS)
    const { error: tokenError } = await supabase.rpc('backend_create_token', {
      p_id: tokenId,
      p_mint_address: mintAddress,
      p_name: name,
      p_ticker: ticker.toUpperCase(),
      p_creator_wallet: creatorWallet,
      p_creator_id: creatorId,
      p_dbc_pool_address: dbcPoolAddress,
      p_description: description || null,
      p_image_url: imageUrl || null,
      p_website_url: websiteUrl || null,
      p_twitter_url: twitterUrl || null,
      p_telegram_url: telegramUrl || null,
      p_discord_url: discordUrl || null,
      p_virtual_sol_reserves: virtualSol,
      p_virtual_token_reserves: virtualToken,
      p_real_sol_reserves: initialBuySol || 0,
      p_total_supply: TOTAL_SUPPLY,
      p_price_sol: initialPrice,
      p_market_cap_sol: virtualSol,
      p_graduation_threshold_sol: GRADUATION_THRESHOLD_SOL,
      p_system_fee_bps: Math.floor(TRADING_FEE_BPS / 2),
      p_creator_fee_bps: Math.floor(TRADING_FEE_BPS / 2),
    });

    if (tokenError) {
      console.error('[pool/create] Token insert error:', tokenError);
      throw tokenError;
    }

    // Create fee earners using RPC functions
    // Creator entry kept for UI consistency but with 0% share
    const { error: creatorFeeError } = await supabase.rpc('backend_create_fee_earner', {
      p_token_id: tokenId,
      p_earner_type: 'creator',
      p_share_bps: 0, // 0% - No on-chain creator fees
      p_wallet_address: creatorWallet,
      p_profile_id: creatorId,
    });

    if (creatorFeeError) {
      console.error('[pool/create] Creator fee earner error:', creatorFeeError);
    }

    const { error: systemFeeError } = await supabase.rpc('backend_create_fee_earner', {
      p_token_id: tokenId,
      p_earner_type: 'system',
      p_share_bps: 10000, // 100% of 2% = 2% to treasury
      p_wallet_address: PLATFORM_FEE_WALLET, // 7UiXCtz3wxjiKS2W3LQsJcs6GqwfuDbeEcRhaAVwcHB2
    });

    if (systemFeeError) {
      console.error('[pool/create] System fee earner error:', systemFeeError);
    }

    // If initial buy, calculate and record holdings
    if (initialBuySol > 0) {
      const k = virtualSol * virtualToken;
      const newVirtualSol = virtualSol + initialBuySol;
      const newVirtualToken = k / newVirtualSol;
      const tokensReceived = virtualToken - newVirtualToken;

      // Use RPC function for token holdings
      const { error: holdingsError } = await supabase.rpc('backend_upsert_token_holding', {
        p_token_id: tokenId,
        p_wallet_address: creatorWallet,
        p_balance_delta: tokensReceived,
        p_profile_id: creatorId,
      });

      if (holdingsError) {
        console.error('[pool/create] Holdings insert error:', holdingsError);
      }

      // Use RPC function to update token state
      const { error: updateError } = await supabase.rpc('backend_update_token_state', {
        p_token_id: tokenId,
        p_virtual_sol_reserves: newVirtualSol,
        p_virtual_token_reserves: newVirtualToken,
        p_real_sol_reserves: initialBuySol,
        p_real_token_reserves: TOTAL_SUPPLY - tokensReceived,
        p_price_sol: newVirtualSol / newVirtualToken,
        p_market_cap_sol: newVirtualSol,
        p_bonding_curve_progress: (initialBuySol / GRADUATION_THRESHOLD_SOL) * 100,
      });

      if (updateError) {
        console.error('[pool/create] Token update error:', updateError);
      }

      // Update holder count
      await supabase.rpc('backend_update_holder_count', { p_token_id: tokenId });
    }

    // Serialize transactions and signers for client signing
    const serializedTransactions = transactions.map(tx => serializeMeteoraTransaction(tx));
    const signers = getRequiredSigners(mintKeypair, configKeypair);

    console.log('[pool/create] Success:', { tokenId, mintAddress, dbcPoolAddress });

    return res.status(200).json({
      success: true,
      tokenId: tokenId,
      mintAddress: mintAddress,
      dbcPoolAddress: dbcPoolAddress,
      // Serialized transactions for client wallet signing
      transactions: serializedTransactions,
      // Keypairs that need to sign (mint and config)
      signers: {
        mint: signers.mint,
        config: signers.config,
      },
    });

  } catch (error) {
    console.error('[pool/create] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
