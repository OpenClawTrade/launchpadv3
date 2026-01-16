import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD_SOL = 85;

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

// Decode Meteora DBC virtualPool account data from on-chain
// Layout from SDK IDL (virtualPool struct with bytemuck serialization):
// - 8 bytes: Anchor discriminator
// - volatilityTracker: ~56 bytes (7 u64 fields)
// - config: 32 bytes (pubkey)
// - creator: 32 bytes (pubkey)
// - baseMint: 32 bytes (pubkey)
// - baseVault: 32 bytes (pubkey)
// - quoteVault: 32 bytes (pubkey)
// - baseReserve: 8 bytes (u64) - virtual token reserves
// - quoteReserve: 8 bytes (u64) - virtual SOL reserves
function decodePoolReserves(base64Data: string): {
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
} | null {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    
    // Offset calculation:
    // 8 (discriminator) + 56 (volatilityTracker) + 32*5 (5 pubkeys) = 224
    const BASE_RESERVE_OFFSET = 224;  // baseReserve (virtual token)
    const QUOTE_RESERVE_OFFSET = 232; // quoteReserve (virtual SOL)
    
    if (buffer.length < QUOTE_RESERVE_OFFSET + 8) {
      console.warn("[pool/state] Buffer too small:", buffer.length);
      return null;
    }
    
    // Read u64 values (little-endian)
    const baseReserve = buffer.readBigUInt64LE(BASE_RESERVE_OFFSET);
    const quoteReserve = buffer.readBigUInt64LE(QUOTE_RESERVE_OFFSET);
    
    // Convert to human-readable values (SOL=9 decimals, token=6 decimals)
    const virtualSolReserves = Number(quoteReserve) / 1e9;
    const virtualTokenReserves = Number(baseReserve) / 1e6;
    
    // For bonding progress, we need the "swapped" SOL amount
    // This is approximately: initialVirtualSOL (30) - currentVirtualSOL + fees collected
    // Simplified: use 30 - virtualSol as approximation (will be negative if more SOL added)
    const initialVirtualSol = 30;
    const realSolReserves = Math.max(0, initialVirtualSol - virtualSolReserves + (virtualSolReserves - 30));
    
    // Sanity check
    if (virtualSolReserves <= 0 || virtualTokenReserves <= 0) {
      console.warn("[pool/state] Invalid reserves:", { virtualSolReserves, virtualTokenReserves });
      return null;
    }
    
    console.log("[pool/state] Decoded:", { virtualSolReserves, virtualTokenReserves });
    
    return { realSolReserves: 0, virtualSolReserves, virtualTokenReserves };
  } catch (e) {
    console.error("[pool/state] Decode error:", e);
    return null;
  }
}

// Fetch pool state directly from Helius RPC (on-chain)
async function fetchFromHeliusRpc(poolAddress: string): Promise<{
  priceSol: number;
  marketCapSol: number;
  bondingProgress: number;
  holderCount: number;
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  isGraduated: boolean;
  source: string;
} | null> {
  const heliusRpcUrl = process.env.HELIUS_RPC_URL;
  
  if (!heliusRpcUrl) {
    console.warn("[pool/state] HELIUS_RPC_URL not configured");
    return null;
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(heliusRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "pool-state",
        method: "getAccountInfo",
        params: [poolAddress, { encoding: "base64" }],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    
    if (!response.ok) {
      console.warn("[pool/state] Helius RPC response not ok:", response.status);
      return null;
    }
    
    const json = await response.json();
    
    if (json.error) {
      console.warn("[pool/state] Helius RPC error:", json.error);
      return null;
    }
    
    const accountData = json.result?.value?.data;
    if (!accountData || !Array.isArray(accountData) || accountData.length < 1) {
      console.warn("[pool/state] No account data returned");
      return null;
    }
    
    const base64Data = accountData[0];
    const reserves = decodePoolReserves(base64Data);
    
    if (!reserves) {
      return null;
    }
    
    const { realSolReserves, virtualSolReserves, virtualTokenReserves } = reserves;
    
    const priceSol = virtualTokenReserves > 0 ? virtualSolReserves / virtualTokenReserves : 0.00000003;
    const marketCapSol = priceSol * TOTAL_SUPPLY;
    const bondingProgress = Math.min((realSolReserves / GRADUATION_THRESHOLD_SOL) * 100, 100);
    
    return {
      priceSol,
      marketCapSol,
      bondingProgress,
      holderCount: 0, // Will be fetched separately if needed
      realSolReserves,
      virtualSolReserves,
      virtualTokenReserves,
      isGraduated: bondingProgress >= 100,
      source: "helius-rpc",
    };
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      console.error("[pool/state] Helius RPC fetch error:", e);
    }
    return null;
  }
}

// Fetch holder count from Helius DAS API
async function fetchHolderCount(mintAddress: string): Promise<number> {
  const heliusRpcUrl = process.env.HELIUS_RPC_URL;
  
  if (!heliusRpcUrl || !mintAddress) return 0;
  
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
    
    if (!response.ok) return 0;
    
    const json = await response.json();
    const total = safeNumber(json?.result?.total ?? 0);
    return total > 0 ? Math.floor(total) : 0;
  } catch {
    return 0;
  }
}

async function getFromSupabase(poolAddress: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("fun_tokens")
      .select("price_sol, volume_24h_sol, status, mint_address")
      .eq("dbc_pool_address", poolAddress)
      .single();

    if (error || !data) return null;

    const priceSol = safeNumber(data.price_sol) || 0.00000003;
    const marketCapSol = priceSol * TOTAL_SUPPLY;
    
    // Try to get holder count if we have mint address
    const holderCount = data.mint_address ? await fetchHolderCount(data.mint_address) : 0;

    return {
      priceSol,
      marketCapSol,
      bondingProgress: 0,
      holderCount,
      realSolReserves: 0,
      virtualSolReserves: 30,
      virtualTokenReserves: TOTAL_SUPPLY,
      isGraduated: data.status === "graduated",
      source: "database" as const,
    };
  } catch {
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

  // Priority 1: Fetch directly from Helius RPC (on-chain data)
  const heliusData = await fetchFromHeliusRpc(poolAddress);
  if (heliusData) {
    console.log("[pool/state] Returning Helius RPC data for", poolAddress);
    return res.status(200).json({ poolAddress, ...heliusData });
  }

  // Priority 2: Fallback to Supabase cached data
  const fallback = await getFromSupabase(poolAddress);
  if (fallback) {
    console.log("[pool/state] Returning DB fallback for", poolAddress);
    return res.status(200).json({ poolAddress, ...fallback });
  }

  // Priority 3: Return default values if all else fails
  console.log("[pool/state] Returning defaults for", poolAddress);
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
