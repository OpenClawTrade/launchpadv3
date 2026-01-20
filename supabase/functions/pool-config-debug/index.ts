import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

// Helper to read u64 little-endian from Uint8Array
function readU64LE(arr: Uint8Array, offset: number): bigint {
  let val = 0n;
  for (let i = 0; i < 8; i++) {
    val |= BigInt(arr[offset + i]) << BigInt(i * 8);
  }
  return val;
}

// Helper to read u8
function readU8(arr: Uint8Array, offset: number): number {
  return arr[offset];
}

// Helper to read u16 LE
function readU16LE(arr: Uint8Array, offset: number): number {
  return arr[offset] | (arr[offset + 1] << 8);
}

// Helper to read u32 LE  
function readU32LE(arr: Uint8Array, offset: number): number {
  return arr[offset] | (arr[offset + 1] << 8) | (arr[offset + 2] << 16) | (arr[offset + 3] << 24);
}

// Helper to convert bytes to hex
function toHex(arr: Uint8Array, start = 0, end?: number): string {
  const slice = end !== undefined ? arr.slice(start, end) : arr.slice(start);
  return Array.from(slice).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Simple base58 encoding
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(bytes: Uint8Array): string {
  const hex = toHex(bytes);
  let num = hex.length > 0 ? BigInt("0x" + hex) : 0n;
  let result = "";
  while (num > 0) {
    const remainder = Number(num % 58n);
    num = num / 58n;
    result = BASE58_ALPHABET[remainder] + result;
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result = "1" + result;
  }
  return result || "1";
}

// DBC PoolConfig struct layout analysis based on Meteora SDK IDL
// Offset 0-7: Anchor discriminator (8 bytes)
// Offset 8-39: PoolFees (BaseFee part - 32 bytes estimated)
// Offset 40-71: feeClaimer pubkey (32 bytes)  
// Offset 72-103: leftoverReceiver pubkey (32 bytes)
// Offset 104+: quoteMint, various u8/u16 fields, migrationQuoteThreshold, curve, etc.

function decodeConfigAccountDetailed(base64Data: string): Record<string, unknown> | null {
  try {
    const bytes = decodeBase64(base64Data);
    
    const result: Record<string, unknown> = {
      dataLength: bytes.length,
      discriminator: toHex(bytes, 0, 8),
    };

    // feeClaimer at offset 40-72
    if (bytes.length >= 72) {
      result.feeClaimerAddress = encodeBase58(bytes.slice(40, 72));
      result.feeClaimerHex = toHex(bytes, 40, 72);
    }

    // leftoverReceiver at offset 72-104
    if (bytes.length >= 104) {
      result.leftoverReceiverAddress = encodeBase58(bytes.slice(72, 104));
      result.leftoverReceiverHex = toHex(bytes, 72, 104);
    }

    // quoteMint at offset 104-136
    if (bytes.length >= 136) {
      result.quoteMintAddress = encodeBase58(bytes.slice(104, 136));
    }

    // After quoteMint, we have various config fields
    // Based on IDL, approx layout:
    // 136: tokenDecimal (u8)
    // 137: tokenType (u8)  
    // 138: activationType (u8)
    // 139: collectFeeMode (u8)
    // 140: migrationOption (u8)
    // 141: tokenUpdateAuthority (u8)
    // 142-143: padding or reserved
    // ...then partnerLpPercentage, creatorLpPercentage, etc.
    
    if (bytes.length > 142) {
      result.tokenDecimal = readU8(bytes, 136);
      result.tokenType = readU8(bytes, 137);
      result.activationType = readU8(bytes, 138);  // 0=slot, 1=timestamp
      result.collectFeeMode = readU8(bytes, 139);
      result.migrationOption = readU8(bytes, 140);
      result.tokenUpdateAuthority = readU8(bytes, 141);
    }

    // Scan for u16 values that might be percentages (0-10000 range)
    const percentageFields: Record<string, number> = {};
    for (let i = 142; i < Math.min(bytes.length - 2, 200); i += 2) {
      const val = readU16LE(bytes, i);
      if (val > 0 && val <= 10000) {
        percentageFields[`offset_${i}`] = val;
      }
    }
    result.possiblePercentageFields = percentageFields;

    // Scan for 85 SOL threshold
    const threshold85SOL = BigInt(85_000_000_000);
    for (let i = 0; i < bytes.length - 8; i++) {
      try {
        const val = readU64LE(bytes, i);
        if (val === threshold85SOL) {
          result.migrationQuoteThresholdOffset = i;
          result.migrationQuoteThreshold = val.toString();
          result.migrationQuoteThresholdSOL = Number(val) / 1e9;
        }
      } catch { /* ignore */ }
    }

    // Look for migrationFeeOption - likely a u8 near the end of the config section
    // Values: 0-5 for fixed presets, 6 for customizable
    // Usually right after the tokenUpdateAuthority and before curve data
    const possibleMigrationFeeOptions: Record<string, number> = {};
    for (let i = 142; i < Math.min(bytes.length, 280); i++) {
      const val = bytes[i];
      if (val >= 0 && val <= 6) {
        // Check if this could be a meaningful field
        possibleMigrationFeeOptions[`offset_${i}`] = val;
      }
    }
    result.possibleMigrationFeeOptions = possibleMigrationFeeOptions;

    // Extract bytes 200-280 which likely contain migration settings
    if (bytes.length >= 280) {
      result.migrationSection = toHex(bytes, 200, 280);
    }

    // Extract full fee section
    result.feeSection = toHex(bytes, 8, 40);

    // Extract curve data (typically starts after ~300 bytes)
    if (bytes.length >= 400) {
      result.curveDataStart = toHex(bytes, 300, 400);
    }

    // Raw bytes for specific offset comparison
    result.bytes_136_150 = toHex(bytes, 136, 150);
    result.bytes_150_170 = toHex(bytes, 150, 170);
    result.bytes_170_200 = toHex(bytes, 170, 200);
    result.bytes_200_232 = toHex(bytes, 200, 232);
    result.bytes_232_264 = toHex(bytes, 232, 264);
    result.bytes_264_296 = toHex(bytes, 264, 296);

    return result;
  } catch (e) {
    console.error("Config decode error:", e);
    return null;
  }
}

function decodePoolAccount(base64Data: string): Record<string, unknown> | null {
  try {
    const bytes = decodeBase64(base64Data);
    
    const result: Record<string, unknown> = {
      dataLength: bytes.length,
      discriminator: toHex(bytes, 0, 8),
    };

    if (bytes.length >= 104) {
      result.configAddress = encodeBase58(bytes.slice(72, 104));
    }
    if (bytes.length >= 136) {
      result.creatorAddress = encodeBase58(bytes.slice(104, 136));
    }
    if (bytes.length >= 168) {
      result.baseMintAddress = encodeBase58(bytes.slice(136, 168));
    }
    if (bytes.length >= 200) {
      result.baseVaultAddress = encodeBase58(bytes.slice(168, 200));
    }
    if (bytes.length >= 232) {
      result.quoteVaultAddress = encodeBase58(bytes.slice(200, 232));
    }
    if (bytes.length >= 240) {
      const baseReserve = readU64LE(bytes, 232);
      result.baseReserve = baseReserve.toString();
      result.baseReserveHuman = Number(baseReserve) / 1e6;
    }
    if (bytes.length >= 248) {
      const quoteReserve = readU64LE(bytes, 240);
      result.quoteReserve = quoteReserve.toString();
      result.quoteReserveHuman = Number(quoteReserve) / 1e9;
    }

    return result;
  } catch (e) {
    console.error("Pool decode error:", e);
    return null;
  }
}

async function fetchAccountData(address: string, heliusRpcUrl: string): Promise<{ data: string; owner: string } | null> {
  try {
    const response = await fetch(heliusRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "account-fetch",
        method: "getAccountInfo",
        params: [address, { encoding: "base64" }],
      }),
    });

    if (!response.ok) return null;
    
    const json = await response.json();
    if (json.error || !json.result?.value) return null;
    
    return {
      data: json.result.value.data[0],
      owner: json.result.value.owner,
    };
  } catch (e) {
    console.error("Fetch error for", address, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL");
  if (!heliusRpcUrl) {
    return new Response(JSON.stringify({ error: "HELIUS_RPC_URL not configured" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const pool1 = url.searchParams.get("pool1") || "9GbGkQDLCM33Po33hQetjT8N1pVLoxVEdLx5T9fXMnBA";
  const pool2 = url.searchParams.get("pool2") || "FcymoaqGL9mT4bAkdZxYj18kaMcvwRL3smCV881i75Ea";

  console.log("Comparing pools:", pool1, "vs", pool2);

  const [pool1Data, pool2Data] = await Promise.all([
    fetchAccountData(pool1, heliusRpcUrl),
    fetchAccountData(pool2, heliusRpcUrl),
  ]);

  if (!pool1Data || !pool2Data) {
    return new Response(JSON.stringify({ 
      error: "Failed to fetch one or both pool accounts",
      pool1Found: !!pool1Data,
      pool2Found: !!pool2Data,
    }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const pool1Decoded = decodePoolAccount(pool1Data.data);
  const pool2Decoded = decodePoolAccount(pool2Data.data);

  const config1Address = pool1Decoded?.configAddress as string;
  const config2Address = pool2Decoded?.configAddress as string;

  console.log("Config addresses:", config1Address, config2Address);

  const [config1Data, config2Data] = await Promise.all([
    config1Address ? fetchAccountData(config1Address, heliusRpcUrl) : null,
    config2Address ? fetchAccountData(config2Address, heliusRpcUrl) : null,
  ]);

  const config1Decoded = config1Data ? decodeConfigAccountDetailed(config1Data.data) : null;
  const config2Decoded = config2Data ? decodeConfigAccountDetailed(config2Data.data) : null;

  // Key differences analysis
  const keyDifferences: Record<string, { yours: unknown; bags: unknown; impact: string }> = {};
  
  if (config1Decoded && config2Decoded) {
    // activationType
    if (config1Decoded.activationType !== config2Decoded.activationType) {
      keyDifferences["activationType"] = {
        yours: config1Decoded.activationType,
        bags: config2Decoded.activationType,
        impact: "0=slot-based, 1=timestamp-based. Timestamp preferred for terminal compatibility."
      };
    }

    // feeClaimer/leftoverReceiver same?
    const yourFeeClaimerSameAsLeftover = config1Decoded.feeClaimerAddress === config1Decoded.leftoverReceiverAddress;
    const bagsFeeClaimerSameAsLeftover = config2Decoded.feeClaimerAddress === config2Decoded.leftoverReceiverAddress;
    
    if (yourFeeClaimerSameAsLeftover !== bagsFeeClaimerSameAsLeftover) {
      keyDifferences["feeClaimerLeftoverReceiver"] = {
        yours: yourFeeClaimerSameAsLeftover ? "SAME address" : "DIFFERENT addresses",
        bags: bagsFeeClaimerSameAsLeftover ? "SAME address" : "DIFFERENT addresses",
        impact: "May affect how terminals identify the pool type/launchpad"
      };
    }

    // Compare migration section bytes
    if (config1Decoded.bytes_200_232 !== config2Decoded.bytes_200_232) {
      keyDifferences["bytes_200_232"] = {
        yours: config1Decoded.bytes_200_232,
        bags: config2Decoded.bytes_200_232,
        impact: "Contains creatorTradingFeePercentage, lockedVesting, or other key fields"
      };
    }

    if (config1Decoded.bytes_232_264 !== config2Decoded.bytes_232_264) {
      keyDifferences["bytes_232_264"] = {
        yours: config1Decoded.bytes_232_264,
        bags: config2Decoded.bytes_232_264,
        impact: "Contains migrationQuoteThreshold and surrounding fields"
      };
    }

    // Check fee section
    if (config1Decoded.feeSection !== config2Decoded.feeSection) {
      keyDifferences["feeSection"] = {
        yours: config1Decoded.feeSection,
        bags: config2Decoded.feeSection,
        impact: "Contains cliffFeeNumerator and dynamic fee settings"
      };
    }
  }

  return new Response(JSON.stringify({
    pool1: {
      address: pool1,
      owner: pool1Data.owner,
      decoded: pool1Decoded,
      configAddress: config1Address,
      configOwner: config1Data?.owner,
      configDecoded: config1Decoded,
    },
    pool2: {
      address: pool2,
      owner: pool2Data.owner,
      decoded: pool2Decoded,
      configAddress: config2Address,
      configOwner: config2Data?.owner,
      configDecoded: config2Decoded,
    },
    keyDifferences,
    summary: Object.keys(keyDifferences).length === 0 
      ? "No obvious key differences found - issue may be in curve data or terminal-specific logic"
      : `Found ${Object.keys(keyDifferences).length} key difference(s) that may cause terminal incompatibility`,
  }, null, 2), {
    headers: corsHeaders,
  });
});
