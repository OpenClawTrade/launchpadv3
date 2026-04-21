// ============================================================================
// eth-claim-platform-fees
//
// Admin one-click sweep for the platform's share of LP fees on every PopShiba
// V3 LP held by the LP-holder wallet (0x8F70…6906).
//
// For each row in eth_lp_positions:
//   1. Read positions(tokenId) to get tokensOwed0/1.
//   2. Call NPM.collect() → fees land in LP-holder wallet as WETH + token.
//   3. Update eth_creator_fee_ledger (creator gets 50%, accumulating).
//   4. Compute platform unpaid share for this token:
//        plat_weth_owed  = total_collected_weth  - creator_share_weth  - platform_paid_weth
//        plat_token_owed = total_collected_token - creator_share_token - platform_paid_token
//   5. Sweep platform_token share via ERC20.transfer to MAIN_WALLET.
//
// After the per-token loop, unwrap the LP-holder's full WETH balance MINUS the
// total outstanding creator_share_weth (so creators can still claim) and send
// the resulting ETH to MAIN_WALLET in one transfer.
//
// Body: {} | { tokenAddress?: "0x..." }   (optional single-token override)
// Headers: { "x-admin-secret": TWITTER_BOT_ADMIN_SECRET }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient, createWalletClient, http, parseAbi, getAddress, type Address,
} from "https://esm.sh/viem@2.45.1";
import { mainnet } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAIN_WALLET = "0x9FD5f2E480F43320E8F65072A739c941cb5b10B0" as Address;
const NPM  = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const MAX_UINT128 = (1n << 128n) - 1n;

const NPM_ABI = parseAbi([
  "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) payable returns (uint256 amount0, uint256 amount1)",
  "function positions(uint256 tokenId) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)",
]);

const WETH_ABI = parseAbi([
  "function withdraw(uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 value) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const adminSecret = req.headers.get("x-admin-secret");
    const expected = Deno.env.get("TWITTER_BOT_ADMIN_SECRET");
    if (!expected || adminSecret !== expected) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetToken: string | undefined = body?.tokenAddress?.toLowerCase?.();

    const PK = Deno.env.get("ETH_LP_HOLDER_PRIVATE_KEY");
    if (!PK) throw new Error("Missing ETH_LP_HOLDER_PRIVATE_KEY");
    const RPC = Deno.env.get("ETH_MAINNET_RPC_URL") || "https://eth.llamarpc.com";
    const account = privateKeyToAccount(PK.startsWith("0x") ? PK as `0x${string}` : `0x${PK}` as `0x${string}`);
    const wallet = createWalletClient({ account, chain: mainnet, transport: http(RPC) });
    const pub = createPublicClient({ chain: mainnet, transport: http(RPC) });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let q = supabase.from("eth_lp_positions").select("*").eq("chain_id", 1);
    if (targetToken) q = q.eq("token_address", targetToken);
    const { data: positions, error } = await q;
    if (error) throw error;
    if (!positions?.length) {
      return new Response(JSON.stringify({ success: true, message: "No positions to collect", results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const pos of positions) {
      const r: any = { tokenAddress: pos.token_address };
      try {
        const tokenId = BigInt(pos.lp_token_id);
        const info = await pub.readContract({
          address: NPM, abi: NPM_ABI, functionName: "positions", args: [tokenId],
        }) as any;
        const token0 = (info[2] as string).toLowerCase();
        const tokensOwed0 = info[10] as bigint;
        const tokensOwed1 = info[11] as bigint;

        let collectedWeth = 0n;
        let collectedToken = 0n;

        if (tokensOwed0 > 0n || tokensOwed1 > 0n) {
          const collectHash = await wallet.writeContract({
            address: NPM, abi: NPM_ABI, functionName: "collect",
            args: [{ tokenId, recipient: account.address as Address, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }] as any,
          });
          await pub.waitForTransactionReceipt({ hash: collectHash });
          const wethIs0 = token0 === WETH.toLowerCase();
          collectedWeth = wethIs0 ? tokensOwed0 : tokensOwed1;
          collectedToken = wethIs0 ? tokensOwed1 : tokensOwed0;
          r.collectHash = collectHash;
        } else {
          r.skipped = "no fees owed";
        }

        // Update ledger (50/50 between creator and platform)
        const creatorShareWeth = collectedWeth / 2n;
        const creatorShareToken = collectedToken / 2n;
        const { data: ledger } = await supabase
          .from("eth_creator_fee_ledger")
          .select("*").eq("token_address", pos.token_address).single();

        const totalWeth   = (ledger?.total_collected_weth   ? BigInt(ledger.total_collected_weth)   : 0n) + collectedWeth;
        const totalToken  = (ledger?.total_collected_token  ? BigInt(ledger.total_collected_token)  : 0n) + collectedToken;
        const cShareWeth  = (ledger?.creator_share_weth     ? BigInt(ledger.creator_share_weth)     : 0n) + creatorShareWeth;
        const cShareToken = (ledger?.creator_share_token    ? BigInt(ledger.creator_share_token)    : 0n) + creatorShareToken;
        const platPaidWeth  = ledger?.platform_paid_weth   ? BigInt(ledger.platform_paid_weth)   : 0n;
        const platPaidToken = ledger?.platform_paid_token  ? BigInt(ledger.platform_paid_token)  : 0n;

        // Platform's not-yet-paid token share for this token
        const platTokenOwed = totalToken > (cShareToken + platPaidToken)
          ? totalToken - cShareToken - platPaidToken
          : 0n;

        // Send platform's token share for this token
        let tokenSweepHash: string | undefined;
        if (platTokenOwed > 0n) {
          const tokenAddr = getAddress(pos.token_address) as Address;
          // Cap by actual balance (in case earlier sweeps already happened off-ledger)
          const bal = await pub.readContract({
            address: tokenAddr, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address],
          }) as bigint;
          const toSend = bal < platTokenOwed ? bal : platTokenOwed;
          if (toSend > 0n) {
            tokenSweepHash = await wallet.writeContract({
              address: tokenAddr, abi: ERC20_ABI, functionName: "transfer", args: [MAIN_WALLET, toSend],
            });
            await pub.waitForTransactionReceipt({ hash: tokenSweepHash as `0x${string}` });
            r.tokenSweepHash = tokenSweepHash;
            r.tokenSent = toSend.toString();
          }
        }

        await supabase.from("eth_creator_fee_ledger").upsert({
          token_address: pos.token_address,
          creator_wallet: pos.creator_wallet,
          lp_token_id: pos.lp_token_id,
          total_collected_weth: totalWeth.toString(),
          total_collected_token: totalToken.toString(),
          creator_share_weth: cShareWeth.toString(),
          creator_share_token: cShareToken.toString(),
          platform_paid_token: (platPaidToken + (tokenSweepHash ? platTokenOwed : 0n)).toString(),
          last_collect_at: new Date().toISOString(),
          chain_id: 1,
        }, { onConflict: "token_address" });

        r.collectedWeth = collectedWeth.toString();
        r.collectedToken = collectedToken.toString();
        r.platformTokenOwed = platTokenOwed.toString();
        results.push(r);
      } catch (e) {
        r.error = e instanceof Error ? e.message : String(e);
        results.push(r);
      }
    }

    // ---- Global ETH sweep ----
    // Compute total outstanding creator_share_weth across ALL ledger rows (so we
    // never sweep money that's earmarked for creators) — query fresh after the
    // per-token loop above.
    const { data: allLedgers } = await supabase
      .from("eth_creator_fee_ledger")
      .select("creator_share_weth, creator_paid_weth")
      .eq("chain_id", 1);

    let creatorReserveWeth = 0n;
    for (const row of allLedgers ?? []) {
      const share = row.creator_share_weth ? BigInt(row.creator_share_weth) : 0n;
      const paid  = row.creator_paid_weth  ? BigInt(row.creator_paid_weth)  : 0n;
      const owed = share > paid ? share - paid : 0n;
      creatorReserveWeth += owed;
    }

    let unwrapHash: string | undefined;
    let ethSweepHash: string | undefined;
    let ethSent = "0";

    const wethBal = await pub.readContract({
      address: WETH, abi: WETH_ABI, functionName: "balanceOf", args: [account.address],
    }) as bigint;
    const sweepable = wethBal > creatorReserveWeth ? wethBal - creatorReserveWeth : 0n;

    if (sweepable > 0n) {
      unwrapHash = await wallet.writeContract({
        address: WETH, abi: WETH_ABI, functionName: "withdraw", args: [sweepable],
      });
      await pub.waitForTransactionReceipt({ hash: unwrapHash as `0x${string}` });

      // Send the unwrapped ETH (minus a small gas buffer) to MAIN_WALLET
      const ethBal = await pub.getBalance({ address: account.address });
      const gasBuffer = 2_000_000n * 30n * 10n ** 9n; // ~0.0006 ETH safety
      const toSend = ethBal > sweepable + gasBuffer ? sweepable : (ethBal > gasBuffer ? ethBal - gasBuffer : 0n);
      if (toSend > 0n) {
        ethSweepHash = await wallet.sendTransaction({ to: MAIN_WALLET, value: toSend });
        await pub.waitForTransactionReceipt({ hash: ethSweepHash as `0x${string}` });
        ethSent = toSend.toString();
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results,
      eth: {
        wethBalanceBefore: wethBal.toString(),
        creatorReserveWeth: creatorReserveWeth.toString(),
        sweepableWeth: sweepable.toString(),
        unwrapHash,
        ethSweepHash,
        ethSent,
        mainWallet: MAIN_WALLET,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[eth-claim-platform-fees] error", err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
