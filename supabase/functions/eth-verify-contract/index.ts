// ============================================================================
// eth-verify-contract
//
// Submits the SaturnEthToken source to Etherscan for verification (multi-chain v2 API).
// Looks up the launch row in eth_launch_requests by tokenAddress, reconstructs the
// constructor args from stored fields, and POSTs to the Etherscan v2 verify endpoint.
//
// Required secret: ETHERSCAN_API_KEY
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encodeAbiParameters, parseEther, getAddress } from "https://esm.sh/viem@2.45.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Must match exactly the source compiled by eth-create-token
const ERC20_SOLIDITY_SOURCE = `// SPDX-License-Identifier: MIT
// Launched via Saturn Ethereum Launchpad — https://saturn.trade
pragma solidity ^0.8.20;

contract SaturnEthToken {
    string public name;
    string public symbol;
    uint8  public constant decimals = 18;
    uint256 public totalSupply;

    string  public metadataURI;
    string  public constant launchedBy = "Saturn Launchpad (Ethereum)";
    address public immutable platformTaxWallet;
    address public immutable creatorTaxWallet;
    uint16  public immutable userTaxBps;
    uint16  public immutable platformTaxBps;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public isTaxExempt;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        address _recipient,
        uint256 _supply,
        uint16  _userTaxBps,
        uint16  _platformTaxBps,
        address _platformTaxWallet,
        address _creatorTaxWallet,
        string memory _metadataURI
    ) {
        require(_userTaxBps <= 300, "user tax > 3%");
        require(_platformTaxBps == 100, "platform tax must be 1%");
        require(_platformTaxWallet != address(0), "platform wallet zero");
        require(_creatorTaxWallet != address(0), "creator wallet zero");

        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        balanceOf[_recipient] = _supply;
        emit Transfer(address(0), _recipient, _supply);

        userTaxBps = _userTaxBps;
        platformTaxBps = _platformTaxBps;
        platformTaxWallet = _platformTaxWallet;
        creatorTaxWallet = _creatorTaxWallet;
        metadataURI = _metadataURI;

        owner = _recipient;
        emit OwnershipTransferred(address(0), _recipient);

        isTaxExempt[_recipient] = true;
        isTaxExempt[_platformTaxWallet] = true;
        isTaxExempt[_creatorTaxWallet] = true;
    }

    function setTaxExempt(address account, bool exempt) external onlyOwner {
        isTaxExempt[account] = exempt;
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "ERC20: insufficient balance");

        uint256 sendAmount = value;

        if (!isTaxExempt[from] && !isTaxExempt[to]) {
            uint256 totalTaxBps = uint256(userTaxBps) + uint256(platformTaxBps);
            if (totalTaxBps > 0) {
                uint256 platformCut = (value * platformTaxBps) / 10000;
                uint256 creatorCut  = (value * userTaxBps) / 10000;
                uint256 totalTax    = platformCut + creatorCut;
                sendAmount = value - totalTax;

                unchecked {
                    balanceOf[from] -= totalTax;
                    if (platformCut > 0) {
                        balanceOf[platformTaxWallet] += platformCut;
                        emit Transfer(from, platformTaxWallet, platformCut);
                    }
                    if (creatorCut > 0) {
                        balanceOf[creatorTaxWallet] += creatorCut;
                        emit Transfer(from, creatorTaxWallet, creatorCut);
                    }
                }
            }
        }

        unchecked {
            balanceOf[from] -= sendAmount;
            balanceOf[to]   += sendAmount;
        }
        emit Transfer(from, to, sendAmount);
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
        require(allowed >= value, "ERC20: insufficient allowance");
        if (allowed != type(uint256).max) {
            unchecked { allowance[from][msg.sender] = allowed - value; }
        }
        _transfer(from, to, value);
        return true;
    }
}`;

const PLATFORM_TAX_WALLET_DEFAULT = "0x000000000000000000000000000000000000dEaD";
const TOTAL_SUPPLY_WEI = parseEther("1000000000");
const ETHEREUM_CHAIN_ID = 1;

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
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid tokenAddress" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Look up launch row to reconstruct constructor args
    let launch: any = null;
    if (launchId) {
      const { data } = await supabase.from("eth_launch_requests").select("*").eq("id", launchId).maybeSingle();
      launch = data;
    }
    if (!launch) {
      const { data } = await supabase
        .from("eth_launch_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      launch = data;
    }
    if (!launch) {
      return new Response(JSON.stringify({ success: false, error: "Launch row not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const platformTaxWallet = (Deno.env.get("ETH_PLATFORM_TAX_WALLET") || PLATFORM_TAX_WALLET_DEFAULT) as `0x${string}`;
    const creatorTaxWallet = getAddress(launch.creator_wallet) as `0x${string}`;

    // Rebuild description block exactly as eth-create-token did
    const userDesc = (launch.description?.trim() || "").slice(0, 500);
    const socialLines: string[] = [];
    if (launch.website_url) socialLines.push(`Domain - ${launch.website_url}`);
    if (launch.twitter_url) socialLines.push(`X - ${launch.twitter_url}`);
    if (launch.telegram_url) socialLines.push(`Telegram - ${launch.telegram_url}`);
    const formattedDescription = [
      "Welcome to Saturn.Trade",
      "",
      "This token is safe to trade and was launched from Saturn Launchpad.",
      ...(userDesc ? ["", userDesc] : []),
      ...(socialLines.length ? ["", ...socialLines] : []),
    ].join("\n");

    const metadataURI = JSON.stringify({
      name: launch.token_name,
      symbol: launch.token_ticker,
      description: formattedDescription,
      image: launch.image_url ?? "",
      website: launch.website_url ?? "",
      twitter: launch.twitter_url ?? "",
      telegram: launch.telegram_url ?? "",
      launchpad: "saturn-eth-v1",
      launchId: launch.id,
    });

    // ABI-encode constructor args (without function selector)
    const encodedArgs = encodeAbiParameters(
      [
        { type: "string" },
        { type: "string" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint16" },
        { type: "uint16" },
        { type: "address" },
        { type: "address" },
        { type: "string" },
      ],
      [
        launch.token_name,
        launch.token_ticker,
        creatorTaxWallet,
        TOTAL_SUPPLY_WEI,
        Number(launch.user_tax_bps),
        Number(launch.platform_tax_bps),
        platformTaxWallet,
        creatorTaxWallet,
        metadataURI,
      ] as any
    ).slice(2); // strip 0x

    // Build standard JSON input for verification
    const standardJson = {
      language: "Solidity",
      sources: { "SaturnEthToken.sol": { content: ERC20_SOLIDITY_SOURCE } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      },
    };

    // Etherscan v2 multichain verify endpoint
    const verifyUrl = `https://api.etherscan.io/v2/api?chainid=${ETHEREUM_CHAIN_ID}`;
    const form = new URLSearchParams();
    form.append("apikey", apiKey);
    form.append("module", "contract");
    form.append("action", "verifysourcecode");
    form.append("contractaddress", tokenAddress);
    form.append("sourceCode", JSON.stringify(standardJson));
    form.append("codeformat", "solidity-standard-json-input");
    form.append("contractname", "SaturnEthToken.sol:SaturnEthToken");
    form.append("compilerversion", "v0.8.20+commit.a1b79de6");
    form.append("constructorArguements", encodedArgs);

    const resp = await fetch(verifyUrl, { method: "POST", body: form });
    const result = await resp.json();
    console.log("[eth-verify] response", result);

    if (result.status !== "1") {
      // Often "Already Verified" — treat as success
      const msg = String(result.result || result.message || "Unknown");
      if (/already verified/i.test(msg)) {
        return new Response(JSON.stringify({ success: true, alreadyVerified: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guid: string = result.result;
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
