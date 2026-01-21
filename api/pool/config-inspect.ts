import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Connection, PublicKey } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function bnToString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyV = v as any;
  if (typeof anyV === "bigint") return anyV.toString();
  if (typeof anyV?.toString === "function") return anyV.toString();
  return String(anyV);
}

function bnToSol(v: unknown): number | null {
  const s = bnToString(v);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n / 1e9;
}

function asBase58(v: unknown): string | null {
  try {
    if (!v) return null;
    if (v instanceof PublicKey) return v.toBase58();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyV = v as any;
    if (typeof anyV?.toBase58 === "function") return anyV.toBase58();
    if (typeof anyV === "string") return anyV;
    return String(anyV);
  } catch {
    return null;
  }
}

function pickConfigFields(config: unknown) {
  // We intentionally keep this resilient to SDK struct changes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (config ?? {}) as any;

  return {
    activationType: c.activationType ?? null,
    collectFeeMode: c.collectFeeMode ?? null,
    migrationOption: c.migrationOption ?? null,
    migrationFeeOption: c.migrationFeeOption ?? null,
    tokenType: c.tokenType ?? null,
    tokenDecimal: c.tokenDecimal ?? c.tokenBaseDecimal ?? null,

    feeClaimer: asBase58(c.feeClaimer),
    leftoverReceiver: asBase58(c.leftoverReceiver),
    quoteMint: asBase58(c.quoteMint),

    migrationQuoteThreshold: bnToString(c.migrationQuoteThreshold),
    migrationQuoteThresholdSOL: bnToSol(c.migrationQuoteThreshold),
  };
}

function pickPoolFields(pool: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (pool ?? {}) as any;
  return {
    config: asBase58(p.config),
    creator: asBase58(p.creator),
    baseMint: asBase58(p.baseMint),
    quoteMint: asBase58(p.quoteMint),

    baseReserve: bnToString(p.baseReserve),
    quoteReserve: bnToString(p.quoteReserve),
    quoteReserveSOL: bnToSol(p.quoteReserve),

    activationPoint: bnToString(p.activationPoint),
    isMigrated: Boolean(p.isMigrated),
    migrationProgress: p.migrationProgress ?? null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    return res.status(200).setHeader("Access-Control-Allow-Origin", "*").end();
  }

  try {
    const { pool1, pool2 } = req.query;
    
    if (!pool1) {
      return res.status(400).json({ error: "pool1 query parameter required" });
    }

    const heliusRpcUrl = process.env.HELIUS_RPC_URL;
    if (!heliusRpcUrl) return res.status(500).json({ error: "HELIUS_RPC_URL not configured" });

    const connection = new Connection(heliusRpcUrl, "confirmed");
    const client = new DynamicBondingCurveClient(connection, "confirmed");

    const results: Record<string, unknown> = {};
    const pools = [pool1 as string];
    if (pool2) pools.push(pool2 as string);

    for (const poolAddress of pools) {
      try {
        const poolPubkey = new PublicKey(poolAddress);
        const poolState = await client.state.getPool(poolPubkey);

        if (!poolState) {
          results[poolAddress] = { error: "Pool not found via SDK" };
          continue;
        }

        const configState = await client.state.getPoolConfig(poolState.config);
        if (!configState) {
          results[poolAddress] = {
            pool: pickPoolFields(poolState),
            config: { error: "Config not found via SDK" },
          };
          continue;
        }

        results[poolAddress] = {
          pool: pickPoolFields(poolState),
          config: pickConfigFields(configState),
        };
      } catch (err) {
        results[poolAddress] = { error: err instanceof Error ? err.message : "Unknown error" };
      }
    }
    
    // If comparing two pools, calculate differences (SDK-decoded fields only)
    let differences: string[] = [];
    if (pool2 && results[pool1 as string] && results[pool2 as string]) {
      const r1 = results[pool1 as string] as any;
      const r2 = results[pool2 as string] as any;
      const c1 = r1?.config;
      const c2 = r2?.config;
      const p1 = r1?.pool;
      const p2 = r2?.pool;

      if (c1 && c2 && !c1.error && !c2.error) {
        const keysToCompare = [
          "activationType",
          "collectFeeMode",
          "migrationOption",
          "migrationFeeOption",
          "tokenType",
          "tokenDecimal",
          "migrationQuoteThresholdSOL",
          "feeClaimer",
          "leftoverReceiver",
          "quoteMint",
        ];
        for (const key of keysToCompare) {
          if (c1[key] !== c2[key]) differences.push(`config.${key}: "${c1[key]}" vs "${c2[key]}"`);
        }
      }

      if (p1 && p2 && !p1.error && !p2.error) {
        const poolKeys = ["quoteReserveSOL", "activationPoint", "isMigrated", "migrationProgress", "creator", "baseMint"];
        for (const key of poolKeys) {
          if (p1[key] !== p2[key]) differences.push(`pool.${key}: "${p1[key]}" vs "${p2[key]}"`);
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      pools: results,
      differences: differences.length > 0 ? differences : undefined,
      note: "SDK-decoded pool/config values (trusted). Compare differences to diagnose terminal display issues.",
      usage: {
        exampleCompare: "/api/pool/config-inspect?pool1=<workingPool>&pool2=<yourPool>",
      },
    });
    
  } catch (error) {
    console.error("[config-inspect] Error:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
}
