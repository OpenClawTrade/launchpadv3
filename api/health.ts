import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Get treasury keypair from env
function getTreasuryKeypair(): Keypair | null {
  const raw = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!raw) return null;

  try {
    if (raw.startsWith('[')) {
      const keyArray = JSON.parse(raw);
      const bytes = new Uint8Array(keyArray);
      if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
      if (bytes.length === 32) return Keypair.fromSeed(bytes);
      return null;
    }

    const decoded: Uint8Array = bs58.decode(raw);
    if (decoded.length === 64) return Keypair.fromSecretKey(decoded);
    if (decoded.length === 32) return Keypair.fromSeed(decoded);
    return null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*').end();
  }

  const health: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {},
    treasury: {},
    rpc: {},
  };

  // Check environment variables
  const envVars = [
    'TREASURY_PRIVATE_KEY',
    'HELIUS_RPC_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
  ];

  for (const varName of envVars) {
    const value = process.env[varName];
    (health.environment as Record<string, string>)[varName] = value 
      ? `✅ Set (${value.length} chars)` 
      : '❌ Missing';
  }

  // Check treasury wallet
  const treasuryKp = getTreasuryKeypair();
  if (treasuryKp) {
    const pubkey = treasuryKp.publicKey.toBase58();
    (health.treasury as Record<string, unknown>).publicKey = pubkey;
    (health.treasury as Record<string, unknown>).status = '✅ Valid';

    // Check balance if RPC is available
    const rpcUrl = process.env.HELIUS_RPC_URL;
    if (rpcUrl) {
      try {
        const connection = new Connection(rpcUrl, 'confirmed');
        const balance = await connection.getBalance(treasuryKp.publicKey);
        (health.treasury as Record<string, unknown>).balanceSOL = balance / LAMPORTS_PER_SOL;
        (health.treasury as Record<string, unknown>).balanceLamports = balance;
        (health.rpc as Record<string, unknown>).status = '✅ Connected';
        
        // Check slot to verify RPC is working
        const slot = await connection.getSlot();
        (health.rpc as Record<string, unknown>).currentSlot = slot;
      } catch (error) {
        (health.rpc as Record<string, unknown>).status = '❌ Error';
        (health.rpc as Record<string, unknown>).error = error instanceof Error ? error.message : 'Unknown error';
      }
    } else {
      (health.rpc as Record<string, unknown>).status = '❌ No RPC URL';
    }
  } else {
    (health.treasury as Record<string, unknown>).status = '❌ Invalid or missing';
  }

  // Set overall status
  const hasIssues = 
    !treasuryKp || 
    !process.env.HELIUS_RPC_URL || 
    !process.env.SUPABASE_URL;

  health.status = hasIssues ? 'degraded' : 'ok';

  return res.status(200).json(health);
}
