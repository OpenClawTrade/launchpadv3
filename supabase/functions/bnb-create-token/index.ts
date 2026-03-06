import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  encodeFunctionData,
} from "https://esm.sh/viem@2.45.1";
import { bsc } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// PancakeSwap V2 Router on BSC
const PANCAKESWAP_V2_ROUTER = "0x10ED43C718714eb63d5aA57B78B54917e56f3157" as `0x${string}`;

const ROUTER_ABI = [
  {
    name: "addLiquidityETH",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountTokenDesired", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountToken", type: "uint256" },
      { name: "amountETH", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
  },
] as const;

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ============================================================================
// Minimal ERC20 Solidity Source (same as base-create-token)
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
// Solidity Compiler
// ============================================================================
let cachedCompilation: { abi: any[]; bytecode: `0x${string}` } | null = null;

async function compileERC20(): Promise<{ abi: any[]; bytecode: `0x${string}` }> {
  if (cachedCompilation) {
    console.log("[Compile] Using cached compilation");
    return cachedCompilation;
  }

  const t0 = Date.now();
  console.log("[Compile] Fetching Solidity compiler from CDN...");

  const solcUrl = "https://binaries.soliditylang.org/bin/soljson-v0.8.20+commit.a1b79de6.js";
  const response = await fetch(solcUrl);
  if (!response.ok) throw new Error(`Failed to fetch Solidity compiler: HTTP ${response.status}`);
  const solcCode = await response.text();
  console.log(`[Compile] Compiler fetched (${(solcCode.length / 1024 / 1024).toFixed(1)}MB) in ${Date.now() - t0}ms`);

  const t1 = Date.now();
  const moduleObj = { exports: {} as any };
  try {
    const fn = new Function("module", "exports", "require", solcCode + "\n//# sourceURL=soljson.js");
    fn(moduleObj, moduleObj.exports, () => ({}));
  } catch (evalError) {
    throw new Error(`Solidity compiler initialization failed: ${evalError instanceof Error ? evalError.message : "Unknown error"}`);
  }

  const soljson = moduleObj.exports;
  if (!soljson || typeof soljson.cwrap !== "function") {
    throw new Error("Solc module loaded but cwrap function not available.");
  }

  const compile = soljson.cwrap("solidity_compile", "string", ["string", "number", "number"]);
  console.log(`[Compile] Compiler initialized in ${Date.now() - t1}ms`);

  const t2 = Date.now();
  const input = JSON.stringify({
    language: "Solidity",
    sources: { "ClawToken.sol": { content: ERC20_SOLIDITY_SOURCE } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  });

  const outputJSON = compile(input, 0, 0);
  const output = JSON.parse(outputJSON);

  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === "error");
    if (errors.length > 0) {
      throw new Error(`Solidity compilation errors:\n${errors.map((e: any) => e.formattedMessage || e.message).join("\n")}`);
    }
  }

  const contract = output.contracts?.["ClawToken.sol"]?.["ClawToken"];
  if (!contract) throw new Error("Contract 'ClawToken' not found in compilation output");

  const bytecodeHex = contract.evm?.bytecode?.object;
  if (!bytecodeHex || bytecodeHex.length < 100) throw new Error(`Invalid bytecode produced (length: ${bytecodeHex?.length || 0})`);

  const bytecode = `0x${bytecodeHex}` as `0x${string}`;
  cachedCompilation = { abi: contract.abi, bytecode };
  console.log(`[Compile] Compilation successful in ${Date.now() - t2}ms. Bytecode: ${bytecode.length} hex chars`);
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
  seedLiquidityBnb?: string; // e.g. "0.1"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: CreateTokenRequest = await req.json();

    if (!body.name || !body.ticker || !body.creatorWallet) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, ticker, creatorWallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(body.creatorWallet)) {
      return new Response(
        JSON.stringify({ error: "Invalid creatorWallet address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const seedBnb = body.seedLiquidityBnb || "0.1";
    const seedBnbWei = parseEther(seedBnb);

    // Setup deployer (same key as Base)
    const deployerKey = Deno.env.get("BASE_DEPLOYER_PRIVATE_KEY");
    if (!deployerKey) {
      return new Response(
        JSON.stringify({ error: "Deployer key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const account = privateKeyToAccount(
      (deployerKey.startsWith("0x") ? deployerKey : `0x${deployerKey}`) as `0x${string}`
    );

    const BSC_RPC = "https://bsc-dataseed.binance.org";
    const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });
    const walletClient = createWalletClient({ account, chain: bsc, transport: http(BSC_RPC) });

    // Check deployer balance
    const balance = await publicClient.getBalance({ address: account.address });
    const minRequired = seedBnbWei + parseEther("0.01"); // seed + gas buffer

    if (balance < minRequired) {
      return new Response(
        JSON.stringify({
          error: `Insufficient BNB. Deployer balance: ${formatEther(balance)} BNB. Need at least ${formatEther(minRequired)} BNB (${seedBnb} seed + gas).`,
          deployer: account.address,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[BNB Deploy] Deploying ${body.name} ($${body.ticker}) for ${body.creatorWallet}`);
    console.log(`[BNB Deploy] Deployer: ${account.address}, Balance: ${formatEther(balance)} BNB, Seed: ${seedBnb} BNB`);

    // Step 1: Compile ERC20
    console.log("[BNB Deploy] Step 1: Compiling ERC20...");
    const { abi, bytecode } = await compileERC20();

    // Step 2: Deploy token — mint all to deployer (so we can add liquidity)
    console.log("[BNB Deploy] Step 2: Deploying token contract...");
    const totalSupply = parseEther("1000000000"); // 1B tokens

    const deployHash = await walletClient.deployContract({
      abi,
      bytecode,
      args: [body.name, body.ticker.toUpperCase(), account.address, totalSupply],
    });

    console.log(`[BNB Deploy] Deployment tx: ${deployHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: deployHash,
      confirmations: 1,
      timeout: 60_000,
    });

    const tokenAddress = receipt.contractAddress;
    if (!tokenAddress) throw new Error("Contract deployment failed - no contract address");

    console.log(`[BNB Deploy] ✅ Token deployed at: ${tokenAddress}`);

    // Step 3: Approve PancakeSwap Router to spend tokens
    console.log("[BNB Deploy] Step 3: Approving PancakeSwap Router...");
    const lpTokenAmount = parseEther("500000000"); // 500M tokens to LP (50%)

    const approveHash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [PANCAKESWAP_V2_ROUTER, lpTokenAmount],
    });

    await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 1, timeout: 30_000 });
    console.log(`[BNB Deploy] ✅ Approved router`);

    // Step 4: Add liquidity on PancakeSwap V2
    console.log("[BNB Deploy] Step 4: Adding PancakeSwap V2 liquidity...");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 min deadline

    const addLiqHash = await walletClient.writeContract({
      address: PANCAKESWAP_V2_ROUTER,
      abi: ROUTER_ABI,
      functionName: "addLiquidityETH",
      args: [
        tokenAddress,
        lpTokenAmount,
        lpTokenAmount * 95n / 100n, // 5% slippage on tokens
        seedBnbWei * 95n / 100n,    // 5% slippage on BNB
        account.address,             // LP tokens to deployer
        deadline,
      ],
      value: seedBnbWei,
    });

    const lpReceipt = await publicClient.waitForTransactionReceipt({
      hash: addLiqHash,
      confirmations: 1,
      timeout: 60_000,
    });

    console.log(`[BNB Deploy] ✅ Liquidity added! LP tx: ${addLiqHash}`);

    // Step 5: Transfer remaining tokens to creator
    console.log("[BNB Deploy] Step 5: Transferring remaining tokens to creator...");
    const remainingTokens = totalSupply - lpTokenAmount; // 500M to creator

    const transferHash = await walletClient.writeContract({
      address: tokenAddress,
      abi: [{
        name: "transfer",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
      }],
      functionName: "transfer",
      args: [body.creatorWallet as `0x${string}`, remainingTokens],
    });

    await publicClient.waitForTransactionReceipt({ hash: transferHash, confirmations: 1, timeout: 30_000 });
    console.log(`[BNB Deploy] ✅ ${formatEther(remainingTokens)} tokens sent to creator`);

    // Step 6: Record in database
    console.log("[BNB Deploy] Step 6: Recording in database...");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error: dbError } = await supabase.rpc("backend_create_bnb_token", {
      p_name: body.name,
      p_ticker: body.ticker.toUpperCase(),
      p_creator_wallet: body.creatorWallet,
      p_evm_token_address: tokenAddress,
      p_evm_pool_address: "", // PancakeSwap auto-creates pair
      p_evm_factory_tx_hash: deployHash,
      p_creator_fee_bps: 5000,
      p_fair_launch_duration_mins: 0,
      p_starting_mcap_usd: 5000,
      p_description: body.description ?? null,
      p_image_url: body.imageUrl ?? null,
      p_website_url: body.websiteUrl ?? null,
      p_twitter_url: body.twitterUrl ?? null,
    });

    if (dbError) {
      console.error("[BNB Deploy] DB recording error:", dbError);
    }

    console.log(`[BNB Deploy] ✅ Complete! Token ID: ${data}`);

    return new Response(
      JSON.stringify({
        success: true,
        tokenAddress,
        txHash: deployHash,
        lpTxHash: addLiqHash,
        tokenId: data,
        deployer: account.address,
        network: "bnb",
        chainId: 56,
        totalSupply: "1000000000",
        seedLiquidity: seedBnb,
        explorerUrl: `https://bscscan.com/tx/${deployHash}`,
        tokenUrl: `https://bscscan.com/token/${tokenAddress}`,
        pancakeswapUrl: `https://pancakeswap.finance/swap?outputCurrency=${tokenAddress}&chainId=56`,
        message: `Token ${body.name} ($${body.ticker}) deployed on BNB Chain at ${tokenAddress} with ${seedBnb} BNB liquidity on PancakeSwap`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[BNB Deploy] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Token deployment failed",
        details: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
