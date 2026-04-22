// ============================================================================
// eth-platform-fees-status
//
// Read-only status endpoint for the admin "Platform Fees" panel.
// Returns, per V3 LP position:
//   - token metadata (address, name, ticker, creator)
//   - uncollectedWeth  : Uniswap V3 fees still sitting in the LP NFT (not yet
//                        pulled into PopShibaFeeVaultV3)
//   - platformOwedWeth : platform's 50% share already inside the vault
//                        (lifetime/2 - platformPaid). This is what the admin
//                        sweep would actually withdraw.
//   - creatorOwedWeth  : creator's 50% share inside the vault (info only —
//                        creators claim themselves via eth-claim-creator-fees)
//   - lifetimeCollectedWeth, totalUnclaimedWeth (uncollected + platformOwed)
//
// All amounts are wei strings. Frontend formats + USD-converts.
//
// Body: {} (no body needed)
// Headers: { "x-admin-secret": TWITTER_BOT_ADMIN_SECRET }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient, http, parseAbi, type Address,
} from "https://esm.sh/viem@2.45.1";
import { mainnet } from "https://esm.sh/viem@2.45.1/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NPM  = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const MAX_UINT128 = (1n << 128n) - 1n;

const NPM_ABI = parseAbi([
  "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) payable returns (uint256 amount0, uint256 amount1)",
  "function positions(uint256 tokenId) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)",
]);

const VAULT_ABI = parseAbi([
  "function lifetimeCollected(address token) view returns (uint256)",
  "function creatorOwed(address token) view returns (uint256)",
  "function creatorPaid(address token) view returns (uint256)",
  "function platformPaid(address token) view returns (uint256)",
  "function tokens(address) view returns (uint256 lpTokenId, address creator, bool registered)",
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

    const RPC = Deno.env.get("ETH_MAINNET_RPC_URL") || "https://eth.llamarpc.com";
    const pub = createPublicClient({ chain: mainnet, transport: http(RPC) });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Active V3 vault
    const { data: deployment } = await supabase
      .from("eth_deployments")
      .select("vault_address")
      .eq("is_active", true)
      .eq("network", "mainnet")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const VAULT = deployment?.vault_address as Address | undefined;

    // All LP positions
    const { data: positions, error } = await supabase
      .from("eth_lp_positions")
      .select("token_address, lp_token_id, creator_wallet")
      .eq("chain_id", 1);
    if (error) throw error;

    const tokenAddrs = (positions ?? []).map((p) => p.token_address.toLowerCase());

    // Pull token metadata in one query
    const { data: tokens } = await supabase
      .from("fun_tokens")
      .select("mint_address, name, symbol")
      .in("mint_address", tokenAddrs);
    const metaByAddr = new Map<string, { name?: string; symbol?: string }>();
    for (const t of tokens ?? []) {
      metaByAddr.set(t.mint_address.toLowerCase(), { name: t.name ?? undefined, symbol: t.symbol ?? undefined });
    }

    const results: any[] = [];
    let totalUncollectedWeth = 0n;
    let totalPlatformOwedWeth = 0n;
    let totalCreatorOwedWeth = 0n;

    for (const pos of positions ?? []) {
      const r: any = {
        tokenAddress: pos.token_address,
        lpTokenId: pos.lp_token_id?.toString?.() ?? String(pos.lp_token_id),
        creatorWallet: pos.creator_wallet,
        meta: metaByAddr.get(pos.token_address.toLowerCase()) ?? null,
      };
      try {
        // Simulate Uniswap collect to get TRUE uncollected fees (tokensOwed
        // on the position struct is stale until collect() runs).
        const tokenId = BigInt(pos.lp_token_id);
        const info = await pub.readContract({
          address: NPM, abi: NPM_ABI, functionName: "positions", args: [tokenId],
        }) as any;
        const token0 = (info[2] as string).toLowerCase();
        const wethIs0 = token0 === WETH.toLowerCase();

        try {
          const sim = await pub.simulateContract({
            account: VAULT ?? "0x0000000000000000000000000000000000000001" as Address,
            address: NPM, abi: NPM_ABI, functionName: "collect",
            args: [{
              tokenId,
              recipient: VAULT ?? "0x0000000000000000000000000000000000000001" as Address,
              amount0Max: MAX_UINT128,
              amount1Max: MAX_UINT128,
            }] as any,
          });
          const [a0, a1] = sim.result as unknown as [bigint, bigint];
          const uncollectedWeth = wethIs0 ? a0 : a1;
          r.uncollectedWeth = uncollectedWeth.toString();
          r.uncollectedToken = (wethIs0 ? a1 : a0).toString();
          totalUncollectedWeth += uncollectedWeth;
        } catch {
          // Sim reverted — almost always means "nothing to collect" or vault
          // isn't the position operator. Treat as zero.
          r.uncollectedWeth = "0";
          r.uncollectedToken = "0";
        }

        // Vault state (only if vault active and registered)
        if (VAULT) {
          try {
            const reg = await pub.readContract({
              address: VAULT, abi: VAULT_ABI, functionName: "tokens",
              args: [pos.token_address as Address],
            }) as readonly [bigint, string, boolean];
            r.registered = reg[2];
            if (reg[2]) {
              const [lifetime, cOwed, cPaid, pPaid] = await Promise.all([
                pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "lifetimeCollected", args: [pos.token_address as Address] }) as Promise<bigint>,
                pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "creatorOwed",       args: [pos.token_address as Address] }) as Promise<bigint>,
                pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "creatorPaid",       args: [pos.token_address as Address] }) as Promise<bigint>,
                pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "platformPaid",      args: [pos.token_address as Address] }) as Promise<bigint>,
              ]);
              const platformShare = lifetime / 2n;
              const creatorShare = lifetime - platformShare;
              const platformOwed = platformShare > pPaid ? platformShare - pPaid : 0n;
              const creatorOwed  = creatorShare  > cPaid ? creatorShare  - cPaid : cOwed; // fallback to view if math drifts

              r.lifetimeCollectedWeth = lifetime.toString();
              r.platformOwedWeth = platformOwed.toString();
              r.platformPaidWeth = pPaid.toString();
              r.creatorOwedWeth  = creatorOwed.toString();
              r.creatorPaidWeth  = cPaid.toString();

              totalPlatformOwedWeth += platformOwed;
              totalCreatorOwedWeth  += creatorOwed;
            }
          } catch (e) {
            r.vaultError = e instanceof Error ? e.message.slice(0, 120) : "vault read failed";
          }
        }

        // Total claimable for the platform on THIS token = vault platformOwed + uncollected/2
        // (because once collect happens, half of uncollected becomes platformOwed)
        const uncollectedWei = BigInt(r.uncollectedWeth ?? "0");
        const platOwedWei    = BigInt(r.platformOwedWeth ?? "0");
        r.totalUnclaimedWeth = (platOwedWei + uncollectedWei / 2n).toString();
      } catch (e) {
        r.error = e instanceof Error ? e.message.slice(0, 200) : "read failed";
      }
      results.push(r);
    }

    // Sort: largest unclaimed first
    results.sort((a, b) => {
      const av = BigInt(a.totalUnclaimedWeth ?? "0");
      const bv = BigInt(b.totalUnclaimedWeth ?? "0");
      return bv > av ? 1 : bv < av ? -1 : 0;
    });

    return new Response(JSON.stringify({
      success: true,
      vaultAddress: VAULT ?? null,
      totals: {
        uncollectedWeth: totalUncollectedWeth.toString(),
        platformOwedWeth: totalPlatformOwedWeth.toString(),
        creatorOwedWeth: totalCreatorOwedWeth.toString(),
        // What the admin sweep would actually deliver to MAIN_WALLET in ETH
        // (uncollected gets split 50/50 on collect, plus existing platformOwed)
        sweepableEth: (totalPlatformOwedWeth + totalUncollectedWeth / 2n).toString(),
      },
      positions: results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[eth-platform-fees-status] error", err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
