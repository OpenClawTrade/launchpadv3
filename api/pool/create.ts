import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Keypair, PublicKey } from '@solana/web3.js';
import { 
  PLATFORM_FEE_WALLET, 
  INITIAL_VIRTUAL_SOL, 
  TOTAL_SUPPLY,
  GRADUATION_THRESHOLD_SOL,
  TOKEN_DECIMALS,
  TRADING_FEE_BPS,
} from '../lib/config';
import { getSupabaseClient } from '../lib/supabase';
import { getConnection, serializeTransaction } from '../lib/solana';
import { createMeteoraPool, getRequiredSigners, serializeTransaction as serializeMeteoraTransaction } from '../lib/meteora';

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
    
    const { transaction, mintKeypair, configKeypair, poolAddress } = await createMeteoraPool({
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
        migration_status: 'dbc_active',
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

    // Create fee earners - creator gets 50%, platform treasury gets 50%
    await supabase.from('fee_earners').insert([
      {
        token_id: token.id,
        wallet_address: creatorWallet,
        profile_id: creatorId,
        earner_type: 'creator',
        share_bps: 5000, // 50% of 2% = 1%
      },
      {
        token_id: token.id,
        wallet_address: PLATFORM_FEE_WALLET, // 7UiXCtz3wxjiKS2W3LQsJcs6GqwfuDbeEcRhaAVwcHB2
        earner_type: 'system',
        share_bps: 5000, // 50% of 2% = 1%
      },
    ]);

    // If initial buy, calculate and record holdings
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

    // Serialize transaction and signers for client signing
    const serializedTransaction = serializeMeteoraTransaction(transaction);
    const signers = getRequiredSigners(mintKeypair, configKeypair);

    console.log('[pool/create] Success:', { tokenId: token.id, mintAddress, dbcPoolAddress });

    return res.status(200).json({
      success: true,
      tokenId: token.id,
      mintAddress: token.mint_address,
      dbcPoolAddress: token.dbc_pool_address,
      // Serialized transaction for client wallet signing
      transaction: serializedTransaction,
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
