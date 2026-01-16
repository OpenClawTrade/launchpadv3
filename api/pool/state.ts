import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPoolState } from "../lib/meteora.js";
import { Connection, PublicKey } from "@solana/web3.js";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD_SOL = 85;
const INITIAL_VIRTUAL_SOL = 30;

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

// Fetch holder count from Helius DAS API
async function fetchHolderCount(mintAddress: string): Promise<number> {
  const heliusRpcUrl = process.env.HELIUS_RPC_URL;

  if (!heliusRpcUrl || !mintAddress) {
    console.log("[pool/state] No Helius URL or mint for holder count");
    return 0;
  }

  try {
    const response = await fetch(heliusRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "holder-count",
        method: "getTokenAccounts",
        params: {
          mint: mintAddress,
          limit: 1,
          page: 1,
        },
      }),
    });

    if (!response.ok) {
      console.warn("[pool/state] Helius holder count response not ok:", response.status);
      return 0;
    }

    const json = await response.json();
    
    if (json.error) {
      console.warn("[pool/state] Helius holder count error:", json.error);
      return 0;
    }
    
    const total = safeNumber(json?.result?.total ?? 0);
    console.log("[pool/state] Holder count for", mintAddress.slice(0, 8) + "...:", total);
    return total > 0 ? Math.floor(total) : 0;
  } catch (e) {
    console.error("[pool/state] Holder count fetch error:", e);
    return 0;
  }
}

// Fetch pool state from Meteora SDK (uses Helius RPC under the hood)
async function fetchFromMeteoraSDK(poolAddress: string): Promise<{
  priceSol: number;
  marketCapSol: number;
  bondingProgress: number;
  holderCount: number;
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  isGraduated: boolean;
  source: string;
  mintAddress?: string;
} | null> {
  try {
    console.log("[pool/state] Fetching from Meteora SDK for pool:", poolAddress);
    
    const poolState = await getPoolState(poolAddress);
    
    if (!poolState) {
      console.warn("[pool/state] No pool state returned from SDK");
      return null;
    }

    const { virtualSolReserves, virtualTokenReserves, price, isMigrated, mintAddress, marketCap } = poolState;

    // Validate reserves
    if (virtualSolReserves <= 0 || virtualTokenReserves <= 0) {
      console.warn("[pool/state] Invalid reserves from SDK:", { virtualSolReserves, virtualTokenReserves });
      return null;
    }

    // Calculate real SOL reserves (SOL deposited by traders)
    // Formula: realSol = virtualSol - initialVirtualSol (30 SOL)
    const realSolReserves = Math.max(0, virtualSolReserves - INITIAL_VIRTUAL_SOL);

    // Calculate bonding progress
    const bondingProgress = Math.min((realSolReserves / GRADUATION_THRESHOLD_SOL) * 100, 100);

    // Fetch holder count
    const holderCount = mintAddress ? await fetchHolderCount(mintAddress) : 0;

    console.log("[pool/state] SDK data:", {
      virtualSolReserves: virtualSolReserves.toFixed(4),
      virtualTokenReserves: virtualTokenReserves.toFixed(0),
      realSolReserves: realSolReserves.toFixed(4),
      priceSol: price.toExponential(4),
      marketCapSol: marketCap.toFixed(2),
      bondingProgress: bondingProgress.toFixed(2),
      holderCount,
      isMigrated,
    });

    return {
      priceSol: price,
      marketCapSol: marketCap,
      bondingProgress,
      holderCount,
      realSolReserves,
      virtualSolReserves,
      virtualTokenReserves,
      isGraduated: isMigrated || bondingProgress >= 100,
      source: "meteora-sdk",
      mintAddress,
    };
  } catch (e) {
    console.error("[pool/state] Meteora SDK error:", e);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }

  const poolAddress =
    (typeof req.query.poolAddress === "string" && req.query.poolAddress) ||
    (typeof req.query.pool === "string" && req.query.pool) ||
    (typeof (req.body as any)?.poolAddress === "string" && (req.body as any).poolAddress) ||
    (typeof (req.body as any)?.pool === "string" && (req.body as any).pool);

  if (!poolAddress) {
    return res.status(400).json({ error: "poolAddress query param required" });
  }

  // Validate it looks like a Solana address
  if (poolAddress.length < 32 || poolAddress.length > 44) {
    return res.status(400).json({ error: "Invalid pool address format" });
  }

  console.log("[pool/state] Request for pool:", poolAddress);

  // Use Meteora SDK for accurate on-chain data
  const sdkData = await fetchFromMeteoraSDK(poolAddress);
  
  if (sdkData) {
    console.log("[pool/state] Returning SDK data for", poolAddress);
    return res.status(200).json({ 
      poolAddress, 
      ...sdkData,
    });
  }

  // Fallback to default values if SDK fails
  console.warn("[pool/state] SDK failed, returning defaults for", poolAddress);
  return res.status(200).json({
    poolAddress,
    priceSol: 0.00000003,
    marketCapSol: 30,
    bondingProgress: 0,
    holderCount: 0,
    realSolReserves: 0,
    virtualSolReserves: 30,
    virtualTokenReserves: TOTAL_SUPPLY,
    isGraduated: false,
    source: "default",
  });
}
