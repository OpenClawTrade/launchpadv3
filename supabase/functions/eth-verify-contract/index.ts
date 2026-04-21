// ============================================================================
// eth-verify-contract
//
// Submits a per-token Etherscan verification for a cloned PopShibaToken so
// the Solidity source on Etherscan shows the launch metadata header
// (Name, Website, X, Telegram, Discord, Description) for THAT specific token.
//
// Background: tokens are EIP-1167 minimal proxies cloned from a single
// PopShibaToken implementation. Without per-token verification, Etherscan
// only shows "Similar Match Source Code" pointing at the impl. Submitting
// the same source again — for the clone address, with a unique comment
// header — produces a unique verified source page per token.
//
// Comments do not affect bytecode, so the SAME compiler + settings used at
// deploy time still produce a matching bytecode hash and verification passes.
//
// Required secret: ETHERSCAN_API_KEY
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Source matches eth-deploy-contracts/sources.ts POPSHIBA_TOKEN_SOL exactly.
// Clones have NO constructor args (state is set via initialize()).
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

const ETHEREUM_CHAIN_ID = 1;
const COMPILER_VERSION = "v0.8.20+commit.a1b79de6";

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
    } catch (_) { /* retry */ }
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
    } catch (_) { /* retry */ }
  }
  return { verified: false, message: "Verification polling timed out" };
}

function buildMetadataHeader(launch: any): string {
  const sanitize = (s: unknown) =>
    String(s ?? "").replace(/\r?\n/g, " ").replace(/\*\//g, "* /").trim();
  const lines: string[] = [];
  const nm = sanitize(launch.token_name);
  const tk = sanitize(launch.token_ticker);
  if (nm || tk) lines.push(`// ${nm}${tk ? ` ($${tk})` : ""}`);
  if (launch.website_url)  lines.push(`// Website     - ${sanitize(launch.website_url)}`);
  if (launch.twitter_url)  lines.push(`// X / Twitter - ${sanitize(launch.twitter_url)}`);
  if (launch.telegram_url) lines.push(`// Telegram    - ${sanitize(launch.telegram_url)}`);
  if (launch.discord_url)  lines.push(`// Discord     - ${sanitize(launch.discord_url)}`);
  if (launch.description) {
    lines.push(`// Description - ${sanitize(launch.description).slice(0, 500)}`);
  }
  if (lines.length === 0) return "";
  return lines.join("\n") + "\n//\n";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ETHERSCAN_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "ETHERSCAN_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tokenAddress: string | undefined = body?.tokenAddress;
    const launchId: string | undefined = body?.launchId;
    const waitForResult: boolean = body?.waitForResult === true;

    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid tokenAddress" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Wait for Etherscan to index the clone bytecode.
    console.log(`[eth-verify] waiting for Etherscan to index ${tokenAddress}`);
    const indexed = await waitForEtherscanIndexing(tokenAddress, apiKey);
    if (!indexed) {
      return new Response(JSON.stringify({ success: false, error: "Etherscan did not index contract in time" }), {
        status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the launch row to fetch metadata.
    let launch: any = null;
    if (launchId) {
      const { data } = await supabase
        .from("eth_launch_requests")
        .select("id, token_name, token_ticker, description, website_url, twitter_url, telegram_url, discord_url")
        .eq("id", launchId)
        .maybeSingle();
      launch = data;
    }
    if (!launch) {
      const { data } = await supabase
        .from("eth_launch_requests")
        .select("id, token_name, token_ticker, description, website_url, twitter_url, telegram_url, discord_url")
        .ilike("token_address", tokenAddress)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      launch = data;
    }
    if (!launch) {
      return new Response(JSON.stringify({ success: false, error: "Launch row not found for token" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Inject metadata header right after the SPDX line. Comments don't change
    // bytecode → verification still matches the on-chain code.
    const metaHeader = buildMetadataHeader(launch);
    const sourceWithHeader = metaHeader
      ? POPSHIBA_TOKEN_BASE_SOURCE.replace(
          /^(\/\/ SPDX-License-Identifier:[^\n]*\n)/,
          `$1${metaHeader}`,
        )
      : POPSHIBA_TOKEN_BASE_SOURCE;

    const contractFile = "PopShibaToken.sol";
    const contractName = "PopShibaToken";

    // Settings MUST mirror eth-deploy-contracts (evmVersion: paris, viaIR: true,
    // optimizer enabled, runs: 200) — otherwise bytecode won't match.
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
    form.append("constructorArguements", ""); // clones have no ctor args

    await delay(2000);
    const resp = await fetch(verifyUrl, { method: "POST", body: form });
    const result = await resp.json();
    console.log("[eth-verify] submit response", result);

    if (result.status !== "1") {
      const msg = String(result.result || result.message || "Unknown");
      if (/already verified/i.test(msg)) {
        return new Response(JSON.stringify({ success: true, verified: true, alreadyVerified: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, error: msg, raw: result }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guid: string = result.result;

    if (waitForResult) {
      console.log(`[eth-verify] polling verification status for GUID=${guid}`);
      const pollResult = await pollVerificationStatus(guid, apiKey);
      console.log(`[eth-verify] final status: verified=${pollResult.verified} msg=${pollResult.message}`);
      return new Response(JSON.stringify({
        success: true,
        verified: pollResult.verified,
        guid,
        message: pollResult.message,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, guid, message: "Verification submitted" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[eth-verify-contract] error", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
