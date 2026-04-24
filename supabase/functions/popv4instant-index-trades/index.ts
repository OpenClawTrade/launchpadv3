// PopShiba V4-Klik — index Klik factory + token events.
//
// Klik (and our PopKlik fork) emits these events that we care about:
//   Factory.ERC20TokenCreated(address tokenAddress)
//     → new token row in popv4instant_tokens
//   Factory.TokenPurchased(address buyer, address tokenOut, uint256 ethSpent, uint256 tokensReceived)
//     → atomic dev-buy at launch (recorded as event_type='dev_buy' in fees ledger,
//       reusing existing schema)
//   Token.FeesReceived(uint256 amount)
//     → 1% trading fee accrued to the token contract; the hook in Klik routes ETH
//       directly into the token's receive() then it pings FeesReceived. We record
//       these into popv4instant_fees_ledger as event_type='accrued'.
//
// Stateless poll. Uses (tx_hash, log_index) UNIQUE for dedupe on fees, and
// UNIQUE(token_address) for tokens. Cron every minute.
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

const ERC20_TOKEN_CREATED = parseAbiItem(
  "event ERC20TokenCreated(address tokenAddress)",
);
const TOKEN_PURCHASED = parseAbiItem(
  "event TokenPurchased(address buyer, address tokenOut, uint256 ethSpent, uint256 tokensReceived)",
);
const FEES_RECEIVED = parseAbiItem(
  "event FeesReceived(uint256 amount)",
);

const LOOKBACK_BLOCKS = 5_000n; // ~16h on mainnet — plenty for a 1-min cron

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const rpc = Deno.env.get("ETH_MAINNET_RPC_URL");
    if (!rpc) return json({ error: "ETH_MAINNET_RPC_URL not set" }, 503);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: dep } = await supabase
      .from("popv4instant_deployments")
      .select("factory_address, hook_address")
      .eq("network", "ethereum")
      .eq("is_active", true)
      .maybeSingle();
    if (!dep) return json({ error: "No active deployment to index" }, 503);

    const factory = getAddress(dep.factory_address) as `0x${string}`;

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
    const lastIndexed = BigInt(
      Math.max(latestToken?.block_number ?? 0, latestFee?.block_number ?? 0),
    );
    const fromBlock = lastIndexed > 0n
      ? (lastIndexed > 25n ? lastIndexed - 25n : 0n)
      : (head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n);

    let createdCount = 0, purchasedCount = 0, feeCount = 0;
    const knownTokens = new Set<string>();

    // 1. ERC20TokenCreated (factory) → new tokens
    const createdLogs = await client.getLogs({
      address: factory,
      event: ERC20_TOKEN_CREATED,
      fromBlock,
      toBlock: head,
    });
    for (const log of createdLogs) {
      const ev = decodeEventLog({
        abi: [ERC20_TOKEN_CREATED],
        data: log.data,
        topics: log.topics,
      });
      const tokenAddr = getAddress((ev.args as any).tokenAddress).toLowerCase();
      knownTokens.add(tokenAddr);
      const { error } = await supabase.from("popv4instant_tokens").upsert({
        token_address: tokenAddr,
        pool_id: "", // filled in by launch metadata flow
        creator_wallet: "", // captured from TokenPurchased.buyer below
        name: "(pending metadata)",
        symbol: "(pending)",
        initial_buy_eth: 0,
        tokens_to_creator: 0,
        sqrt_price_x96: "0",
        tick_lower: 0,
        tick_upper: 0,
        launch_tx_hash: log.transactionHash,
        block_number: Number(log.blockNumber),
      }, { onConflict: "token_address", ignoreDuplicates: true });
      if (!error) createdCount++;
    }

    // 2. TokenPurchased (factory) → atomic dev buy at launch.
    // We use this to backfill creator_wallet + initial_buy_eth on the token row.
    const purchasedLogs = await client.getLogs({
      address: factory,
      event: TOKEN_PURCHASED,
      fromBlock,
      toBlock: head,
    });
    for (const log of purchasedLogs) {
      const ev = decodeEventLog({
        abi: [TOKEN_PURCHASED],
        data: log.data,
        topics: log.topics,
      });
      const a = ev.args as any;
      const tokenAddr = getAddress(a.tokenOut).toLowerCase();
      const buyer = getAddress(a.buyer).toLowerCase();
      const ethSpent = Number(formatEther(a.ethSpent));
      const tokensReceived = Number(formatEther(a.tokensReceived));

      // Backfill creator on the token row (only if still empty).
      await supabase
        .from("popv4instant_tokens")
        .update({
          creator_wallet: buyer,
          initial_buy_eth: ethSpent,
          tokens_to_creator: tokensReceived,
        })
        .eq("token_address", tokenAddr)
        .or("creator_wallet.eq.,creator_wallet.is.null");

      // Also log it in the fees ledger as a "dev_buy" event for the trade feed.
      const { error } = await supabase.from("popv4instant_fees_ledger").upsert({
        token_address: tokenAddr,
        event_type: "dev_buy",
        fee_in_eth: true,
        eth_amount: ethSpent,
        token_amount: tokensReceived,
        recipient: buyer,
        tx_hash: log.transactionHash,
        block_number: Number(log.blockNumber),
        log_index: Number(log.logIndex),
      }, { onConflict: "tx_hash,log_index", ignoreDuplicates: true });
      if (!error) purchasedCount++;
    }

    // 3. FeesReceived (per-token) → 1% trading fees accruing to each token contract.
    // We only know the token addresses we have indexed (from popv4instant_tokens).
    // Pull the full known list to build the address filter.
    const { data: tokenRows } = await supabase
      .from("popv4instant_tokens")
      .select("token_address");
    const tokenAddrs = (tokenRows ?? []).map((r) =>
      getAddress(r.token_address) as `0x${string}`
    );
    if (tokenAddrs.length > 0) {
      const feeLogs = await client.getLogs({
        address: tokenAddrs,
        event: FEES_RECEIVED,
        fromBlock,
        toBlock: head,
      });
      for (const log of feeLogs) {
        const ev = decodeEventLog({
          abi: [FEES_RECEIVED],
          data: log.data,
          topics: log.topics,
        });
        const amount = Number(formatEther((ev.args as any).amount));
        const { error } = await supabase.from("popv4instant_fees_ledger").upsert({
          token_address: getAddress(log.address).toLowerCase(),
          event_type: "accrued",
          fee_in_eth: true,
          total_fee: amount,
          // PopShiba override: 50/50 split between creator and treasury.
          creator_share: amount / 2,
          treasury_share: amount / 2,
          tx_hash: log.transactionHash,
          block_number: Number(log.blockNumber),
          log_index: Number(log.logIndex),
        }, { onConflict: "tx_hash,log_index", ignoreDuplicates: true });
        if (!error) feeCount++;
      }
    }

    return json({
      success: true,
      fromBlock: Number(fromBlock),
      toBlock: Number(head),
      indexed: {
        erc20Created: createdCount,
        tokenPurchased: purchasedCount,
        feesReceived: feeCount,
      },
    });
  } catch (e) {
    console.error("[popv4instant-index-trades] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
