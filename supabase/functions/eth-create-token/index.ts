// ============================================================================
// eth-create-token (V3 single-sided launcher — platform-owned LP NFT)
//
// Flow (all server-side, signed by platform deployer):
//   1. Compile + deploy minimal ERC-20 (1B supply minted to platform deployer)
//   2. Create Uniswap V3 pool at fee tier 1% (10000 bps, tickSpacing 200)
//      with sqrtPriceX96 chosen for ~$5K starting market cap
//   3. Approve NonfungiblePositionManager for full token supply
//   4. Mint single-sided V3 position above spot — recipient = platform deployer
//   5. Optional dev buy: swap ETH→token via SwapRouter, send tokens to creator
//   6. Persist eth_lp_positions + eth_creator_fee_ledger rows
//
// The platform owns the LP NFT so it can call collect() and split fees 50/50.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  parseEther,
  parseAbi,
  encodeDeployData,
  encodeFunctionData,
  getAddress,
  type Address,
} from "https://esm.sh/viem@2.45.1";
import { mainnet } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";
import { ERC20_BYTECODE, ERC20_ABI_FULL } from "./contract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isEvmAddress = (a: unknown): a is string =>
  typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);

// ---- Constants ----
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const UNISWAP_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984" as const;
const NPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" as const; // NonfungiblePositionManager
const SWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564" as const;
const FEE_TIER = 10000; // 1%
const TICK_SPACING = 200;
const MIN_TICK = -887200; // multiple of 200
const MAX_TICK = 887200;
const TOTAL_SUPPLY_WEI = parseEther("1000000000"); // 1B tokens

// Minimal ERC-20 with no tax, no owner, mints to deployer.
const ERC20_SOURCE = `// SPDX-License-Identifier: MIT
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

// Precompiled at build-time (see ./contract.ts). Runtime solc compilation is
// not supported in the Deno edge runtime ("soljson.cwrap is not a function").
function compileERC20(): { abi: any[]; bytecode: `0x${string}` } {
  return { abi: ERC20_ABI_FULL as any, bytecode: ERC20_BYTECODE };
}

// ---- Math helpers ----
// sqrtPriceX96 = sqrt(token1/token0) * 2^96
// For our pool, token0/token1 ordering is by address. We compute sqrtPrice
// such that 1 token = priceWeiPerToken WETH (or its inverse if WETH is token0).
function computeSqrtPriceX96(tokenAddr: string, priceWethPerToken: number): bigint {
  const tokenIsToken0 = tokenAddr.toLowerCase() < WETH.toLowerCase();
  // priceWethPerToken is small (e.g. 5e-12). Use a Q-math safe approach with BigInt scaling.
  // sqrt(price) where price = WETH per token (token0 → token1 ratio if token0=token).
  // If token is token0: price1/price0 = WETH/token = priceWethPerToken
  // If token is token1: price1/price0 = token/WETH = 1/priceWethPerToken
  const ratio = tokenIsToken0 ? priceWethPerToken : 1 / priceWethPerToken;
  const sqrt = Math.sqrt(ratio);
  // Multiply by 2^96. Use string conversion to avoid Number precision blowup.
  const Q96 = 2 ** 96;
  const product = sqrt * Q96;
  // product can be huge; convert via exponential string then BigInt
  if (!isFinite(product) || product <= 0) throw new Error("Bad sqrtPriceX96");
  return BigInt(Math.floor(product));
}

// ---- Validation ----
interface LaunchBody {
  name: string;
  ticker: string;
  creatorWallet: string;
  devBuyEth?: number;
  description?: string | null;
  imageUrl?: string | null;
  websiteUrl?: string | null;
  twitterUrl?: string | null;
  telegramUrl?: string | null;
  startMarketCapUsd?: number; // default 5000
  ethPriceUsd?: number; // optional override; default 3000
}

function validate(body: any): { ok: true; data: LaunchBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const { name, ticker, creatorWallet, devBuyEth } = body;
  if (typeof name !== "string" || name.trim().length < 1 || name.length > 32) return { ok: false, error: "Invalid name" };
  if (typeof ticker !== "string" || ticker.trim().length < 1 || ticker.length > 10) return { ok: false, error: "Invalid ticker" };
  if (!isEvmAddress(creatorWallet)) return { ok: false, error: "Invalid creator wallet" };
  if (devBuyEth !== undefined && devBuyEth !== null) {
    if (typeof devBuyEth !== "number" || !isFinite(devBuyEth) || devBuyEth < 0 || devBuyEth > 5) {
      return { ok: false, error: "devBuyEth must be 0..5" };
    }
  }
  return { ok: true, data: body as LaunchBody };
}

// ABIs for V3
const FACTORY_ABI = parseAbi([
  "function createPool(address tokenA, address tokenB, uint24 fee) returns (address)",
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)",
]);
const POOL_ABI = parseAbi([
  "function initialize(uint160 sqrtPriceX96)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
]);
const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
]);
const NPM_ABI = parseAbi([
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
]);
const SWAP_ROUTER_ABI = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const json = await req.json().catch(() => null);
    const v = validate(json);
    if (!v.ok) {
      return new Response(JSON.stringify({ success: false, error: v.error }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = v.data;

    // ---- Env / clients ----
    // Deployer pays gas for deploy + pool init + mint. LP holder is a separate
    // wallet (0x8F70…6906) that receives the NFT and later collects all fees.
    const PK = Deno.env.get("BASE_DEPLOYER_PRIVATE_KEY");
    if (!PK) throw new Error("Platform deployer key missing");
    const LP_HOLDER = "0x8F7017df748Db75a58B3AA441ea0886dfEC16906" as const;
    // Build a fallback RPC transport. Public endpoints rate-limit aggressively
    // (esp. eth.llamarpc.com), so we rotate across several. ETH_MAINNET_RPC_URL
    // (e.g. an Alchemy/Infura URL) is tried first when set.
    const alchemyKey = Deno.env.get("ALCHEMY_BSC_API_KEY"); // reused; same key works on all Alchemy networks
    const rpcUrls = [
      Deno.env.get("ETH_MAINNET_RPC_URL"),
      alchemyKey ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}` : null,
      "https://cloudflare-eth.com",
      "https://rpc.ankr.com/eth",
      "https://ethereum-rpc.publicnode.com",
      "https://eth.drpc.org",
      "https://eth.llamarpc.com",
    ].filter(Boolean) as string[];
    const transport = fallback(
      rpcUrls.map((u) => http(u, { timeout: 20_000, retryCount: 1 })),
      { rank: false, retryCount: 2 },
    );
    const account = privateKeyToAccount(PK.startsWith("0x") ? PK as `0x${string}` : `0x${PK}` as `0x${string}`);
    const wallet = createWalletClient({ account, chain: mainnet, transport });
    const pub = createPublicClient({ chain: mainnet, transport });
    const platformDeployer = account.address;
    const lpHolder = getAddress(LP_HOLDER) as Address;
    const creatorWallet = getAddress(body.creatorWallet) as Address;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ---- 1. Persist intent ----
    const { data: launchRow } = await supabase
      .from("eth_launch_requests")
      .insert({
        creator_wallet: creatorWallet,
        token_name: body.name.trim(),
        token_ticker: body.ticker.trim().toUpperCase(),
        description: body.description ?? null,
        image_url: body.imageUrl ?? null,
        website_url: body.websiteUrl ?? null,
        twitter_url: body.twitterUrl ?? null,
        telegram_url: body.telegramUrl ?? null,
        lp_eth: 0,
        user_tax_bps: 0,
        platform_tax_bps: 0,
        burn_lp: false,
        renounce: false,
        status: "deploying",
        lp_refund_owed_eth: 0,
      })
      .select("id")
      .single();
    const launchId = launchRow?.id ?? null;

    // ---- 2. Compile + deploy ERC20 ----
    const { abi, bytecode } = compileERC20();
    const userDesc = (body.description?.trim() || "").slice(0, 500);
    const metadataURI = JSON.stringify({
      name: body.name.trim(),
      symbol: body.ticker.trim().toUpperCase(),
      description: userDesc,
      image: body.imageUrl ?? "",
      website: body.websiteUrl ?? "",
      twitter: body.twitterUrl ?? "",
      telegram: body.telegramUrl ?? "",
      launchpad: "saturn-eth-v3",
      launchId: launchId ?? "",
    });
    const deployData = encodeDeployData({
      abi,
      bytecode,
      args: [body.name.trim(), body.ticker.trim().toUpperCase(), platformDeployer, TOTAL_SUPPLY_WEI, metadataURI] as any,
    });
    console.log("[eth-create-token-v3] deploying ERC20…");
    const deployHash = await wallet.sendTransaction({ to: null as any, data: deployData, value: 0n });
    const deployRcpt = await pub.waitForTransactionReceipt({ hash: deployHash });
    const tokenAddress = deployRcpt.contractAddress!;
    console.log("[eth-create-token-v3] token deployed:", tokenAddress);

    // ---- 3. Compute sqrtPriceX96 for ~$5K market cap ----
    const ethUsd = body.ethPriceUsd && body.ethPriceUsd > 0 ? body.ethPriceUsd : 3000;
    const startMcUsd = body.startMarketCapUsd && body.startMarketCapUsd > 0 ? body.startMarketCapUsd : 5000;
    // 1B supply → price per token (USD) = startMcUsd / 1B → / ethUsd = WETH per token
    const priceWethPerToken = (startMcUsd / 1_000_000_000) / ethUsd;
    const sqrtPriceX96 = computeSqrtPriceX96(tokenAddress, priceWethPerToken);

    // ---- 4. Create + initialize pool ----
    const tokenIsToken0 = tokenAddress.toLowerCase() < WETH.toLowerCase();
    const token0 = tokenIsToken0 ? tokenAddress : WETH;
    const token1 = tokenIsToken0 ? WETH : tokenAddress;

    let poolAddr = await pub.readContract({
      address: UNISWAP_V3_FACTORY, abi: FACTORY_ABI, functionName: "getPool",
      args: [token0 as Address, token1 as Address, FEE_TIER],
    }) as Address;

    if (!poolAddr || poolAddr === "0x0000000000000000000000000000000000000000") {
      console.log("[eth-create-token-v3] creating pool…");
      const createHash = await wallet.writeContract({
        address: UNISWAP_V3_FACTORY, abi: FACTORY_ABI, functionName: "createPool",
        args: [token0 as Address, token1 as Address, FEE_TIER],
      });
      await pub.waitForTransactionReceipt({ hash: createHash });
      poolAddr = await pub.readContract({
        address: UNISWAP_V3_FACTORY, abi: FACTORY_ABI, functionName: "getPool",
        args: [token0 as Address, token1 as Address, FEE_TIER],
      }) as Address;
    }
    console.log("[eth-create-token-v3] pool:", poolAddr);

    // Initialize if not yet initialized
    try {
      const slot0 = await pub.readContract({ address: poolAddr, abi: POOL_ABI, functionName: "slot0" }) as any;
      if (!slot0 || slot0[0] === 0n) throw new Error("not initialized");
      console.log("[eth-create-token-v3] pool already initialized");
    } catch {
      console.log("[eth-create-token-v3] initializing pool with sqrtPriceX96=", sqrtPriceX96.toString());
      const initHash = await wallet.writeContract({
        address: poolAddr, abi: POOL_ABI, functionName: "initialize", args: [sqrtPriceX96],
      });
      await pub.waitForTransactionReceipt({ hash: initHash });
    }

    // ---- 5. Approve NPM + mint single-sided position ----
    console.log("[eth-create-token-v3] approving NPM…");
    const apprHash = await wallet.writeContract({
      address: tokenAddress as Address, abi: ERC20_ABI, functionName: "approve",
      args: [NPM, TOTAL_SUPPLY_WEI],
    });
    await pub.waitForTransactionReceipt({ hash: apprHash });

    // Single-sided: token only on the side strictly above current spot.
    // If token is token0, position must be ABOVE current tick (tickLower > currentTick).
    // If token is token1, position must be BELOW current tick (tickUpper < currentTick).
    const slot0 = await pub.readContract({ address: poolAddr, abi: POOL_ABI, functionName: "slot0" }) as any;
    const currentTick = Number(slot0[1]);
    const tickAtSpacing = Math.floor(currentTick / TICK_SPACING) * TICK_SPACING;

    let tickLower: number, tickUpper: number, amount0Desired: bigint, amount1Desired: bigint;
    if (tokenIsToken0) {
      tickLower = tickAtSpacing + TICK_SPACING; // strictly above
      tickUpper = MAX_TICK;
      amount0Desired = TOTAL_SUPPLY_WEI;
      amount1Desired = 0n;
    } else {
      tickLower = MIN_TICK;
      tickUpper = tickAtSpacing; // strictly below
      amount0Desired = 0n;
      amount1Desired = TOTAL_SUPPLY_WEI;
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
    console.log(`[eth-create-token-v3] minting V3 position tickLower=${tickLower} tickUpper=${tickUpper}`);
    const mintHash = await wallet.writeContract({
      address: NPM, abi: NPM_ABI, functionName: "mint",
      args: [{
        token0: token0 as Address, token1: token1 as Address, fee: FEE_TIER,
        tickLower, tickUpper, amount0Desired, amount1Desired,
        amount0Min: 0n, amount1Min: 0n, recipient: lpHolder, deadline,
      }] as any,
    });
    const mintRcpt = await pub.waitForTransactionReceipt({ hash: mintHash });

    // Extract tokenId from IncreaseLiquidity / Transfer event (NFT mint Transfer from 0x0 → recipient)
    let lpTokenId: bigint = 0n;
    for (const log of mintRcpt.logs) {
      if (log.address.toLowerCase() === NPM.toLowerCase() && log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
        // Transfer(address,address,uint256) — third indexed topic = tokenId
        if (log.topics[3]) lpTokenId = BigInt(log.topics[3]);
      }
    }
    console.log("[eth-create-token-v3] LP tokenId:", lpTokenId.toString());

    // ---- 6. Optional dev buy ----
    let devBuyTxHash: string | null = null;
    if (body.devBuyEth && body.devBuyEth > 0) {
      try {
        const devBuyWei = parseEther(String(body.devBuyEth));
        console.log(`[eth-create-token-v3] dev buy ${body.devBuyEth} ETH → creator ${creatorWallet}`);
        devBuyTxHash = await wallet.writeContract({
          address: SWAP_ROUTER, abi: SWAP_ROUTER_ABI, functionName: "exactInputSingle",
          args: [{
            tokenIn: WETH as Address, tokenOut: tokenAddress as Address, fee: FEE_TIER,
            recipient: creatorWallet, deadline,
            amountIn: devBuyWei, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n,
          }] as any,
          value: devBuyWei,
        });
        await pub.waitForTransactionReceipt({ hash: devBuyTxHash as `0x${string}` });
      } catch (e) {
        console.error("[eth-create-token-v3] dev buy failed:", e);
        devBuyTxHash = null;
      }
    }

    // ---- 7. Persist DB rows ----
    await supabase.from("eth_lp_positions").insert({
      token_address: tokenAddress.toLowerCase(),
      pool_address: poolAddr.toLowerCase(),
      lp_token_id: lpTokenId.toString(),
      creator_wallet: creatorWallet.toLowerCase(),
      platform_owner: lpHolder.toLowerCase(),
      fee_tier: FEE_TIER,
      tick_lower: tickLower,
      tick_upper: tickUpper,
      sqrt_price_x96: sqrtPriceX96.toString(),
      chain_id: 1,
    });
    await supabase.from("eth_creator_fee_ledger").insert({
      token_address: tokenAddress.toLowerCase(),
      creator_wallet: creatorWallet.toLowerCase(),
      lp_token_id: lpTokenId.toString(),
      chain_id: 1,
    });

    if (launchId) {
      await supabase.from("eth_launch_requests").update({
        status: "live", deploy_tx_hash: deployHash, token_address: tokenAddress,
      }).eq("id", launchId);
    }

    return new Response(JSON.stringify({
      success: true,
      launchId,
      tokenAddress,
      poolAddress: poolAddr,
      lpTokenId: lpTokenId.toString(),
      deployTxHash: deployHash,
      mintTxHash: mintHash,
      devBuyTxHash,
      feeTier: FEE_TIER,
      platformOwner: lpHolder,
      creatorWallet,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[eth-create-token-v3] error", err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
