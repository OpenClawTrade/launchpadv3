// ============================================================================
// eth-verify-contract
//
// Verifies either:
// 1) legacy PopShiba clone tokens, or
// 2) standalone V2-burn tokens deployed by PopShibaBurnLauncherV2, or
// 3) standalone V2-fees tokens deployed by PopShibaFeesLauncherV2 (1% swap fee).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient,
  encodeAbiParameters,
  http,
  parseAbi,
  parseAbiParameters,
} from "https://esm.sh/viem@2.45.1";
import { mainnet } from "https://esm.sh/viem@2.45.1/chains";
import { POPSHIBA_FEES_LAUNCHER_V2_SOURCE } from "./v2fees_source.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ETHEREUM_CHAIN_ID = 1;
const COMPILER_VERSION = "v0.8.20+commit.a1b79de6";
const TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;

const POPSHIBA_TOKEN_BASE_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PopShibaToken {
    string public name;
    string public symbol;
    uint8  public constant decimals = 18;
    uint256 public totalSupply;
    string  public metadataURI;
    string  public constant launchedBy = "PopShiba.com";

    bool private _initialized;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function initialize(
        string memory _name,
        string memory _symbol,
        address _recipient,
        uint256 _supply,
        string memory _metadataURI
    ) external {
        require(!_initialized, "ALREADY_INIT");
        _initialized = true;
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        metadataURI = _metadataURI;
        balanceOf[_recipient] = _supply;
        emit Transfer(address(0), _recipient, _supply);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "ERC20: allowance");
        if (allowed != type(uint256).max) {
            unchecked { allowance[from][msg.sender] = allowed - value; }
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "ERC20: balance");
        unchecked {
            balanceOf[from] -= value;
            balanceOf[to]   += value;
        }
        emit Transfer(from, to, value);
    }
}
`;

const POPSHIBA_BURN_TOKEN_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PopShibaBurnToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    string public metadataURI;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory metadataURI_,
        uint256 totalSupply_,
        address recipient
    ) {
        name = name_;
        symbol = symbol_;
        metadataURI = metadataURI_;
        totalSupply = totalSupply_;
        balanceOf[recipient] = totalSupply_;
        emit Transfer(address(0), recipient, totalSupply_);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            require(a >= amount, "ERC20: allowance");
            allowance[from][msg.sender] = a - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ERC20: zero to");
        uint256 b = balanceOf[from];
        require(b >= amount, "ERC20: balance");
        unchecked { balanceOf[from] = b - amount; }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
`;

const METADATA_ABI = parseAbi(["function metadataURI() view returns (string)"]);
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForEtherscanIndexing(tokenAddress: string, apiKey: string, maxRetries = 20): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (i > 0) await delay(6000);
    try {
      const resp = await fetch(
        `https://api.etherscan.io/v2/api?chainid=${ETHEREUM_CHAIN_ID}&module=proxy&action=eth_getCode&address=${tokenAddress}&tag=latest&apikey=${apiKey}`
      );
      const json = await resp.json();
      const code = json?.result || "0x";
      if (code && code !== "0x" && code.length > 10) {
        console.log(`[eth-verify] contract indexed after ${i + 1} attempts`);
        return true;
      }
    } catch (_) {}
    console.log(`[eth-verify] waiting for indexing... attempt ${i + 1}/${maxRetries}`);
  }
  return false;
}

async function pollVerificationStatus(guid: string, apiKey: string, maxRetries = 24): Promise<{ verified: boolean; message: string }> {
  for (let i = 0; i < maxRetries; i++) {
    await delay(6000);
    try {
      const resp = await fetch(
        `https://api.etherscan.io/v2/api?chainid=${ETHEREUM_CHAIN_ID}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${apiKey}`
      );
      const json = await resp.json();
      const result = String(json?.result || "");
      console.log(`[eth-verify] poll ${i + 1}: ${result}`);
      if (/pass/i.test(result)) return { verified: true, message: result };
      if (/fail/i.test(result) && !/pending/i.test(result)) return { verified: false, message: result };
    } catch (_) {}
  }
  return { verified: false, message: "Verification polling timed out" };
}

function buildMetadataHeader(launch: any): string {
  const sanitize = (s: unknown) =>
    String(s ?? "").replace(/\r?\n/g, " ").replace(/\*\//g, "* /").trim();
  const lines: string[] = [];
  lines.push(`// Launched from POPSHIBA.COM`);
  const nm = sanitize(launch.token_name);
  const tk = sanitize(launch.token_ticker);
  if (nm || tk) lines.push(`// ${nm}${tk ? ` ($${tk})` : ""}`);
  if (launch.description) lines.push(`// Description - ${sanitize(launch.description).slice(0, 500)}`);
  if (launch.website_url) lines.push(`// ${sanitize(launch.website_url)}`);
  if (launch.twitter_url) lines.push(`// ${sanitize(launch.twitter_url)}`);
  if (launch.telegram_url) lines.push(`// ${sanitize(launch.telegram_url)}`);
  return lines.length ? lines.join("\n") + "\n//\n" : "";
}

// NOTE: We do NOT inject any code or NatSpec into the source body, because the
// contract bytecode is already deployed and any change to the source would
// either alter the runtime bytecode (verification fails) or alter the metadata
// hash suffix (verification also fails). The only thing we can change is
// pure-comment lines that the compiler ignores entirely. Etherscan still
// displays those comments on the verified Code tab even if they don't break
// the "Similar Match" group, so the per-token header (name, ticker,
// description, socials) WILL show at the top of the source view.

async function inferTokenKind(supabase: ReturnType<typeof createClient>, launch: any): Promise<"clone" | "v2burn" | "v2fees"> {
  // Try to find the launcher row by tx hash regardless of burn_lp flag (which is shared
  // between v2burn and v2fees) so we can distinguish the two.
  const txHash = launch?.launch_tx_hash || launch?.deploy_tx_hash;
  if (txHash && typeof txHash === "string") {
    const rpc = Deno.env.get("ETH_MAINNET_RPC_URL") || "https://eth.llamarpc.com";
    const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
    try {
      const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
      if (tx.to) {
        const { data: rows } = await supabase
          .from("eth_deployments")
          .select("launcher_address, contracts")
          .eq("is_active", true);
        const matched = (rows || []).find((r: any) =>
          String(r.launcher_address || "").toLowerCase() === String(tx.to).toLowerCase()
        );
        const v = (matched?.contracts as any)?.version;
        if (v === "v2fees") return "v2fees";
        if (v === "v2burn") return "v2burn";
      }
    } catch (e) {
      console.error("[eth-verify] failed to infer token kind from tx", e);
    }
  }
  if (launch?.burn_lp) return "v2burn";
  return "clone";
}

async function buildConstructorArgsHex(launch: any, tokenKind: "clone" | "v2burn" | "v2fees"): Promise<string> {
  if (tokenKind === "clone") return "";

  const txHash = launch?.launch_tx_hash || launch?.deploy_tx_hash;
  if (!txHash || typeof txHash !== "string") {
    throw new Error("Missing launch transaction hash for verification");
  }

  const rpc = Deno.env.get("ETH_MAINNET_RPC_URL") || "https://eth.llamarpc.com";
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
  const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
  if (!tx.to) {
    throw new Error("Could not determine launcher address from launch tx");
  }

  const metadataURI = await publicClient.readContract({
    address: launch.token_address as `0x${string}`,
    abi: METADATA_ABI,
    functionName: "metadataURI",
  });

  if (tokenKind === "v2burn") {
    return encodeAbiParameters(
      parseAbiParameters("string,string,string,uint256,address"),
      [
        String(launch.token_name || ""),
        String(launch.token_ticker || ""),
        String(metadataURI || ""),
        TOTAL_SUPPLY,
        tx.to,
      ]
    ).slice(2);
  }

  // v2fees: constructor(name, symbol, metadataURI, totalSupply, recipient, feeRecipient, router, weth)
  const FEE_RECIPIENT = "0x9FD5f2E480F43320E8F65072A739c941cb5b10B0";
  const V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  return encodeAbiParameters(
    parseAbiParameters("string,string,string,uint256,address,address,address,address"),
    [
      String(launch.token_name || ""),
      String(launch.token_ticker || ""),
      String(metadataURI || ""),
      TOTAL_SUPPLY,
      tx.to,
      FEE_RECIPIENT as `0x${string}`,
      V2_ROUTER as `0x${string}`,
      WETH as `0x${string}`,
    ]
  ).slice(2);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ETHERSCAN_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "ETHERSCAN_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tokenAddress: string | undefined = body?.tokenAddress;
    const launchId: string | undefined = body?.launchId;
    const waitForResult: boolean = body?.waitForResult === true;

    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid tokenAddress" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`[eth-verify] waiting for Etherscan to index ${tokenAddress}`);
    const indexed = await waitForEtherscanIndexing(tokenAddress, apiKey);
    if (!indexed) {
      return new Response(JSON.stringify({ success: false, error: "Etherscan did not index contract in time" }), {
        status: 408,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let launch: any = null;
    if (launchId) {
      const { data } = await supabase
        .from("eth_launch_requests")
        .select("id, token_name, token_ticker, description, website_url, twitter_url, telegram_url, burn_lp, launch_tx_hash, deploy_tx_hash, token_address")
        .eq("id", launchId)
        .maybeSingle();
      launch = data;
    }
    if (!launch) {
      const { data } = await supabase
        .from("eth_launch_requests")
        .select("id, token_name, token_ticker, description, website_url, twitter_url, telegram_url, burn_lp, launch_tx_hash, deploy_tx_hash, token_address")
        .ilike("token_address", tokenAddress)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      launch = data;
    }
    if (!launch) {
      return new Response(JSON.stringify({ success: false, error: "Launch row not found for token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenKind = await inferTokenKind(supabase, launch);
    const metaHeader = buildMetadataHeader(launch);
    const baseSource = tokenKind === "v2burn"
      ? POPSHIBA_BURN_TOKEN_SOURCE
      : tokenKind === "v2fees"
      ? POPSHIBA_FEES_LAUNCHER_V2_SOURCE
      : POPSHIBA_TOKEN_BASE_SOURCE;
    const sourceWithHeader = metaHeader
      ? baseSource.replace(/^(\/\/ SPDX-License-Identifier:[^\n]*\n)/, `$1${metaHeader}`)
      : baseSource;

    const contractFile = tokenKind === "v2burn"
      ? "PopShibaBurnToken.sol"
      : tokenKind === "v2fees"
      ? "PopShibaFeesLauncherV2.sol"
      : "PopShibaToken.sol";
    const contractName = tokenKind === "v2burn"
      ? "PopShibaBurnToken"
      : tokenKind === "v2fees"
      ? "PopShibaFeesToken"
      : "PopShibaToken";
    const constructorArgsHex = await buildConstructorArgsHex({ ...launch, token_address: tokenAddress }, tokenKind);

    const standardJson = {
      language: "Solidity",
      sources: { [contractFile]: { content: sourceWithHeader } },
      settings: {
        evmVersion: "paris",
        viaIR: true,
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      },
    };

    const verifyUrl = `https://api.etherscan.io/v2/api?chainid=${ETHEREUM_CHAIN_ID}`;
    const form = new URLSearchParams();
    form.append("apikey", apiKey);
    form.append("module", "contract");
    form.append("action", "verifysourcecode");
    form.append("contractaddress", tokenAddress);
    form.append("sourceCode", JSON.stringify(standardJson));
    form.append("codeformat", "solidity-standard-json-input");
    form.append("contractname", `${contractFile}:${contractName}`);
    form.append("compilerversion", COMPILER_VERSION);
    form.append("constructorArguements", constructorArgsHex);

    // Etherscan can take 30-90s to index a freshly-deployed contract. If the
    // first submit returns "Unable to locate ContractCode", retry with backoff
    // so the bytecode-similarity auto-matcher (which would tag this as a
    // previously verified token like "SHIBANUSI") never wins the race.
    await delay(2000);
    let result: any = null;
    const submitDelays = [0, 8000, 15000, 25000, 40000, 60000];
    for (let i = 0; i < submitDelays.length; i++) {
      if (submitDelays[i] > 0) await delay(submitDelays[i]);
      const resp = await fetch(verifyUrl, { method: "POST", body: form });
      result = await resp.json();
      console.log(`[eth-verify] submit attempt ${i + 1} response`, result);
      if (result.status === "1") break;
      const msg = String(result.result || result.message || "");
      if (/already verified/i.test(msg)) break;
      if (!/Unable to locate ContractCode/i.test(msg)) break; // non-retryable
    }

    if (result.status !== "1") {
      const msg = String(result.result || result.message || "Unknown");
      if (/already verified/i.test(msg)) {
        return new Response(JSON.stringify({ success: true, verified: true, alreadyVerified: true, tokenKind }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, error: msg, raw: result, tokenKind }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guid: string = result.result;

    if (waitForResult) {
      const pollResult = await pollVerificationStatus(guid, apiKey);
      return new Response(JSON.stringify({
        success: true,
        verified: pollResult.verified,
        guid,
        tokenKind,
        message: pollResult.message,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, guid, tokenKind, message: "Verification submitted" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[eth-verify-contract] error", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});