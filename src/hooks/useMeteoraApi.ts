import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Connection, Transaction, VersionedTransaction, Keypair, ComputeBudgetProgram, TransactionMessage, PublicKey } from '@solana/web3.js';

// Get API URL from environment (or runtime config)
// Called fresh on every API request to ensure we pick up async-loaded config
const getApiUrl = (): string => {
  const normalize = (url: string) => url.replace(/\/+$/, "");

  // 1) Window runtime config (set by RuntimeConfigBootstrap in current session)
  if (typeof window !== "undefined") {
    const fromWindow = (window as any)?.__PUBLIC_CONFIG__?.meteoraApiUrl as string | undefined;
    if (fromWindow && fromWindow.startsWith("https://") && !fromWindow.includes("${")) {
      return normalize(fromWindow);
    }
  }

  // 2) localStorage next (persists across sessions, set by RuntimeConfigBootstrap)
  if (typeof window !== "undefined") {
    const fromStorage = localStorage.getItem("meteoraApiUrl");
    if (fromStorage && fromStorage.startsWith("https://") && !fromStorage.includes("${")) {
      return normalize(fromStorage);
    }
  }

  // 3) Build-time Vite env var
  const meteoraUrl = import.meta.env.VITE_METEORA_API_URL;
  if (meteoraUrl && typeof meteoraUrl === "string" && meteoraUrl.startsWith("https://") && !meteoraUrl.includes("${")) {
    return normalize(meteoraUrl.trim());
  }

  // 4) Fallback to current origin (useful for preview/debug; might fail if /api isn't deployed there)
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
};

// Get RPC URL - use the centralized function
import { getRpcUrl as getBaseRpcUrl } from "@/hooks/useSolanaWallet";

const getRpcUrl = () => getBaseRpcUrl().url;
const getRpcInfo = () => getBaseRpcUrl();

// API request helper
async function apiRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const apiUrl = getApiUrl();
  const url = `${apiUrl}/api${endpoint}`;

  // Build headers - include x-launchpad-id if set in localStorage
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  
  // Check for launchpad context (set by launchpad template page)
  if (typeof window !== 'undefined') {
    const launchpadId = localStorage.getItem('x-launchpad-id');
    if (launchpadId) {
      headers['x-launchpad-id'] = launchpadId;
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // This usually means the request hit a static HTML page (e.g. missing /api deployment)
    const snippet = text?.slice(0, 200) ?? '';
    throw new Error(
      `Backend API returned non-JSON (HTTP ${response.status}). ` +
        `This typically means /api is not deployed on that domain. ` +
        `Response starts with: ${JSON.stringify(snippet)}`
    );
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `API request failed (HTTP ${response.status})`);
  }

  return data as T;
}

// Small helpers
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitForRuntimeConfigLoaded(timeoutMs: number = 2000) {
  if (typeof window === "undefined") return;
  const start = Date.now();
  while (!(window as any).__PUBLIC_CONFIG_LOADED__ && Date.now() - start < timeoutMs) {
    await sleep(50);
  }
}

async function confirmSignatureWithPolling(params: {
  connection: Connection;
  signature: string;
  blockhash: string;
  lastValidBlockHeight: number;
  timeoutMs?: number;
}) {
  const { connection, signature, blockhash, lastValidBlockHeight } = params;
  const timeoutMs = params.timeoutMs ?? 15_000; // 15 seconds - with high priority fees, should be near-instant

  const start = Date.now();
  let loop = 0;

  while (true) {
    try {
      const statuses = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });

      const status = statuses.value[0];
      if (status?.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
      }

      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
        console.log(`[useMeteoraApi] Confirmed in ${Date.now() - start}ms`);
        return;
      }
    } catch (e) {
      // Rate limit or network error - continue polling
    }

    // Check block height expiry every 5 loops
    if (loop % 5 === 0 && loop > 0) {
      try {
        const height = await connection.getBlockHeight("confirmed");
        if (height > lastValidBlockHeight) {
          throw new Error(
            `Transaction expired (block height ${height} > lastValidBlockHeight ${lastValidBlockHeight}). ` +
              `Signature: ${signature} (blockhash: ${blockhash})`
          );
        }
      } catch (e) {
        // If getBlockHeight is rate-limited, don't fail confirmation polling.
      }
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Transaction was not confirmed in ${(timeoutMs / 1000).toFixed(1)} seconds. ` +
          `Check signature ${signature} on Solscan.`
      );
    }

    loop++;
    await sleep(400); // Fast polling - 400ms
  }
}

// Convert base64 to Uint8Array (browser-compatible)
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Deserialize transaction from base64 (browser-compatible)
function deserializeTransaction(base64: string): Transaction | VersionedTransaction {
  const bytes = base64ToBytes(base64);
  
  // Check if it's a versioned transaction (first byte indicates version)
  try {
    // Try versioned first
    return VersionedTransaction.deserialize(bytes);
  } catch {
    // Fall back to legacy transaction
    return Transaction.from(bytes);
  }
}

// Deserialize keypair from base64 (browser-compatible)
function deserializeKeypair(base64: string): Keypair {
  const secretKey = base64ToBytes(base64);
  return Keypair.fromSecretKey(secretKey);
}

// Pool creation response
interface CreatePoolResponse {
  success: boolean;
  tokenId: string;
  mintAddress: string;
  dbcPoolAddress: string | null;
  // Backwards/forwards compatibility:
  transaction?: string; // single serialized transaction
  transactions?: string[]; // multiple serialized transactions
  signers?: {
    mint: string; // Base64 encoded secret key
    config: string; // Base64 encoded secret key
  };
  lastValidBlockHeight?: number;
}

// Swap execution response
interface SwapResponse {
  success: boolean;
  transaction?: string; // Serialized transaction for signing
  tokensOut: number;
  solOut: number;
  newPrice: number;
  bondingProgress: number;
  graduated: boolean;
  marketCap: number;
}

// Fee claim response (legacy)
interface ClaimFeesResponse {
  success: boolean;
  claimedAmount: number;
  signature: string;
  isPending: boolean;
}

// Treasury pool fee claim response
interface ClaimPoolFeesResponse {
  success: boolean;
  signature: string;
  claimedSol: number;
  poolAddress: string;
  tokenId: string;
  treasuryWallet: string;
}

// Treasury pool fee claim response (DAMM V2)
interface ClaimDammFeesResponse {
  success: boolean;
  signature: string;
  poolAddress: string;
  positionAddress: string;
  tokenId?: string;
  treasuryWallet: string;
}

// Treasury positions response
interface TreasuryPositionsResponse {
  success: boolean;
  treasuryWallet: string;
  positionCount: number;
  positions: Array<{
    position: string;
    positionNftAccount: string;
    pool: string;
    liquidity: string;
    tokenAMint: string;
    tokenBMint: string;
    feeAOwed: string;
    feeBOwed: string;
  }>;
}

// Sync response
interface SyncResponse {
  success: boolean;
  synced: number;
  results: Array<{
    tokenId: string;
    updated: boolean;
  }>;
}

// Migration response
interface MigrateResponse {
  success: boolean;
  signatures: string[];
  dammPoolAddress: string;
  message: string;
}

export function useMeteoraApi() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Create a new token pool - matches working flow exactly
  const createPool = useCallback(async (
    params: {
      creatorWallet: string;
      privyUserId?: string;
      name: string;
      ticker: string;
      description?: string;
      imageUrl?: string;
      websiteUrl?: string;
      twitterUrl?: string;
      telegramUrl?: string;
      discordUrl?: string;
      initialBuySol?: number;
      feeMode?: 'creator' | 'holder_rewards';
    },
    signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
  ): Promise<CreatePoolResponse & { signature?: string; signatures?: string[] }> => {
    setIsLoading(true);
    
    try {
      // Step 1: Get transactions from API
      const result = await apiRequest<CreatePoolResponse>('/pool/create', params);

      const txBase64s =
        result.transactions && result.transactions.length > 0
          ? result.transactions
          : result.transaction
            ? [result.transaction]
            : [];

      // Step 2: If transactions need signing by user wallet
      if (txBase64s.length > 0 && signTransaction) {
        // Make sure runtime config has a chance to load (important on fresh domains with empty localStorage)
        await waitForRuntimeConfigLoaded(2000);

        const { url: rpcUrl, source: rpcSource } = getRpcInfo();
        console.info("[useMeteoraApi] Using RPC:", rpcSource, rpcUrl);

        const connection = new Connection(rpcUrl, "confirmed");

        // Get keypairs from backend for re-signing
        let mintKeypair: Keypair | null = null;
        let configKeypair: Keypair | null = null;
        
        if (result.signers) {
          try {
            mintKeypair = deserializeKeypair(result.signers.mint);
            configKeypair = deserializeKeypair(result.signers.config);
          } catch (e) {
            // Will use pre-signed TX
          }
        }

        const signatures: string[] = [];

        for (let i = 0; i < txBase64s.length; i++) {
          const txBase64 = txBase64s[i];
          
          // Convert base64 to bytes
          const txBytes = base64ToBytes(txBase64);
          
          // Deserialize to determine type
          const tx = deserializeTransaction(txBase64);
          const isVersioned = tx instanceof VersionedTransaction;

          // Get FRESH blockhash RIGHT BEFORE signing
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

          let signedBytes: Uint8Array;
          
          if (isVersioned) {
            const vtx = tx as VersionedTransaction;
            
            if (mintKeypair && configKeypair) {
              // Rebuild transaction with fresh blockhash
              const msg = vtx.message;
              (msg as any).recentBlockhash = blockhash;
              
              const newVtx = new VersionedTransaction(msg);
              
              const accountKeys = msg.staticAccountKeys || (msg as any).accountKeys || [];
              const numRequiredSignatures = msg.header?.numRequiredSignatures || (msg as any).numRequiredSignatures || 0;
              
              const requiredSigners = accountKeys.slice(0, numRequiredSignatures);
              
              const mintPubkey = mintKeypair.publicKey.toBase58();
              const configPubkey = configKeypair.publicKey.toBase58();
              
              for (const signer of requiredSigners) {
                const signerStr = signer.toBase58();
                if (signerStr === mintPubkey) {
                  newVtx.sign([mintKeypair]);
                } else if (signerStr === configPubkey) {
                  newVtx.sign([configKeypair]);
                }
              }
              
              const userSignedTx = await signTransaction(newVtx);
              signedBytes = (userSignedTx as VersionedTransaction).serialize();
            } else {
              const userSignedTx = await signTransaction(vtx);
              signedBytes = (userSignedTx as VersionedTransaction).serialize();
            }
          } else {
            const legacyTx = tx as Transaction;
            legacyTx.recentBlockhash = blockhash;
            legacyTx.lastValidBlockHeight = lastValidBlockHeight;
            
            if (mintKeypair && configKeypair) {
              const mintPubkey = mintKeypair.publicKey.toBase58();
              const configPubkey = configKeypair.publicKey.toBase58();
              
              for (const sig of legacyTx.signatures) {
                const pubkeyStr = sig.publicKey.toBase58();
                if (pubkeyStr === mintPubkey) {
                  legacyTx.partialSign(mintKeypair);
                } else if (pubkeyStr === configPubkey) {
                  legacyTx.partialSign(configKeypair);
                }
              }
            }
            
            const userSignedTx = await signTransaction(legacyTx);
            signedBytes = (userSignedTx as Transaction).serialize();
          }

          // Send to network
          let signature: string;
          try {
            signature = await connection.sendRawTransaction(signedBytes, {
              skipPreflight: true,
              preflightCommitment: 'confirmed',
              maxRetries: 5,
            });
          } catch (sendError: any) {
            throw new Error(`Failed to send transaction: ${sendError?.message || sendError}`);
          }

          if (!signature || signature === '1111111111111111111111111111111111111111111111111111111111111111') {
            throw new Error('Transaction failed - RPC returned null signature.');
          }

          // Confirm transaction (robust across RPC congestion + avoids 30s default timeout)
          try {
            await confirmSignatureWithPolling({
              connection,
              signature,
              blockhash,
              lastValidBlockHeight,
              timeoutMs: 120_000,
            });
          } catch (confirmError: any) {
            // Keep legacy fallback behavior but add context.
            const statuses = await connection.getSignatureStatuses([signature], {
              searchTransactionHistory: true,
            });
            const status = statuses.value[0];

            if (status?.err) {
              throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
            }

            throw confirmError;
          }

          signatures.push(signature);
        }

        return {
          ...result,
          signatures,
          signature: signatures[0],
        };
      }

      return result;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Execute a swap
  const executeSwap = useCallback(async (
    params: {
      mintAddress: string;
      userWallet: string;
      amount: number;
      isBuy: boolean;
      slippageBps?: number;
      profileId?: string;
    },
    signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
  ): Promise<SwapResponse & { signature?: string }> => {
    setIsLoading(true);
    try {
      // Step 1: Get transaction from API
      const result = await apiRequest<SwapResponse>('/swap/execute', params);
      
      // Step 2: If transaction needs signing
      if (result.transaction && signTransaction) {
        const connection = new Connection(getRpcUrl(), 'confirmed');
        
        // Deserialize transaction
        const tx = deserializeTransaction(result.transaction);
        
        // Get recent blockhash for legacy transactions
        if (tx instanceof Transaction) {
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = blockhash;
          tx.lastValidBlockHeight = lastValidBlockHeight;
        }
        
        // Sign with user's wallet
        const signedTx = await signTransaction(tx);
        
        // Send transaction
        const signature = await connection.sendRawTransaction(
          signedTx instanceof Transaction 
            ? signedTx.serialize() 
            : signedTx.serialize()
        );
        
        // Confirm transaction
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed');
        
        return { ...result, signature };
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Legacy claim fees (redirects to pool-based claiming)
  const claimFees = useCallback(async (params: {
    tokenId: string;
    walletAddress: string;
    profileId?: string;
  }): Promise<ClaimFeesResponse> => {
    setIsLoading(true);
    try {
      const result = await apiRequest<ClaimFeesResponse>('/fees/claim', params);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get claimable fees from a pool (treasury use)
  const getClaimableFees = useCallback(async (poolAddress: string): Promise<{
    success: boolean;
    poolAddress: string;
    claimableSol: number;
    claimableTokens: number;
    totalTradingFee: number;
  }> => {
    const apiUrl = getApiUrl();
    const url = `${apiUrl}/api/fees/claim-from-pool?poolAddress=${encodeURIComponent(poolAddress)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get claimable fees');
    }
    
    return data;
  }, []);

  // Claim fees from DBC pool (treasury use - pre-graduation)
  const claimPoolFees = useCallback(async (params: {
    poolAddress: string;
    tokenId?: string;
  }): Promise<ClaimPoolFeesResponse> => {
    setIsLoading(true);
    try {
      const result = await apiRequest<ClaimPoolFeesResponse>('/fees/claim-from-pool', params);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Claim fees from DAMM V2 (treasury use - post-graduation)
  const claimDammFees = useCallback(async (params: {
    tokenId?: string;
    dammPoolAddress?: string;
    positionAddress?: string;
  }): Promise<ClaimDammFeesResponse> => {
    setIsLoading(true);
    try {
      const result = await apiRequest<ClaimDammFeesResponse>(
        '/fees/claim-damm-fees', 
        params
      );
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get treasury DAMM V2 positions
  const getTreasuryPositions = useCallback(async (): Promise<TreasuryPositionsResponse> => {
    const apiUrl = getApiUrl();
    const url = `${apiUrl}/api/fees/claim-damm-fees`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get treasury positions');
    }
    
    return data;
  }, []);

  // Sync token data from on-chain
  const syncTokenData = useCallback(async (): Promise<SyncResponse> => {
    setIsLoading(true);
    try {
      const result = await apiRequest<SyncResponse>('/data/sync', {});
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Migrate pool to DAMM V2
  const migratePool = useCallback(async (params: {
    mintAddress: string;
  }): Promise<MigrateResponse> => {
    setIsLoading(true);
    try {
      const result = await apiRequest<MigrateResponse>('/pool/migrate', params);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    createPool,
    executeSwap,
    claimFees,
    getClaimableFees,
    claimPoolFees,
    claimDammFees,
    getTreasuryPositions,
    syncTokenData,
    migratePool,
  };
}
