// PopShiba V4-Klik — build the launch tx for the user's wallet to sign.
//
// Klik flow: factory.deployCoin{value: initialBuyEth}(name, symbol, metadata, salt, configId)
// configId 0 = the canonical Klik liquidity config baked into the factory
// constructor (sqrtPriceX96 / ticks / 1B token amount / 1 ETH virtual amount).
//
// Body: { creator, name, symbol, initialBuyEth, metadata? }
//   - `creator` is informational (the actual creator is msg.sender of the tx)
//   - `metadata` defaults to "" if omitted
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeFunctionData, parseAbi, parseEther, getAddress, keccak256, toHex } from "npm:viem@2.21.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FACTORY_ABI = parseAbi([
  "function deployCoin(string _name, string _symbol, string _metadata, bytes32 salt, uint256 configId) payable returns (uint256 tokensReceived)",
  "event ERC20TokenCreated(address tokenAddress)",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { creator, name, symbol, initialBuyEth, metadata } = await req.json();
    if (!creator || !name || !symbol || initialBuyEth == null) {
      return json({ error: "creator, name, symbol, initialBuyEth required" }, 400);
    }

    const valueWei = parseEther(String(initialBuyEth));

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
    if (!dep) return json({ error: "No active V4-Klik deployment. Run popv4instant-deploy first." }, 503);

    // Random per-launch salt for the CREATE2 token deploy.
    const saltBytes = new Uint8Array(32);
    crypto.getRandomValues(saltBytes);
    const salt = toHex(saltBytes);

    const data = encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: "deployCoin",
      args: [name, symbol, metadata ?? "", salt, 0n],
    });

    return json({
      success: true,
      to: getAddress(dep.factory_address),
      data,
      value: "0x" + valueWei.toString(16),
      valueWei: valueWei.toString(),
      hook: dep.hook_address,
      configId: 0,
      salt,
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
