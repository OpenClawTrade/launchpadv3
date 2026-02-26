import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionConfirmationStatus,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';
import { createMeteoraPool } from '../../lib/meteora.js';
import { TOTAL_SUPPLY, GRADUATION_THRESHOLD_SOL, TRADING_FEE_BPS, LAUNCH_FUNDING_SOL } from '../../lib/config.js';

const VERSION = "punch-v1.0.0";

const INITIAL_VIRTUAL_SOL = 30;
const MAX_LAUNCH_RETRIES = 2;
const TX_CONFIRMATION_TIMEOUT_MS = 45000;
const PRIORITY_FEE_MICROLAMPORTS = 500000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Get PUNCH deployer keypair (separate from main treasury)
function getPunchDeployerKeypair(): Keypair {
  const raw = process.env.PUNCH_DEPLOYER_PRIVATE_KEY?.trim();
  if (!raw) {
    throw new Error('PUNCH_DEPLOYER_PRIVATE_KEY not configured');
  }

  try {
    if (raw.startsWith('[')) {
      const keyArray = JSON.parse(raw);
      const bytes = new Uint8Array(keyArray);
      if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
      if (bytes.length === 32) return Keypair.fromSeed(bytes);
      throw new Error(`Invalid key length: ${bytes.length}`);
    }

    const decoded: Uint8Array = bs58.decode(raw);
    if (decoded.length === 64) return Keypair.fromSecretKey(decoded);
    if (decoded.length === 32) return Keypair.fromSeed(decoded);
    throw new Error(`Invalid key length: ${decoded.length}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    throw new Error(`Invalid PUNCH_DEPLOYER_PRIVATE_KEY format (${msg})`);
  }
}

function getPunchFeeWallet(): string {
  const wallet = process.env.PUNCH_FEE_WALLET?.trim();
  if (!wallet) {
    throw new Error('PUNCH_FEE_WALLET not configured');
  }
  return wallet;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase credentials not configured');
  return createClient(url, key);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getBlockhashWithRetry(connection: Connection, maxRetries = 5) {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await connection.getLatestBlockhash('confirmed');
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Unknown error');
      if (i < maxRetries - 1) await sleep(1000 * Math.pow(2, i));
    }
  }
  throw lastError || new Error('Failed to get blockhash');
}

async function confirmTransaction(
  connection: Connection,
  signature: string,
  commitment: TransactionConfirmationStatus = 'confirmed',
  timeoutMs: number = TX_CONFIRMATION_TIMEOUT_MS
): Promise<void> {
  const startTime = Date.now();
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) throw new Error(`TX confirmation timeout`);
      const result = await Promise.race([
        connection.getSignatureStatus(signature, { searchTransactionHistory: true }),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), Math.min(timeoutMs - elapsed, 10000)))
      ]);
      if (result?.value) {
        if (result.value.err) throw new Error(`TX failed on-chain: ${JSON.stringify(result.value.err)}`);
        if (result.value.confirmationStatus === 'confirmed' || result.value.confirmationStatus === 'finalized') return;
      }
      await sleep(1000 * Math.pow(1.5, attempt));
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Unknown');
      if (error.message.includes('failed on-chain')) throw error;
      if (attempt < maxRetries - 1) await sleep(1000 * Math.pow(2, attempt));
    }
  }
  const finalStatus = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
  if (finalStatus?.value?.confirmationStatus === 'confirmed' || finalStatus?.value?.confirmationStatus === 'finalized') return;
  throw new Error(`TX not confirmed: ${signature}`);
}

async function verifyPoolExists(connection: Connection, poolAddress: PublicKey): Promise<boolean> {
  try {
    const info = await connection.getAccountInfo(poolAddress);
    return info !== null && info.data.length > 0;
  } catch { return false; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).setHeader('Access-Control-Allow-Origin', '*').end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();

  try {
    const { name, ticker, description, imageUrl, twitterUrl, feeRecipientWallet, serverSideSign } = req.body;

    if (!name || !ticker) return res.status(400).json({ error: 'Missing required fields: name, ticker' });
    if (!serverSideSign) return res.status(400).json({ error: 'serverSideSign required' });

    console.log(`[create-punch][${VERSION}] Request`, { name, ticker });

    const punchDeployer = getPunchDeployerKeypair();
    const punchFeeWallet = getPunchFeeWallet();
    const deployerAddress = punchDeployer.publicKey.toBase58();

    const supabase = getSupabase();
    const rpcUrl = process.env.HELIUS_RPC_URL;
    if (!rpcUrl) throw new Error('HELIUS_RPC_URL not configured');

    const connection = new Connection(rpcUrl, 'confirmed');

    let lastError: Error | null = null;
    let signatures: string[] = [];
    let mintAddress = '';
    let dbcPoolAddress = '';
    let mintKeypair: Keypair | null = null;
    let configKeypair: Keypair | null = null;
    let poolAddress: PublicKey | null = null;

    for (let attempt = 0; attempt < MAX_LAUNCH_RETRIES; attempt++) {
      try {
        console.log(`[create-punch][${VERSION}] Attempt ${attempt + 1}/${MAX_LAUNCH_RETRIES}`);

        const latestBlockhash = await getBlockhashWithRetry(connection);

        const result = await createMeteoraPool({
          creatorWallet: deployerAddress,
          leftoverReceiverWallet: punchFeeWallet, // Punch fee wallet receives leftovers & NFT
          name: name.slice(0, 32),
          ticker: ticker.toUpperCase().slice(0, 10),
          description: description || `${name} - Punched into existence!`,
          imageUrl: imageUrl || undefined,
          initialBuySol: 0,
        });

        const transactions = result.transactions;
        mintKeypair = result.mintKeypair;
        configKeypair = result.configKeypair;
        poolAddress = result.poolAddress;
        mintAddress = mintKeypair.publicKey.toBase58();
        dbcPoolAddress = poolAddress.toBase58();

        const availableKeypairs: Map<string, Keypair> = new Map([
          [punchDeployer.publicKey.toBase58(), punchDeployer],
          [mintKeypair.publicKey.toBase58(), mintKeypair],
          [configKeypair.publicKey.toBase58(), configKeypair],
        ]);

        signatures = [];

        for (let i = 0; i < transactions.length; i++) {
          const tx = transactions[i];
          if (tx instanceof VersionedTransaction) {
            tx.sign(Array.from(availableKeypairs.values()));
          } else {
            tx.recentBlockhash = latestBlockhash.blockhash;
            tx.feePayer = punchDeployer.publicKey;
            const message = tx.compileMessage();
            const requiredSignerPubkeys = message.accountKeys
              .slice(0, message.header.numRequiredSignatures)
              .map((k: PublicKey) => k.toBase58());
            const signersForTx = requiredSignerPubkeys
              .map((pk: string) => availableKeypairs.get(pk))
              .filter((kp: Keypair | undefined): kp is Keypair => kp !== undefined);
            tx.sign(...signersForTx);
          }

          const signature = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 5,
          });
          signatures.push(signature);
          await confirmTransaction(connection, signature);
          console.log(`[create-punch][${VERSION}] TX ${i + 1} confirmed`);
        }

        await sleep(1000);
        const poolExists = await verifyPoolExists(connection, poolAddress);
        if (!poolExists) throw new Error(`Pool not found on-chain: ${dbcPoolAddress}`);

        lastError = null;
        break;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error('Unknown');
        console.error(`[create-punch][${VERSION}] Attempt ${attempt + 1} failed:`, lastError.message);
        if (attempt < MAX_LAUNCH_RETRIES - 1) await sleep(2000 * Math.pow(2, attempt));
      }
    }

    if (lastError) throw lastError;

    console.log(`[create-punch][${VERSION}] SUCCESS`, { mintAddress, dbcPoolAddress, elapsed: Date.now() - startTime });

    return res.status(200).json({
      success: true,
      mintAddress,
      dbcPoolAddress,
      poolAddress: dbcPoolAddress,
      creatorWallet: deployerAddress,
      deployerWallet: deployerAddress,
      feeRecipientWallet: punchFeeWallet,
      signatures,
      confirmed: true,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[create-punch][${VERSION}] Error:`, errorMessage);
    return res.status(500).json({ success: false, error: errorMessage, confirmed: false });
  }
}
