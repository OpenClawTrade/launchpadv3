import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Connection, PublicKey } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD_SOL = 85;
const INITIAL_VIRTUAL_SOL = 30;
const TOKEN_DECIMALS = 6;
const REQUEST_TIMEOUT_MS = 8000;

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

// Decode Meteora DBC virtualPool account data from on-chain
// VirtualPool struct layout (from Meteora SDK IDL):
// 8 bytes: Anchor discriminator
// VolatilityTracker: 64 bytes
// config: 32 bytes (pubkey)
// creator: 32 bytes (pubkey)
// baseMint: 32 bytes (pubkey)
// baseVault: 32 bytes (pubkey)
// quoteVault: 32 bytes (pubkey)
// baseReserve: 8 bytes (u64) - virtual token reserves
// quoteReserve: 8 bytes (u64) - virtual SOL reserves
function decodePoolReserves(base64Data: string): {
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  mintAddress?: string;
} | null {
  try {
    const buffer = Buffer.from(base64Data, "base64");

    // Offset = 8 + 64 + 32*5 = 232 for baseReserve, 240 for quoteReserve
    const BASE_RESERVE_OFFSET = 232;
    const QUOTE_RESERVE_OFFSET = 240;
    const BASE_MINT_OFFSET = 136; // 8 + 64 + 32 + 32 = 136

    if (buffer.length < QUOTE_RESERVE_OFFSET + 8) {
      console.warn("[pool/state] Buffer too small:", buffer.length);
      return null;
    }

    // Read u64 values (little-endian)
    const baseReserve = buffer.readBigUInt64LE(BASE_RESERVE_OFFSET);
    const quoteReserve = buffer.readBigUInt64LE(QUOTE_RESERVE_OFFSET);

    // Read mint address (32 bytes at offset 136)
    let mintAddress: string | undefined;
    if (buffer.length >= BASE_MINT_OFFSET + 32) {
      const mintBytes = buffer.slice(BASE_MINT_OFFSET, BASE_MINT_OFFSET + 32);
      try {
        mintAddress = new PublicKey(mintBytes).toBase58();
      } catch {
        // Ignore mint parsing errors
      }
    }

    // Convert to human-readable values
    // SOL has 9 decimals, tokens have 6 decimals
    const virtualSolReserves = Number(quoteReserve) / 1e9;
    const virtualTokenReserves = Number(baseReserve) / Math.pow(10, TOKEN_DECIMALS);

    // Calculate real SOL reserves (SOL deposited by traders)
    const realSolReserves = Math.max(0, virtualSolReserves - INITIAL_VIRTUAL_SOL);

    // Sanity check
    if (virtualSolReserves <= 0 || virtualTokenReserves <= 0) {
      console.warn("[pool/state] Invalid reserves:", { virtualSolReserves, virtualTokenReserves });
      return null;
    }

    console.log("[pool/state] Decoded on-chain:", {
      virtualSolReserves: virtualSolReserves.toFixed(4),
      virtualTokenReserves: virtualTokenReserves.toFixed(0),
      realSolReserves: realSolReserves.toFixed(4),
      mintAddress: mintAddress?.slice(0, 8) + "...",
    });

    return { realSolReserves, virtualSolReserves, virtualTokenReserves, mintAddress };
  } catch (e) {
    console.error("[pool/state] Decode error:", e);
    return null;
  }
}

// Fetch holder count from Helius DAS API
async function fetchHolderCount(mintAddress: string, heliusRpcUrl: string): Promise<number> {
  if (!heliusRpcUrl || !mintAddress) return 0;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

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
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

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
    if ((e as Error).name !== "AbortError") {
      console.error("[pool/state] Holder count fetch error:", e);
    }
    return 0;
  }
}

// Fetch pool state from Helius RPC directly (decode on-chain data)
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
  mintAddress?: string;
} | null> {
  const heliusRpcUrl = process.env.HELIUS_RPC_URL;

  if (!heliusRpcUrl) {
    console.error("[pool/state] HELIUS_RPC_URL not configured");
    return null;
  }

  try {
    console.log("[pool/state] Fetching from Helius RPC for pool:", poolAddress);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      console.warn("[pool/state] No account data for pool:", poolAddress);
      return null;
    }

    const reserves = decodePoolReserves(accountData[0]);
    if (!reserves) {
      return null;
    }

    const { realSolReserves, virtualSolReserves, virtualTokenReserves, mintAddress } = reserves;

    // Calculate metrics using canonical formulas
    const priceSol = virtualTokenReserves > 0 ? virtualSolReserves / virtualTokenReserves : 0;
    const marketCapSol = priceSol * TOTAL_SUPPLY;
    const bondingProgress = Math.min((realSolReserves / GRADUATION_THRESHOLD_SOL) * 100, 100);

    // Fetch holder count if we have mint address
    const holderCount = mintAddress ? await fetchHolderCount(mintAddress, heliusRpcUrl) : 0;

    console.log("[pool/state] Calculated:", {
      priceSol: priceSol.toExponential(4),
      marketCapSol: marketCapSol.toFixed(2),
      bondingProgress: bondingProgress.toFixed(2),
      holderCount,
    });

    return {
      priceSol,
      marketCapSol,
      bondingProgress,
      holderCount,
      realSolReserves,
      virtualSolReserves,
      virtualTokenReserves,
      isGraduated: bondingProgress >= 100,
      source: "helius-rpc",
      mintAddress,
    };
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      console.error("[pool/state] Helius RPC error:", e);
    }
    return null;
  }
}

// Fetch cached data from database
async function fetchFromDatabase(poolAddress: string): Promise<{
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
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn("[pool/state] Supabase not configured");
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to find token by pool address
    const { data: token, error } = await supabase
      .from("tokens")
      .select("*")
      .eq("dbc_pool_address", poolAddress)
      .maybeSingle();

    if (error) {
      console.warn("[pool/state] DB query error:", error.message);
      return null;
    }

    if (!token) {
      // Try fun_tokens table
      const { data: funToken, error: funError } = await supabase
        .from("fun_tokens")
        .select("*")
        .eq("dbc_pool_address", poolAddress)
        .maybeSingle();

      if (funError || !funToken) {
        return null;
      }

      // fun_tokens don't have reserve data, return defaults with DB price
      return {
        priceSol: funToken.price_sol || 0.00000003,
        marketCapSol: (funToken.price_sol || 0.00000003) * TOTAL_SUPPLY,
        bondingProgress: 0,
        holderCount: 0,
        realSolReserves: 0,
        virtualSolReserves: INITIAL_VIRTUAL_SOL,
        virtualTokenReserves: TOTAL_SUPPLY,
        isGraduated: funToken.status === "graduated",
        source: "database-fun",
        mintAddress: funToken.mint_address,
      };
    }

    const virtualSol = token.virtual_sol_reserves || INITIAL_VIRTUAL_SOL;
    const virtualTokens = token.virtual_token_reserves || TOTAL_SUPPLY;
    const realSol = token.real_sol_reserves || 0;

    const priceSol = virtualTokens > 0 ? virtualSol / virtualTokens : 0;
    const bondingProgress = Math.min((realSol / GRADUATION_THRESHOLD_SOL) * 100, 100);

    return {
      priceSol,
      marketCapSol: token.market_cap_sol || priceSol * TOTAL_SUPPLY,
      bondingProgress,
      holderCount: token.holder_count || 0,
      realSolReserves: realSol,
      virtualSolReserves: virtualSol,
      virtualTokenReserves: virtualTokens,
      isGraduated: token.status === "graduated" || bondingProgress >= 100,
      source: "database",
      mintAddress: token.mint_address,
    };
  } catch (e) {
    console.error("[pool/state] DB fetch error:", e);
    return null;
  }
}

// Update database with live data (fire and forget)
async function updateDatabaseAsync(poolAddress: string, data: {
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  priceSol: number;
  marketCapSol: number;
  bondingProgress: number;
  holderCount: number;
}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) return;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from("tokens")
      .update({
        real_sol_reserves: data.realSolReserves,
        virtual_sol_reserves: data.virtualSolReserves,
        virtual_token_reserves: data.virtualTokenReserves,
        price_sol: data.priceSol,
        market_cap_sol: data.marketCapSol,
        bonding_curve_progress: data.bondingProgress / 100, // Store as 0-1
        holder_count: data.holderCount,
        updated_at: new Date().toISOString(),
      })
      .eq("dbc_pool_address", poolAddress);

    console.log("[pool/state] Updated DB for pool:", poolAddress.slice(0, 8) + "...");
  } catch (e) {
    console.warn("[pool/state] DB update failed:", e);
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

  // Try on-chain data first (most accurate)
  const rpcData = await fetchFromHeliusRpc(poolAddress);
  
  if (rpcData) {
    console.log("[pool/state] Returning RPC data for", poolAddress.slice(0, 8) + "...");
    
    // Update DB in background (don't await)
    updateDatabaseAsync(poolAddress, rpcData);

    return res.status(200).json({ 
      poolAddress, 
      ...rpcData,
    });
  }

  // Fallback to database cache
  console.log("[pool/state] RPC failed, trying database for", poolAddress);
  const dbData = await fetchFromDatabase(poolAddress);

  if (dbData) {
    console.log("[pool/state] Returning DB data for", poolAddress.slice(0, 8) + "...");
    return res.status(200).json({
      poolAddress,
      ...dbData,
    });
  }

  // Final fallback - return defaults
  console.warn("[pool/state] All sources failed, returning defaults for", poolAddress);
  return res.status(200).json({
    poolAddress,
    priceSol: 0.00000003,
    marketCapSol: 30,
    bondingProgress: 0,
    holderCount: 0,
    realSolReserves: 0,
    virtualSolReserves: INITIAL_VIRTUAL_SOL,
    virtualTokenReserves: TOTAL_SUPPLY,
    isGraduated: false,
    source: "default",
  });
}
