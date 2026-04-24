// PopShiba V4-Instant — poll Launched + FeeAccrued + claim events.
//
// Stateless poll (no cursor table) — we use a "from block = max(known) - 50"
// strategy and dedupe via the (tx_hash, log_index) UNIQUE constraint on
// popv4instant_fees_ledger and the UNIQUE token_address on popv4instant_tokens.
//
// Trigger via cron (every minute) or manual GET.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  createPublicClient, http, parseAbiItem, decodeEventLog, getAddress, formatEther,
} from "npm:viem@2.21.0";
import { mainnet } from "npm:viem@2.21.0/chains";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LAUNCHED = parseAbiItem(
  "event Launched(address indexed token, address indexed creator, bytes32 poolId, uint256 initialBuyEth, uint256 tokensToCreator, uint160 sqrtPriceX96)",
);
const FEE_ACCRUED = parseAbiItem(
  "event FeeAccrued(address indexed token, bool feeInEth, uint256 totalFee, uint256 creatorShare, uint256 treasuryShare)",
);
const CREATOR_CLAIMED = parseAbiItem(
  "event CreatorClaimed(address indexed token, address indexed creator, uint256 ethAmount, uint256 tokenAmount)",
);
const TREASURY_CLAIMED = parseAbiItem(
  "event TreasuryClaimed(address indexed token, address indexed treasury, uint256 ethAmount, uint256 tokenAmount)",
);

const LOOKBACK_BLOCKS = 5_000n; // ~16h on mainnet — plenty for a 1-min cron

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const rpc = Deno.env.get("ETH_MAINNET_RPC_URL");
    if (!rpc) return json({ error: "ETH_MAINNET_RPC_URL not set" }, 503);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: dep } = await supabase
      .from("popv4instant_deployments")
      .select("factory_address, hook_address")
      .eq("network", "ethereum")
      .eq("is_active", true)
      .maybeSingle();
    if (!dep) return json({ error: "No active deployment to index" }, 503);

    const factory = getAddress(dep.factory_address) as `0x${string}`;
    const hook = getAddress(dep.hook_address) as `0x${string}`;

    const client = createPublicClient({ chain: mainnet, transport: http(rpc) });
    const head = await client.getBlockNumber();

    // Determine fromBlock = max(latest indexed) - tiny overlap, else head-LOOKBACK
    const { data: latestToken } = await supabase
      .from("popv4instant_tokens")
      .select("block_number")
      .order("block_number", { ascending: false }).limit(1).maybeSingle();
    const { data: latestFee } = await supabase
      .from("popv4instant_fees_ledger")
      .select("block_number")
      .order("block_number", { ascending: false }).limit(1).maybeSingle();
    const lastIndexed = BigInt(Math.max(latestToken?.block_number ?? 0, latestFee?.block_number ?? 0));
    const fromBlock = lastIndexed > 0n
      ? (lastIndexed > 25n ? lastIndexed - 25n : 0n)
      : (head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n);

    let launchedCount = 0, feeCount = 0, claimCount = 0;

    // 1. Launched (factory)
    const launchedLogs = await client.getLogs({ address: factory, event: LAUNCHED, fromBlock, toBlock: head });
    for (const log of launchedLogs) {
      const ev = decodeEventLog({ abi: [LAUNCHED], data: log.data, topics: log.topics });
      const a = ev.args as any;
      const { error } = await supabase.from("popv4instant_tokens").upsert({
        token_address: getAddress(a.token).toLowerCase(),
        pool_id: a.poolId,
        creator_wallet: getAddress(a.creator).toLowerCase(),
        name: "(pending metadata)", // populated by launch caller post-hoc
        symbol: "(pending)",
        initial_buy_eth: Number(formatEther(a.initialBuyEth)),
        tokens_to_creator: Number(formatEther(a.tokensToCreator)),
        sqrt_price_x96: a.sqrtPriceX96.toString(),
        tick_lower: 0, tick_upper: 0,
        launch_tx_hash: log.transactionHash,
        block_number: Number(log.blockNumber),
      }, { onConflict: "token_address", ignoreDuplicates: true });
      if (!error) launchedCount++;
    }

    // 2. FeeAccrued (hook)
    const feeLogs = await client.getLogs({ address: hook, event: FEE_ACCRUED, fromBlock, toBlock: head });
    for (const log of feeLogs) {
      const ev = decodeEventLog({ abi: [FEE_ACCRUED], data: log.data, topics: log.topics });
      const a = ev.args as any;
      const { error } = await supabase.from("popv4instant_fees_ledger").upsert({
        token_address: getAddress(a.token).toLowerCase(),
        event_type: "accrued",
        fee_in_eth: a.feeInEth,
        total_fee: Number(formatEther(a.totalFee)),
        creator_share: Number(formatEther(a.creatorShare)),
        treasury_share: Number(formatEther(a.treasuryShare)),
        tx_hash: log.transactionHash,
        block_number: Number(log.blockNumber),
        log_index: Number(log.logIndex),
      }, { onConflict: "tx_hash,log_index", ignoreDuplicates: true });
      if (!error) feeCount++;
    }

    // 3. CreatorClaimed + TreasuryClaimed (hook)
    for (const [event, type] of [[CREATOR_CLAIMED, "creator_claimed"], [TREASURY_CLAIMED, "treasury_claimed"]] as const) {
      const logs = await client.getLogs({ address: hook, event, fromBlock, toBlock: head });
      for (const log of logs) {
        const ev = decodeEventLog({ abi: [event], data: log.data, topics: log.topics });
        const a = ev.args as any;
        const { error } = await supabase.from("popv4instant_fees_ledger").upsert({
          token_address: getAddress(a.token).toLowerCase(),
          event_type: type,
          fee_in_eth: true,
          eth_amount: Number(formatEther(a.ethAmount)),
          token_amount: Number(formatEther(a.tokenAmount)),
          recipient: getAddress(type === "creator_claimed" ? a.creator : a.treasury).toLowerCase(),
          tx_hash: log.transactionHash,
          block_number: Number(log.blockNumber),
          log_index: Number(log.logIndex),
        }, { onConflict: "tx_hash,log_index", ignoreDuplicates: true });
        if (!error) claimCount++;
      }
    }

    return json({
      success: true,
      fromBlock: Number(fromBlock),
      toBlock: Number(head),
      indexed: { launched: launchedCount, feeAccrued: feeCount, claims: claimCount },
    });
  } catch (e) {
    console.error("[popv4instant-index-trades] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
