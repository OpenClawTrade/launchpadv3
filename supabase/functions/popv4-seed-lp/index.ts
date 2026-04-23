// popv4-seed-lp — post-graduation keeper. POST { token } triggers the LP NFT
// mint flow on the V4 PositionManager and locks the resulting NFT in
// PopV4LpLocker. In the singleton architecture, the curve clone exposes
// `seedLockedLP()` which is callable once per token after graduation.
//
// Flow:
//   1. Read curve.graduated() — must be true
//   2. Server signs and sends curve.seedLockedLP() (gas-paid by deployer)
//   3. Curve internally:
//        - approves PositionManager
//        - mints full-range LP NFT to PopV4LpLocker
//        - calls locker.registerLock(poolId, tokenId, curve)
//        - calls token.enableTransfers()
//   4. Mark DB row graduated=true with cleared reserves
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createPublicClient, createWalletClient, http, parseAbi, getAddress } from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { mainnet } from "npm:viem@2.21.0/chains";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CURVE_ABI = parseAbi([
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
    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string" || !token.startsWith("0x")) {
      return json({ error: "token (address) required" }, 400);
    }

    const pk  = Deno.env.get("ETH_MAINNET_DEPLOYER_PRIVATE_KEY");
    const rpc = Deno.env.get("ETH_MAINNET_RPC_URL");
    if (!pk || !rpc) return json({ error: "Missing deployer secrets" }, 503);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tokRow, error: tokErr } = await supabase
      .from("bonding_tokens")
      .select("curve_address, graduated")
      .eq("token_address", token.toLowerCase())
      .maybeSingle();
    if (tokErr) throw tokErr;
    if (!tokRow) return json({ error: "token not found" }, 404);

    const curveAddr = getAddress(tokRow.curve_address) as `0x${string}`;
    const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
    const grad = await publicClient.readContract({
      address: curveAddr, abi: CURVE_ABI, functionName: "graduated",
    });
    if (!grad) return json({ error: "Not graduated yet" }, 409);

    const cleaned = pk.trim().replace(/^["']|["']$/g, "").replace(/^0x/i, "");
    const account = privateKeyToAccount(`0x${cleaned}` as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpc) });

    const hash = await walletClient.writeContract({
      address: curveAddr, abi: CURVE_ABI, functionName: "seedLockedLP",
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    await supabase.from("bonding_tokens").update({
      graduated: true,
      graduated_at: new Date().toISOString(),
      real_eth_reserves: 0,
      real_token_reserves: 0,
    }).eq("token_address", token.toLowerCase());

    return json({ ok: true, txHash: hash, status: receipt.status, blockNumber: Number(receipt.blockNumber) });
  } catch (e) {
    console.error("[popv4-seed-lp]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
