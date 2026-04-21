// ============================================================================
// eth-collect-fees
//
// Loops all eth_lp_positions, calls NonfungiblePositionManager.collect() on
// each NFT. Splits collected WETH/token 50/50 between creator (accrued in
// eth_creator_fee_ledger as `creator_share_*`) and platform (kept in deployer).
//
// Triggers:
//   - Cron (every ~6h) — POST {} (no body)
//   - Manual single-token — POST { tokenAddress: "0x..." }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient, createWalletClient, http, parseAbi, getAddress, type Address,
} from "https://esm.sh/viem@2.45.1";
import { mainnet } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const MAX_UINT128 = (1n << 128n) - 1n;

const NPM_ABI = parseAbi([
  "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) payable returns (uint256 amount0, uint256 amount1)",
  "function positions(uint256 tokenId) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const targetToken: string | undefined = body?.tokenAddress;

    // The LP NFT is owned by 0x8F70…6906, so collect() must be signed by that key.
    const PK = Deno.env.get("ETH_LP_HOLDER_PRIVATE_KEY");
    if (!PK) throw new Error("Missing ETH_LP_HOLDER_PRIVATE_KEY (LP NFT holder)");
    const RPC = Deno.env.get("ETH_MAINNET_RPC_URL") || "https://eth.llamarpc.com";
    const account = privateKeyToAccount(PK.startsWith("0x") ? PK as `0x${string}` : `0x${PK}` as `0x${string}`);
    const wallet = createWalletClient({ account, chain: mainnet, transport: http(RPC) });
    const pub = createPublicClient({ chain: mainnet, transport: http(RPC) });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let q = supabase.from("eth_lp_positions").select("*").eq("chain_id", 1);
    if (targetToken) q = q.eq("token_address", targetToken.toLowerCase());
    const { data: positions, error } = await q;
    if (error) throw error;
    if (!positions || positions.length === 0) {
      return new Response(JSON.stringify({ success: true, collected: 0, message: "No positions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    for (const pos of positions) {
      try {
        const tokenId = BigInt(pos.lp_token_id);
        // Read positions to know token0/token1.
        // NOTE: tokensOwed0/1 are STALE — they only reflect fees that were
        // already checkpointed by a prior mint/burn/collect. Active swap fees
        // live in feeGrowthGlobal until collect() is called. So we cannot
        // skip on tokensOwed === 0 — we must simulate the collect to know the
        // true claimable amount.
        const info = await pub.readContract({
          address: NPM, abi: NPM_ABI, functionName: "positions", args: [tokenId],
        }) as any;
        const token0 = (info[2] as string).toLowerCase();
        const token1 = (info[3] as string).toLowerCase();

        const collectArgs = [{
          tokenId,
          recipient: account.address as Address,
          amount0Max: MAX_UINT128,
          amount1Max: MAX_UINT128,
        }] as const;

        // Simulate first to get the actual returned amounts (this triggers
        // the pool's fee-growth update inside the simulation).
        const sim = await pub.simulateContract({
          account,
          address: NPM,
          abi: NPM_ABI,
          functionName: "collect",
          args: collectArgs as any,
        });
        const [simAmount0, simAmount1] = sim.result as unknown as [bigint, bigint];

        if (simAmount0 === 0n && simAmount1 === 0n) {
          results.push({ tokenAddress: pos.token_address, skipped: true, reason: "no fees owed" });
          continue;
        }

        const collectHash = await wallet.writeContract({
          address: NPM, abi: NPM_ABI, functionName: "collect",
          args: collectArgs as any,
        });
        await pub.waitForTransactionReceipt({ hash: collectHash });

        // Determine which side is WETH and which is the token
        const wethIs0 = token0 === WETH.toLowerCase();
        const collectedWeth = wethIs0 ? simAmount0 : simAmount1;
        const collectedToken = wethIs0 ? simAmount1 : simAmount0;
        const creatorShareWeth = collectedWeth / 2n;
        const creatorShareToken = collectedToken / 2n;

        // Fetch current ledger row, accumulate
        const { data: ledger } = await supabase
          .from("eth_creator_fee_ledger")
          .select("*").eq("token_address", pos.token_address).single();

        await supabase.from("eth_creator_fee_ledger").upsert({
          token_address: pos.token_address,
          creator_wallet: pos.creator_wallet,
          lp_token_id: pos.lp_token_id,
          total_collected_weth: ((ledger?.total_collected_weth ? BigInt(ledger.total_collected_weth) : 0n) + collectedWeth).toString(),
          total_collected_token: ((ledger?.total_collected_token ? BigInt(ledger.total_collected_token) : 0n) + collectedToken).toString(),
          creator_share_weth: ((ledger?.creator_share_weth ? BigInt(ledger.creator_share_weth) : 0n) + creatorShareWeth).toString(),
          creator_share_token: ((ledger?.creator_share_token ? BigInt(ledger.creator_share_token) : 0n) + creatorShareToken).toString(),
          last_collect_at: new Date().toISOString(),
          chain_id: 1,
        }, { onConflict: "token_address" });

        results.push({
          tokenAddress: pos.token_address,
          collectHash,
          collectedWeth: collectedWeth.toString(),
          collectedToken: collectedToken.toString(),
          creatorShareWeth: creatorShareWeth.toString(),
        });
      } catch (e) {
        console.error("[eth-collect-fees] failed for", pos.token_address, e);
        results.push({ tokenAddress: pos.token_address, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, collected: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[eth-collect-fees] error", err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
