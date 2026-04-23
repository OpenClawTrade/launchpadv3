// popv4-index-trades — POST { hook } indexes Buy/Sell/Graduated logs from a
// PopBondingHookV4 instance into bonding_trades and updates the
// bonding_tokens row's curve state, market cap, progress, etc.
//
// Designed to be called on-demand by the V4 token detail page.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  createPublicClient, http, parseAbiItem, formatEther, getAddress, type Address,
} from "npm:viem@2.21.0";
import { mainnet } from "npm:viem@2.21.0/chains";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUY_EVENT  = parseAbiItem("event Buy(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 fee, uint256 newRealEth, uint256 newRealTokens)");
const SELL_EVENT = parseAbiItem("event Sell(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 fee, uint256 newRealEth, uint256 newRealTokens)");
const GRADUATED  = parseAbiItem("event Graduated(uint256 ethToLp, uint256 tokensToLp)");

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
    const { hook } = await req.json().catch(() => ({}));
    if (!hook || !hook.startsWith?.("0x")) {
      return new Response(JSON.stringify({ error: "hook required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // We store hook addresses in curve_address for V4 launches.
    const { data: token, error: tokErr } = await supabase
      .from("bonding_tokens")
      .select("*")
      .eq("curve_address", hook.toLowerCase())
      .maybeSingle();
    if (tokErr) throw tokErr;
    if (!token) {
      return new Response(JSON.stringify({ error: "token not found", hook }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const hookAddr = getAddress(hook) as Address;
    const tokenAddr = getAddress(token.token_address) as Address;
    const startBlock = BigInt(token.block_number ?? 0);

    const client = await makeClient();
    const latest = await client.getBlockNumber();

    // Pull all Buy/Sell/Graduated logs in chunks
    const allBuys: any[] = [];
    const allSells: any[] = [];
    let graduatedAt: bigint | null = null;
    for (let from = startBlock; from <= latest; from += CHUNK + 1n) {
      const to = from + CHUNK > latest ? latest : from + CHUNK;
      const [buys, sells, grads] = await Promise.all([
        client.getLogs({ address: hookAddr, event: BUY_EVENT, fromBlock: from, toBlock: to }),
        client.getLogs({ address: hookAddr, event: SELL_EVENT, fromBlock: from, toBlock: to }),
        client.getLogs({ address: hookAddr, event: GRADUATED,  fromBlock: from, toBlock: to }),
      ]);
      allBuys.push(...buys);
      allSells.push(...sells);
      if (grads.length > 0 && graduatedAt === null) graduatedAt = grads[0].blockNumber!;
    }

    // Insert trades
    const rows: any[] = [];
    for (const log of allBuys) {
      const a = log.args as any;
      const ethIn = a.ethIn as bigint;
      const tokensOut = a.tokensOut as bigint;
      const priceEth = tokensOut > 0n ? Number(ethIn) / Number(tokensOut) : 0;
      rows.push({
        token_address: tokenAddr.toLowerCase(),
        curve_address: hookAddr.toLowerCase(),
        side: "buy",
        trader_address: a.buyer.toLowerCase(),
        eth_amount: Number(formatEther(ethIn)),
        token_amount: Number(formatEther(tokensOut)),
        price_eth: priceEth,
        tx_hash: log.transactionHash!,
        block_number: Number(log.blockNumber),
        log_index: log.logIndex,
      });
    }
    for (const log of allSells) {
      const a = log.args as any;
      const tokensIn = a.tokensIn as bigint;
      const ethOut = a.ethOut as bigint;
      const priceEth = tokensIn > 0n ? Number(ethOut) / Number(tokensIn) : 0;
      rows.push({
        token_address: tokenAddr.toLowerCase(),
        curve_address: hookAddr.toLowerCase(),
        side: "sell",
        trader_address: a.seller.toLowerCase(),
        eth_amount: Number(formatEther(ethOut)),
        token_amount: Number(formatEther(tokensIn)),
        price_eth: priceEth,
        tx_hash: log.transactionHash!,
        block_number: Number(log.blockNumber),
        log_index: log.logIndex,
      });
    }
    if (rows.length > 0) {
      // dedupe insert
      await supabase.from("bonding_trades").upsert(rows, {
        onConflict: "tx_hash,log_index", ignoreDuplicates: true,
      });
    }

    // Read current curve state
    const HOOK_ABI = [
      { type: "function", name: "realEthReserves", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
      { type: "function", name: "realTokenReserves", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
      { type: "function", name: "graduated", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
    ] as const;

    const [realEth, realTokens, isGrad] = await Promise.all([
      client.readContract({ address: hookAddr, abi: HOOK_ABI, functionName: "realEthReserves" }),
      client.readContract({ address: hookAddr, abi: HOOK_ABI, functionName: "realTokenReserves" }),
      client.readContract({ address: hookAddr, abi: HOOK_ABI, functionName: "graduated" }),
    ]);

    const realEthN = Number(formatEther(realEth as bigint));
    const realTokensN = Number(formatEther(realTokens as bigint));
    const progressBps = Math.min(10_000, Math.floor((realEthN / 3) * 10_000));
    const lastTrade = rows.sort((a, b) => b.block_number - a.block_number)[0];

    await supabase.from("bonding_tokens").update({
      real_eth_reserves: realEthN,
      real_token_reserves: realTokensN,
      progress_bps: progressBps,
      graduated: !!isGrad,
      graduated_at: graduatedAt ? new Date().toISOString() : token.graduated_at,
      total_trades: (token.total_trades ?? 0) + rows.length,
      last_trade_at: lastTrade ? new Date().toISOString() : token.last_trade_at,
      price_eth: lastTrade?.price_eth ?? token.price_eth,
      updated_at: new Date().toISOString(),
    }).eq("curve_address", hookAddr.toLowerCase());

    return new Response(JSON.stringify({
      ok: true,
      newTrades: rows.length,
      buys: allBuys.length, sells: allSells.length,
      graduated: !!isGrad, graduatedAt: graduatedAt?.toString() ?? null,
      realEth: realEthN, realTokens: realTokensN, progressBps,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[popv4-index-trades]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
