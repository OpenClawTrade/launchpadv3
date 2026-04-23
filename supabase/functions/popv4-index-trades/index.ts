// popv4-index-trades — POST { token } indexes Trade + Graduated logs from the
// SINGLETON hook (filtered by indexed `token` topic) into bonding_trades and
// updates the bonding_tokens row's curve state.
//
// In V4 singleton arch we no longer index per-hook — every token's events
// come from the same hook contract, distinguished by the indexed `token`
// argument in the Trade event.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  createPublicClient, http, parseAbi, parseAbiItem, formatEther, getAddress,
  encodeAbiParameters, keccak256, padHex, type Address,
} from "npm:viem@2.21.0";
import { mainnet } from "npm:viem@2.21.0/chains";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRADE_EVENT = parseAbiItem(
  "event Trade(address indexed token, address indexed trader, bool isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 fee, uint256 creatorFee, uint256 protocolFee, uint256 newRealEth, uint256 newRealTokens, uint256 priceAfter, uint256 progressBps, uint256 timestamp)"
);
const GRADUATED_EVENT = parseAbiItem(
  "event Graduated(address indexed token, uint256 ethToLp, uint256 tokensToLp)"
);

const CURVE_VIEW_ABI = parseAbi([
  "function realEthReserves() view returns (uint256)",
  "function realTokenReserves() view returns (uint256)",
  "function graduated() view returns (bool)",
  "function getPrice() view returns (uint256)",
  "function curveProgressBps() view returns (uint256)",
]);

const RPCS = (Deno.env.get("ETH_MAINNET_RPC_URL") ? [Deno.env.get("ETH_MAINNET_RPC_URL")!] : []).concat([
  "https://ethereum-rpc.publicnode.com",
  "https://eth.drpc.org",
  "https://1rpc.io/eth",
]);
const CHUNK = 5_000n;

async function makeClient() {
  for (const url of RPCS) {
    try {
      const c = createPublicClient({ chain: mainnet, transport: http(url) });
      await c.getBlockNumber();
      return c;
    } catch { /* try next */ }
  }
  throw new Error("All RPC endpoints failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { token } = await req.json().catch(() => ({}));
    if (!token || !token.startsWith?.("0x")) {
      return json({ error: "token (address) required" }, 400);
    }

    const hook = Deno.env.get("POP_V4_HOOK_ADDRESS");
    if (!hook) return json({ error: "POP_V4_HOOK_ADDRESS not set" }, 503);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: tokRow, error: tokErr } = await supabase
      .from("bonding_tokens")
      .select("*")
      .eq("token_address", token.toLowerCase())
      .maybeSingle();
    if (tokErr) throw tokErr;
    if (!tokRow) return json({ error: "token not found", token }, 404);

    const tokenAddr = getAddress(token) as Address;
    const hookAddr  = getAddress(hook) as Address;
    const curveAddr = getAddress(tokRow.curve_address) as Address;
    const startBlock = BigInt(tokRow.block_number ?? 0);

    const client = await makeClient();
    const latest = await client.getBlockNumber();
    const tokenTopic = padHex(tokenAddr.toLowerCase() as `0x${string}`, { size: 32 });

    const allTrades: any[] = [];
    let graduatedAt: bigint | null = null;
    for (let from = startBlock; from <= latest; from += CHUNK + 1n) {
      const to = from + CHUNK > latest ? latest : from + CHUNK;
      const [trades, grads] = await Promise.all([
        client.getLogs({
          address: hookAddr, event: TRADE_EVENT,
          args: { token: tokenAddr },
          fromBlock: from, toBlock: to,
        }),
        client.getLogs({
          address: hookAddr, event: GRADUATED_EVENT,
          args: { token: tokenAddr },
          fromBlock: from, toBlock: to,
        }),
      ]);
      allTrades.push(...trades);
      if (grads.length > 0 && graduatedAt === null) graduatedAt = grads[0].blockNumber!;
    }

    const rows = allTrades.map((log) => {
      const a = log.args as any;
      const ethAmount   = a.ethAmount as bigint;
      const tokenAmount = a.tokenAmount as bigint;
      const isBuy       = a.isBuy as boolean;
      const priceEth    = tokenAmount > 0n ? Number(ethAmount) / Number(tokenAmount) : 0;
      return {
        token_address: tokenAddr.toLowerCase(),
        curve_address: curveAddr.toLowerCase(),
        side: isBuy ? "buy" : "sell",
        trader_address: (a.trader as string).toLowerCase(),
        eth_amount:   Number(formatEther(ethAmount)),
        token_amount: Number(formatEther(tokenAmount)),
        price_eth: priceEth,
        tx_hash: log.transactionHash!,
        block_number: Number(log.blockNumber),
        log_index: log.logIndex,
      };
    });
    if (rows.length > 0) {
      await supabase.from("bonding_trades").upsert(rows, {
        onConflict: "tx_hash,log_index", ignoreDuplicates: true,
      });
    }

    // Read live curve state from the per-token clone
    const [realEth, realTokens, isGrad, price, bps] = await Promise.all([
      client.readContract({ address: curveAddr, abi: CURVE_VIEW_ABI, functionName: "realEthReserves" }),
      client.readContract({ address: curveAddr, abi: CURVE_VIEW_ABI, functionName: "realTokenReserves" }),
      client.readContract({ address: curveAddr, abi: CURVE_VIEW_ABI, functionName: "graduated" }),
      client.readContract({ address: curveAddr, abi: CURVE_VIEW_ABI, functionName: "getPrice" }),
      client.readContract({ address: curveAddr, abi: CURVE_VIEW_ABI, functionName: "curveProgressBps" }),
    ]);

    const realEthN    = Number(formatEther(realEth as bigint));
    const realTokensN = Number(formatEther(realTokens as bigint));
    const priceEth    = Number(formatEther(price as bigint));
    const lastTrade   = rows.sort((a, b) => b.block_number - a.block_number)[0];

    await supabase.from("bonding_tokens").update({
      real_eth_reserves: realEthN,
      real_token_reserves: realTokensN,
      progress_bps: Number(bps),
      graduated: !!isGrad,
      graduated_at: graduatedAt ? new Date().toISOString() : tokRow.graduated_at,
      total_trades: (tokRow.total_trades ?? 0) + rows.length,
      last_trade_at: lastTrade ? new Date().toISOString() : tokRow.last_trade_at,
      price_eth: priceEth || tokRow.price_eth,
      updated_at: new Date().toISOString(),
    }).eq("token_address", tokenAddr.toLowerCase());

    return json({
      ok: true,
      newTrades: rows.length,
      total: allTrades.length,
      graduated: !!isGrad,
      graduatedAt: graduatedAt?.toString() ?? null,
      realEth: realEthN, realTokens: realTokensN, progressBps: Number(bps),
    });
  } catch (e) {
    console.error("[popv4-index-trades]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
