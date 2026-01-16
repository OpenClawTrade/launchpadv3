import {
  Connection,
  Keypair,
  Transaction,
  VersionedTransaction,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import bs58 from 'bs58';

// Jito Block Engine endpoints
const JITO_BLOCK_ENGINES = [
  'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles',
];

// Jito tip accounts - one of these receives tips
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4bVmkzf6HbKBJv9fYfZxTdU',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

// Configuration
export const JITO_CONFIG = {
  TIP_LAMPORTS: 10_000_000, // 0.01 SOL tip for priority
  PRIORITY_FEE_LAMPORTS: 100_000, // 100k microlamports priority fee
  COMPUTE_UNITS: 500_000, // 500k compute units
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 500,
};

// Get random Jito tip account
export function getRandomTipAccount(): PublicKey {
  const index = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
  return new PublicKey(JITO_TIP_ACCOUNTS[index]);
}

// Get random Jito block engine
export function getRandomBlockEngine(): string {
  const index = Math.floor(Math.random() * JITO_BLOCK_ENGINES.length);
  return JITO_BLOCK_ENGINES[index];
}

// Create a tip transaction for Jito
export function createJitoTipInstruction(
  fromPubkey: PublicKey,
  tipLamports: number = JITO_CONFIG.TIP_LAMPORTS
) {
  return SystemProgram.transfer({
    fromPubkey,
    toPubkey: getRandomTipAccount(),
    lamports: tipLamports,
  });
}

// Add priority fee instructions to transaction
export function addPriorityFees(
  instructions: any[],
  computeUnits: number = JITO_CONFIG.COMPUTE_UNITS,
  priorityFeeLamports: number = JITO_CONFIG.PRIORITY_FEE_LAMPORTS
) {
  const microLamportsPerCu = Math.floor((priorityFeeLamports * 1_000_000) / computeUnits);
  
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: microLamportsPerCu }),
    ...instructions,
  ];
}

// Submit bundle to Jito Block Engine
export async function submitJitoBundle(
  transactions: (Transaction | VersionedTransaction)[],
  signers: Keypair[][],
  connection: Connection
): Promise<{ success: boolean; bundleId?: string; signatures?: string[]; error?: string }> {
  try {
    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    
    // Serialize all transactions
    const serializedTxs: string[] = [];
    const signatures: string[] = [];
    
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const txSigners = signers[i] || [];
      
      if (tx instanceof VersionedTransaction) {
        // For versioned transactions
        tx.message.recentBlockhash = blockhash;
        for (const signer of txSigners) {
          tx.sign([signer]);
        }
        serializedTxs.push(bs58.encode(tx.serialize()));
        signatures.push(bs58.encode(tx.signatures[0]));
      } else {
        // For legacy transactions
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        
        // Reset signatures and sign fresh
        tx.signatures = [];
        for (const signer of txSigners) {
          tx.partialSign(signer);
        }
        
        serializedTxs.push(bs58.encode(tx.serialize({ requireAllSignatures: false })));
        signatures.push(bs58.encode(tx.signature!));
      }
    }
    
    // Submit to Jito
    const blockEngine = getRandomBlockEngine();
    console.log(`[Jito] Submitting bundle to ${blockEngine}`);
    
    const response = await fetch(blockEngine, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [serializedTxs],
      }),
    });
    
    const result = await response.json();
    
    if (result.error) {
      console.error('[Jito] Bundle submission error:', result.error);
      return { success: false, error: result.error.message || JSON.stringify(result.error) };
    }
    
    console.log('[Jito] Bundle submitted:', result.result);
    
    return {
      success: true,
      bundleId: result.result,
      signatures,
    };
  } catch (error) {
    console.error('[Jito] Bundle submission failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Wait for bundle confirmation
export async function waitForBundleConfirmation(
  bundleId: string,
  timeoutMs: number = 30000
): Promise<{ confirmed: boolean; status?: string }> {
  const startTime = Date.now();
  const blockEngine = getRandomBlockEngine().replace('/bundles', '/bundles');
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(blockEngine.replace('sendBundle', 'getBundleStatuses'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBundleStatuses',
          params: [[bundleId]],
        }),
      });
      
      const result = await response.json();
      
      if (result.result?.value?.[0]) {
        const status = result.result.value[0];
        console.log('[Jito] Bundle status:', status);
        
        if (status.confirmation_status === 'confirmed' || status.confirmation_status === 'finalized') {
          return { confirmed: true, status: status.confirmation_status };
        }
        
        if (status.err) {
          return { confirmed: false, status: 'failed' };
        }
      }
    } catch (error) {
      console.error('[Jito] Status check error:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return { confirmed: false, status: 'timeout' };
}

// Parse sniper keypair from env
export function getSniperKeypair(): Keypair {
  const privateKey = process.env.SNIPER_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('SNIPER_PRIVATE_KEY not configured');
  }
  
  try {
    // Try as base58 first
    const secretKey = bs58.decode(privateKey);
    return Keypair.fromSecretKey(secretKey);
  } catch {
    try {
      // Try as JSON array
      const secretKey = JSON.parse(privateKey);
      return Keypair.fromSecretKey(Uint8Array.from(secretKey));
    } catch {
      throw new Error('Invalid SNIPER_PRIVATE_KEY format');
    }
  }
}
