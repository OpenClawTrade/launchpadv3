import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
} from "https://esm.sh/viem@2.45.1";
import { base } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// Minimal ERC20 Solidity Source
// Constructor: (string name, string symbol, address recipient, uint256 supply)
// Mints all supply to recipient. Standard transfer/approve/transferFrom.
// ============================================================================
const ERC20_SOLIDITY_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ClawToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, address _recipient, uint256 _supply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        balanceOf[_recipient] = _supply;
        emit Transfer(address(0), _recipient, _supply);
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        require(balanceOf[msg.sender] >= _value, "ERC20: insufficient balance");
        unchecked {
            balanceOf[msg.sender] -= _value;
            balanceOf[_to] += _value;
        }
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function approve(address _spender, uint256 _value) public returns (bool) {
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(balanceOf[_from] >= _value, "ERC20: insufficient balance");
        require(allowance[_from][msg.sender] >= _value, "ERC20: insufficient allowance");
        unchecked {
            allowance[_from][msg.sender] -= _value;
            balanceOf[_from] -= _value;
            balanceOf[_to] += _value;
        }
        emit Transfer(_from, _to, _value);
        return true;
    }
}`;

// ============================================================================
// Solidity Compiler - loads solc from Ethereum Foundation CDN
// Caches compilation result in-memory for subsequent requests in same isolate
// ============================================================================
let cachedCompilation: { abi: any[]; bytecode: `0x${string}` } | null = null;

async function compileERC20(): Promise<{
  abi: any[];
  bytecode: `0x${string}`;
}> {
  if (cachedCompilation) {
    console.log("[Compile] Using cached compilation");
    return cachedCompilation;
  }

  const t0 = Date.now();
  console.log("[Compile] Fetching Solidity compiler from CDN...");

  // Fetch solc asm.js binary (~8MB, pure JavaScript, no WASM dependency)
  const solcUrl =
    "https://binaries.soliditylang.org/bin/soljson-v0.8.20+commit.a1b79de6.js";
  const response = await fetch(solcUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Solidity compiler: HTTP ${response.status}`
    );
  }
  const solcCode = await response.text();
  console.log(
    `[Compile] Compiler fetched (${(solcCode.length / 1024 / 1024).toFixed(1)}MB) in ${Date.now() - t0}ms`
  );

  // Evaluate the Emscripten-compiled module
  const t1 = Date.now();
  const moduleObj = { exports: {} as any };
  try {
    const fn = new Function(
      "module",
      "exports",
      "require",
      solcCode + "\n//# sourceURL=soljson.js"
    );
    fn(moduleObj, moduleObj.exports, () => ({}));
  } catch (evalError) {
    console.error("[Compile] Failed to evaluate solc module:", evalError);
    throw new Error(
      `Solidity compiler initialization failed: ${evalError instanceof Error ? evalError.message : "Unknown error"}`
    );
  }

  const soljson = moduleObj.exports;
  if (!soljson || typeof soljson.cwrap !== "function") {
    throw new Error(
      "Solc module loaded but cwrap function not available. The compiler may not be compatible with this runtime."
    );
  }

  const compile = soljson.cwrap(
    "solidity_compile",
    "string",
    ["string", "number", "number"]
  );
  console.log(`[Compile] Compiler initialized in ${Date.now() - t1}ms`);

  // Compile the ERC20 source
  const t2 = Date.now();
  const input = JSON.stringify({
    language: "Solidity",
    sources: {
      "ClawToken.sol": { content: ERC20_SOLIDITY_SOURCE },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  });

  const outputJSON = compile(input, 0, 0);
  const output = JSON.parse(outputJSON);

  // Check for compilation errors
  if (output.errors) {
    const errors = output.errors.filter(
      (e: any) => e.severity === "error"
    );
    if (errors.length > 0) {
      const messages = errors
        .map((e: any) => e.formattedMessage || e.message)
        .join("\n");
      throw new Error(`Solidity compilation errors:\n${messages}`);
    }
  }

  const contract = output.contracts?.["ClawToken.sol"]?.["ClawToken"];
  if (!contract) {
    throw new Error(
      "Contract 'ClawToken' not found in compilation output"
    );
  }

  const bytecodeHex = contract.evm?.bytecode?.object;
  if (!bytecodeHex || bytecodeHex.length < 100) {
    throw new Error(
      `Invalid bytecode produced (length: ${bytecodeHex?.length || 0})`
    );
  }

  const bytecode = `0x${bytecodeHex}` as `0x${string}`;
  const abi = contract.abi;

  console.log(
    `[Compile] Compilation successful in ${Date.now() - t2}ms. Bytecode: ${bytecode.length} hex chars`
  );

  cachedCompilation = { abi, bytecode };
  return cachedCompilation;
}

// ============================================================================
// Request Handler
// ============================================================================
interface CreateTokenRequest {
  name: string;
  ticker: string;
  creatorWallet: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  fairLaunchDurationMins?: number;
  startingMcapUsd?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: CreateTokenRequest = await req.json();

    // Validate required fields
    if (!body.name || !body.ticker || !body.creatorWallet) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: name, ticker, creatorWallet",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate creator wallet is a valid Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(body.creatorWallet)) {
      return new Response(
        JSON.stringify({ error: "Invalid creatorWallet address" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Setup deployer
    const deployerKey = Deno.env.get("BASE_DEPLOYER_PRIVATE_KEY");
    if (!deployerKey) {
      return new Response(
        JSON.stringify({ error: "BASE_DEPLOYER_PRIVATE_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const account = privateKeyToAccount(
      (deployerKey.startsWith("0x")
        ? deployerKey
        : `0x${deployerKey}`) as `0x${string}`
    );

    const publicClient = createPublicClient({
      chain: base,
      transport: http("https://mainnet.base.org"),
    });

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http("https://mainnet.base.org"),
    });

    // Check deployer balance
    const balance = await publicClient.getBalance({
      address: account.address,
    });
    const balanceEth = formatEther(balance);

    if (balance < parseEther("0.001")) {
      return new Response(
        JSON.stringify({
          error: `Insufficient ETH for deployment. Deployer balance: ${balanceEth} ETH. Need at least 0.001 ETH.`,
          deployer: account.address,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[Deploy] Deploying ${body.name} ($${body.ticker}) for ${body.creatorWallet}`
    );
    console.log(
      `[Deploy] Deployer: ${account.address}, Balance: ${balanceEth} ETH`
    );

    // Step 1: Compile ERC20 contract
    console.log("[Deploy] Step 1: Compiling ERC20 contract...");
    const { abi, bytecode } = await compileERC20();

    // Step 2: Deploy the token contract
    console.log("[Deploy] Step 2: Deploying token contract...");
    const totalSupply = parseEther("1000000000"); // 1 billion tokens

    const deployHash = await walletClient.deployContract({
      abi,
      bytecode,
      args: [
        body.name,
        body.ticker.toUpperCase(),
        body.creatorWallet as `0x${string}`,
        totalSupply,
      ],
    });

    console.log(`[Deploy] Deployment tx submitted: ${deployHash}`);

    // Step 3: Wait for confirmation
    console.log("[Deploy] Step 3: Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: deployHash,
      confirmations: 1,
      timeout: 60_000, // 60 second timeout
    });

    const tokenAddress = receipt.contractAddress;
    if (!tokenAddress) {
      throw new Error(
        "Contract deployment failed - no contract address in receipt"
      );
    }

    console.log(`[Deploy] ✅ Token deployed at: ${tokenAddress}`);
    console.log(`[Deploy] Gas used: ${receipt.gasUsed.toString()}`);

    // Step 4: Record in database
    console.log("[Deploy] Step 4: Recording in database...");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error: dbError } = await supabase.rpc(
      "backend_create_base_token",
      {
        p_name: body.name,
        p_ticker: body.ticker.toUpperCase(),
        p_creator_wallet: body.creatorWallet,
        p_evm_token_address: tokenAddress,
        p_evm_pool_address: "", // No Uniswap pool yet
        p_evm_factory_tx_hash: deployHash,
        p_creator_fee_bps: 5000,
        p_fair_launch_duration_mins: body.fairLaunchDurationMins ?? 5,
        p_starting_mcap_usd: body.startingMcapUsd ?? 5000,
        p_description: body.description ?? null,
        p_image_url: body.imageUrl ?? null,
        p_website_url: body.websiteUrl ?? null,
        p_twitter_url: body.twitterUrl ?? null,
      }
    );

    if (dbError) {
      console.error("[Deploy] DB recording error:", dbError);
      // Token IS deployed on-chain even if DB fails
      // Return success with a warning
    }

    console.log(`[Deploy] ✅ Complete! Token ID: ${data}`);

    return new Response(
      JSON.stringify({
        success: true,
        tokenAddress,
        txHash: deployHash,
        tokenId: data,
        deployer: account.address,
        network: "base",
        chainId: 8453,
        totalSupply: "1000000000",
        explorerUrl: `https://basescan.org/tx/${deployHash}`,
        tokenUrl: `https://basescan.org/token/${tokenAddress}`,
        message: `Token ${body.name} ($${body.ticker}) deployed on Base at ${tokenAddress}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Deploy] Error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Token deployment failed",
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
