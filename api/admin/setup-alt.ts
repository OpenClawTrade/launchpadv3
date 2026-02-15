import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { createAddressLookupTableOnChain, getAddressLookupTable } from '../../../lib/addressLookupTable.js';

function getTreasuryKeypair(): Keypair {
  const raw = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!raw) throw new Error('TREASURY_PRIVATE_KEY not configured');

  try {
    if (raw.startsWith('[')) {
      const bytes = new Uint8Array(JSON.parse(raw));
      return bytes.length === 64 ? Keypair.fromSecretKey(bytes) : Keypair.fromSeed(bytes);
    }
    const decoded: Uint8Array = bs58.decode(raw);
    return decoded.length === 64 ? Keypair.fromSecretKey(decoded) : Keypair.fromSeed(decoded);
  } catch (e) {
    throw new Error(`Invalid TREASURY_PRIVATE_KEY format`);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-treasury-secret',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers on ALL responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Simple auth check
  const secret = req.headers['x-treasury-secret'] as string;
  if (secret !== 'tuna-treasury-2024') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (!rpcUrl) {
    return res.status(500).json({ error: 'HELIUS_RPC_URL not configured' });
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const { mode } = req.body || {};

  try {
    if (mode === 'status') {
      // Check if ALT exists
      const altAddress = process.env.ALT_ADDRESS;
      if (!altAddress) {
        return res.status(200).json({
          success: true,
          exists: false,
          message: 'ALT_ADDRESS not set. Create one first.',
        });
      }

      const altAccount = await getAddressLookupTable(connection);
      return res.status(200).json({
        success: true,
        exists: !!altAccount,
        altAddress,
        addressCount: altAccount?.state.addresses.length || 0,
      });
    }

    if (mode === 'create') {
      // Check if one already exists
      const existingAlt = process.env.ALT_ADDRESS;
      if (existingAlt) {
        const existing = await getAddressLookupTable(connection);
        if (existing) {
          return res.status(200).json({
            success: true,
            alreadyExists: true,
            altAddress: existingAlt,
            addressCount: existing.state.addresses.length,
            message: 'ALT already exists. Set ALT_ADDRESS in Vercel env vars if not already done.',
          });
        }
      }

      const payer = getTreasuryKeypair();
      const balance = await connection.getBalance(payer.publicKey);

      if (balance < 0.05 * 1e9) {
        return res.status(400).json({
          error: `Treasury balance too low: ${(balance / 1e9).toFixed(4)} SOL. Need at least 0.05 SOL.`,
        });
      }

      const altAddress = await createAddressLookupTableOnChain(connection, payer);

      return res.status(200).json({
        success: true,
        altAddress: altAddress.toBase58(),
        message: `ALT created! Add ALT_ADDRESS=${altAddress.toBase58()} to your Vercel environment variables, then redeploy.`,
      });
    }

    return res.status(400).json({ error: 'Invalid mode. Use "status" or "create".' });
  } catch (error) {
    console.error('[setup-alt] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
