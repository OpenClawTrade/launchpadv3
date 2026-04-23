// popv4-seed-lp — anyone can POST { hook } to trigger seedLockedLP() on a
// graduated PopBondingHookV4. Server signs with the deployer key so end users
// don't pay gas. Idempotent: a second call after success no-ops.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createPublicClient, createWalletClient, http, parseAbi } from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { mainnet } from "npm:viem@2.21.0/chains";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOOK_ABI = parseAbi([
  "function graduated() view returns (bool)",
  "function realEthReserves() view returns (uint256)",
  "function seedLockedLP()",
]);

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { hook } = await req.json().catch(() => ({}));
    if (!hook || typeof hook !== "string" || !hook.startsWith("0x")) {
      return json({ error: "hook (address) required" }, 400);
    }

    const pk = Deno.env.get("ETH_MAINNET_DEPLOYER_PRIVATE_KEY");
    const rpc = Deno.env.get("ETH_MAINNET_RPC_URL");
    if (!pk || !rpc) return json({ error: "Missing deployer secrets" }, 503);

    const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
    const grad = await publicClient.readContract({
      address: hook as `0x${string}`, abi: HOOK_ABI, functionName: "graduated",
    });
    if (!grad) return json({ error: "Not graduated yet" }, 409);

    const cleaned = pk.trim().replace(/^["']|["']$/g, "").replace(/^0x/i, "");
    const account = privateKeyToAccount(`0x${cleaned}` as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpc) });

    const hash = await walletClient.writeContract({
      address: hook as `0x${string}`, abi: HOOK_ABI, functionName: "seedLockedLP",
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Mark graduated in DB
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("bonding_tokens").update({
      graduated: true, graduated_at: new Date().toISOString(), real_eth_reserves: 0,
    }).eq("curve_address", hook.toLowerCase());

    return json({ ok: true, txHash: hash, status: receipt.status, blockNumber: Number(receipt.blockNumber) });
  } catch (e) {
    console.error("[popv4-seed-lp]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
