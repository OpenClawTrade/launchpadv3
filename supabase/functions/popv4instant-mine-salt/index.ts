// PopShiba V4-Klik — CREATE2 salt miner for the singleton hook.
//
// Required permission bits for PopKlikHook (lower 14 of address):
//   beforeInitialize       (1 << 13) = 0x2000
//   beforeSwap             (1 << 7)  = 0x0080
//   afterSwap              (1 << 6)  = 0x0040
//   beforeSwapReturnDelta  (1 << 3)  = 0x0008
//   afterSwapReturnDelta   (1 << 2)  = 0x0004
//   ──────────────────────────────────────────
//   TOTAL                            = 0x20CC
//
// Body: { factory, initCodeHash, maxIterations? }
//   factory       = address that will CREATE2-deploy the hook (the
//                   canonical CREATE2 deployer 0x4e59…56C)
//   initCodeHash  = keccak256(creationCode || constructorArgs)
import { keccak_256 } from "https://esm.sh/@noble/hashes@1.4.0/sha3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const REQUIRED_BITS = 0x20CCn;

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToHex(b: Uint8Array): string {
  let s = "0x";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

function computeCreate2(factoryBytes: Uint8Array, salt: Uint8Array, initCodeHash: Uint8Array): Uint8Array {
  const buf = new Uint8Array(1 + 20 + 32 + 32);
  buf[0] = 0xff;
  buf.set(factoryBytes, 1);
  buf.set(salt, 21);
  buf.set(initCodeHash, 53);
  return keccak_256(buf).slice(12);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { factory, initCodeHash, maxIterations = 20_000_000 } = await req.json();
    if (!factory || !initCodeHash) {
      return json({ error: "factory + initCodeHash required" }, 400);
    }
    const factoryBytes = hexToBytes(factory);
    const ichBytes = hexToBytes(initCodeHash);
    if (factoryBytes.length !== 20) throw new Error("factory must be 20 bytes");
    if (ichBytes.length !== 32) throw new Error("initCodeHash must be 32 bytes");

    const salt = new Uint8Array(32);
    crypto.getRandomValues(salt.subarray(0, 16));

    let iterations = 0;
    const start = Date.now();
    for (let i = 0; i < maxIterations; i++) {
      for (let j = 31; j >= 24; j--) {
        salt[j] = (salt[j] + 1) & 0xff;
        if (salt[j] !== 0) break;
      }
      iterations++;
      const addr = computeCreate2(factoryBytes, salt, ichBytes);
      const lower14 = ((addr[18] & 0x3f) << 8) | addr[19];
      if (BigInt(lower14) === REQUIRED_BITS) {
        return json({
          salt: bytesToHex(salt),
          hookAddress: bytesToHex(addr),
          iterations,
          elapsedMs: Date.now() - start,
        });
      }
    }
    return json({ error: "no salt found", iterations }, 504);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
