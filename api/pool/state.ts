import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DBC_API_URL = "https://dbc-api.meteora.ag";
const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD_SOL = 85;

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function computeFromDbcPool(data: any) {
  // DBC API uses different field names - try both old and new formats
  const realSol = safeNumber(data.real_sol_reserves ?? data.real_base_amount ?? data.real_quote_amount) / 1e9;
  const virtualSol = safeNumber(data.virtual_sol_reserves ?? data.virtual_base_amount ?? data.virtual_quote_amount ?? 30e9) / 1e9;
  const virtualTokens = safeNumber(data.virtual_token_reserves ?? data.virtual_quote_amount ?? data.virtual_base_amount ?? 1e15) / 1e6;

  const priceSol = virtualTokens > 0 ? virtualSol / virtualTokens : 0.00000003;
  const marketCapSol = priceSol * TOTAL_SUPPLY;
  const bondingProgress = Math.min((realSol / GRADUATION_THRESHOLD_SOL) * 100, 100);

  return {
    priceSol,
    marketCapSol,
    bondingProgress,
    holderCount: safeNumber(data.holder_count ?? 0),
    realSolReserves: realSol,
    virtualSolReserves: virtualSol,
    virtualTokenReserves: virtualTokens,
    isGraduated: bondingProgress >= 100,
    source: "meteora" as const,
  };
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
      .select("price_sol, volume_24h_sol, status")
      .eq("dbc_pool_address", poolAddress)
      .single();

    if (error || !data) return null;

    const priceSol = safeNumber(data.price_sol) || 0.00000003;
    const marketCapSol = priceSol * TOTAL_SUPPLY;

    return {
      priceSol,
      marketCapSol,
      bondingProgress: 0, // Unknown from DB
      holderCount: 0,
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

  // Try Meteora DBC API first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const url = `${DBC_API_URL}/pools/${poolAddress}`;
    const upstream = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (upstream.ok) {
      const data = await upstream.json();
      const computed = computeFromDbcPool(data);
      return res.status(200).json({ poolAddress, ...computed });
    }
  } catch (err) {
    console.warn("[api/pool/state] Meteora API failed, trying fallback:", err instanceof Error ? err.message : err);
  }

  // Fallback to Supabase cached data
  const fallback = await getFromSupabase(poolAddress);
  if (fallback) {
    return res.status(200).json({ poolAddress, ...fallback });
  }

  // Return default values if all else fails
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
