// PopShiba V4-Instant — build the claim tx for the creator's wallet.
//
// The creator pays gas; the hook pays out the accrued ETH (+ token side if any).
// We just hand back calldata + the hook address. The on-chain `claimCreator`
// already enforces msg.sender == creatorByToken[token].
//
// Body: { token: address }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeFunctionData, parseAbi, getAddress } from "npm:viem@2.21.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOOK_ABI = parseAbi([
  "function claimCreator(address token)",
  "function creatorEthOwed(address token) view returns (uint256)",
  "function creatorTokenOwed(address token) view returns (uint256)",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { token } = await req.json();
    if (!token) return json({ error: "token required" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: dep, error } = await supabase
      .from("popv4instant_deployments")
      .select("hook_address")
      .eq("network", "ethereum")
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (!dep) return json({ error: "No active deployment" }, 503);

    const data = encodeFunctionData({
      abi: HOOK_ABI,
      functionName: "claimCreator",
      args: [getAddress(token)],
    });

    return json({
      success: true,
      to: getAddress(dep.hook_address),
      data,
      value: "0x0",
    });
  } catch (e) {
    console.error("[popv4instant-claim] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
