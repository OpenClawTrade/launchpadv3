import type { VercelRequest, VercelResponse } from "@vercel/node";

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
  const realSol = safeNumber(data.real_base_amount ?? data.real_sol_reserves) / 1e9;
  const virtualSol = safeNumber(data.virtual_base_amount ?? data.virtual_sol_reserves ?? 30e9) / 1e9;
  const virtualTokens = safeNumber(data.virtual_quote_amount ?? data.virtual_token_reserves ?? 1e15) / 1e6;

  const priceSol = virtualTokens > 0 ? virtualSol / virtualTokens : 0.00000003;
  const marketCapSol = priceSol * TOTAL_SUPPLY;
  const bondingProgress = Math.min((realSol / GRADUATION_THRESHOLD_SOL) * 100, 100);

  return {
    priceSol,
    marketCapSol,
    bondingProgress,
    holderCount: safeNumber(data.holder_count ?? 0),
    realSolReserves: realSol,
    // include for debugging/compat
    virtualSolReserves: virtualSol,
    virtualTokenReserves: virtualTokens,
    isGraduated: bondingProgress >= 100,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }

  try {
    const poolAddress =
      (typeof req.query.poolAddress === "string" && req.query.poolAddress) ||
      (typeof req.query.pool === "string" && req.query.pool) ||
      (typeof (req.body as any)?.poolAddress === "string" && (req.body as any).poolAddress) ||
      (typeof (req.body as any)?.pool === "string" && (req.body as any).pool);

    if (!poolAddress) {
      return res.status(400).json({ error: "poolAddress query param required" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const url = `${DBC_API_URL}/pools/${poolAddress}`;
    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return res.status(502).json({
        error: `Upstream DBC API failed (HTTP ${upstream.status})`,
        upstreamStatus: upstream.status,
        upstreamBody: text.slice(0, 300),
      });
    }

    const data = await upstream.json();
    const computed = computeFromDbcPool(data);

    return res.status(200).json({
      poolAddress,
      ...computed,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/pool/state] Error:", error);
    return res.status(500).json({ error: msg });
  }
}
