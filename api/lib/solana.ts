import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { HELIUS_RPC_URL, TREASURY_PRIVATE_KEY } from './config.js';

// Get Solana connection
export function getConnection(): Connection {
  if (!HELIUS_RPC_URL) {
    throw new Error('HELIUS_RPC_URL not configured');
  }
  return new Connection(HELIUS_RPC_URL, 'confirmed');
}

// Parse treasury keypair from env
export function getTreasuryKeypair(): Keypair {
  if (!TREASURY_PRIVATE_KEY) {
    throw new Error('TREASURY_PRIVATE_KEY not configured');
  }
  
  try {
    // Try JSON array format first
    const secretKey = JSON.parse(TREASURY_PRIVATE_KEY);
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
  } catch {
    // Try base58 format
    const secretKey = bs58.decode(TREASURY_PRIVATE_KEY);
    return Keypair.fromSecretKey(secretKey);
  }
}

// Generate a random base58 string for mock addresses
export function generateMockMintAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Verify a transaction on-chain
export async function verifyTransaction(signature: string): Promise<boolean> {
  const connection = getConnection();
  try {
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    return tx !== null && tx.meta?.err === null;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return false;
  }
}

// Get account balance
export async function getBalance(address: string): Promise<number> {
  const connection = getConnection();
  try {
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error getting balance:', error);
    return 0;
  }
}

// Transfer SOL from treasury
export async function transferSol(
  toAddress: string, 
  amountSol: number
): Promise<string> {
  const connection = getConnection();
  const treasury = getTreasuryKeypair();
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
    })
  );
  
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [treasury]
  );
  
  return signature;
}

// Serialize transaction for client signing
export function serializeTransaction(transaction: Transaction): string {
  return Buffer.from(transaction.serialize({ requireAllSignatures: false })).toString('base64');
}

// Deserialize transaction from client
export function deserializeTransaction(base64: string): Transaction {
  const buffer = Buffer.from(base64, 'base64');
  return Transaction.from(buffer);
}
