import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Connection, PublicKey } from "@solana/web3.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Helper to read little-endian integers from buffer
function readU64LE(data: Uint8Array, offset: number): bigint {
  let val = 0n;
  for (let i = 0; i < 8; i++) {
    val |= BigInt(data[offset + i]) << BigInt(i * 8);
  }
  return val;
}

function readU16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readU8(data: Uint8Array, offset: number): number {
  return data[offset];
}

// Decode pool account to get config address
function decodePoolAccount(data: Uint8Array): {
  configAddress: string;
  creatorAddress: string;
  baseMintAddress: string;
  quoteMintAddress: string;
  baseReserve: string;
  quoteReserve: string;
} {
  // Pool account layout (approximate offsets based on Meteora DBC):
  // 8 bytes: discriminator
  // 32 bytes: config
  // 32 bytes: creator
  // 32 bytes: baseMint
  // 32 bytes: quoteMint
  // ... vaults, reserves, etc.
  
  const configAddress = new PublicKey(data.slice(8, 40)).toBase58();
  const creatorAddress = new PublicKey(data.slice(40, 72)).toBase58();
  const baseMintAddress = new PublicKey(data.slice(72, 104)).toBase58();
  const quoteMintAddress = new PublicKey(data.slice(104, 136)).toBase58();
  
  // Base and quote vaults (32 bytes each)
  // offset 136-168: baseVault
  // offset 168-200: quoteVault
  
  // Reserves are u64 values
  // offset 200-208: baseReserve
  // offset 208-216: quoteReserve
  const baseReserve = readU64LE(data, 200).toString();
  const quoteReserve = readU64LE(data, 208).toString();
  
  return {
    configAddress,
    creatorAddress,
    baseMintAddress,
    quoteMintAddress,
    baseReserve,
    quoteReserve,
  };
}

// Decode config account
function decodeConfigAccount(data: Uint8Array): Record<string, unknown> {
  // Config account layout (approximate):
  // 8 bytes: discriminator
  // 32 bytes: poolCreatorAuthority
  // 1 byte: activationType (0=Slot, 1=Timestamp)
  // 1 byte: collectFeeMode
  // ... various fee fields
  // 32 bytes: feeClaimer
  // 32 bytes: leftoverReceiver
  // 32 bytes: quoteMint
  // 1 byte: tokenDecimal
  // ... migration config fields
  
  const poolCreatorAuthority = new PublicKey(data.slice(8, 40)).toBase58();
  const activationType = readU8(data, 40);
  const collectFeeMode = readU8(data, 41);
  
  // Fee fields (various u16/u64 values)
  const tradeFeeNumerator = readU64LE(data, 42);
  const tradeFeeDenominator = readU64LE(data, 50);
  const protocolFeePercent = readU8(data, 58);
  const creatorFeePercent = readU8(data, 59);
  const partnerFeePercent = readU8(data, 60);
  
  // Padding and more fields
  // offset 61-64: padding
  // offset 64-72: activationPoint (u64)
  const activationPoint = readU64LE(data, 64);
  
  // Key addresses
  // offset 72-104: feeClaimer
  // offset 104-136: leftoverReceiver  
  // offset 136-168: quoteMint
  const feeClaimer = new PublicKey(data.slice(72, 104)).toBase58();
  const leftoverReceiver = new PublicKey(data.slice(104, 136)).toBase58();
  const quoteMint = new PublicKey(data.slice(136, 168)).toBase58();
  
  const tokenDecimal = readU8(data, 168);
  
  // Migration config starts around offset 169
  // migrationOption: 1 byte
  // migrationFeeOption: 1 byte
  // tokenType: 1 byte
  // tokenFlag: 1 byte
  // creatorPostMigrationFeePercentage: 1 byte
  const migrationOption = readU8(data, 169);
  const migrationFeeOption = readU8(data, 170);
  const tokenType = readU8(data, 171);
  const tokenFlag = readU8(data, 172);
  const creatorPostMigrationFeePercentage = readU8(data, 173);
  
  // Padding then migration thresholds
  // offset 174-176: padding
  // offset 176-184: migrationQuoteThreshold (u64)
  // offset 184-192: migrationBaseThreshold (u64)
  const migrationQuoteThreshold = readU64LE(data, 176);
  const migrationBaseThreshold = readU64LE(data, 184);
  
  // Curve points start after basic config
  // Look for sqrtPrice and liquidity pairs
  
  return {
    poolCreatorAuthority,
    activationType: activationType === 0 ? "Slot" : activationType === 1 ? "Timestamp" : `Unknown(${activationType})`,
    activationTypeRaw: activationType,
    collectFeeMode,
    tradeFeeNumerator: tradeFeeNumerator.toString(),
    tradeFeeDenominator: tradeFeeDenominator.toString(),
    protocolFeePercent,
    creatorFeePercent,
    partnerFeePercent,
    activationPoint: activationPoint.toString(),
    feeClaimer,
    leftoverReceiver,
    quoteMint,
    tokenDecimal,
    migrationOption: migrationOption === 0 ? "None" : migrationOption === 1 ? "MET_DAMM" : migrationOption === 2 ? "MET_DAMM_V2" : `Unknown(${migrationOption})`,
    migrationOptionRaw: migrationOption,
    migrationFeeOption: migrationFeeOption === 0 ? "FixedBps25" : migrationFeeOption === 1 ? "FixedBps30" : migrationFeeOption === 2 ? "FixedBps100" : migrationFeeOption === 3 ? "FixedBps200" : migrationFeeOption === 4 ? "FixedBps400" : `Unknown(${migrationFeeOption})`,
    migrationFeeOptionRaw: migrationFeeOption,
    tokenType,
    tokenFlag,
    creatorPostMigrationFeePercentage,
    migrationQuoteThreshold: migrationQuoteThreshold.toString(),
    migrationQuoteThresholdSOL: Number(migrationQuoteThreshold) / 1e9,
    migrationBaseThreshold: migrationBaseThreshold.toString(),
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
    if (!heliusRpcUrl) {
      return res.status(500).json({ error: "HELIUS_RPC_URL not configured" });
    }

    const connection = new Connection(heliusRpcUrl, "confirmed");
    
    const results: Record<string, unknown> = {};
    const pools = [pool1 as string];
    if (pool2) pools.push(pool2 as string);
    
    for (const poolAddress of pools) {
      try {
        const poolPubkey = new PublicKey(poolAddress);
        const poolAccountInfo = await connection.getAccountInfo(poolPubkey);
        
        if (!poolAccountInfo) {
          results[poolAddress] = { error: "Pool account not found" };
          continue;
        }
        
        const poolData = decodePoolAccount(poolAccountInfo.data);
        
        // Fetch config account
        const configPubkey = new PublicKey(poolData.configAddress);
        const configAccountInfo = await connection.getAccountInfo(configPubkey);
        
        if (!configAccountInfo) {
          results[poolAddress] = { 
            pool: poolData,
            config: { error: "Config account not found" }
          };
          continue;
        }
        
        const configData = decodeConfigAccount(configAccountInfo.data);
        
        results[poolAddress] = {
          pool: poolData,
          config: configData,
          rawConfigSize: configAccountInfo.data.length,
          rawPoolSize: poolAccountInfo.data.length,
        };
      } catch (err) {
        results[poolAddress] = { error: err instanceof Error ? err.message : "Unknown error" };
      }
    }
    
    // If comparing two pools, calculate differences
    let differences: string[] = [];
    if (pool2 && results[pool1 as string] && results[pool2 as string]) {
      const c1 = (results[pool1 as string] as any)?.config;
      const c2 = (results[pool2 as string] as any)?.config;
      
      if (c1 && c2 && !c1.error && !c2.error) {
        const keysToCompare = [
          "activationType", "activationTypeRaw", "collectFeeMode",
          "migrationOption", "migrationOptionRaw", "migrationFeeOption", "migrationFeeOptionRaw",
          "tokenType", "tokenFlag", "creatorPostMigrationFeePercentage",
          "migrationQuoteThresholdSOL", "protocolFeePercent", "creatorFeePercent", "partnerFeePercent"
        ];
        
        for (const key of keysToCompare) {
          if (c1[key] !== c2[key]) {
            differences.push(`${key}: "${c1[key]}" vs "${c2[key]}"`);
          }
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      pools: results,
      differences: differences.length > 0 ? differences : undefined,
      note: "Compare config values between working and non-working pools"
    });
    
  } catch (error) {
    console.error("[config-inspect] Error:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
}
