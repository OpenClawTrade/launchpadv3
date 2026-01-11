import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Connection, Transaction, VersionedTransaction, Keypair } from '@solana/web3.js';

// Get API URL from environment (or runtime config)
const getApiUrl = () => {
  const normalize = (url: string) => url.replace(/\/+$/, "");

  // 1) Runtime config (loaded from backend)
  if (typeof window !== "undefined") {
    const fromWindow = (window as any)?.__PUBLIC_CONFIG__?.meteoraApiUrl as string | undefined;
    const fromStorage = localStorage.getItem("meteoraApiUrl") ?? undefined;
    const runtimeUrl = (fromWindow || fromStorage || "").trim();

    if (runtimeUrl && !runtimeUrl.includes("${")) {
      return normalize(runtimeUrl);
    }
  }

  // 2) Build-time Vite env var
  const meteoraUrl = import.meta.env.VITE_METEORA_API_URL;
  if (meteoraUrl && !meteoraUrl.includes("${")) {
    return normalize(meteoraUrl.trim());
  }

  // 3) Fallback to current origin
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
};

// Get RPC URL - use the centralized function
import { getRpcUrl as getBaseRpcUrl } from '@/hooks/useSolanaWallet';

const getRpcUrl = () => getBaseRpcUrl().url;

// API request helper
async function apiRequest<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const apiUrl = getApiUrl();
  const url = `${apiUrl}/api${endpoint}`;

  console.log('[useMeteoraApi] Request:', { url, body });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

// Deserialize transaction from base64
function deserializeTransaction(base64: string): Transaction | VersionedTransaction {
  const buffer = Buffer.from(base64, 'base64');
  
  // Check if it's a versioned transaction (first byte indicates version)
  try {
    // Try versioned first
    return VersionedTransaction.deserialize(buffer);
  } catch {
    // Fall back to legacy transaction
    return Transaction.from(buffer);
  }
}

// Deserialize keypair from base64
function deserializeKeypair(base64: string): Keypair {
  const secretKey = Buffer.from(base64, 'base64');
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

  // Create a new token pool
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

      // Step 2: If transactions need signing
      if (txBase64s.length > 0 && result.signers && signTransaction) {
        const connection = new Connection(getRpcUrl(), 'confirmed');

        const mintKeypair = deserializeKeypair(result.signers.mint);
        const configKeypair = deserializeKeypair(result.signers.config);

        const signatures: string[] = [];

        for (const txBase64 of txBase64s) {
          const tx = deserializeTransaction(txBase64);

          // Legacy transactions
          if (tx instanceof Transaction) {
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            tx.recentBlockhash = blockhash;
            tx.lastValidBlockHeight = lastValidBlockHeight;

            // Program-required signers first
            tx.partialSign(mintKeypair, configKeypair);

            // Then user wallet
            const signedTx = await signTransaction(tx);

            const signature = await connection.sendRawTransaction(
              signedTx instanceof Transaction
                ? signedTx.serialize()
                : (signedTx as VersionedTransaction).serialize()
            );

            await connection.confirmTransaction(
              {
                signature,
                blockhash,
                lastValidBlockHeight,
              },
              'confirmed'
            );

            signatures.push(signature);
            continue;
          }

          // Versioned transactions
          if (tx instanceof VersionedTransaction) {
            // Program-required signers first
            tx.sign([mintKeypair, configKeypair]);

            // Then user wallet
            const signedTx = await signTransaction(tx);

            const signature = await connection.sendRawTransaction(
              signedTx instanceof VersionedTransaction
                ? signedTx.serialize()
                : (signedTx as Transaction).serialize()
            );

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            await connection.confirmTransaction(
              {
                signature,
                blockhash,
                lastValidBlockHeight,
              },
              'confirmed'
            );

            signatures.push(signature);
          }
        }

        console.log('[useMeteoraApi] Pool created on-chain:', signatures);

        return {
          ...result,
          signatures,
          signature: signatures[0],
        };
      }

      return result;
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
        
        console.log('[useMeteoraApi] Swap executed on-chain:', signature);
        
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
