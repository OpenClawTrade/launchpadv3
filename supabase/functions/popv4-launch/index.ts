// PopShiba V4 — one-token launch deployer.
// Flow:
//   1. POST { name, symbol, creator } → server
//   2. Server calls popv4-mine-salt with factory address + initCodeHash to find a salt
//      whose CREATE2 hook address has the required permission bits (0x2A88).
//   3. Server calls factory.launch(name, symbol, salt, sqrtPriceX96) on mainnet.
//   4. Token + Hook + V4 Pool are created in one tx.
//   5. Row inserted into bonding_tokens (network='mainnet-v4').
//
// Required env: ETH_MAINNET_DEPLOYER_PRIVATE_KEY, ETH_MAINNET_RPC_URL,
//   POP_V4_FACTORY_ADDRESS (set after one-time factory deploy).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  createPublicClient, createWalletClient, http, encodeAbiParameters,
  encodeFunctionData, keccak256, parseAbi,
} from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { mainnet } from "npm:viem@2.21.0/chains";
import HookArtifact from "../../../contracts/popshiba/v4/artifacts/PopBondingHookV4.json" with { type: "json" };
import FactoryArtifact from "../../../contracts/popshiba/v4/artifacts/PopBondingFactoryV4.json" with { type: "json" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// √(1.06 ETH / 1.073B tokens) * 2^96 ≈ initial sqrtPriceX96 for the V4 pool.
// For currency0=ETH (0x0), price = token1/token0 = tokens/eth.
// Pre-graduation it doesn't matter (hook handles all swaps), so we use 1:1.
const INITIAL_SQRT_PRICE_X96 = 79228162514264337593543950336n; // 1<<96

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { name, symbol, creator } = await req.json();
    if (!name || !symbol || !creator) {
      return json({ error: "name, symbol, creator required" }, 400);
    }

    const factory = Deno.env.get("POP_V4_FACTORY_ADDRESS");
    const pk = Deno.env.get("ETH_MAINNET_DEPLOYER_PRIVATE_KEY");
    const rpc = Deno.env.get("ETH_MAINNET_RPC_URL");
    if (!factory) return json({ error: "POP_V4_FACTORY_ADDRESS not set — deploy factory first" }, 503);
    if (!pk || !rpc) return json({ error: "Missing deployer secrets" }, 503);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";

    // 1. Compute hook init-code hash: bytecode || abi.encode(poolManager)
    const POOL_MANAGER = "0x000000000004444c5dc75cB358380D2e3dE08A90"; // Uniswap V4 mainnet
    const hookInitCode = (HookArtifact as any).bytecode.object as string;
    const constructorArgs = encodeAbiParameters([{ type: "address" }], [POOL_MANAGER as `0x${string}`]);
    const fullInit = (hookInitCode.startsWith("0x") ? hookInitCode : `0x${hookInitCode}`) + constructorArgs.slice(2);
    const initCodeHash = keccak256(fullInit as `0x${string}`);

    // 2. Mine salt via popv4-mine-salt edge function
    const mineRes = await fetch(`${supabaseUrl}/functions/v1/popv4-mine-salt`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ factory, initCodeHash }),
    });
    if (!mineRes.ok) {
      const t = await mineRes.text();
      return json({ error: "salt mining failed", detail: t }, 502);
    }
    const { salt, hookAddress, iterations } = await mineRes.json();
    console.log(`[popv4-launch] salt found in ${iterations} iters → hook ${hookAddress}`);

    // 3. Call factory.launch(name, symbol, salt, sqrtPriceX96)
    const cleanedPk = pk.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "").replace(/^0x/i, "");
    const account = privateKeyToAccount(`0x${cleanedPk}` as `0x${string}`);
    const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
    const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpc) });

    const launchAbi = parseAbi([
      "function launch(string name, string symbol, bytes32 salt, uint160 sqrtPriceX96) returns (address token, address hook)",
      "event Launched(address indexed token, address indexed hook, address indexed creator, bytes32 salt)",
    ]);
    const data = encodeFunctionData({
      abi: launchAbi,
      functionName: "launch",
      args: [name, symbol, salt as `0x${string}`, INITIAL_SQRT_PRICE_X96],
    });
    const hash = await walletClient.sendTransaction({ to: factory as `0x${string}`, data });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Parse Launched event for actual addresses
    const launched = receipt.logs.find((l) => l.topics[0] === keccak256(new TextEncoder().encode("Launched(address,address,address,bytes32)")));
    const tokenAddr = launched ? `0x${launched.topics[1]?.slice(26)}` : "";
    const hookAddr = launched ? `0x${launched.topics[2]?.slice(26)}` : hookAddress;

    // 4. Insert into bonding_tokens
    const { data: row, error } = await supabase.from("bonding_tokens").insert({
      name,
      symbol,
      token_address: tokenAddr,
      curve_address: hookAddr, // hook plays the role of the curve in V4
      creator_address: creator,
      salt: salt,
      tx_hash: hash,
      block_number: Number(receipt.blockNumber),
    }).select().single();
    if (error) console.error("[popv4-launch] DB insert failed:", error);

    return json({
      success: true,
      token: tokenAddr,
      hook: hookAddr,
      txHash: hash,
      saltIterations: iterations,
      row,
    });
  } catch (e) {
    console.error("[popv4-launch] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
