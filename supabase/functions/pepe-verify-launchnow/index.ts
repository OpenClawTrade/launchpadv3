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
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC = `0x${"0".repeat(64)}`;
const ETH_RPC_URLS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.llamarpc.com",
  "https://rpc.ankr.com/eth",
  "https://cloudflare-eth.com",
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Etherscan free tier: 5 req/sec hard cap. We stay safely under at ~1.5 req/sec.
let lastEtherscanCall = 0;
const ETHERSCAN_MIN_GAP_MS = 700;
async function etherscanFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const wait = lastEtherscanCall + ETHERSCAN_MIN_GAP_MS - now;
  if (wait > 0) await delay(wait);
  lastEtherscanCall = Date.now();
  const r = await fetch(url, init);
  // If we still hit the rate limit, back off and retry once.
  try {
    const cloned = r.clone();
    const j = await cloned.json();
    const msg = String(j?.result || j?.message || "");
    if (/max calls per sec|rate limit/i.test(msg)) {
      console.warn("[etherscan] rate limited, backing off 2s");
      await delay(2000);
      lastEtherscanCall = Date.now();
      return await fetch(url, init);
    }
  } catch { /* not json, ignore */ }
  return r;
}

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
      const r = await etherscanFetch(
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

// eth_getCode tells us the chain has the contract.
async function waitForCode(addr: string, apiKey: string): Promise<boolean> {
  for (let i = 0; i < 24; i++) {
    if (i > 0) await delay(5000);
    try {
      const r = await etherscanFetch(
        `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=proxy&action=eth_getCode&address=${addr}&tag=latest&apikey=${apiKey}`,
      );
      const j = await r.json();
      const code = j?.result || "0x";
      if (code && code !== "0x" && code.length > 10) return true;
    } catch {/* retry */}
  }
  return false;
}

// getsourcecode tells us Etherscan's *verification* indexer can see the contract.
// This is the index used by verifysourcecode — RPC eth_getCode is not enough.
async function waitForVerifyIndex(addr: string, apiKey: string): Promise<boolean> {
  for (let i = 0; i < 36; i++) {
    if (i > 0) await delay(5000);
    try {
      const r = await etherscanFetch(
        `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=contract&action=getsourcecode&address=${addr}&apikey=${apiKey}`,
      );
      const j = await r.json();
      const arr = Array.isArray(j?.result) ? j.result : [];
      const item = arr[0];
      if (item && typeof item === "object") {
        // Once Etherscan recognizes the address (verified or not) it returns an object
        // with at least an ABI / SourceCode field present (possibly empty strings).
        // The presence of the result row itself is the signal we need.
        return true;
      }
    } catch {/* retry */}
  }
  return false;
}

async function isAlreadyVerified(addr: string, apiKey: string): Promise<boolean> {
  try {
    const r = await etherscanFetch(
      `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=contract&action=getsourcecode&address=${addr}&apikey=${apiKey}`,
    );
    const j = await r.json();
    const item = Array.isArray(j?.result) ? j.result[0] : null;
    const src = item?.SourceCode ?? "";
    return typeof src === "string" && src.length > 0;
  } catch {
    return false;
  }
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  let lastError: Error | null = null;
  for (const url of ETH_RPC_URLS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = await r.json();
      if (j?.error) throw new Error(String(j.error?.message || "RPC error"));
      return j.result as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error(`RPC ${method} failed`);
}

async function resolveInitialSupplyFromLogs(tokenAddress: string): Promise<bigint | null> {
  try {
    const logs = await rpcCall<Array<{ data?: string }>>("eth_getLogs", [{
      address: tokenAddress,
      fromBlock: "0x0",
      toBlock: "latest",
      topics: [TRANSFER_TOPIC, ZERO_TOPIC],
    }]);
    const mintLog = logs.find((log) => typeof log?.data === "string" && /^0x[0-9a-fA-F]+$/.test(log.data));
    if (!mintLog?.data) return null;
    return BigInt(mintLog.data);
  } catch (err) {
    console.warn("[pepe-verify] failed to resolve initial supply from logs", err);
    return null;
  }
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
    const supply: string | undefined = body?.totalSupply; // optional current supply; verifier resolves initial mint when possible
    const header: string | undefined = body?.header;
    const waitForResult: boolean = body?.waitForResult !== false;

    // NEW (per-token unique source): when the client compiled a fresh source
    // server-side via pepe-compile-launchnow, it passes the exact bytes back
    // so we can verify with the SAME source that produced the bytecode.
    const customSourceCode: string | undefined = body?.sourceCode;
    const customContractName: string | undefined = body?.contractName;
    const customFileName: string | undefined = body?.fileName;

    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid tokenAddress" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!name || !symbol) {
      return new Response(JSON.stringify({ success: false, error: "Missing name/symbol" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[pepe-verify] checking already-verified ${tokenAddress}`);
    if (await isAlreadyVerified(tokenAddress, apiKey)) {
      console.log(`[pepe-verify] ${tokenAddress} already verified`);
      return new Response(JSON.stringify({ success: true, verified: true, alreadyVerified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[pepe-verify] waiting for code ${tokenAddress}`);
    const hasCode = await waitForCode(tokenAddress, apiKey);
    if (!hasCode) {
      return new Response(JSON.stringify({ success: false, error: "Etherscan RPC did not see contract code in time. Try again in 1-2 minutes." }), {
        status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[pepe-verify] waiting for verifier index ${tokenAddress}`);
    const verifierReady = await waitForVerifyIndex(tokenAddress, apiKey);
    if (!verifierReady) {
      console.warn(`[pepe-verify] verifier index not ready, attempting submit anyway`);
    }

    // Decide which source/contract/file to submit:
    //   - If client provided customSourceCode (LaunchNow fresh-compile path),
    //     use it verbatim — it's the exact source that produced the on-chain
    //     bytecode, so verification is Exact Match with custom header preserved.
    //   - Otherwise fall back to the legacy shared PEPE_TOKEN_SOURCE.
    const useFreshSource = !!(customSourceCode && customContractName && customFileName);
    const sourceContent = useFreshSource ? customSourceCode! : PEPE_TOKEN_SOURCE;
    const fileName = useFreshSource ? customFileName! : "PepeToken.sol";
    const contractIdentifier = useFreshSource
      ? `${customFileName}:${customContractName}`
      : "PepeToken.sol:PepeToken";

    if (!useFreshSource) {
      // Legacy path — header injection would break bytecode equality.
      void header;
      void buildHeader;
    }

    const standardJson = {
      language: "Solidity",
      sources: { [fileName]: { content: sourceContent } },
      settings: {
        evmVersion: "paris",
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      },
    };

    const resolvedInitialSupply = await resolveInitialSupplyFromLogs(tokenAddress);
    const ctorSupply = resolvedInitialSupply ?? (supply ? BigInt(supply) : null);
    if (ctorSupply == null) {
      return new Response(JSON.stringify({ success: false, error: "Could not resolve the token's original launch supply for verification" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[pepe-verify] submitting ${contractIdentifier} (${useFreshSource ? "fresh" : "legacy"}) supply=${ctorSupply.toString()}`);
    const ctorArgsHex = encodeConstructorArgs(sanitize(name), sanitize(symbol), ctorSupply);

    const buildForm = () => {
      const form = new URLSearchParams();
      form.append("apikey", apiKey);
      form.append("module", "contract");
      form.append("action", "verifysourcecode");
      form.append("contractaddress", tokenAddress);
      form.append("sourceCode", JSON.stringify(standardJson));
      form.append("codeformat", "solidity-standard-json-input");
      form.append("contractname", contractIdentifier);
      form.append("compilerversion", COMPILER);
      form.append("constructorArguements", ctorArgsHex);
      return form;
    };

    // Retry submit on transient "Unable to locate ContractCode" — that means
    // Etherscan's verifier index hasn't caught up yet even though RPC sees the code.
    let json: any = null;
    let lastMsg = "";
    for (let attempt = 0; attempt < 8; attempt++) {
      if (attempt > 0) {
        console.log(`[pepe-verify] submit retry ${attempt} (after "${lastMsg}")`);
        await delay(8000);
      }
      const resp = await etherscanFetch(`https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}`, {
        method: "POST",
        body: buildForm(),
      });
      json = await resp.json();
      console.log(`[pepe-verify] submit attempt ${attempt + 1}`, json);
      lastMsg = String(json?.result || json?.message || "");
      if (json?.status === "1") break;
      if (/already verified/i.test(lastMsg)) {
        return new Response(JSON.stringify({ success: true, verified: true, alreadyVerified: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Only retry on transient indexer-lag errors. Bytecode mismatches won't fix themselves.
      if (!/unable to locate|not yet indexed|please try again/i.test(lastMsg)) break;
    }

    if (json?.status !== "1") {
      return new Response(JSON.stringify({ success: false, error: lastMsg || "Unknown" }), {
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
