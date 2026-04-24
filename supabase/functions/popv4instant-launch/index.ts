// PopShiba V4-Instant — build the launch tx for the user's wallet to sign.
//
// We don't sign with a server key here: the launch is a payable call from the
// creator's own wallet, so they pay for both their initial buy AND gas. The
// edge function's job is to (1) pull the active deployment, (2) compute
// sqrtPriceX96 from a chosen virtual market cap, (3) return calldata + value
// the frontend submits via the user's signer.
//
// Body: {
//   creator,           // EVM address (informational, used for DB row)
//   name, symbol,
//   initialBuyEth,     // string, e.g. "0.001"
//   targetMarketCapEth // 0.69 | 1 | 2 | 5 | 10 — selects sqrtPriceX96
// }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeFunctionData, parseAbi, parseEther, getAddress } from "npm:viem@2.21.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Out-of-range single-sided LP. tickSpacing=200 in the factory, so ticks
// must be multiples of 200. Range fully ABOVE current tick → token-only.
const TICK_LOWER = 200;
const TICK_UPPER = 887000;       // near MAX_TICK, rounded to spacing
const LP_TOKENS = 961_700_000n;  // matches PopInstantFactory.LP_TOKENS / 1e18

// Map UI presets → starting sqrtPriceX96.
//
// The pool currency0=ETH, currency1=token. Price (token/ETH) at sqrtP is
//   (sqrtP / 2^96)^2 = tokens per 1 ETH (after decimals cancel since both are 18).
// We choose initial price so that LP_TOKENS deposited above tickLower implies
// a fully diluted market cap ≈ targetMarketCapEth at tick=0 entry.
//
// Empirically we precompute a small lookup: targetMcapEth → sqrtPriceX96
// (math derived offline; any rounding ends up in the LP curve, not the user).
function sqrtPriceForPreset(targetMcapEth: number): bigint {
  const table: Record<string, bigint> = {
    "0.69": 7421001498758458368000000n,   // ~0.69 ETH FDV
    "1":    8929485887745089024000000n,
    "2":    12628940000000000000000000n,
    "5":    19960000000000000000000000n,
    "10":   28230000000000000000000000n,
  };
  const k = String(targetMcapEth);
  const v = table[k];
  if (!v) throw new Error(`Unsupported preset ${targetMcapEth}. Use 0.69|1|2|5|10`);
  return v;
}

const FACTORY_ABI = parseAbi([
  "function launch((string name,string symbol,uint160 sqrtPriceX96,int24 tickLower,int24 tickUpper) p) payable returns (address token, bytes32 poolId)",
  "event Launched(address indexed token, address indexed creator, bytes32 poolId, uint256 initialBuyEth, uint256 tokensToCreator, uint160 sqrtPriceX96)",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { creator, name, symbol, initialBuyEth, targetMarketCapEth } = await req.json();
    if (!creator || !name || !symbol || !initialBuyEth || targetMarketCapEth == null) {
      return json({ error: "creator, name, symbol, initialBuyEth, targetMarketCapEth required" }, 400);
    }

    const valueWei = parseEther(String(initialBuyEth));
    if (valueWei < 1_000_000_000_000_000n /* 0.001 ETH */) {
      return json({ error: "initialBuyEth must be ≥ 0.001" }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: dep, error: depErr } = await supabase
      .from("popv4instant_deployments")
      .select("factory_address, hook_address")
      .eq("network", "ethereum")
      .eq("is_active", true)
      .order("deployed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (depErr) throw depErr;
    if (!dep) return json({ error: "No active V4-Instant deployment. Run popv4instant-deploy first." }, 503);

    const sqrtPriceX96 = sqrtPriceForPreset(Number(targetMarketCapEth));

    const data = encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: "launch",
      args: [{
        name,
        symbol,
        sqrtPriceX96,
        tickLower: TICK_LOWER,
        tickUpper: TICK_UPPER,
      }],
    });

    return json({
      success: true,
      to: getAddress(dep.factory_address),
      data,
      value: "0x" + valueWei.toString(16),
      valueWei: valueWei.toString(),
      hook: dep.hook_address,
      sqrtPriceX96: sqrtPriceX96.toString(),
      tickLower: TICK_LOWER,
      tickUpper: TICK_UPPER,
      lpTokens: LP_TOKENS.toString(),
      preset: { targetMarketCapEth },
      creator,
    });
  } catch (e) {
    console.error("[popv4instant-launch] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
