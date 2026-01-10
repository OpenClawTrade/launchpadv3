import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { 
  PLATFORM_FEE_WALLET, 
  INITIAL_VIRTUAL_SOL, 
  TOTAL_SUPPLY,
  GRADUATION_THRESHOLD_SOL,
  TOKEN_DECIMALS,
  TRADING_FEE_BPS,
} from '../lib/config';
import { getSupabaseClient } from '../lib/supabase';
import { getConnection, generateMockMintAddress, serializeTransaction } from '../lib/solana';

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

    // For production: Use Meteora SDK to create real pool
    // The Meteora SDK would be imported and used here to:
    // 1. Generate token mint keypair
    // 2. Generate config keypair
    // 3. Build pool creation transaction
    // 4. Return serialized transaction for client signing
    
    // For now, generate mock addresses (replace with real Meteora SDK calls)
    const mintAddress = generateMockMintAddress();
    const dbcPoolAddress: string | null = null; // Would come from Meteora SDK
    
    // Calculate initial price
    const virtualSol = INITIAL_VIRTUAL_SOL;
    const virtualToken = TOTAL_SUPPLY;
    const initialPrice = virtualSol / virtualToken;

    // Create token record in database
    const { data: token, error: tokenError } = await supabase
      .from('tokens')
      .insert({
        mint_address: mintAddress,
        name,
        ticker: ticker.toUpperCase(),
        description: description || null,
        image_url: imageUrl || null,
        website_url: websiteUrl || null,
        twitter_url: twitterUrl || null,
        telegram_url: telegramUrl || null,
        discord_url: discordUrl || null,
        creator_wallet: creatorWallet,
        creator_id: creatorId,
        dbc_pool_address: dbcPoolAddress,
        virtual_sol_reserves: virtualSol,
        virtual_token_reserves: virtualToken,
        real_sol_reserves: initialBuySol || 0,
        total_supply: TOTAL_SUPPLY,
        graduation_threshold_sol: GRADUATION_THRESHOLD_SOL,
        price_sol: initialPrice,
        market_cap_sol: virtualSol,
        status: 'bonding',
        migration_status: dbcPoolAddress ? 'dbc_active' : 'pending',
        creator_fee_bps: TRADING_FEE_BPS / 2,
        system_fee_bps: TRADING_FEE_BPS / 2,
        holder_count: initialBuySol > 0 ? 1 : 0,
      })
      .select()
      .single();

    if (tokenError) {
      console.error('[pool/create] Token insert error:', tokenError);
      throw tokenError;
    }

    // Create fee earners
    await supabase.from('fee_earners').insert([
      {
        token_id: token.id,
        wallet_address: creatorWallet,
        profile_id: creatorId,
        earner_type: 'creator',
        share_bps: 5000, // 50%
      },
      {
        token_id: token.id,
        wallet_address: PLATFORM_FEE_WALLET,
        earner_type: 'system',
        share_bps: 5000, // 50%
      },
    ]);

    // If initial buy, calculate and record
    if (initialBuySol > 0) {
      const k = virtualSol * virtualToken;
      const newVirtualSol = virtualSol + initialBuySol;
      const newVirtualToken = k / newVirtualSol;
      const tokensReceived = virtualToken - newVirtualToken;

      await supabase.from('token_holdings').insert({
        token_id: token.id,
        wallet_address: creatorWallet,
        profile_id: creatorId,
        balance: tokensReceived,
      });

      await supabase.from('tokens').update({
        real_sol_reserves: initialBuySol,
        bonding_curve_progress: (initialBuySol / GRADUATION_THRESHOLD_SOL) * 100,
        holder_count: 1,
      }).eq('id', token.id);
    }

    console.log('[pool/create] Token created:', { tokenId: token.id, mintAddress });

    return res.status(200).json({
      success: true,
      tokenId: token.id,
      mintAddress: token.mint_address,
      dbcPoolAddress: token.dbc_pool_address,
      // In production, would also return:
      // transactions: [/* serialized transactions for client signing */],
      // signers: { config: '...', baseMint: '...' },
    });

  } catch (error) {
    console.error('[pool/create] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
