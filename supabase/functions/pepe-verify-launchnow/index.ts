// Auto-verifies PepeToken (LaunchNow edition) on Etherscan.
// Source: contracts/launchnow/PepeToken.sol — solc 0.8.28, optimizer runs=200, evmVersion=paris.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { PEPE_TOKEN_SOURCE } from "./source.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHAIN_ID = 1;
const COMPILER = "v0.8.28+commit.7893614a";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sanitize(s: unknown): string {
  return String(s ?? "").replace(/\r?\n/g, " ").replace(/\*\//g, "* /").trim();
}

function buildHeader(headerRaw: string | undefined): string {
  if (!headerRaw) return "";
  const lines = headerRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => (l.startsWith("//") ? l : `// ${l}`))
    .map((l) => l.replace(/\*\//g, "* /"));
  return lines.length ? lines.join("\n") + "\n//\n" : "";
}

// Encode (string, string, uint256) ABI args: dynamic offsets
function encodeConstructorArgs(name: string, symbol: string, supply: bigint): string {
  const enc = (n: bigint) => n.toString(16).padStart(64, "0");
  const encStr = (s: string) => {
    const bytes = new TextEncoder().encode(s);
    const len = enc(BigInt(bytes.length));
    let hex = "";
    for (const b of bytes) hex += b.toString(16).padStart(2, "0");
    // pad to 32-byte boundary
    const padLen = (64 - (hex.length % 64)) % 64;
    return len + hex + "0".repeat(padLen);
  };
  // 3 head slots: offset(name), offset(symbol), supply
  const offName = 96n; // 3 * 32
  const nameTail = encStr(name);
  const offSymbol = offName + BigInt(nameTail.length / 2);
  const symbolTail = encStr(symbol);
  return enc(offName) + enc(offSymbol) + enc(supply) + nameTail + symbolTail;
}

async function pollStatus(guid: string, apiKey: string): Promise<{ verified: boolean; msg: string }> {
  for (let i = 0; i < 30; i++) {
    await delay(5000);
    try {
      const r = await fetch(
        `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${apiKey}`,
      );
      const j = await r.json();
      const m = String(j?.result || "");
      console.log(`[pepe-verify] poll ${i + 1}: ${m}`);
      if (/pass/i.test(m)) return { verified: true, msg: m };
      if (/fail/i.test(m) && !/pending/i.test(m)) return { verified: false, msg: m };
    } catch {/* retry */}
  }
  return { verified: false, msg: "timeout" };
}

async function waitForIndex(addr: string, apiKey: string): Promise<boolean> {
  for (let i = 0; i < 24; i++) {
    if (i > 0) await delay(5000);
    try {
      const r = await fetch(
        `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=proxy&action=eth_getCode&address=${addr}&tag=latest&apikey=${apiKey}`,
      );
      const j = await r.json();
      const code = j?.result || "0x";
      if (code && code !== "0x" && code.length > 10) return true;
    } catch {/* retry */}
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ETHERSCAN_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "ETHERSCAN_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tokenAddress: string | undefined = body?.tokenAddress;
    const name: string | undefined = body?.name;
    const symbol: string | undefined = body?.symbol;
    const supply: string | undefined = body?.totalSupply; // decimal string of raw uint256
    const header: string | undefined = body?.header;
    const waitForResult: boolean = body?.waitForResult !== false;

    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid tokenAddress" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!name || !symbol || !supply) {
      return new Response(JSON.stringify({ success: false, error: "Missing name/symbol/totalSupply" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[pepe-verify] waiting for indexing ${tokenAddress}`);
    const indexed = await waitForIndex(tokenAddress, apiKey);
    if (!indexed) {
      return new Response(JSON.stringify({ success: false, error: "Etherscan did not index contract in time" }), {
        status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headerBlock = buildHeader(header);
    const sourceWithHeader = headerBlock
      ? PEPE_TOKEN_SOURCE.replace(/^(\/\/ SPDX-License-Identifier:[^\n]*\n)/, `$1${headerBlock}`)
      : PEPE_TOKEN_SOURCE;

    const standardJson = {
      language: "Solidity",
      sources: { "PepeToken.sol": { content: sourceWithHeader } },
      settings: {
        evmVersion: "paris",
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      },
    };

    const ctorArgsHex = encodeConstructorArgs(sanitize(name), sanitize(symbol), BigInt(supply));

    const form = new URLSearchParams();
    form.append("apikey", apiKey);
    form.append("module", "contract");
    form.append("action", "verifysourcecode");
    form.append("contractaddress", tokenAddress);
    form.append("sourceCode", JSON.stringify(standardJson));
    form.append("codeformat", "solidity-standard-json-input");
    form.append("contractname", "PepeToken.sol:PepeToken");
    form.append("compilerversion", COMPILER);
    form.append("constructorArguements", ctorArgsHex);

    const resp = await fetch(`https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}`, {
      method: "POST",
      body: form,
    });
    const json = await resp.json();
    console.log("[pepe-verify] submit", json);

    if (json?.status !== "1") {
      const msg = String(json?.result || json?.message || "Unknown");
      if (/already verified/i.test(msg)) {
        return new Response(JSON.stringify({ success: true, verified: true, alreadyVerified: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guid: string = json.result;
    if (!waitForResult) {
      return new Response(JSON.stringify({ success: true, guid, message: "Submitted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await pollStatus(guid, apiKey);
    return new Response(JSON.stringify({ success: true, verified: result.verified, guid, message: result.msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[pepe-verify-launchnow]", err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
