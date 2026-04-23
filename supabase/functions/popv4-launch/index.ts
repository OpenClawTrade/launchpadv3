// PopShiba V4 — launch one token via the singleton factory.
//
// Singleton architecture: the hook is already deployed and shared. Each launch
// is a single tx → factory.launch(name, symbol, sqrtPriceX96) which clones
// the token + curve, registers the curve in the singleton hook, and
// initializes the V4 pool. No salt mining per launch.
//
// Body: { name, symbol, creator }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  createPublicClient, createWalletClient, http, encodeFunctionData,
  parseAbi, decodeEventLog, getAddress,
} from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { mainnet } from "npm:viem@2.21.0/chains";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pre-graduation, the hook intercepts every swap so the V4 pool's sqrtPrice
// doesn't matter mathematically. Use 1<<96 (1:1) as a safe initializer.
const INITIAL_SQRT_PRICE_X96 = 79228162514264337593543950336n;

const FACTORY_ABI = parseAbi([
  "function launch(string name, string symbol, uint160 sqrtPriceX96) returns (address token, address curve, bytes32 poolId)",
  "event Launched(address indexed token, address indexed curve, address indexed creator, bytes32 poolId)",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { name, symbol, creator } = await req.json();
    if (!name || !symbol || !creator) return json({ error: "name, symbol, creator required" }, 400);

    const factory = Deno.env.get("POP_V4_FACTORY_ADDRESS");
    const hook    = Deno.env.get("POP_V4_HOOK_ADDRESS");
    const pk      = Deno.env.get("ETH_MAINNET_DEPLOYER_PRIVATE_KEY");
    const rpc     = Deno.env.get("ETH_MAINNET_RPC_URL");
    if (!factory || !hook) return json({ error: "POP_V4_FACTORY_ADDRESS / POP_V4_HOOK_ADDRESS not set — run popv4-deploy-factory first" }, 503);
    if (!pk || !rpc) return json({ error: "Missing deployer secrets" }, 503);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const cleanedPk = pk.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "").replace(/^0x/i, "");
    const account = privateKeyToAccount(`0x${cleanedPk}` as `0x${string}`);
    const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
    const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpc) });

    const data = encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: "launch",
      args: [name, symbol, INITIAL_SQRT_PRICE_X96],
    });
    const hash = await walletClient.sendTransaction({ to: factory as `0x${string}`, data });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Find Launched event
    let tokenAddr = "" as `0x${string}`;
    let curveAddr = "" as `0x${string}`;
    let poolId = "" as `0x${string}`;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== factory.toLowerCase()) continue;
      try {
        const parsed = decodeEventLog({ abi: FACTORY_ABI, data: log.data, topics: log.topics });
        if (parsed.eventName === "Launched") {
          tokenAddr = parsed.args.token as `0x${string}`;
          curveAddr = parsed.args.curve as `0x${string}`;
          poolId    = parsed.args.poolId as `0x${string}`;
          break;
        }
      } catch { /* not our event */ }
    }

    if (!tokenAddr) return json({ error: "Launched event not found in receipt", txHash: hash }, 500);

    // Persist. curve_address column = the per-token CURVE_IMPL clone (NOT the singleton hook).
    const { data: row, error } = await supabase.from("bonding_tokens").insert({
      name, symbol,
      token_address: getAddress(tokenAddr).toLowerCase(),
      curve_address: getAddress(curveAddr).toLowerCase(),
      creator_address: getAddress(creator).toLowerCase(),
      salt: poolId, // store poolId here for V4 — used to address the curve via hook.curveOf(poolId)
      tx_hash: hash,
      block_number: Number(receipt.blockNumber),
    }).select().single();
    if (error) console.error("[popv4-launch] DB insert failed:", error);

    return json({
      success: true,
      token: tokenAddr,
      curve: curveAddr,
      hook,
      poolId,
      txHash: hash,
      blockNumber: Number(receipt.blockNumber),
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
