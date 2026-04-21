// ============================================================================
// eth-verify-contract
//
// Submits the launchpad contract source to Etherscan for verification (v2 API).
//
// Supports BOTH contract generations:
//   • Legacy: SaturnEthV3Token (launchedBy = "Saturn V3 Launchpad")
//   • Current: PopShibaLaunchpad (launchedBy = "PopShiba.com")
//
// When called with waitForResult=true, polls Etherscan checkverifystatus until
// the contract is verified (or max retries exceeded). This is used by
// eth-create-token to block LP creation until verification is confirmed.
//
// Required secret: ETHERSCAN_API_KEY
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encodeAbiParameters, parseEther, getAddress } from "https://esm.sh/viem@2.45.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POPSHIBA_SOURCE = `// SPDX-License-Identifier: MIT
// Launched via PopShiba.com Ethereum Launchpad
pragma solidity ^0.8.19;

contract PopShibaLaunchpad {
    string public name;
    string public symbol;
    uint8  public constant decimals = 18;
    uint256 public totalSupply;
    string  public metadataURI;
    string  public constant launchedBy = "PopShiba.com";

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, address _recipient, uint256 _supply, string memory _metadataURI) {
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
}`;

const SATURN_SOURCE = `// SPDX-License-Identifier: MIT
// Launched via Saturn Ethereum V3 Launchpad — https://saturn.trade
pragma solidity ^0.8.20;

contract SaturnEthV3Token {
    string public name;
    string public symbol;
    uint8  public constant decimals = 18;
    uint256 public totalSupply;
    string  public metadataURI;
    string  public constant launchedBy = "Saturn V3 Launchpad";

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, address _recipient, uint256 _supply, string memory _metadataURI) {
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
}`;

const POPSHIBA_MARKER_HEX = "506f7053686962612e636f6d";
const TOTAL_SUPPLY_WEI = parseEther("1000000000");
const ETHEREUM_CHAIN_ID = 1;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Helper: wait for Etherscan to index the contract bytecode
async function waitForEtherscanIndexing(tokenAddress: string, apiKey: string, maxRetries = 20): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (i > 0) await delay(6000); // respect rate limit (max 3/sec on free tier)
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

// Helper: poll checkverifystatus until Pass/Fail
async function pollVerificationStatus(guid: string, apiKey: string, maxRetries = 24): Promise<{ verified: boolean; message: string }> {
  for (let i = 0; i < maxRetries; i++) {
    await delay(6000); // 6s between checks to respect rate limit
    try {
      const resp = await fetch(
        `https://api.etherscan.io/v2/api?chainid=${ETHEREUM_CHAIN_ID}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${apiKey}`
      );
      const json = await resp.json();
      const result = String(json?.result || "");
      console.log(`[eth-verify] poll ${i + 1}: ${result}`);
      
      if (/pass/i.test(result)) return { verified: true, message: result };
      if (/fail/i.test(result) && !/pending/i.test(result)) return { verified: false, message: result };
      // "Pending in queue" → keep polling
    } catch (_) { /* retry */ }
  }
  return { verified: false, message: "Verification polling timed out" };
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Wait for Etherscan to index the contract code first ──
    console.log("[eth-verify] waiting for Etherscan to index contract...");
    const indexed = await waitForEtherscanIndexing(tokenAddress, apiKey);
    if (!indexed) {
      return new Response(JSON.stringify({ success: false, error: "Etherscan did not index contract in time" }), {
        status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up launch row
    let launch: any = null;
    if (launchId) {
      const { data } = await supabase.from("eth_launch_requests").select("*").eq("id", launchId).maybeSingle();
      launch = data;
    }
    if (!launch) {
      const { data } = await supabase
        .from("eth_launch_requests")
        .select("*")
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

    // ── Detect contract generation (reuse bytecode from indexing check) ──
    // We already confirmed bytecode exists above; fetch it once more with rate-limit spacing
    await delay(2000);
    let isPopShiba = false;
    try {
      const codeResp = await fetch(
        `https://api.etherscan.io/v2/api?chainid=${ETHEREUM_CHAIN_ID}&module=proxy&action=eth_getCode&address=${tokenAddress}&tag=latest&apikey=${apiKey}`
      );
      const codeJson = await codeResp.json();
      const runtimeCode: string = codeJson?.result || "";
      isPopShiba = runtimeCode.toLowerCase().includes(POPSHIBA_MARKER_HEX);
    } catch (e) {
      console.warn("[eth-verify] eth_getCode failed, defaulting to PopShiba", e);
      isPopShiba = true;
    }

    const ERC20_SOLIDITY_SOURCE = isPopShiba ? POPSHIBA_SOURCE : SATURN_SOURCE;
    const contractFile = isPopShiba ? "PopShibaLaunchpad.sol" : "SaturnEthV3Token.sol";
    const contractName = isPopShiba ? "PopShibaLaunchpad" : "SaturnEthV3Token";
    const launchpadTag = isPopShiba ? "popshiba-eth-v1" : "saturn-eth-v3";

    console.log(`[eth-verify] token=${tokenAddress} generation=${isPopShiba ? "PopShiba" : "Saturn"}`);

    // Determine recipient
    await delay(2000);
    let recipient: `0x${string}` | null = null;
    if (launch.deploy_tx_hash) {
      try {
        const txResp = await fetch(
          `https://api.etherscan.io/v2/api?chainid=${ETHEREUM_CHAIN_ID}&module=proxy&action=eth_getTransactionByHash&txhash=${launch.deploy_tx_hash}&apikey=${apiKey}`
        );
        const txJson = await txResp.json();
        if (txJson?.result?.from) recipient = getAddress(txJson.result.from) as `0x${string}`;
      } catch (_) { /* fall through */ }
    }
    if (!recipient) {
      const fallback = Deno.env.get("ETH_DEPLOYER_PUBLIC_ADDRESS");
      if (fallback) recipient = getAddress(fallback) as `0x${string}`;
    }
    if (!recipient) {
      return new Response(JSON.stringify({
        success: false,
        error: "Could not determine deploy recipient",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rebuild metadataURI exactly
    const metadataURI = JSON.stringify({
      name: launch.token_name,
      symbol: launch.token_ticker,
      description: (launch.description?.trim() || "").slice(0, 500),
      image: launch.image_url ?? "",
      website: launch.website_url ?? "",
      twitter: launch.twitter_url ?? "",
      telegram: launch.telegram_url ?? "",
      launchpad: launchpadTag,
      launchId: launch.id ?? "",
    });

    const encodedArgs = encodeAbiParameters(
      [
        { type: "string" },
        { type: "string" },
        { type: "address" },
        { type: "uint256" },
        { type: "string" },
      ],
      [
        launch.token_name,
        launch.token_ticker,
        recipient,
        TOTAL_SUPPLY_WEI,
        metadataURI,
      ] as any
    ).slice(2);

    const standardJson = {
      language: "Solidity",
      sources: { [contractFile]: { content: ERC20_SOLIDITY_SOURCE } },
      settings: {
        evmVersion: "paris",
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
    form.append("compilerversion", "v0.8.20+commit.a1b79de6");
    form.append("constructorArguements", encodedArgs);

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
    
    // If caller wants to wait for completion, poll checkverifystatus
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
