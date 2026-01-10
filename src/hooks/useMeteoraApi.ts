import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Connection, Transaction, VersionedTransaction, Keypair } from '@solana/web3.js';

// Get API URL from environment
const getApiUrl = () => {
  // Check for configured Meteora API URL
  const meteoraUrl = import.meta.env.VITE_METEORA_API_URL;
  if (meteoraUrl && !meteoraUrl.includes('${')) {
    return meteoraUrl;
  }
  
  // Fallback to current origin for Vercel deployment
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  return '';
};

// Get RPC URL
const getRpcUrl = () => {
  return import.meta.env.VITE_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
};

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
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data;
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
  transaction?: string; // Serialized transaction
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

// Claimable fees response
interface ClaimableFeesResponse {
  success: boolean;
  poolAddress: string;
  claimableSol: number;
  claimableTokens: number;
  totalTradingFee: number;
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
  ): Promise<CreatePoolResponse & { signature?: string }> => {
    setIsLoading(true);
    try {
      // Step 1: Get transaction from API
      const result = await apiRequest<CreatePoolResponse>('/pool/create', params);
      
      // Step 2: If transaction needs signing
      if (result.transaction && result.signers && signTransaction) {
        const connection = new Connection(getRpcUrl(), 'confirmed');
        
        // Deserialize transaction and signers
        const tx = deserializeTransaction(result.transaction);
        const mintKeypair = deserializeKeypair(result.signers.mint);
        const configKeypair = deserializeKeypair(result.signers.config);
        
        // For legacy transactions
        if (tx instanceof Transaction) {
          // Get recent blockhash
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = blockhash;
          tx.lastValidBlockHeight = lastValidBlockHeight;
          
          // Sign with generated keypairs first
          tx.partialSign(mintKeypair, configKeypair);
          
          // Then sign with user's wallet
          const signedTx = await signTransaction(tx);
          
          // Send transaction
          const signature = await connection.sendRawTransaction(
            signedTx instanceof Transaction 
              ? signedTx.serialize() 
              : signedTx.serialize()
          );
          
          // Confirm transaction
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight,
          }, 'confirmed');
          
          console.log('[useMeteoraApi] Pool created on-chain:', signature);
          
          return { ...result, signature };
        }
        
        // For versioned transactions
        if (tx instanceof VersionedTransaction) {
          tx.sign([mintKeypair, configKeypair]);
          const signedTx = await signTransaction(tx);
          
          const signature = await connection.sendRawTransaction(
            signedTx instanceof VersionedTransaction 
              ? signedTx.serialize() 
              : (signedTx as Transaction).serialize()
          );
          
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight,
          }, 'confirmed');
          
          console.log('[useMeteoraApi] Pool created on-chain:', signature);
          
          return { ...result, signature };
        }
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
  const getClaimableFees = useCallback(async (poolAddress: string): Promise<ClaimableFeesResponse> => {
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
    positionNftMint?: string;
  }): Promise<{ success: boolean; message: string; info: Record<string, unknown> }> => {
    setIsLoading(true);
    try {
      const result = await apiRequest<{ success: boolean; message: string; info: Record<string, unknown> }>(
        '/fees/claim-damm-fees', 
        params
      );
      return result;
    } finally {
      setIsLoading(false);
    }
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
    syncTokenData,
    migratePool,
  };
}
