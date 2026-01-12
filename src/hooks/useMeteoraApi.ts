import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Connection, Transaction, VersionedTransaction, Keypair } from '@solana/web3.js';

// Get API URL from environment (or runtime config)
// Called fresh on every API request to ensure we pick up async-loaded config
const getApiUrl = (): string => {
  const normalize = (url: string) => url.replace(/\/+$/, "");

  // 1) localStorage first (persists across sessions, set by RuntimeConfigBootstrap)
  if (typeof window !== "undefined") {
    const fromStorage = localStorage.getItem("meteoraApiUrl");
    if (fromStorage && fromStorage.startsWith("https://") && !fromStorage.includes("${")) {
      return normalize(fromStorage);
    }
  }

  // 2) Window runtime config (set by RuntimeConfigBootstrap in current session)
  if (typeof window !== "undefined") {
    const fromWindow = (window as any)?.__PUBLIC_CONFIG__?.meteoraApiUrl as string | undefined;
    if (fromWindow && fromWindow.startsWith("https://") && !fromWindow.includes("${")) {
      return normalize(fromWindow);
    }
  }

  // 3) Build-time Vite env var
  const meteoraUrl = import.meta.env.VITE_METEORA_API_URL;
  if (meteoraUrl && typeof meteoraUrl === "string" && meteoraUrl.startsWith("https://") && !meteoraUrl.includes("${")) {
    return normalize(meteoraUrl.trim());
  }

  // 4) Fallback to current origin (will fail on trenches.to but at least shows clear error)
  if (typeof window !== "undefined") {
    console.warn("[getApiUrl] No API URL configured, falling back to origin:", window.location.origin);
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

// Deserialize transaction from base64 (browser-compatible)
function deserializeTransaction(base64: string): Transaction | VersionedTransaction {
  // Convert base64 to Uint8Array (browser-compatible, no Buffer needed)
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
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
  // Convert base64 to Uint8Array (browser-compatible, no Buffer needed)
  const binaryString = atob(base64);
  const secretKey = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    secretKey[i] = binaryString.charCodeAt(i);
  }
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
    console.log('[createPool] Starting pool creation...');
    console.log('[createPool] Params:', JSON.stringify(params, null, 2));
    console.log('[createPool] signTransaction provided:', !!signTransaction);
    
    try {
      // Step 1: Get transactions from API
      console.log('[createPool] Step 1: Calling API /pool/create...');
      const apiStartTime = Date.now();
      const result = await apiRequest<CreatePoolResponse>('/pool/create', params);
      console.log('[createPool] API responded in', Date.now() - apiStartTime, 'ms');
      console.log('[createPool] API result:', {
        success: result.success,
        tokenId: result.tokenId,
        mintAddress: result.mintAddress,
        dbcPoolAddress: result.dbcPoolAddress,
        hasTransaction: !!result.transaction,
        transactionsCount: result.transactions?.length || 0,
        hasSigners: !!result.signers,
      });

      const txBase64s =
        result.transactions && result.transactions.length > 0
          ? result.transactions
          : result.transaction
            ? [result.transaction]
            : [];

      console.log('[createPool] Transactions to sign:', txBase64s.length);

      // Step 2: If transactions need signing by user wallet
      if (txBase64s.length > 0 && signTransaction) {
        const rpcUrl = getRpcUrl();
        console.log('[createPool] Step 2: Connecting to RPC:', rpcUrl.substring(0, 50) + '...');
        const connection = new Connection(rpcUrl, 'confirmed');

        const signatures: string[] = [];

        for (let i = 0; i < txBase64s.length; i++) {
          const txBase64 = txBase64s[i];
          console.log(`[createPool] Processing transaction ${i + 1}/${txBase64s.length}...`);
          console.log(`[createPool] TX base64 length: ${txBase64.length} chars`);
          
          console.log('[createPool] Deserializing transaction...');
          const tx = deserializeTransaction(txBase64);
          const txType = tx instanceof VersionedTransaction ? 'VersionedTransaction' : 'LegacyTransaction';
          console.log(`[createPool] Deserialized as: ${txType}`);

          // Get fresh blockhash BEFORE signing
          console.log('[createPool] Getting fresh blockhash...');
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
          console.log('[createPool] Blockhash:', blockhash, 'Height:', lastValidBlockHeight);

          // Update blockhash for legacy transactions
          if (tx instanceof Transaction) {
            tx.recentBlockhash = blockhash;
            tx.lastValidBlockHeight = lastValidBlockHeight;
          }

          console.log('[createPool] Requesting user signature via Privy...');
          const signStartTime = Date.now();
          
          try {
            const signedTx = await signTransaction(tx);
            console.log('[createPool] User signed TX in', Date.now() - signStartTime, 'ms');
            
            // Serialize the signed transaction
            const serializedTx = signedTx instanceof Transaction
              ? signedTx.serialize()
              : (signedTx as VersionedTransaction).serialize();
            
            console.log('[createPool] Serialized TX size:', serializedTx.length, 'bytes');

            console.log('[createPool] Sending TX to network...');
            const sendStartTime = Date.now();
            
            const signature = await connection.sendRawTransaction(serializedTx, {
              skipPreflight: false,
              preflightCommitment: 'confirmed',
              maxRetries: 3,
            });
            
            console.log('[createPool] TX sent in', Date.now() - sendStartTime, 'ms');
            console.log('[createPool] TX signature:', signature);
            
            // Validate signature isn't a placeholder
            if (!signature || signature === '1111111111111111111111111111111111111111111111111111111111111111') {
              throw new Error('Invalid signature returned from RPC - transaction may have failed');
            }

            console.log('[createPool] Confirming TX...');
            const confirmStartTime = Date.now();
            
            const confirmation = await connection.confirmTransaction(
              {
                signature,
                blockhash,
                lastValidBlockHeight,
              },
              'confirmed'
            );
            
            console.log('[createPool] TX confirmed in', Date.now() - confirmStartTime, 'ms');
            
            if (confirmation.value.err) {
              console.error('[createPool] TX confirmed but has error:', confirmation.value.err);
              throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }

            signatures.push(signature);
            console.log(`[createPool] Transaction ${i + 1} complete!`);
            
          } catch (signError: any) {
            console.error('[createPool] Error during TX signing/sending:', signError);
            console.error('[createPool] Error name:', signError?.name);
            console.error('[createPool] Error message:', signError?.message);
            console.error('[createPool] Error logs:', signError?.logs);
            throw signError;
          }
        }

        console.log('[createPool] All transactions complete! Signatures:', signatures);

        return {
          ...result,
          signatures,
          signature: signatures[0],
        };
      }

      console.log('[createPool] No transactions to sign, returning API result directly');
      return result;
    } catch (error) {
      console.error('[createPool] FATAL ERROR:', error);
      throw error;
    } finally {
      setIsLoading(false);
      console.log('[createPool] Pool creation finished');
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
