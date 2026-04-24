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

// Single-sided token-only LP. tickSpacing=200; pool starts at `initialTick`,
// LP placed in [tickLower, tickUpper] STRICTLY BELOW initialTick so the
// position is fully in currency1 (token). Dev buy = zeroForOne (ETH→token)
// moves price DOWN, crossing from initialTick into the LP range and filling
// the order. Critical: tickUpper MUST be < initialTick (not equal), or the
// swap starts already in-range from the wrong side and gets 0 fill.
const TICK_LOWER = -887000;            // price floor (≈ 0)
const TICK_SPACING = 200;
const LP_TOKENS = 1_000_000_000n;       // matches PopInstantFactory.LP_TOKENS / 1e18

// Preset → initialTick. sqrtPriceX96 = sqrtPriceAtTick(initialTick).
// Target FDV (ETH) ≈ 1e9 / price, where price = 1.0001^initialTick.
//   FDV=0.69  → tick≈211072 → 211000
//   FDV=1     → tick≈207243 → 207200
//   FDV=2     → tick≈200312 → 200200
//   FDV=5     → tick≈191150 → 191000
//   FDV=10    → tick≈184219 → 184200
function presetParams(targetMcapEth: number): { sqrtPriceX96: bigint; initialTick: number } {
  const table: Record<string, { sqrtPriceX96: bigint; initialTick: number }> = {
    "0.69": { sqrtPriceX96: 3016164599597434889666621244321452n, initialTick: 211000 },
    "1":    { sqrtPriceX96: 2505414483750479311864138015696063n, initialTick: 207400 },
    "2":    { sqrtPriceX96: 1771595571142957102961017161607260n, initialTick: 200400 },
    "5":    { sqrtPriceX96: 1120455419495722798374638764549163n, initialTick: 191200 },
    "10":   { sqrtPriceX96:  792281625142643375935439503360000n, initialTick: 184400 },
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

    const { sqrtPriceX96, initialTick } = presetParams(Number(targetMarketCapEth));
    // tickUpper must be < initialTick so position is single-sided in token.
    const tickUpper = initialTick - TICK_SPACING;
    const tickLower = TICK_LOWER;

    const data = encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: "launch",
      args: [{
        name,
        symbol,
        sqrtPriceX96,
        tickLower,
        tickUpper,
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
      initialTick,
      tickLower,
      tickUpper,
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
