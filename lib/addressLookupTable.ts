// Address Lookup Table (ALT) utilities for Meteora DBC pool creation
// ALTs compress 32-byte pubkeys to 1-byte indices, saving ~310 bytes per transaction
// This is critical for Phantom Lighthouse compatibility (needs room to inject instructions)

import {
  Connection,
  PublicKey,
  AddressLookupTableProgram,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import {
  PLATFORM_FEE_WALLET,
  WSOL_MINT,
  DBC_PROGRAM_ID,
} from './config.js';

// Well-known static addresses used in Meteora DBC pool creation
// These are the same across ALL pool creations, making them ideal for ALT compression
export const ALT_STATIC_ADDRESSES: PublicKey[] = [
  // Core Solana programs
  new PublicKey('11111111111111111111111111111111'),           // System Program
  new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),  // Token Program
  new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), // Associated Token Program
  new PublicKey('ComputeBudget111111111111111111111111111111'),    // Compute Budget Program
  new PublicKey('SysvarRent111111111111111111111111111111111'),    // Rent Sysvar

  // Token mints
  new PublicKey(WSOL_MINT), // Wrapped SOL

  // Meteora programs
  new PublicKey(DBC_PROGRAM_ID), // Meteora DBC Program

  // Metaplex
  new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'), // Token Metadata Program

  // Platform
  new PublicKey(PLATFORM_FEE_WALLET), // Platform fee wallet

  // Meteora migration fee address (from SDK constant)
  new PublicKey('39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg'), // DAMM_V1_MIGRATION_FEE_ADDRESS for FixedBps200
];

/**
 * Fetch and return the ALT account from chain.
 * The ALT_ADDRESS env var must be set to the on-chain lookup table address.
 */
export async function getAddressLookupTable(
  connection: Connection
): Promise<AddressLookupTableAccount | null> {
  const altAddress = process.env.ALT_ADDRESS;
  if (!altAddress) {
    console.warn('[ALT] ALT_ADDRESS environment variable not set — skipping ALT compression');
    return null;
  }

  try {
    const altPubkey = new PublicKey(altAddress);
    const result = await connection.getAddressLookupTable(altPubkey);
    
    if (!result.value) {
      console.warn('[ALT] Lookup table not found on-chain:', altAddress);
      return null;
    }

    console.log(`[ALT] Loaded lookup table: ${altAddress} with ${result.value.state.addresses.length} addresses`);
    return result.value;
  } catch (error) {
    console.error('[ALT] Failed to fetch lookup table:', error);
    return null;
  }
}

/**
 * Create a new Address Lookup Table on-chain.
 * Run this once, then store the resulting address as ALT_ADDRESS env var.
 */
export async function createAddressLookupTableOnChain(
  connection: Connection,
  payer: Keypair
): Promise<PublicKey> {
  const slot = await connection.getSlot();

  // Step 1: Create the ALT
  const [createIx, altAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: slot,
  });

  // Step 2: Extend with all static addresses
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: altAddress,
    addresses: ALT_STATIC_ADDRESSES,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [createIx, extendIx],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([payer]);

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');

  console.log(`[ALT] ✅ Created lookup table: ${altAddress.toBase58()}`);
  console.log(`[ALT] ✅ Added ${ALT_STATIC_ADDRESSES.length} addresses`);
  console.log(`[ALT] Set ALT_ADDRESS=${altAddress.toBase58()} in your environment`);

  return altAddress;
}
