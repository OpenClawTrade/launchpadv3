/**
 * One-time setup script: Creates an Address Lookup Table (ALT) on Solana mainnet.
 * 
 * Usage:
 *   HELIUS_RPC_URL=https://... TREASURY_PRIVATE_KEY=... npx ts-node scripts/setup-alt.ts
 * 
 * After running, copy the printed ALT_ADDRESS and set it as an environment variable.
 */

import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { createAddressLookupTableOnChain } from '../lib/addressLookupTable.js';

async function main() {
  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (!rpcUrl) {
    console.error('❌ Set HELIUS_RPC_URL environment variable');
    process.exit(1);
  }

  const raw = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!raw) {
    console.error('❌ Set TREASURY_PRIVATE_KEY environment variable');
    process.exit(1);
  }

  let payer: Keypair;
  try {
    if (raw.startsWith('[')) {
      payer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
    } else {
      const decoded = bs58.decode(raw);
      payer = decoded.length === 64
        ? Keypair.fromSecretKey(decoded)
        : Keypair.fromSeed(decoded);
    }
  } catch (e) {
    console.error('❌ Invalid TREASURY_PRIVATE_KEY format');
    process.exit(1);
  }

  console.log('Payer:', payer.publicKey.toBase58());

  const connection = new Connection(rpcUrl, 'confirmed');
  const balance = await connection.getBalance(payer.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');

  if (balance < 0.05 * 1e9) {
    console.error('❌ Need at least 0.05 SOL for ALT creation');
    process.exit(1);
  }

  const altAddress = await createAddressLookupTableOnChain(connection, payer);

  console.log('\n========================================');
  console.log('✅ ALT created successfully!');
  console.log(`ALT_ADDRESS=${altAddress.toBase58()}`);
  console.log('========================================');
  console.log('\nSet this as your ALT_ADDRESS environment variable in Vercel.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
