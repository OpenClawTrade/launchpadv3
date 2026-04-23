// Salt miner for Uniswap V4 hook deployment.
// Brute-forces a CREATE2 salt so the deployed hook address has the required
// permission bits in the lower 14 bits of the address: 0x2A88
//   (beforeAddLiquidity | beforeRemoveLiquidity | beforeSwap | beforeSwapReturnsDelta)
//
// Input: { factory: address, initCodeHash: 0x... (keccak256 of init code) }
// Output: { salt: 0x..., hookAddress: 0x..., iterations: number }
//
// Uses Web Crypto + ethers-style CREATE2 math (keccak256 over [0xff, factory, salt, initCodeHash]).
// Typically converges in <50k iterations for a 14-bit constraint.
import { keccak_256 } from "https://esm.sh/@noble/hashes@1.4.0/sha3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const REQUIRED_BITS = 0x2A88n;
const MASK = 0x3FFFn;

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
  return keccak_256(buf).slice(12); // last 20 bytes = address
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { factory, initCodeHash, maxIterations = 5_000_000 } = await req.json();
    if (!factory || !initCodeHash) {
      return new Response(JSON.stringify({ error: "factory + initCodeHash required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const factoryBytes = hexToBytes(factory);
    const ichBytes = hexToBytes(initCodeHash);
    if (factoryBytes.length !== 20) throw new Error("factory must be 20 bytes");
    if (ichBytes.length !== 32) throw new Error("initCodeHash must be 32 bytes");

    const salt = new Uint8Array(32);
    // Randomize the high 16 bytes so parallel callers don't collide
    crypto.getRandomValues(salt.subarray(0, 16));

    let iterations = 0;
    const start = Date.now();
    for (let i = 0; i < maxIterations; i++) {
      // Increment the low 64 bits of salt
      for (let j = 31; j >= 24; j--) {
        salt[j] = (salt[j] + 1) & 0xff;
        if (salt[j] !== 0) break;
      }
      iterations++;
      const addr = computeCreate2(factoryBytes, salt, ichBytes);
      // Lower 14 bits live in addr[18..19] (last 2 bytes, big-endian)
      const lower14 = ((addr[18] & 0x3f) << 8) | addr[19];
      if (BigInt(lower14) === REQUIRED_BITS) {
        return new Response(JSON.stringify({
          salt: bytesToHex(salt),
          hookAddress: bytesToHex(addr),
          iterations,
          elapsedMs: Date.now() - start,
        }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ error: "no salt found", iterations }), {
      status: 504, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
